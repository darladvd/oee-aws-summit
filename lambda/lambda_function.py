import json
import os
import time
import boto3
from botocore.exceptions import ClientError

AWS_REGION = os.getenv("AWS_REGION", "ap-southeast-1")

bedrock = boto3.client("bedrock-runtime", region_name=AWS_REGION)
athena = boto3.client("athena", region_name=AWS_REGION)

MODEL_ID = "arn:aws:bedrock:ap-southeast-1:141922114492:application-inference-profile/toabv9iabntf"

ATHENA_DATABASE = os.getenv("ATHENA_DATABASE")
ATHENA_TABLE = os.getenv("ATHENA_TABLE")
ATHENA_OUTPUT_LOCATION = os.getenv("ATHENA_OUTPUT_LOCATION")
ATHENA_WORKGROUP = os.getenv("ATHENA_WORKGROUP", "primary")
ATHENA_DATE_COLUMN = os.getenv("ATHENA_DATE_COLUMN", "date")
ATHENA_ENTITY_COLUMN = os.getenv("ATHENA_ENTITY_COLUMN", "production_line")
ATHENA_SITE_COLUMN = os.getenv("ATHENA_SITE_COLUMN", "site")
ATHENA_SHIFT_COLUMN = os.getenv("ATHENA_SHIFT_COLUMN", "shift")
ATHENA_PRODUCT_COLUMN = os.getenv("ATHENA_PRODUCT_COLUMN", "product")
ATHENA_KPI_COLUMN_MAP = json.loads(
    os.getenv(
        "ATHENA_KPI_COLUMN_MAP",
        json.dumps({
            "OEE": "oee",
            "Availability": "availability",
            "Efficiency": "efficiency",
            "Quality": "quality"
        })
    )
)
ATHENA_DRIVER_COLUMNS = json.loads(
    os.getenv(
        "ATHENA_DRIVER_COLUMNS",
        json.dumps([
            "break_time_minutes",
            "maintenance_minutes",
            "shift_meeting_minutes",
            "machine_breakdown_minutes",
            "material_shortage_minutes",
            "changeover_time_minutes",
            "defects"
        ])
    )
)
DEMO_DEFAULT_YEAR = "2026"

SYSTEM_PROMPT = """
You are an operations analytics copilot for a manufacturing dashboard.

You support TWO modes:

1. KNOWLEDGE MODE
- Answer KPI/business questions (e.g. "what is OEE?")
- Explain clearly using general knowledge
- Do NOT force trend analysis

2. EXPLAIN CONTEXT MODE
- Explain KPI changes using provided dashboard_context
- DO NOT invent data
- Treat possible_drivers as hints, not facts

Rules:
- Always return valid JSON
- Do not wrap in markdown
- Be concise and business-friendly
- If context is limited, say "based on available dashboard context"

Return this JSON format:
{
  "summary": "...",
  "why": ["...", "..."],
  "actions": ["...", "..."],
  "grounding_note": "..."
}
""".strip()

KNOWLEDGE_REFERENCE = """
Trusted OEE reference for this application:

- OEE (Overall Equipment Effectiveness) is a high-level measure of how effectively planned production time is converted into good output.
- Preferred OEE formula: OEE = Availability × Performance × Quality.
- In this application and dataset, the three component KPIs used alongside OEE are Availability, Efficiency, and Quality. Efficiency is the performance-like component used in the dataset.
- Availability reflects whether the line was running during planned production time.
- Availability-related losses in this dataset may correspond to break_time_minutes, maintenance_minutes, shift_meeting_minutes, machine_breakdown_minutes, material_shortage_minutes, and changeover_time_minutes.
- Efficiency reflects whether the line ran at the expected rate while operating. In this dataset, efficiency can be interpreted alongside target_output and actual_output.
- Quality reflects whether output was good output. In this dataset, quality can be interpreted alongside defects.
- Defects reduce quality. Stop-time related losses reduce availability. Lower actual output versus target_output can indicate efficiency loss.
- OEE should be explained by identifying which component or loss category is most likely affecting the result.

Use this reference for concept questions. Do not claim you queried the live dataset in knowledge mode.
""".strip()


def clean_model_output(text):
    text = text.strip()

    if text.startswith("```json"):
        text = text[len("```json"):].strip()
    elif text.startswith("```"):
        text = text[len("```"):].strip()

    if text.endswith("```"):
        text = text[:-3].strip()

    return text


def parse_event_body(event):
    body = event

    if isinstance(event, dict) and "body" in event:
        body = event["body"]
        if isinstance(body, str):
            body = json.loads(body)

    return body if isinstance(body, dict) else {}


def sql_escape(value):
    return str(value).replace("'", "''")


def has_athena_config():
    return all([ATHENA_DATABASE, ATHENA_TABLE, ATHENA_OUTPUT_LOCATION])


def has_enough_context_for_athena(dashboard_context):
    if not isinstance(dashboard_context, dict):
        return False

    has_kpi = bool(dashboard_context.get("kpi", {}).get("name"))
    has_entity = bool(dashboard_context.get("entity", {}).get("name"))
    has_time_range = bool(dashboard_context.get("time_range", {}).get("label"))

    return has_kpi and (has_entity or has_time_range)


def get_kpi_column(kpi_name):
    if not kpi_name:
        return None

    return ATHENA_KPI_COLUMN_MAP.get(kpi_name)


def get_latest_demo_date_expr():
    return (
        f'(SELECT max(TRY_CAST("{ATHENA_DATE_COLUMN}" AS DATE)) '
        f'FROM "{ATHENA_DATABASE}"."{ATHENA_TABLE}")'
    )


def build_time_filter(time_label):
    if not time_label:
        return None

    normalized = time_label.strip().lower()
    date_expr = f'TRY_CAST("{ATHENA_DATE_COLUMN}" AS DATE)'
    latest_date_expr = get_latest_demo_date_expr()
    iso_date_parts = normalized.split("-")

    if (
        len(iso_date_parts) == 3
        and len(iso_date_parts[0]) == 4
        and all(part.isdigit() for part in iso_date_parts)
    ):
        year, month, day = iso_date_parts
        return f"{date_expr} = DATE '{year}-{month}-{day}'"

    if normalized == "last 7 days":
        return (
            f"{date_expr} BETWEEN date_add('day', -6, {latest_date_expr}) "
            f"AND {latest_date_expr}"
        )
    if normalized == "this week":
        return (
            f"{date_expr} >= date_trunc('week', {latest_date_expr}) "
            f"AND {date_expr} <= {latest_date_expr}"
        )
    if normalized == "last week":
        return (
            f"{date_expr} >= date_add('week', -1, date_trunc('week', {latest_date_expr})) "
            f"AND {date_expr} < date_trunc('week', {latest_date_expr})"
        )
    if normalized == "this month":
        return (
            f"{date_expr} >= date_trunc('month', {latest_date_expr}) "
            f"AND {date_expr} <= {latest_date_expr}"
        )
    if normalized == "today":
        return f"{date_expr} = {latest_date_expr}"
    if normalized == "recent":
        return (
            f"{date_expr} BETWEEN date_add('day', -6, {latest_date_expr}) "
            f"AND {latest_date_expr}"
        )

    month_year = {
        "january": "01",
        "jan": "01",
        "february": "02",
        "feb": "02",
        "march": "03",
        "mar": "03",
        "april": "04",
        "apr": "04",
        "may": "05",
        "june": "06",
        "jun": "06",
        "july": "07",
        "jul": "07",
        "august": "08",
        "aug": "08",
        "september": "09",
        "sep": "09",
        "sept": "09",
        "october": "10",
        "oct": "10",
        "november": "11",
        "nov": "11",
        "december": "12",
        "dec": "12",
    }

    parts = normalized.split()
    if len(parts) in (1, 2) and parts[0] in month_year:
        month = month_year[parts[0]]
        year = DEMO_DEFAULT_YEAR

        if len(parts) == 2:
            if not parts[1].isdigit():
                return None
            year = parts[1]

        return (
            f"date_trunc('month', {date_expr}) = "
            f"DATE '{year}-{month}-01'"
        )

    return None


def build_athena_query(dashboard_context):
    if not has_athena_config() or not has_enough_context_for_athena(dashboard_context):
        return None

    where_clauses = []
    kpi_name = dashboard_context.get("kpi", {}).get("name")
    entity_name = dashboard_context.get("entity", {}).get("name")
    time_label = dashboard_context.get("time_range", {}).get("label")
    kpi_column = get_kpi_column(kpi_name)

    if not kpi_column:
        return None

    if entity_name:
        where_clauses.append(
            f'lower("{ATHENA_ENTITY_COLUMN}") = lower(\'{sql_escape(entity_name)}\')'
        )
    time_filter = build_time_filter(time_label)
    if time_filter:
        where_clauses.append(time_filter)

    if len(where_clauses) == 0:
        return None

    driver_aggregates = ",\n  ".join(
        [f'SUM("{column}") AS "{column}"' for column in ATHENA_DRIVER_COLUMNS]
    )

    valid_date_clause = f'TRY_CAST("{ATHENA_DATE_COLUMN}" AS DATE) IS NOT NULL'

    return f"""
SELECT
  AVG("{kpi_column}") AS kpi_value,
  MIN(TRY_CAST("{ATHENA_DATE_COLUMN}" AS DATE)) AS start_date,
  MAX(TRY_CAST("{ATHENA_DATE_COLUMN}" AS DATE)) AS end_date,
  MIN("{ATHENA_SITE_COLUMN}") AS site,
  MIN("{ATHENA_ENTITY_COLUMN}") AS entity_name,
  MIN("{ATHENA_SHIFT_COLUMN}") AS shift,
  MIN("{ATHENA_PRODUCT_COLUMN}") AS product,
  {driver_aggregates}
FROM "{ATHENA_DATABASE}"."{ATHENA_TABLE}"
WHERE {valid_date_clause} AND {" AND ".join(where_clauses)}
""".strip()


def run_athena_query(query):
    start_response = athena.start_query_execution(
        QueryString=query,
        QueryExecutionContext={"Database": ATHENA_DATABASE},
        ResultConfiguration={"OutputLocation": ATHENA_OUTPUT_LOCATION},
        WorkGroup=ATHENA_WORKGROUP,
    )

    query_execution_id = start_response["QueryExecutionId"]

    for _ in range(15):
        execution = athena.get_query_execution(QueryExecutionId=query_execution_id)
        state = execution["QueryExecution"]["Status"]["State"]

        if state == "SUCCEEDED":
            results = athena.get_query_results(QueryExecutionId=query_execution_id)
            rows = results.get("ResultSet", {}).get("Rows", [])
            if len(rows) <= 1:
                return None

            headers = [
                column.get("VarCharValue", "")
                for column in rows[0].get("Data", [])
            ]

            records = []
            for row in rows[1:]:
                values = [column.get("VarCharValue", "") for column in row.get("Data", [])]
                record = dict(zip(headers, values))
                records.append(record)

            return {
                "query": query,
                "rows": records
            }

        if state in ["FAILED", "CANCELLED"]:
            reason = execution["QueryExecution"]["Status"].get("StateChangeReason", "Unknown Athena failure")
            raise RuntimeError(f"Athena query failed: {reason}")

        time.sleep(1)

    raise TimeoutError("Athena query timed out")


def maybe_get_athena_grounding(payload):
    dashboard_context = payload.get("dashboard_context", {})
    query = build_athena_query(dashboard_context)

    if not query:
        return None

    try:
        return run_athena_query(query)
    except Exception as exc:
        print(f"Athena grounding skipped due to error: {exc}")
        return None


def build_prompt(payload, athena_grounding=None):
    mode = payload.get("mode", "knowledge")
    question = payload.get("user_question", "")

    if mode == "knowledge":
        return f"""
Answer this manufacturing KPI question clearly and simply using the trusted reference below.

Question: {question}

Reference:
{KNOWLEDGE_REFERENCE}

Instructions:
- Use the reference first, then general manufacturing knowledge only if needed
- Keep the explanation business-friendly and concise
- If the question is about a formula, explain it clearly
- If the question is about a KPI component, relate it to the dataset columns when useful
- Do not say Athena or dashboard data was queried for knowledge mode

- summary = main explanation
- why = key supporting points
- actions = optional next steps (e.g. what to monitor)
- grounding_note = based on trusted OEE knowledge reference

Return JSON only.
"""

    else:  # explain_context
        athena_section = ""
        if athena_grounding and athena_grounding.get("rows"):
            athena_section = f"""
Athena grounded rows:
{json.dumps(athena_grounding.get("rows", []), indent=2)}
"""

        return f"""
Explain this dashboard insight using ONLY the provided context.

Question: {question}

Context:
{json.dumps(payload.get("dashboard_context", {}), indent=2)}

{athena_section}

Rules:
- Do not invent data
- Use context only
- possible_drivers are hints only
- If Athena grounded rows are provided, prioritize them over weak heuristics
- If Athena grounding is unavailable, fall back gracefully to the provided dashboard context

Return JSON only.
"""


def fallback_response(payload, athena_grounding=None):
    question = payload.get("user_question", "")
    dashboard_context = payload.get("dashboard_context", {})

    if athena_grounding and athena_grounding.get("rows"):
        grounding_note = "Fallback response based on available Athena-grounded context and provided dashboard context"
    elif dashboard_context:
        grounding_note = "Fallback response based on available dashboard context"
    else:
        grounding_note = "Fallback response due to parsing or model limitations"

    return {
        "summary": f"Unable to fully analyze '{question}' with available context.",
        "why": [
            "Limited structured data was provided",
            "No live dataset query was performed",
            "Additional context is required for deeper analysis"
        ],
        "actions": [
            "Refine the question",
            "Use QuickSight Q for data queries",
            "Provide more context for better insights"
        ],
        "grounding_note": grounding_note
    }


def normalize(data):
    return {
        "summary": str(data.get("summary", "")).strip(),
        "why": [str(x).strip() for x in data.get("why", [])][:3],
        "actions": [str(x).strip() for x in data.get("actions", [])][:3],
        "grounding_note": str(data.get("grounding_note", "")).strip()
    }


def lambda_handler(event, context):
    try:
        payload = parse_event_body(event)

        if not payload:
            return {
                "statusCode": 400,
                "headers": {"Access-Control-Allow-Origin": "*"},
                "body": json.dumps({"error": "Empty request"})
            }

        athena_grounding = None
        if payload.get("mode") == "explain_context":
            athena_grounding = maybe_get_athena_grounding(payload)

        prompt = build_prompt(payload, athena_grounding)

        response = bedrock.converse(
            modelId=MODEL_ID,
            system=[{"text": SYSTEM_PROMPT}],
            messages=[
                {
                    "role": "user",
                    "content": [{"text": prompt}]
                }
            ],
            inferenceConfig={
                "maxTokens": 500,
                "temperature": 0.4,
                "topP": 0.9
            }
        )

        text = response["output"]["message"]["content"][0]["text"]
        cleaned = clean_model_output(text)

        try:
            parsed = json.loads(cleaned)
            parsed = normalize(parsed)
        except:
            parsed = fallback_response(payload, athena_grounding)

        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            "body": json.dumps(parsed)
        }

    except (ClientError, Exception) as e:
        return {
            "statusCode": 500,
            "headers": {"Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"error": str(e)})
        }

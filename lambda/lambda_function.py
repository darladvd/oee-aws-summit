import json
import os
import time
import boto3
from botocore.exceptions import ClientError

AWS_REGION = os.getenv("AWS_REGION", "ap-southeast-1")

bedrock = boto3.client("bedrock-runtime", region_name=AWS_REGION)
athena = boto3.client("athena", region_name=AWS_REGION)

MODEL_ID = os.getenv(
    "BEDROCK_MODEL_ID",
    "arn:aws:bedrock:ap-southeast-1:141922114492:application-inference-profile/toabv9iabntf"
)


def log(step, message, data=None):
    """Structured JSON log — one line per event in CloudWatch."""
    entry = {"step": step, "message": message}
    if data is not None:
        entry["data"] = data
    print(json.dumps(entry, default=str))

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

# ---------------------------------------------------------------------------
# System prompt for the explanation step
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """
You are an operations analytics copilot for a manufacturing OEE dashboard.

You support TWO modes:

1. KNOWLEDGE MODE
- Answer KPI/business questions (e.g. "what is OEE?")
- Explain clearly using general manufacturing knowledge
- Do NOT force trend analysis or invent data

2. EXPLAIN CONTEXT MODE
- Explain KPI changes using ONLY the provided live Athena data
- DO NOT invent numbers — only reference values present in the data
- Identify root causes by analyzing which OEE component is weakest and which driver columns are highest
- Provide specific, actionable recommendations tied to the identified drivers

Rules:
- Always return valid JSON (no markdown wrapping)
- Be concise and business-friendly
- If data is limited, say so honestly

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

- OEE (Overall Equipment Effectiveness) measures how effectively planned production time is converted into good output.
- Formula: OEE = Availability × Performance × Quality.
- In this dataset, the three component KPIs are Availability, Efficiency (performance proxy), and Quality.
- Availability = was the line running during planned time? Losses: break_time_minutes, maintenance_minutes, shift_meeting_minutes, machine_breakdown_minutes, material_shortage_minutes, changeover_time_minutes.
- Efficiency = did the line run at expected speed? Interpret via target_output vs actual_output.
- Quality = was output good? Interpret via defects column.
- To explain OEE, identify which component is weakest and which loss category drives it.
""".strip()

# ---------------------------------------------------------------------------
# Intent extraction prompt (Step 1)
# ---------------------------------------------------------------------------

INTENT_EXTRACTION_PROMPT = """
Extract structured intent from this user question about a manufacturing OEE dashboard.

Question: "{question}"

Available KPIs: OEE, Availability, Efficiency, Quality
Entity types: production_line, site, shift, product
Time ranges: specific dates (YYYY-MM-DD), month names, relative phrases, date ranges

Instructions:
- kpi: Map synonyms to the correct KPI. Examples:
  - "uptime", "downtime", "running" → Availability
  - "rejects", "defects", "scrap", "yield" → Quality
  - "speed", "throughput", "output", "rate", "slow" → Efficiency
  - "oee", "overall", "performance", "performing", "poorly", "well", "bad", "good" → OEE
  - If unclear or the question is general about performance, use OEE
- entity: Extract the entity name as the user stated it (preserve casing like "Line 1", "Site B"). Infer the type:
  - Contains "line" → production_line
  - Contains "site" or "plant" or "factory" → site
  - Contains "shift" or is a shift name (morning/night/afternoon) → shift
  - Contains "product" → product
- time_range: Normalize to one of these formats:
  - For date ranges like "February 18 to February 27" → "2026-02-18 to 2026-02-27"
  - For single dates like "March 15" → "2026-03-15"
  - "last 7 days" for "lately", "recently", "past week"
  - "last 30 days" for "past month", "last few weeks"
  - "this month" for "this month"
  - Month name (e.g. "March", "January") if a specific month is mentioned
  - null if no time indication at all (the system will default to last 7 days)
  - IMPORTANT: The dataset year is 2026. Always use 2026 as the year unless the user explicitly states a different year.
- mode: "knowledge" ONLY for pure definition/concept questions (e.g. "what is OEE?", "explain availability"). Use "explain_context" for everything else.

Return ONLY valid JSON, no markdown:
{{"kpi": "...", "entity": {{"type": "...", "name": "..."}}, "time_range": "...", "mode": "..."}}

Use null for any field you truly cannot determine. Do NOT guess entity names that aren't in the question.
""".strip()


# ---------------------------------------------------------------------------
# Utility functions
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# Step 1: Intent extraction via Bedrock
# ---------------------------------------------------------------------------

def extract_intent(question):
    """Use Bedrock to parse the user's question into structured intent."""
    prompt = INTENT_EXTRACTION_PROMPT.format(question=question)

    log("INTENT_EXTRACTION", "Prompt sent to Bedrock", {"prompt": prompt})

    try:
        response = bedrock.converse(
            modelId=MODEL_ID,
            system=[{"text": "You are a precise intent parser. Return only valid JSON. No explanations."}],
            messages=[{"role": "user", "content": [{"text": prompt}]}],
            inferenceConfig={
                "maxTokens": 200,
                "temperature": 0.1,
                "topP": 0.9
            }
        )

        text = response["output"]["message"]["content"][0]["text"]
        cleaned = clean_model_output(text)

        log("INTENT_EXTRACTION", "Bedrock response", {"raw": text, "cleaned": cleaned})

        intent = json.loads(cleaned)

        # Normalize — safely handle any shape Bedrock returns
        entity = intent.get("entity")
        if isinstance(entity, dict) and entity.get("name"):
            entity = {"type": entity.get("type", "production_line"), "name": entity["name"]}
        else:
            entity = None

        result = {
            "kpi": intent.get("kpi") if isinstance(intent.get("kpi"), str) else None,
            "entity": entity,
            "time_range": intent.get("time_range") if isinstance(intent.get("time_range"), str) else None,
            "mode": intent.get("mode", "explain_context"),
        }

        log("INTENT_EXTRACTION", "Final intent", result)
        return result

    except Exception as exc:
        log("INTENT_EXTRACTION", "FAILED", {"error": str(exc)})
        return {
            "kpi": "OEE",
            "entity": None,
            "time_range": "last 7 days",
            "mode": "explain_context",
        }


# ---------------------------------------------------------------------------
# Athena query building (uses extracted intent, no regex)
# ---------------------------------------------------------------------------

def get_kpi_column(kpi_name):
    if not kpi_name:
        return None
    return ATHENA_KPI_COLUMN_MAP.get(kpi_name)


def get_latest_demo_date_expr():
    return (
        f'(SELECT max(TRY_CAST("{ATHENA_DATE_COLUMN}" AS DATE)) '
        f'FROM "{ATHENA_DATABASE}"."{ATHENA_TABLE}")'
    )


def resolve_entity_column(entity_type):
    """Map entity type to the correct Athena column."""
    entity_type_column_map = {
        "production_line": ATHENA_ENTITY_COLUMN,
        "line": ATHENA_ENTITY_COLUMN,
        "site": ATHENA_SITE_COLUMN,
        "shift": ATHENA_SHIFT_COLUMN,
        "product": ATHENA_PRODUCT_COLUMN,
    }
    return entity_type_column_map.get(entity_type, ATHENA_ENTITY_COLUMN)


def build_time_filter(time_label):
    if not time_label:
        return None

    normalized = time_label.strip().lower()
    date_expr = f'TRY_CAST("{ATHENA_DATE_COLUMN}" AS DATE)'
    latest_date_expr = get_latest_demo_date_expr()

    # Date range: "2026-02-18 to 2026-02-27"
    range_match = normalized.split(" to ")
    if len(range_match) == 2:
        start_parts = range_match[0].strip().split("-")
        end_parts = range_match[1].strip().split("-")
        if (
            len(start_parts) == 3 and len(end_parts) == 3
            and all(p.isdigit() for p in start_parts)
            and all(p.isdigit() for p in end_parts)
        ):
            start_date = range_match[0].strip()
            end_date = range_match[1].strip()
            return f"{date_expr} BETWEEN DATE '{start_date}' AND DATE '{end_date}'"

    # ISO date: 2026-03-15
    iso_date_parts = normalized.split("-")
    if (
        len(iso_date_parts) == 3
        and len(iso_date_parts[0]) == 4
        and all(part.isdigit() for part in iso_date_parts)
    ):
        year, month, day = iso_date_parts
        return f"{date_expr} = DATE '{year}-{month}-{day}'"

    # Relative ranges
    if normalized in ("last 7 days", "lately", "recently", "past week"):
        return (
            f"{date_expr} BETWEEN date_add('day', -6, {latest_date_expr}) "
            f"AND {latest_date_expr}"
        )
    if normalized in ("last 30 days", "past month", "last few weeks"):
        return (
            f"{date_expr} BETWEEN date_add('day', -29, {latest_date_expr}) "
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

    # Month name (e.g. "march", "january 2026")
    month_map = {
        "january": "01", "jan": "01", "february": "02", "feb": "02",
        "march": "03", "mar": "03", "april": "04", "apr": "04",
        "may": "05", "june": "06", "jun": "06", "july": "07", "jul": "07",
        "august": "08", "aug": "08", "september": "09", "sep": "09", "sept": "09",
        "october": "10", "oct": "10", "november": "11", "nov": "11",
        "december": "12", "dec": "12",
    }

    parts = normalized.split()
    if len(parts) in (1, 2) and parts[0] in month_map:
        month = month_map[parts[0]]
        year = "2026"  # Dataset year
        if len(parts) == 2 and parts[1].isdigit():
            year = parts[1]
        return (
            f"date_trunc('month', {date_expr}) = DATE '{year}-{month}-01'"
        )

    return None


def build_athena_query(intent):
    """Build Athena SQL from the LLM-extracted intent."""
    if not has_athena_config():
        return None

    if not intent:
        return None

    kpi_name = intent.get("kpi") or "OEE"
    entity = intent.get("entity")
    time_range = intent.get("time_range")

    kpi_column = get_kpi_column(kpi_name)
    if not kpi_column:
        kpi_column = "oee"
        kpi_name = "OEE"

    # Need at least one filter dimension
    has_entity = isinstance(entity, dict) and entity.get("name")
    has_time = bool(time_range)

    if not has_entity and not has_time:
        # No filters at all — default to last 7 days of the full dataset
        time_range = "last 7 days"

    where_clauses = []

    if has_entity:
        entity_column = resolve_entity_column(entity.get("type", "production_line"))
        where_clauses.append(
            f'lower("{entity_column}") = lower(\'{sql_escape(entity["name"])}\')'
        )

    time_filter = build_time_filter(time_range)
    if time_filter:
        where_clauses.append(time_filter)
    elif has_entity:
        # Entity specified but no parseable time range — default to last 7 days
        latest_date_expr = get_latest_demo_date_expr()
        date_expr = f'TRY_CAST("{ATHENA_DATE_COLUMN}" AS DATE)'
        where_clauses.append(
            f"{date_expr} BETWEEN date_add('day', -6, {latest_date_expr}) "
            f"AND {latest_date_expr}"
        )

    if not where_clauses:
        return None

    # Build SELECT: primary KPI + all other KPIs + drivers
    other_kpi_columns = [
        col for col in ATHENA_KPI_COLUMN_MAP.values() if col != kpi_column
    ]
    other_kpi_aggregates = ",\n  ".join(
        [f'AVG("{col}") AS "{col}"' for col in other_kpi_columns]
    )
    driver_aggregates = ",\n  ".join(
        [f'SUM("{col}") AS "{col}"' for col in ATHENA_DRIVER_COLUMNS]
    )

    valid_date_clause = f'TRY_CAST("{ATHENA_DATE_COLUMN}" AS DATE) IS NOT NULL'

    return f"""
SELECT
  AVG("{kpi_column}") AS kpi_value,
  {other_kpi_aggregates},
  COUNT(*) AS record_count,
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
                col.get("VarCharValue", "") for col in rows[0].get("Data", [])
            ]
            records = []
            for row in rows[1:]:
                values = [col.get("VarCharValue", "") for col in row.get("Data", [])]
                records.append(dict(zip(headers, values)))

            return {"query": query, "rows": records}

        if state in ("FAILED", "CANCELLED"):
            reason = execution["QueryExecution"]["Status"].get(
                "StateChangeReason", "Unknown Athena failure"
            )
            raise RuntimeError(f"Athena query failed: {reason}")

        time.sleep(1)

    raise TimeoutError("Athena query timed out")


# ---------------------------------------------------------------------------
# Step 2: Explanation prompt building
# ---------------------------------------------------------------------------

def build_explanation_prompt(question, intent, athena_result):
    """Build the explanation prompt with Athena data for Bedrock."""
    kpi_name = intent.get("kpi") or "OEE"
    entity = intent.get("entity")
    entity_name = entity["name"] if entity else "the selected scope"
    time_range = intent.get("time_range") or "last 7 days"

    if athena_result and athena_result.get("rows"):
        athena_section = f"""
--- LIVE DATA FROM ATHENA ---
{json.dumps(athena_result["rows"], indent=2)}
---

Column guide:
- kpi_value: average {kpi_name} for {entity_name} over {time_range}
- oee, availability, efficiency, quality: OEE component averages (values are decimals, e.g. 0.72 = 72%)
- record_count: number of production records in the period
- Driver columns (summed totals for the period):
  - break_time_minutes: scheduled breaks
  - maintenance_minutes: planned maintenance
  - shift_meeting_minutes: shift meetings
  - machine_breakdown_minutes: unplanned equipment failures (affects Availability)
  - material_shortage_minutes: waiting for materials (affects Availability)
  - changeover_time_minutes: product/tool changeovers (affects Availability)
  - defects: defective units produced (affects Quality)

Analysis approach:
1. Identify which OEE component (availability, efficiency, quality) is lowest
2. Find the driver columns with the highest values — those are the root causes
3. Map drivers to components: breakdown/shortage/changeover/maintenance → Availability; defects → Quality; low actual vs target output → Efficiency
4. Quantify: use the actual numbers to explain severity
"""
    else:
        athena_section = """
--- NO LIVE DATA AVAILABLE ---
The Athena query returned no results for this scope. Provide a helpful response acknowledging the data gap.
Suggest the user refine their question with a specific entity or time range.
"""

    return f"""
User question: "{question}"

Extracted intent:
- KPI focus: {kpi_name}
- Entity: {entity_name}
- Time range: {time_range}

{athena_section}

Instructions:
- Answer the user's question directly using the Athena data
- Be specific: cite actual values (convert decimals to percentages for KPIs)
- Identify the #1 root cause and supporting factors
- Recommend concrete actions tied to the data (not generic advice)
- If the data contradicts the user's assumption, politely correct them with evidence
- Keep it concise — 2-3 sentences for summary, 2-3 bullet points each for why and actions

Return ONLY valid JSON:
{{"summary": "...", "why": ["...", "..."], "actions": ["...", "..."], "grounding_note": "..."}}
"""


def build_knowledge_prompt(question):
    """Build prompt for knowledge/definition questions."""
    return f"""
Answer this specific question about manufacturing KPIs.

Question: "{question}"

Reference material:
{KNOWLEDGE_REFERENCE}

Instructions:
- Focus your answer specifically on what was asked — do NOT give a generic OEE overview for every question
- "what is OEE?" → explain the concept and its purpose
- "what is the formula?" → show the formula clearly (OEE = Availability × Performance × Quality) with a brief numeric example
- "how is it measured?" → explain what data is collected and how each component is calculated in practice
- "what is availability?" → explain only availability, not all three components
- Tailor the summary, why, and actions to the specific question asked
- Do not repeat the same answer structure for different questions
- Do not claim any live data was queried

Return ONLY valid JSON:
{{"summary": "...", "why": ["...", "..."], "actions": ["...", "..."], "grounding_note": "Based on OEE knowledge reference"}}
"""


# ---------------------------------------------------------------------------
# Response helpers
# ---------------------------------------------------------------------------

def fallback_response(question):
    return {
        "summary": f"I couldn't fully analyze '{question}' with the available data.",
        "why": [
            "The query may not have matched any records in the dataset",
            "Try specifying a production line, site, or time range"
        ],
        "actions": [
            "Rephrase with a specific entity (e.g. 'Line 1', 'Site A')",
            "Add a time range (e.g. 'in March', 'last 7 days')",
            "Use QuickSight Q for direct data queries"
        ],
        "grounding_note": "No Athena data was available for this query"
    }


def normalize_response(data):
    return {
        "summary": str(data.get("summary", "")).strip(),
        "why": [str(x).strip() for x in data.get("why", [])][:3],
        "actions": [str(x).strip() for x in data.get("actions", [])][:3],
        "grounding_note": str(data.get("grounding_note", "")).strip()
    }


# ---------------------------------------------------------------------------
# Lambda handler
# ---------------------------------------------------------------------------

def lambda_handler(event, context):
    try:
        payload = parse_event_body(event)

        if not payload:
            return {
                "statusCode": 400,
                "headers": {"Access-Control-Allow-Origin": "*"},
                "body": json.dumps({"error": "Empty request"})
            }

        question = payload.get("user_question", "").strip()
        if not question:
            return {
                "statusCode": 400,
                "headers": {"Access-Control-Allow-Origin": "*"},
                "body": json.dumps({"error": "No question provided"})
            }

        # Step 1: Let Bedrock extract intent from the raw question
        intent = extract_intent(question)
        mode = intent.get("mode", "explain_context")

        log("HANDLER", "Intent extracted", {"intent": intent, "mode": mode})

        # Knowledge mode — no Athena needed
        if mode == "knowledge":
            prompt = build_knowledge_prompt(question)
            log("KNOWLEDGE", "Prompt sent to Bedrock", {"prompt": prompt})
        else:
            # Step 2a: Query Athena using the extracted intent
            athena_result = None
            query = build_athena_query(intent)

            if query:
                log("ATHENA", "Query built", {"query": query})
                try:
                    athena_result = run_athena_query(query)
                    log("ATHENA", "Query result", {"rows": athena_result.get("rows", []) if athena_result else None})
                except Exception as exc:
                    log("ATHENA", "Query failed", {"error": str(exc)})
            else:
                log("ATHENA", "No query built (insufficient intent)")

            # Step 2b: Build explanation prompt with data
            prompt = build_explanation_prompt(question, intent, athena_result)
            log("EXPLANATION", "Prompt sent to Bedrock", {"prompt": prompt})

        # Call Bedrock for the final response
        response = bedrock.converse(
            modelId=MODEL_ID,
            system=[{"text": SYSTEM_PROMPT}],
            messages=[{"role": "user", "content": [{"text": prompt}]}],
            inferenceConfig={
                "maxTokens": 500,
                "temperature": 0.3,
                "topP": 0.9
            }
        )

        text = response["output"]["message"]["content"][0]["text"]
        cleaned = clean_model_output(text)

        log("RESPONSE", "Bedrock final response", {"raw": text, "cleaned": cleaned})

        try:
            parsed = json.loads(cleaned)
            parsed = normalize_response(parsed)
        except Exception:
            parsed = fallback_response(question)

        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
            "body": json.dumps(parsed)
        }

    except (ClientError, Exception) as e:
        log("ERROR", "Lambda error", {"error": str(e)})
        return {
            "statusCode": 500,
            "headers": {"Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"error": str(e)})
        }

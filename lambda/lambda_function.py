import json
import boto3
from botocore.exceptions import ClientError

bedrock = boto3.client("bedrock-runtime", region_name="ap-southeast-1")

MODEL_ID = "arn:aws:bedrock:ap-southeast-1:141922114492:application-inference-profile/toabv9iabntf"

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


def build_prompt(payload):
    mode = payload.get("mode", "knowledge")
    question = payload.get("user_question", "")

    if mode == "knowledge":
        return f"""
Answer this question clearly and simply:

Question: {question}

Explain the concept in a business-friendly way.

- summary = main explanation
- why = key supporting points
- actions = optional next steps (e.g. what to monitor)
- grounding_note = based on general KPI knowledge

Return JSON only.
"""

    else:  # explain_context
        return f"""
Explain this dashboard insight using ONLY the provided context.

Question: {question}

Context:
{json.dumps(payload.get("dashboard_context", {}), indent=2)}

Rules:
- Do not invent data
- Use context only
- possible_drivers are hints only

Return JSON only.
"""


def fallback_response(payload):
    question = payload.get("user_question", "")

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
        "grounding_note": "Fallback response due to parsing or model limitations"
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

        prompt = build_prompt(payload)

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
            parsed = fallback_response(payload)

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
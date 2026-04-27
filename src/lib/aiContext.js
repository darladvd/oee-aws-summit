// AI Context — minimal.
// All intent extraction (KPI, entity, time range, mode) is handled by Bedrock in the Lambda.
// The frontend just sends the raw question.

export function buildAiPayload(question) {
  return {
    user_question: question,
  };
}

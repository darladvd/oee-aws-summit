// AI Context — simplified.
// Intent extraction (KPI, entity, time range) is now handled by Bedrock in the Lambda.
// The frontend only needs to classify mode and send the raw question.

function normalizeQuestion(question) {
  return question.trim().toLowerCase().replace(/\s+/g, ' ');
}

function hasAnyPhrase(question, phrases) {
  return phrases.some((phrase) => question.includes(phrase));
}

export function classifyAiMode(question) {
  const normalized = normalizeQuestion(question || '');

  const knowledgePatterns = [
    'what is oee',
    'what does oee mean',
    'what is availability',
    'what is efficiency',
    'what is quality',
    'difference between',
    'what is the difference',
    'define ',
    'explain the concept',
    'what does downtime mean',
  ];

  if (hasAnyPhrase(normalized, knowledgePatterns)) {
    return 'knowledge';
  }

  return 'explain_context';
}

export function buildAiPayload(question) {
  const mode = classifyAiMode(question);

  return {
    mode,
    user_question: question,
  };
}

// Keep these exports for backward compatibility but they're now minimal
export function parseQuestionContext() {
  return {};
}

export function mergeContext() {
  return {};
}

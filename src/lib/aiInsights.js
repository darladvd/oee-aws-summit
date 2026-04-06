import { buildAiPayload } from './aiContext';

const AI_API_URL = import.meta.env.VITE_AI_API_URL;

if (!AI_API_URL) {
  throw new Error('Missing VITE_AI_API_URL');
}

function normalizeAiResponse(payload) {
  if (payload && typeof payload === 'object' && 'statusCode' in payload && 'body' in payload) {
    const parsedBody = typeof payload.body === 'string' ? JSON.parse(payload.body) : payload.body;
    return normalizeAiResponse(parsedBody);
  }

  return payload;
}

export async function callAiInsights({ userQuestion, selectedContext, mode = 'direct_ai' }) {
  const payload = buildAiPayload({
    userQuestion,
    selectedContext,
    mode,
  });

  const response = await fetch(AI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error('AI request failed');
  }

  const raw = await response.json();
  return normalizeAiResponse(raw);
}

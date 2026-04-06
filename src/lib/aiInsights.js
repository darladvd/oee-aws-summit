import { buildAiPayload, classifyAiMode } from './aiContext';

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

export async function callAiInsights({ userQuestion, selectedContext }) {
  const detectedMode = classifyAiMode(userQuestion);
  const payload = buildAiPayload(userQuestion, selectedContext);
  console.log('AI mode detected:', detectedMode);
  console.log('AI payload sent:', payload);

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
  const parsed = normalizeAiResponse(raw);
  console.log('AI API response:', parsed);
  return parsed;
}

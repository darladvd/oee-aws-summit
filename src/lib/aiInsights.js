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

export async function callAiInsights({ userQuestion }) {
  const payload = buildAiPayload(userQuestion);
  console.log('AI mode:', payload.mode);
  console.log('AI payload:', payload);

  let response;
  try {
    response = await fetch(AI_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.error('AI fetch error:', error);
    throw error;
  }

  console.log('AI response status:', response.status);

  const rawText = await response.text();
  console.log('AI raw response:', rawText);

  if (!rawText) {
    throw new Error('Empty AI API response');
  }

  let parsedJson;
  try {
    parsedJson = JSON.parse(rawText);
  } catch (error) {
    console.error('AI response JSON parse failed:', rawText);
    throw error;
  }

  if (!response.ok) {
    console.error('AI request failed:', parsedJson);
    throw new Error('AI request failed');
  }

  return normalizeAiResponse(parsedJson);
}

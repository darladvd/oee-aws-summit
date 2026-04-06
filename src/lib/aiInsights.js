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

  if (detectedMode === 'explain_context') {
    if (!payload.dashboard_context) {
      console.info('Athena grounding may have been skipped because no dashboard_context was sent.');
    } else if (!payload.dashboard_context.entity && !payload.dashboard_context.time_range) {
      console.info(
        'Athena grounding may have been skipped because dashboard_context had no entity or time range.',
        payload.dashboard_context,
      );
    } else if (!payload.dashboard_context.entity) {
      console.info(
        'Athena grounding is using partial context without an entity filter.',
        payload.dashboard_context,
      );
    }
  }

  let response;

  try {
    response = await fetch(AI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.error('AI fetch/network error:', error);
    throw error;
  }

  console.log('AI response status:', response.status, response.statusText);

  const rawText = await response.text();
  console.log('AI raw response text:', rawText);

  if (!rawText) {
    throw new Error('Empty AI API response');
  }

  let parsedJson;
  try {
    parsedJson = JSON.parse(rawText);
  } catch (error) {
    console.error('AI response JSON parse failed. Raw text:', rawText);
    throw error;
  }

  if (!response.ok) {
    console.error('AI request failed with non-OK status:', parsedJson);
    throw new Error('AI request failed');
  }

  let parsed;
  try {
    parsed = normalizeAiResponse(parsedJson);
  } catch (error) {
    console.error('AI nested response parse failed:', parsedJson);
    throw error;
  }

  console.log('AI parsed response:', parsed);
  return parsed;
}

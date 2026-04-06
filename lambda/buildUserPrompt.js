function formatContextSection(dashboardContext = {}) {
  const lines = [];

  if (dashboardContext.kpi?.name) {
    lines.push(`KPI: ${dashboardContext.kpi.name}`);
  }
  if (dashboardContext.entity?.name) {
    lines.push(`Entity: ${dashboardContext.entity.type || 'entity'} ${dashboardContext.entity.name}`);
  }
  if (dashboardContext.time_range?.label) {
    lines.push(`Time range: ${dashboardContext.time_range.label}`);
  }
  if (dashboardContext.trend?.direction) {
    lines.push(`Trend direction: ${dashboardContext.trend.direction}`);
  }
  if (dashboardContext.trend?.description) {
    lines.push(`Trend detail: ${dashboardContext.trend.description}`);
  }
  if (dashboardContext.possible_drivers?.length) {
    lines.push(`Possible drivers: ${dashboardContext.possible_drivers.join(', ')}`);
  }
  if (dashboardContext.source) {
    lines.push(`Source: ${dashboardContext.source}`);
  }

  return lines.join('\n');
}

export function buildUserPrompt(payload) {
  const {
    mode = 'direct_ai',
    user_question: userQuestion,
    dashboard_context: dashboardContext = {},
    response_preferences: responsePreferences = {},
  } = payload;

  const sharedInstructions = [
    'You are an operations analytics assistant.',
    'Be conservative and grounded in the provided context only.',
    'Do not invent facts, root causes, or numeric values that are not supported by the prompt.',
    'Return valid JSON only with keys: summary, why, actions, grounding_note.',
    `Tone: ${responsePreferences.tone || 'business-friendly'}`,
    `Length: ${responsePreferences.length || 'concise'}`,
    `Max reasons: ${responsePreferences.max_reasons || 3}`,
    `Max actions: ${responsePreferences.max_actions || 3}`,
  ];

  const contextSection = formatContextSection(dashboardContext);

  if (mode === 'explain_q_context') {
    return [
      ...sharedInstructions,
      'This request is based on QuickSight Q-driven context.',
      'Explain the selected dashboard/Q context in business-friendly language.',
      'Use the user question as the explanation request.',
      'Reference the KPI, entity, trend, and time range when available.',
      dashboardContext.trend?.description
        ? `Use this trend detail prominently: ${dashboardContext.trend.description}`
        : 'If no trend detail is provided, keep the explanation high-level and grounded.',
      'If the provided context is limited, say so clearly in grounding_note.',
      '',
      `User question: ${userQuestion}`,
      contextSection,
    ].join('\n');
  }

  return [
    ...sharedInstructions,
    'Respond to the user question using the dashboard context when it helps explain likely trends or next actions.',
    'If context is partial, acknowledge that limitation in grounding_note.',
    '',
    `User question: ${userQuestion}`,
    contextSection,
  ].join('\n');
}

export function buildFallbackResponse(payload) {
  const context = payload.dashboard_context || {};
  const kpi = context.kpi?.name || 'the KPI';
  const entity = context.entity?.name || 'the selected area';
  const timeRange = context.time_range?.label || 'the selected period';
  const trendDescription =
    context.trend?.description || `${kpi} changed versus the previous period`;

  return {
    summary: `${kpi} for ${entity} shows a noteworthy pattern over ${timeRange}. ${trendDescription}.`,
    why: (context.possible_drivers || ['The currently supplied context is limited']).slice(0, 3),
    actions: [
      `Review ${entity} performance drivers for ${timeRange}.`,
      `Validate whether the ${kpi} trend is new or recurring.`,
      'Use recent downtime, quality, and throughput data to confirm likely causes.',
    ].slice(0, 3),
    grounding_note:
      context.source === 'quicksight-q'
        ? 'This explanation is grounded in the QuickSight Q-driven context provided to the Lambda.'
        : 'This explanation is grounded in the dashboard context provided to the Lambda.',
  };
}

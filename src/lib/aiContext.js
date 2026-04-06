function capitalize(value) {
  if (!value) {
    return value;
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

function hasValue(value) {
  return value !== undefined && value !== null && value !== '';
}

function detectKpi(question) {
  const normalized = question.toLowerCase();

  if (normalized.includes('availability')) {
    return { name: 'Availability' };
  }
  if (normalized.includes('quality')) {
    return { name: 'Quality' };
  }
  if (normalized.includes('efficiency')) {
    return { name: 'Efficiency' };
  }
  if (normalized.includes('oee')) {
    return { name: 'OEE' };
  }

  return undefined;
}

function detectEntity(question) {
  const entityMatch = question.match(/\bline\s+([a-z0-9-]+)/i);
  if (!entityMatch) {
    return undefined;
  }

  return {
    type: 'line',
    name: `Line ${capitalize(entityMatch[1])}`,
  };
}

function detectTimeRange(question) {
  const normalized = question.toLowerCase();
  const monthMatch = question.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)(?:\s+\d{4})?\b/i,
  );

  if (monthMatch) {
    return { label: monthMatch[0] };
  }
  if (normalized.includes('last 7 days')) {
    return { label: 'last 7 days' };
  }
  if (normalized.includes('this week')) {
    return { label: 'this week' };
  }
  if (normalized.includes('last week')) {
    return { label: 'last week' };
  }
  if (normalized.includes('this month')) {
    return { label: 'this month' };
  }
  if (normalized.includes('today')) {
    return { label: 'today' };
  }

  return undefined;
}

function detectTrend(question, detectedKpi, detectedEntity) {
  const normalized = question.toLowerCase();
  const referenceName = detectedKpi?.name || detectedEntity?.name;

  if (
    normalized.includes('decrease') ||
    normalized.includes('decline') ||
    normalized.includes('drop') ||
    normalized.includes('underperform') ||
    normalized.includes('down')
  ) {
    return {
      direction: 'decreasing',
      description: referenceName
        ? `${referenceName} declined versus the previous period`
        : 'Performance declined versus the previous period',
    };
  }

  if (
    normalized.includes('increase') ||
    normalized.includes('improve') ||
    normalized.includes('up')
  ) {
    return {
      direction: 'increasing',
      description: referenceName
        ? `${referenceName} improved versus the previous period`
        : 'Performance improved versus the previous period',
    };
  }

  if (normalized.includes('trend') || normalized.includes('anomaly')) {
    return {
      description: referenceName
        ? `Observed trend for ${referenceName}`
        : 'Observed trend in the dashboard context',
    };
  }

  return undefined;
}

function detectPossibleDrivers(question) {
  const normalized = question.toLowerCase();
  const drivers = [];

  if (normalized.includes('downtime') || normalized.includes('stop')) {
    drivers.push('downtime increased');
  }
  if (normalized.includes('quality')) {
    drivers.push('quality losses increased');
  }
  if (normalized.includes('changeover')) {
    drivers.push('changeover delays increased');
  }

  return drivers;
}

function mergeField(baseField, parsedField) {
  if (!baseField && !parsedField) {
    return undefined;
  }

  return {
    ...(baseField || {}),
    ...(parsedField || {}),
  };
}

function compactContext(context) {
  const nextContext = {};

  if (context.kpi?.name) {
    nextContext.kpi = { name: context.kpi.name };
  }

  if (context.entity?.type && context.entity?.name) {
    nextContext.entity = {
      type: context.entity.type,
      name: context.entity.name,
    };
  }

  if (context.time_range?.label) {
    nextContext.time_range = { label: context.time_range.label };
  }

  if (context.trend && (context.trend.direction || context.trend.description)) {
    nextContext.trend = {};
    if (context.trend.direction) {
      nextContext.trend.direction = context.trend.direction;
    }
    if (context.trend.description) {
      nextContext.trend.description = context.trend.description;
    }
  }

  if (Array.isArray(context.possible_drivers)) {
    nextContext.possible_drivers = context.possible_drivers;
  }

  if (context.source) {
    nextContext.source = context.source;
  }

  return nextContext;
}

export function classifyAiMode(question) {
  const normalized = question.trim().toLowerCase();

  const knowledgePatterns = [
    'what is oee',
    'what does oee mean',
    'what is availability',
    'what is efficiency',
    'what is quality',
    'difference between',
    'what is the difference',
    'why does downtime affect oee',
    'what does downtime pareto analysis mean',
  ];

  const explainPatterns = [
    'why is',
    'underperform',
    'explain',
    'what should we do next',
    'what should i do next',
    'why did',
    'decrease',
    'decline',
    'summarize',
    'anomaly',
    'trend',
    'issue',
    'next actions',
    'underperforming',
  ];

  if (knowledgePatterns.some((pattern) => normalized.includes(pattern))) {
    return 'knowledge';
  }

  if (explainPatterns.some((pattern) => normalized.includes(pattern))) {
    return 'explain_context';
  }

  return 'explain_context';
}

export function parseQuestionContext(question, source = 'app') {
  const rawQuestion = question?.trim() || '';
  if (!rawQuestion) {
    return {};
  }

  const detectedKpi = detectKpi(rawQuestion);
  const detectedEntity = detectEntity(rawQuestion);
  const detectedTimeRange = detectTimeRange(rawQuestion);
  const detectedTrend = detectTrend(rawQuestion, detectedKpi, detectedEntity);
  const detectedDrivers = detectPossibleDrivers(rawQuestion);

  return compactContext({
    kpi: detectedKpi,
    entity: detectedEntity,
    time_range: detectedTimeRange,
    trend: detectedTrend,
    possible_drivers: detectedDrivers,
    source,
  });
}

export function mergeContext(baseContext = {}, questionContext = {}, source = 'app') {
  return compactContext({
    kpi: mergeField(baseContext.kpi, questionContext.kpi),
    entity: mergeField(baseContext.entity, questionContext.entity),
    time_range: mergeField(baseContext.time_range, questionContext.time_range),
    trend: mergeField(baseContext.trend, questionContext.trend),
    possible_drivers: questionContext.possible_drivers?.length
      ? questionContext.possible_drivers
      : baseContext.possible_drivers || [],
    source: questionContext.source || baseContext.source || source,
  });
}

export function buildAiPayload(question, selectedContext) {
  const mode = classifyAiMode(question);

  const payload = {
    mode,
    user_question: question,
    response_preferences: {
      tone: 'business-friendly',
      length: 'concise',
      max_reasons: 3,
      max_actions: 3,
    },
  };

  if (mode === 'explain_context') {
    const dashboardContext = compactContext(selectedContext || {});
    if (Object.keys(dashboardContext).length > 0) {
      payload.dashboard_context = dashboardContext;
    }
  }

  return payload;
}

export function buildAiPrefillQuestion() {
  return 'Explain the current OEE trend and suggest next actions.';
}

function parseKnownProductionLines(rawValue) {
  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (Array.isArray(parsed)) {
      return parsed
        .map((value) => String(value).trim())
        .filter(Boolean);
    }
  } catch {
    // Fall back to comma-separated parsing below.
  }

  return rawValue
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

const KNOWN_PRODUCTION_LINES = parseKnownProductionLines(import.meta.env.VITE_PRODUCTION_LINES);

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

function detectTimeRange(question) {
  const normalized = question.toLowerCase();
  const monthNumber = {
    january: '01',
    jan: '01',
    february: '02',
    feb: '02',
    march: '03',
    mar: '03',
    april: '04',
    apr: '04',
    may: '05',
    june: '06',
    jun: '06',
    july: '07',
    jul: '07',
    august: '08',
    aug: '08',
    september: '09',
    sep: '09',
    sept: '09',
    october: '10',
    oct: '10',
    november: '11',
    nov: '11',
    december: '12',
    dec: '12',
  };
  const isoDateMatch = question.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  const explicitDateMatch = question.match(
    /\b(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sep|sept|october|oct|november|nov|december|dec)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,)?\s+(\d{4})\b/i,
  );
  const monthMatch = question.match(
    /\b(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sep|sept|october|oct|november|nov|december|dec)(?:\s+\d{4})?\b/i,
  );

  if (isoDateMatch) {
    return { label: `${isoDateMatch[1]}-${isoDateMatch[2]}-${isoDateMatch[3]}` };
  }
  if (explicitDateMatch) {
    const month = monthNumber[explicitDateMatch[1].toLowerCase()];
    const day = explicitDateMatch[2].padStart(2, '0');
    const year = explicitDateMatch[3];
    return { label: `${year}-${month}-${day}` };
  }
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

function normalizeQuestion(question) {
  return question.trim().toLowerCase().replace(/\s+/g, ' ');
}

function hasWholePhrase(question, phrase) {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  const pattern = new RegExp(`(^|\\b)${escaped}(\\b|$)`, 'i');
  return pattern.test(question);
}

function hasAnyPhrase(question, phrases) {
  return phrases.some((phrase) => hasWholePhrase(question, phrase));
}

function detectKnownEntity(question) {
  if (KNOWN_PRODUCTION_LINES.length === 0) {
    return undefined;
  }

  const normalizedQuestion = normalizeQuestion(question);
  const matchingEntity = KNOWN_PRODUCTION_LINES.find((entityName) =>
    hasWholePhrase(normalizedQuestion, normalizeQuestion(entityName)),
  );

  if (!matchingEntity) {
    return undefined;
  }

  return {
    type: 'production_line',
    name: matchingEntity,
  };
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
  const normalized = normalizeQuestion(question || '');

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
    'why is this changing',
    'why is this line underperforming',
    'explain',
    'explain this issue',
    'summarize this issue',
    'what should i investigate',
    'what should we do next',
    'what should i do next',
    'how should i interpret this',
    'what should i investigate for',
    'why is this',
  ];

  if (hasAnyPhrase(normalized, knowledgePatterns)) {
    return 'knowledge';
  }

  if (hasAnyPhrase(normalized, explainPatterns)) {
    return 'explain_context';
  }

  if (/\b(why|explain|summari[sz]e|investigate|interpret)\b/i.test(normalized)) {
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
  const detectedEntity = detectKnownEntity(rawQuestion);
  const detectedTimeRange = detectTimeRange(rawQuestion);

  return compactContext({
    kpi: detectedKpi,
    entity: detectedEntity,
    time_range: detectedTimeRange,
    source,
  });
}

export function mergeContext(baseContext = {}, questionContext = {}, source = 'app') {
  return compactContext({
    kpi: mergeField(baseContext.kpi, questionContext.kpi),
    entity: mergeField(baseContext.entity, questionContext.entity),
    time_range: mergeField(baseContext.time_range, questionContext.time_range),
    trend: mergeField(baseContext.trend, questionContext.trend),
    possible_drivers: Array.isArray(questionContext.possible_drivers)
      ? questionContext.possible_drivers
      : baseContext.possible_drivers,
    source: questionContext.source || baseContext.source || source,
  });
}

export function buildAiPayload(question, appState = {}) {
  const mode = classifyAiMode(question);
  const questionContext = parseQuestionContext(question, appState?.source || 'app');
  const mergedContext = mergeContext(appState, questionContext, appState?.source || 'app');

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
    const dashboardContext = compactContext({
      ...mergedContext,
      source: 'app',
    });
    const hasSubstantiveContext = Boolean(
      dashboardContext.kpi
      || dashboardContext.entity
      || dashboardContext.time_range
      || dashboardContext.trend
      || (Array.isArray(dashboardContext.possible_drivers) && dashboardContext.possible_drivers.length > 0),
    );

    if (hasSubstantiveContext) {
      payload.dashboard_context = dashboardContext;
    }
  }

  return payload;
}

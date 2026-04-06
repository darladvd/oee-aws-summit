function capitalize(value) {
  if (!value) {
    return value;
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
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
  ];

  const explainPatterns = [
    'why is',
    'underperform',
    'explain',
    'what should we do next',
    'what should i do next',
    'why did',
    'decrease',
    'summarize',
    'anomaly',
    'trend',
    'issue',
    'next actions',
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
  const lowerQuestion = rawQuestion.toLowerCase();

  let kpiName = 'OEE';
  if (lowerQuestion.includes('availability')) {
    kpiName = 'Availability';
  } else if (lowerQuestion.includes('quality')) {
    kpiName = 'Quality';
  } else if (lowerQuestion.includes('efficiency')) {
    kpiName = 'Efficiency';
  }

  let entityName = 'Line B';
  const entityMatch = rawQuestion.match(/\bline\s+([a-z0-9-]+)/i);
  if (entityMatch) {
    entityName = `Line ${capitalize(entityMatch[1])}`;
  }

  let timeLabel = 'last 7 days';
  const monthMatch = rawQuestion.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)(?:\s+\d{4})?\b/i,
  );
  if (monthMatch) {
    timeLabel = monthMatch[0];
  } else if (lowerQuestion.includes('this week')) {
    timeLabel = 'this week';
  } else if (lowerQuestion.includes('last 7 days')) {
    timeLabel = 'last 7 days';
  } else if (lowerQuestion.includes('last week')) {
    timeLabel = 'last week';
  }

  let trendDirection = 'decreasing';
  let trendDescription = `${kpiName} declined versus the previous period`;
  if (lowerQuestion.includes('increase') || lowerQuestion.includes('improv')) {
    trendDirection = 'increasing';
    trendDescription = `${kpiName} improved versus the previous period`;
  } else if (lowerQuestion.includes('underperform')) {
    trendDescription = `${entityName} is underperforming versus the previous period`;
  }

  const possibleDrivers = [];
  if (lowerQuestion.includes('downtime') || lowerQuestion.includes('stop')) {
    possibleDrivers.push('downtime increased');
  }
  if (lowerQuestion.includes('quality')) {
    possibleDrivers.push('quality losses increased');
  }
  if (lowerQuestion.includes('changeover')) {
    possibleDrivers.push('changeover delays increased');
  }
  if (possibleDrivers.length === 0) {
    possibleDrivers.push('downtime increased');
  }

  return {
    kpi: { name: kpiName },
    entity: { type: 'line', name: entityName },
    time_range: { label: timeLabel },
    trend: {
      direction: trendDirection,
      description: trendDescription,
    },
    possible_drivers: possibleDrivers,
    source,
  };
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
    payload.dashboard_context = {
      kpi: {
        name: selectedContext?.kpi?.name || 'OEE',
      },
      entity: {
        type: selectedContext?.entity?.type || 'line',
        name: selectedContext?.entity?.name || 'Line B',
      },
      time_range: {
        label: selectedContext?.time_range?.label || 'last 7 days',
      },
      trend: {
        direction: selectedContext?.trend?.direction || 'decreasing',
        description:
          selectedContext?.trend?.description || 'OEE declined versus the previous period',
      },
      possible_drivers:
        selectedContext?.possible_drivers?.length > 0
          ? selectedContext.possible_drivers
          : ['downtime increased'],
      source: selectedContext?.source || 'app',
    };
  }

  return payload;
}

export function buildAiPrefillQuestion() {
  return 'Explain the current OEE trend and suggest next actions.';
}

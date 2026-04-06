import {
  GenerateEmbedUrlForRegisteredUserCommand,
  QuickSightClient,
} from '@aws-sdk/client-quicksight';

const region =
  process.env.AWS_REGION ||
  process.env.QUICKSIGHT_REGION ||
  'ap-southeast-1';

const client = new QuickSightClient({ region });

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getAllowedDomains() {
  const rawValue =
    process.env.QUICKSIGHT_ALLOWED_DOMAINS ||
    'http://localhost:5173,https://master.d96p7tkwm1e3e.amplifyapp.com';

  return rawValue
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function getPath(event) {
  return event?.rawPath || event?.path || '';
}

function getRouteType(event) {
  const path = getPath(event).toLowerCase();

  if (path.endsWith('/dashboard-url')) {
    return 'dashboard';
  }

  if (path.endsWith('/q-url')) {
    return 'q';
  }

  const explicitType = event?.queryStringParameters?.type?.toLowerCase();
  if (explicitType === 'dashboard' || explicitType === 'q') {
    return explicitType;
  }

  return null;
}

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET,OPTIONS',
    },
    body: JSON.stringify(body),
  };
}

async function generateDashboardEmbedUrl() {
  const awsAccountId = getRequiredEnv('AWS_ACCOUNT_ID');
  const dashboardId = getRequiredEnv('QUICKSIGHT_DASHBOARD_ID');
  const userArn = getRequiredEnv('QUICKSIGHT_USER_ARN');

  const command = new GenerateEmbedUrlForRegisteredUserCommand({
    AwsAccountId: awsAccountId,
    UserArn: userArn,
    ExperienceConfiguration: {
      Dashboard: {
        InitialDashboardId: dashboardId,
      },
    },
    AllowedDomains: getAllowedDomains(),
    SessionLifetimeInMinutes: 60,
  });

  const result = await client.send(command);
  return result.EmbedUrl;
}

async function generateQEmbedUrl() {
  const awsAccountId = getRequiredEnv('AWS_ACCOUNT_ID');
  const topicId = getRequiredEnv('QUICKSIGHT_TOPIC_ID');
  const userArn = getRequiredEnv('QUICKSIGHT_USER_ARN');

  const command = new GenerateEmbedUrlForRegisteredUserCommand({
    AwsAccountId: awsAccountId,
    UserArn: userArn,
    ExperienceConfiguration: {
      GenerativeQnA: {
        InitialTopicId: topicId,
      },
    },
    AllowedDomains: getAllowedDomains(),
    SessionLifetimeInMinutes: 60,
  });

  const result = await client.send(command);
  return result.EmbedUrl;
}

export const handler = async (event) => {
  if (event?.requestContext?.http?.method === 'OPTIONS' || event?.httpMethod === 'OPTIONS') {
    return jsonResponse(200, { ok: true });
  }

  try {
    const routeType = getRouteType(event);

    if (!routeType) {
      return jsonResponse(400, {
        error: 'Unsupported QuickSight embed route',
      });
    }

    const embedUrl =
      routeType === 'dashboard'
        ? await generateDashboardEmbedUrl()
        : await generateQEmbedUrl();

    return jsonResponse(200, { embedUrl });
  } catch (error) {
    console.error('QuickSight registered embed generation failed:', error);

    return jsonResponse(500, {
      error: 'Failed to generate QuickSight embed URL',
      details: error.message,
    });
  }
};

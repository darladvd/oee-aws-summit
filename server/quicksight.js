//for local
import {
  GenerateEmbedUrlForAnonymousUserCommand,
  QuickSightClient,
} from '@aws-sdk/client-quicksight';

const region =
  process.env.AWS_REGION ||
  process.env.QUICKSIGHT_REGION ||
  'ap-southeast-1';

const client = new QuickSightClient({ region });

const allowedDomains = [
  'http://localhost:5173',
  'https://master.d96p7tkwm1e3e.amplifyapp.com',
];

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getDashboardArn() {
  const awsAccountId = getRequiredEnv('AWS_ACCOUNT_ID');
  const dashboardId = getRequiredEnv('QUICKSIGHT_DASHBOARD_ID');
  return `arn:aws:quicksight:${region}:${awsAccountId}:dashboard/${dashboardId}`;
}

function getTopicArn() {
  const awsAccountId = getRequiredEnv('AWS_ACCOUNT_ID');
  const topicId = getRequiredEnv('QUICKSIGHT_TOPIC_ID');
  return `arn:aws:quicksight:${region}:${awsAccountId}:topic/${topicId}`;
}

export async function getDashboardEmbedUrl(req, res) {
  try {
    const awsAccountId = getRequiredEnv('AWS_ACCOUNT_ID');
    const dashboardId = getRequiredEnv('QUICKSIGHT_DASHBOARD_ID');

    const command = new GenerateEmbedUrlForAnonymousUserCommand({
      AwsAccountId: awsAccountId,
      Namespace: 'default',
      AuthorizedResourceArns: [getDashboardArn()],
      ExperienceConfiguration: {
        Dashboard: {
          InitialDashboardId: dashboardId,
        },
      },
      AllowedDomains: allowedDomains,
      SessionLifetimeInMinutes: 60,
    });

    const result = await client.send(command);

    return res.status(200).json({
      embedUrl: result.EmbedUrl,
    });
  } catch (error) {
    console.error('Error generating anonymous dashboard embed URL:', error);

    return res.status(500).json({
      error: 'Failed to generate dashboard embed URL',
      details: error.message,
    });
  }
}

export async function getQEmbedUrl(req, res) {
  try {
    const awsAccountId = getRequiredEnv('AWS_ACCOUNT_ID');
    const topicId = getRequiredEnv('QUICKSIGHT_TOPIC_ID');

    const command = new GenerateEmbedUrlForAnonymousUserCommand({
      AwsAccountId: awsAccountId,
      Namespace: 'default',
      AuthorizedResourceArns: [getTopicArn()],
      ExperienceConfiguration: {
        GenerativeQnA: {
          InitialTopicId: topicId,
        },
      },
      AllowedDomains: allowedDomains,
      SessionLifetimeInMinutes: 60,
    });

    const result = await client.send(command);

    return res.status(200).json({
      embedUrl: result.EmbedUrl,
    });
  } catch (error) {
    console.error('Error generating anonymous Generative Q&A embed URL:', error);

    return res.status(500).json({
      error: 'Failed to generate Generative Q&A embed URL',
      details: error.message,
    });
  }
}
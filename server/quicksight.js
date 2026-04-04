import {
  GenerateEmbedUrlForRegisteredUserCommand,
  QuickSightClient,
} from '@aws-sdk/client-quicksight';

const region = process.env.AWS_REGION || process.env.QUICKSIGHT_REGION || 'ap-southeast-1';
const client = new QuickSightClient({ region });

export async function getDashboardEmbedUrl(req, res) {
  try {
    const command = new GenerateEmbedUrlForRegisteredUserCommand({
      AwsAccountId: process.env.AWS_ACCOUNT_ID,
      UserArn: process.env.QUICKSIGHT_USER_ARN,
      ExperienceConfiguration: {
        Dashboard: {
          InitialDashboardId: process.env.QUICKSIGHT_DASHBOARD_ID,
        },
      },
      AllowedDomains: ['http://localhost:5173'],
      SessionLifetimeInMinutes: 60,
    });

    const result = await client.send(command);

    res.json({
      embedUrl: result.EmbedUrl,
    });
  } catch (error) {
    console.error('Error generating QuickSight embed URL:', error);
    res.status(500).json({ error: 'Failed to generate embed URL' });
  }
}

export async function getQEmbedUrl(req, res) {
  try {
    const command = new GenerateEmbedUrlForRegisteredUserCommand({
      AwsAccountId: process.env.AWS_ACCOUNT_ID,
      UserArn: process.env.QUICKSIGHT_USER_ARN,
      ExperienceConfiguration: {
        GenerativeQnA: {
          InitialTopicId: process.env.QUICKSIGHT_TOPIC_ID,
        },
      },
      AllowedDomains: ['http://localhost:5173'],
      SessionLifetimeInMinutes: 60,
    });

    const result = await client.send(command);

    res.json({
      embedUrl: result.EmbedUrl,
    });
  } catch (error) {
    console.error('Error generating Q embed URL:', error);
    res.status(500).json({ error: 'Failed to generate Q embed URL' });
  }
}

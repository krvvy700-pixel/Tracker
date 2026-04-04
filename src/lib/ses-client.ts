import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const sesClient = new SESClient({
  region: process.env.AWS_SES_REGION || 'ap-south-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

const FROM_EMAIL = process.env.SES_FROM_EMAIL || 'tracking@shiptrack.store';

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: EmailPayload): Promise<{ success: boolean; error?: string }> {
  if (!to || !to.includes('@')) {
    return { success: false, error: 'Invalid email address' };
  }

  try {
    const command = new SendEmailCommand({
      Source: FROM_EMAIL,
      Destination: { ToAddresses: [to] },
      Message: {
        Subject: { Data: subject, Charset: 'UTF-8' },
        Body: { Html: { Data: html, Charset: 'UTF-8' } },
      },
    });

    await sesClient.send(command);
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown SES error';
    console.error(`SES send failed to ${to}:`, message);
    return { success: false, error: message };
  }
}

// Batch send with rate limiting (SES default: 14/sec)
export async function sendBatchEmails(
  emails: EmailPayload[]
): Promise<{ sent: number; failed: number; errors: string[] }> {
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  // Process in batches of 10 with 1-second gaps to stay under SES rate limit
  const BATCH = 10;
  for (let i = 0; i < emails.length; i += BATCH) {
    const batch = emails.slice(i, i + BATCH);
    const results = await Promise.all(batch.map((e) => sendEmail(e)));

    for (const r of results) {
      if (r.success) sent++;
      else {
        failed++;
        if (r.error) errors.push(r.error);
      }
    }

    // Rate limit pause between batches
    if (i + BATCH < emails.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return { sent, failed, errors: errors.slice(0, 5) };
}

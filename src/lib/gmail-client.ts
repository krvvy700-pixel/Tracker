import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER || '',
    pass: process.env.GMAIL_APP_PASSWORD || '',
  },
});

const FROM_EMAIL = process.env.GMAIL_USER || '';
const FROM_NAME = process.env.GMAIL_FROM_NAME || 'ShipTrack';

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: EmailPayload): Promise<{ success: boolean; error?: string }> {
  if (!to || !to.includes('@')) {
    return { success: false, error: 'Invalid email address' };
  }

  if (!FROM_EMAIL) {
    return { success: false, error: 'GMAIL_USER not configured' };
  }

  try {
    await transporter.sendMail({
      from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
      to,
      subject,
      html,
    });
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown Gmail error';
    console.error(`Gmail send failed to ${to}:`, message);
    return { success: false, error: message };
  }
}

// Batch send with rate limiting (Gmail Workspace: ~2000/day, pace at 5/sec)
export async function sendBatchEmails(
  emails: EmailPayload[]
): Promise<{ sent: number; failed: number; errors: string[] }> {
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  // Process in batches of 5 with 1-second gaps to stay under Gmail rate limit
  const BATCH = 5;
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
      await new Promise((resolve) => setTimeout(resolve, 1200));
    }
  }

  return { sent, failed, errors: errors.slice(0, 5) };
}

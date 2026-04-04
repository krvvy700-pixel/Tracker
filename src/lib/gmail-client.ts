import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  pool: true,           // Reuse one SMTP connection for all emails
  maxConnections: 1,    // Only 1 connection to avoid "too many logins"
  maxMessages: 100,     // Send up to 100 emails per connection
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

// Batch send — sequential with delays to stay under Gmail rate limit
export async function sendBatchEmails(
  emails: EmailPayload[]
): Promise<{ sent: number; failed: number; errors: string[] }> {
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  // Send one at a time with a short delay — pool reuses the same connection
  for (let i = 0; i < emails.length; i++) {
    const result = await sendEmail(emails[i]);

    if (result.success) {
      sent++;
    } else {
      failed++;
      if (result.error) errors.push(result.error);
      // If we get a rate limit error, stop sending
      if (result.error?.includes('Too many') || result.error?.includes('limit')) {
        errors.push(`Stopped after ${i + 1}/${emails.length} — Gmail rate limit hit`);
        failed += emails.length - i - 1;
        break;
      }
    }

    // Small delay between emails to be gentle on Gmail
    if (i < emails.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  return { sent, failed, errors: errors.slice(0, 5) };
}

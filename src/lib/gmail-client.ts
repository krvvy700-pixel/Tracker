// Gmail Draft Creator — sends email data to Google Apps Script
// which creates drafts in user's Gmail inbox

const SCRIPT_URL = process.env.GMAIL_SCRIPT_URL || '';

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: EmailPayload): Promise<{ success: boolean; error?: string }> {
  if (!to || !to.includes('@')) {
    return { success: false, error: 'Invalid email address' };
  }
  // Single email — delegate to batch
  const result = await sendBatchEmails([{ to, subject, html }]);
  return result.sent > 0 ? { success: true } : { success: false, error: result.errors[0] || 'Failed to create draft' };
}

// Create Gmail drafts via Google Apps Script
export async function sendBatchEmails(
  emails: EmailPayload[]
): Promise<{ sent: number; failed: number; errors: string[] }> {
  if (!SCRIPT_URL) {
    return { sent: 0, failed: emails.length, errors: ['GMAIL_SCRIPT_URL not configured — set it in Vercel env vars'] };
  }

  if (emails.length === 0) {
    return { sent: 0, failed: 0, errors: [] };
  }

  try {
    // Google Apps Script has a payload limit, so batch into chunks of 50
    let totalCreated = 0;
    let totalFailed = 0;
    const allErrors: string[] = [];

    const CHUNK = 50;
    for (let i = 0; i < emails.length; i += CHUNK) {
      const chunk = emails.slice(i, i + CHUNK);

      const res = await fetch(SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails: chunk }),
        // Google Apps Script redirects on POST — follow it
        redirect: 'follow',
      });

      if (!res.ok) {
        const text = await res.text().catch(() => 'Unknown error');
        allErrors.push(`Script returned ${res.status}: ${text.slice(0, 100)}`);
        totalFailed += chunk.length;
        continue;
      }

      const data = await res.json().catch(() => null);

      if (data && data.success) {
        totalCreated += data.drafts || 0;
        totalFailed += data.failed || 0;
        if (data.errors) allErrors.push(...data.errors);
      } else {
        allErrors.push(data?.error || 'Unknown script error');
        totalFailed += chunk.length;
      }

      // Small pause between chunks
      if (i + CHUNK < emails.length) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    return { sent: totalCreated, failed: totalFailed, errors: allErrors.slice(0, 5) };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Gmail draft creation failed:', message);
    return { sent: 0, failed: emails.length, errors: [message] };
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getAuthFromRequest } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { sendBatchEmails } from '@/lib/ses-client';
import { generateTrackingEmail } from '@/lib/email-templates';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://shiptrack.store';

export async function POST(request: NextRequest) {
  const user = getAuthFromRequest(request);
  if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { orderIds, status } = body;

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json({ error: 'No order IDs provided' }, { status: 400 });
    }

    if (!status) {
      return NextResponse.json({ error: 'No status provided' }, { status: 400 });
    }

    // Fetch orders with business info
    const { data: orders, error: fetchError } = await getSupabaseAdmin()
      .from('orders')
      .select(`
        order_id, customer_name, customer_email, tracking_id, courier_partner,
        tracking_token, estimated_delivery, order_total, city,
        business_id, order_items (product_name),
        businesses (name, logo_url, support_email, support_phone)
      `)
      .in('order_id', orderIds);

    if (fetchError || !orders) {
      return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
    }

    const withEmail: typeof orders = [];
    const noEmail: string[] = [];

    for (const order of orders) {
      if (order.customer_email && order.customer_email.includes('@')) {
        withEmail.push(order);
      } else {
        noEmail.push(order.order_id);
      }
    }

    // Build email payloads
    const emails = withEmail
      .map((order) => {
        /* eslint-disable @typescript-eslint/no-explicit-any */
        const biz = (order as any).businesses || {};
        const items = (order as any).order_items || [];
        const logoUrl = biz.logo_url && biz.logo_url.includes('drive.google.com')
          ? biz.logo_url.replace(/\/file\/d\/([^/]+).*/, '/uc?export=view&id=$1')
          : biz.logo_url;

        const result = generateTrackingEmail(
          {
            customerName: order.customer_name,
            orderId: order.order_id,
            productNames: items.map((i: { product_name: string }) => i.product_name).filter(Boolean),
            trackingId: order.tracking_id || '',
            courierPartner: order.courier_partner || '',
            trackingUrl: `${BASE_URL}/track/${order.tracking_token}`,
            businessName: biz.name || 'ShipTrack',
            businessLogoUrl: logoUrl || undefined,
            supportEmail: biz.support_email || '',
            supportPhone: biz.support_phone || '',
            estimatedDelivery: order.estimated_delivery || undefined,
            orderTotal: order.order_total || 0,
            city: order.city || '',
          },
          status
        );

        if (!result) return null;
        return { to: order.customer_email, subject: result.subject, html: result.html };
      })
      .filter((e): e is NonNullable<typeof e> => e !== null);

    if (emails.length === 0) {
      return NextResponse.json({
        sent: 0,
        failed: 0,
        noEmail: noEmail.length,
        noEmailOrders: noEmail,
        message: 'No emails to send (no valid email addresses or unsupported status)',
      });
    }

    // Send via SES
    const result = await sendBatchEmails(emails);

    // Log to email_logs table
    const logRows = withEmail.map((order, i) => ({
      order_id: order.order_id,
      status,
      recipient_email: order.customer_email,
      success: i < result.sent,
      error_message: i >= result.sent ? (result.errors[i - result.sent] || '') : '',
    }));

    // Insert logs in batches
    for (let i = 0; i < logRows.length; i += 100) {
      const batch = logRows.slice(i, i + 100);
      await getSupabaseAdmin().from('email_logs').insert(batch).select();
    }

    return NextResponse.json({
      sent: result.sent,
      failed: result.failed,
      noEmail: noEmail.length,
      noEmailOrders: noEmail,
      errors: result.errors,
      message: `${result.sent} emails sent, ${result.failed} failed, ${noEmail.length} have no email`,
    });
  } catch (err) {
    console.error('Send email error:', err);
    return NextResponse.json({ error: 'Email sending failed' }, { status: 500 });
  }
}

// GET: Fetch daily email stats
export async function GET(request: NextRequest) {
  const user = getAuthFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { count } = await getSupabaseAdmin()
      .from('email_logs')
      .select('*', { count: 'exact', head: true })
      .gte('sent_at', today.toISOString())
      .eq('success', true);

    return NextResponse.json({ sentToday: count || 0 });
  } catch {
    return NextResponse.json({ sentToday: 0 });
  }
}

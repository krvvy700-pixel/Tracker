import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// GET - public tracking by token or orderId+phone
// Optimized: 1 query instead of 3 (saves API requests on Supabase Free)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  const orderId = searchParams.get('orderId');
  const phone = searchParams.get('phone');

  if (token) {
    // Token-based tracking — single query with business join
    const { data: order, error } = await getSupabaseAdmin()
      .from('orders')
      .select(`
        order_id, customer_name, tracking_status, tracking_id, courier_partner,
        status_updated_at, estimated_delivery, order_total, payment_method,
        is_cancelled, city, state, pincode, created_at, business_id,
        order_items(*),
        businesses(name, logo_url, support_email, support_phone)
      `)
      .eq('tracking_token', token)
      .single();

    if (error || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Extract business from joined data
    const business = (order as Record<string, unknown>).businesses || null;
    const { businesses: _, ...cleanOrder } = order as Record<string, unknown>;

    // History — still need a separate query (different table)
    const { data: history } = await getSupabaseAdmin()
      .from('tracking_history')
      .select('status, created_at, notes')
      .eq('order_id', order.order_id)
      .order('created_at', { ascending: true });

    return NextResponse.json({ order: cleanOrder, business, history: history || [] });
  }

  if (orderId && phone) {
    const normalizedPhone = phone.replace(/\D/g, '').slice(-4);

    // Single query with business join
    const { data: order, error } = await getSupabaseAdmin()
      .from('orders')
      .select(`
        order_id, customer_name, tracking_status, tracking_id, courier_partner,
        status_updated_at, estimated_delivery, order_total, payment_method,
        is_cancelled, city, state, pincode, created_at, customer_mobile, business_id,
        order_items(*),
        businesses(name, logo_url, support_email, support_phone)
      `)
      .eq('order_id', orderId)
      .single();

    if (error || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Verify phone
    const orderPhoneLast4 = order.customer_mobile.slice(-4);
    if (normalizedPhone !== orderPhoneLast4) {
      return NextResponse.json({ error: 'Phone number does not match' }, { status: 403 });
    }

    const { customer_mobile, businesses: biz, ...safeOrder } = order as Record<string, unknown>;
    const business = biz || null;

    const { data: history } = await getSupabaseAdmin()
      .from('tracking_history')
      .select('status, created_at, notes')
      .eq('order_id', order.order_id)
      .order('created_at', { ascending: true });

    return NextResponse.json({ order: safeOrder, business, history: history || [] });
  }

  return NextResponse.json({ error: 'Provide token or orderId+phone' }, { status: 400 });
}

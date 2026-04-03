import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// GET - public tracking by token
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  const orderId = searchParams.get('orderId');
  const phone = searchParams.get('phone');

  if (token) {
    // Token-based tracking (direct link)
    const { data: order, error } = await getSupabaseAdmin()
      .from('orders')
      .select('order_id, customer_name, tracking_status, tracking_id, courier_partner, status_updated_at, estimated_delivery, order_total, payment_method, is_cancelled, city, state, pincode, created_at, order_items(*)')
      .eq('tracking_token', token)
      .single();

    if (error || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Get tracking history
    const { data: history } = await getSupabaseAdmin()
      .from('tracking_history')
      .select('*')
      .eq('order_id', order.order_id)
      .order('created_at', { ascending: true });

    return NextResponse.json({ order, history: history || [] });
  }

  if (orderId && phone) {
    // Order ID + phone verification
    const normalizedPhone = phone.replace(/\D/g, '').slice(-4);

    const { data: order, error } = await getSupabaseAdmin()
      .from('orders')
      .select('order_id, customer_name, tracking_status, tracking_id, courier_partner, status_updated_at, estimated_delivery, order_total, payment_method, is_cancelled, city, state, pincode, created_at, customer_mobile, order_items(*)')
      .eq('order_id', orderId)
      .single();

    if (error || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Verify last 4 digits of phone
    const orderPhoneLast4 = order.customer_mobile.slice(-4);
    if (normalizedPhone !== orderPhoneLast4) {
      return NextResponse.json({ error: 'Phone number does not match' }, { status: 403 });
    }

    // Remove sensitive data
    const { customer_mobile, ...safeOrder } = order;

    // Get tracking history
    const { data: history } = await getSupabaseAdmin()
      .from('tracking_history')
      .select('*')
      .eq('order_id', order.order_id)
      .order('created_at', { ascending: true });

    return NextResponse.json({ order: safeOrder, history: history || [] });
  }

  return NextResponse.json({ error: 'Provide token or orderId+phone' }, { status: 400 });
}

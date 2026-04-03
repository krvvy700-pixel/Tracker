import { NextRequest, NextResponse } from 'next/server';
import { getAuthFromRequest } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';

// GET all orders with filtering
export async function GET(request: NextRequest) {
  const user = getAuthFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';
  const status = searchParams.get('status') || '';
  const brand = searchParams.get('brand') || '';
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = (page - 1) * limit;

  let query = getSupabaseAdmin()
    .from('orders')
    .select('*, order_items(*)', { count: 'exact' });

  if (search) {
    query = query.or(
      `order_id.ilike.%${search}%,customer_name.ilike.%${search}%,customer_mobile.ilike.%${search}%,customer_email.ilike.%${search}%`
    );
  }

  if (status) {
    if (status === 'Cancelled') {
      query = query.eq('is_cancelled', true);
    } else {
      query = query.eq('tracking_status', status).eq('is_cancelled', false);
    }
  }

  if (brand) {
    // Filter by brand through order_items
    const { data: orderIds } = await getSupabaseAdmin()
      .from('order_items')
      .select('order_id')
      .eq('brand', brand);
    
    if (orderIds && orderIds.length > 0) {
      const uniqueIds = [...new Set(orderIds.map(o => o.order_id))];
      query = query.in('order_id', uniqueIds);
    } else {
      return NextResponse.json({ orders: [], total: 0, page, limit });
    }
  }

  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    orders: data || [],
    total: count || 0,
    page,
    limit,
  });
}

// PATCH - bulk update status
export async function PATCH(request: NextRequest) {
  const user = getAuthFromRequest(request);
  if (!user || user.role === 'viewer') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { orderIds, status, trackingId, courierPartner, notes } = await request.json();

    if (!orderIds || !Array.isArray(orderIds) || !status) {
      return NextResponse.json({ error: 'orderIds array and status required' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {
      tracking_status: status,
      status_updated_at: new Date().toISOString(),
    };

    if (status === 'Cancelled') {
      updateData.is_cancelled = true;
      updateData.cancelled_at = new Date().toISOString();
    }

    if (trackingId) updateData.tracking_id = trackingId;
    if (courierPartner) updateData.courier_partner = courierPartner;

    const { error } = await getSupabaseAdmin()
      .from('orders')
      .update(updateData)
      .in('order_id', orderIds);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Add tracking history for each order
    const historyEntries = orderIds.map((orderId: string) => ({
      order_id: orderId,
      status,
      changed_by: user.displayName || user.username,
      notes: notes || `Status updated to ${status}`,
    }));

    await getSupabaseAdmin().from('tracking_history').insert(historyEntries);

    return NextResponse.json({ success: true, updated: orderIds.length });
  } catch {
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
}

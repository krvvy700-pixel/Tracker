import { NextRequest, NextResponse } from 'next/server';
import { getAuthFromRequest } from '@/lib/auth';
import { cleanCSVData, CleanedOrder } from '@/lib/csv-cleaner';
import { getSupabaseAdmin } from '@/lib/supabase';
import Papa from 'papaparse';

// No maxDuration needed — each chunk finishes in <5s on Hobby

const BATCH_SIZE = 500;
const PARALLEL_LIMIT = 50;

// Generate tracking ID: ST + 10 uppercase alphanumeric chars
function generateTrackingId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = 'ST';
  for (let i = 0; i < 10; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

export async function POST(request: NextRequest) {
  const user = getAuthFromRequest(request);
  if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const chunkIndex = parseInt(formData.get('chunkIndex') as string || '0');
    const totalChunks = parseInt(formData.get('totalChunks') as string || '1');
    const isLastChunk = chunkIndex === totalChunks - 1;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const csvText = await file.text();
    const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });

    if (parsed.errors.length > 0) {
      return NextResponse.json(
        { error: 'CSV parsing errors', details: parsed.errors.slice(0, 5) },
        { status: 400 }
      );
    }

    const { orders, stats } = cleanCSVData(parsed.data as Record<string, string>[]);

    // ═══ AUTO-DETECT BRANDS → CREATE BUSINESSES ═══
    const allBrands = new Set<string>();
    orders.forEach((o) => o.items.forEach((item) => { if (item.brand) allBrands.add(item.brand); }));
    const brandArr = Array.from(allBrands).filter((b) => b.length > 0);

    const bizMap = new Map<string, string>();

    if (brandArr.length > 0) {
      const { data: existingBiz } = await getSupabaseAdmin()
        .from('businesses')
        .select('id, name');
      if (existingBiz) existingBiz.forEach((b) => bizMap.set(b.name.toLowerCase(), b.id));

      for (const brand of brandArr) {
        if (!bizMap.has(brand.toLowerCase())) {
          const { data } = await getSupabaseAdmin()
            .from('businesses')
            .insert({ name: brand })
            .select('id')
            .single();
          if (data) bizMap.set(brand.toLowerCase(), data.id);
        }
      }
    }

    const getBusinessId = (order: CleanedOrder): string | null => {
      const brand = order.items[0]?.brand;
      if (brand && bizMap.has(brand.toLowerCase())) return bizMap.get(brand.toLowerCase())!;
      return null;
    };

    // ═══ STEP 1: Batch-check existing orders ═══
    const allOrderIds = orders.map((o) => o.order_id);
    const existingOrderIds = new Set<string>();

    for (let i = 0; i < allOrderIds.length; i += BATCH_SIZE) {
      const batch = allOrderIds.slice(i, i + BATCH_SIZE);
      const { data } = await getSupabaseAdmin()
        .from('orders')
        .select('order_id')
        .in('order_id', batch);
      if (data) data.forEach((d) => existingOrderIds.add(d.order_id));
    }

    const newOrders = orders.filter((o) => !existingOrderIds.has(o.order_id));
    const existingOrders = orders.filter((o) => existingOrderIds.has(o.order_id));

    // ═══ STEP 2: Batch-INSERT new orders ═══
    let newCount = 0;
    for (let i = 0; i < newOrders.length; i += BATCH_SIZE) {
      const batch = newOrders.slice(i, i + BATCH_SIZE);
      const rows = batch.map((order) => {
        const businessId = getBusinessId(order);
        return {
          order_id: order.order_id,
          shopify_id: order.shopify_id,
          payment_method: order.payment_method,
          financial_status: order.financial_status,
          customer_name: order.customer_name,
          customer_email: order.customer_email,
          customer_mobile: order.customer_mobile,
          address_line1: order.address_line1,
          address_line2: order.address_line2,
          address_line3: order.address_line3,
          city: order.city,
          state: order.state,
          pincode: order.pincode,
          order_total: order.order_total,
          is_cancelled: order.is_cancelled,
          tracking_status: order.is_cancelled ? 'Cancelled' : 'Order Placed',
          tracking_id: generateTrackingId(),
          ...(businessId ? { business_id: businessId } : {}),
        };
      });

      const { error } = await getSupabaseAdmin().from('orders').insert(rows);
      if (!error) newCount += batch.length;
    }

    // ═══ STEP 3: Parallel-UPDATE existing orders ═══
    let updatedCount = 0;
    for (let i = 0; i < existingOrders.length; i += PARALLEL_LIMIT) {
      const batch = existingOrders.slice(i, i + PARALLEL_LIMIT);
      const results = await Promise.all(
        batch.map((order) => {
          const businessId = getBusinessId(order);
          return getSupabaseAdmin()
            .from('orders')
            .update({
              payment_method: order.payment_method,
              financial_status: order.financial_status,
              customer_name: order.customer_name,
              customer_email: order.customer_email,
              customer_mobile: order.customer_mobile,
              address_line1: order.address_line1,
              address_line2: order.address_line2,
              address_line3: order.address_line3,
              city: order.city,
              state: order.state,
              pincode: order.pincode,
              order_total: order.order_total,
              is_cancelled: order.is_cancelled,
              ...(businessId ? { business_id: businessId } : {}),
            })
            .eq('order_id', order.order_id);
        })
      );
      updatedCount += results.filter((r) => !r.error).length;
    }

    // ═══ STEP 4: Delete old items for existing orders ═══
    const existingOrderIdsArr = Array.from(existingOrderIds);
    for (let i = 0; i < existingOrderIdsArr.length; i += BATCH_SIZE) {
      const batch = existingOrderIdsArr.slice(i, i + BATCH_SIZE);
      await getSupabaseAdmin().from('order_items').delete().in('order_id', batch);
    }

    // ═══ STEP 5: Batch-INSERT all items ═══
    const allItems = orders.flatMap((o) =>
      o.items.map((item) => ({
        order_id: o.order_id,
        brand: item.brand,
        product_name: item.product_name,
        quantity: item.quantity,
        price: item.price,
      }))
    );

    for (let i = 0; i < allItems.length; i += BATCH_SIZE) {
      const batch = allItems.slice(i, i + BATCH_SIZE);
      await getSupabaseAdmin().from('order_items').insert(batch);
    }

    // ═══ STEP 6: Tracking history for new orders ═══
    const historyRows = newOrders.map((o) => ({
      order_id: o.order_id,
      status: o.is_cancelled ? 'Cancelled' : 'Order Placed',
      changed_by: user.username,
      notes: '',
    }));

    for (let i = 0; i < historyRows.length; i += BATCH_SIZE) {
      const batch = historyRows.slice(i, i + BATCH_SIZE);
      await getSupabaseAdmin().from('tracking_history').insert(batch);
    }

    // ═══ STEP 7: Log (only on last chunk) ═══
    if (isLastChunk) {
      await getSupabaseAdmin().from('upload_logs').insert({
        filename: file.name,
        total_rows: stats.total,
        new_orders: newCount,
        updated_orders: updatedCount,
        skipped_rows: stats.total - stats.unique,
        uploaded_by: user.username,
      });
    }

    return NextResponse.json({
      success: true,
      chunk: chunkIndex,
      totalChunks,
      stats: {
        ...stats,
        newOrders: newCount,
        updatedOrders: updatedCount,
        brandsDetected: brandArr.length,
      },
    });
  } catch (err) {
    console.error('Upload error:', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}

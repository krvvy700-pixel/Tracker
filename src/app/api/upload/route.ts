import { NextRequest, NextResponse } from 'next/server';
import { getAuthFromRequest } from '@/lib/auth';
import { cleanCSVData, CleanedOrder } from '@/lib/csv-cleaner';
import { getSupabaseAdmin } from '@/lib/supabase';
import Papa from 'papaparse';

export async function POST(request: NextRequest) {
  const user = getAuthFromRequest(request);
  if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
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

    let newOrders = 0;
    let updatedOrders = 0;

    for (const order of orders) {
      // Check if order exists
      const { data: existing } = await getSupabaseAdmin()
        .from('orders')
        .select('order_id, tracking_status')
        .eq('order_id', order.order_id)
        .single();

      if (existing) {
        // Update existing order (don't overwrite tracking status)
        await getSupabaseAdmin()
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
          })
          .eq('order_id', order.order_id);

        // Replace items
        await getSupabaseAdmin().from('order_items').delete().eq('order_id', order.order_id);
        await insertItems(order.order_id, order.items);
        updatedOrders++;
      } else {
        // Insert new order
        const { error } = await getSupabaseAdmin().from('orders').insert({
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
        });

        if (!error) {
          await insertItems(order.order_id, order.items);
          
          // Add initial tracking history
          await getSupabaseAdmin().from('tracking_history').insert({
            order_id: order.order_id,
            status: order.is_cancelled ? 'Cancelled' : 'Order Placed',
            changed_by: user.username,
            notes: 'CSV import',
          });
          
          newOrders++;
        }
      }
    }

    // Log the upload
    await getSupabaseAdmin().from('upload_logs').insert({
      filename: file.name,
      total_rows: stats.total,
      new_orders: newOrders,
      updated_orders: updatedOrders,
      skipped_rows: stats.total - stats.unique,
      uploaded_by: user.username,
    });

    return NextResponse.json({
      success: true,
      stats: {
        ...stats,
        newOrders,
        updatedOrders,
      },
    });
  } catch (err) {
    console.error('Upload error:', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}

async function insertItems(orderId: string, items: CleanedOrder['items']) {
  const rows = items.map((item) => ({
    order_id: orderId,
    brand: item.brand,
    product_name: item.product_name,
    quantity: item.quantity,
    price: item.price,
  }));

  await getSupabaseAdmin().from('order_items').insert(rows);
}

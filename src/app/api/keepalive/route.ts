import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// Keep-alive endpoint — prevents Supabase Free from pausing after 7 days
// Called by Vercel Cron daily
export async function GET() {
  try {
    const { count, error } = await getSupabaseAdmin()
      .from('orders')
      .select('id', { count: 'exact', head: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      orders: count,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json({ error: 'Keep-alive failed' }, { status: 500 });
  }
}

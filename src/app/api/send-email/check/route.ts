import { NextRequest, NextResponse } from 'next/server';
import { getAuthFromRequest } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';

// POST: Check which order IDs have been emailed
export async function POST(request: NextRequest) {
  const user = getAuthFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { orderIds } = await request.json();

    if (!orderIds || !Array.isArray(orderIds)) {
      return NextResponse.json({ emailedIds: [] });
    }

    const emailedIds = new Set<string>();

    // Batch query to avoid .in() limit
    for (let i = 0; i < orderIds.length; i += 100) {
      const batch = orderIds.slice(i, i + 100);
      const { data: logs } = await getSupabaseAdmin()
        .from('email_logs')
        .select('order_id')
        .in('order_id', batch)
        .eq('success', true);
      if (logs) logs.forEach((l) => emailedIds.add(l.order_id));
    }

    return NextResponse.json({ emailedIds: Array.from(emailedIds) });
  } catch {
    return NextResponse.json({ emailedIds: [] });
  }
}

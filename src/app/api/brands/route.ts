import { NextRequest, NextResponse } from 'next/server';
import { getAuthFromRequest } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';

// GET - get unique brands from order_items
export async function GET(request: NextRequest) {
  const user = getAuthFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await getSupabaseAdmin()
    .from('order_items')
    .select('brand')
    .not('brand', 'is', null)
    .not('brand', 'eq', '');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const uniqueBrands = [...new Set((data || []).map((d) => d.brand))].filter(Boolean).sort();

  return NextResponse.json({ brands: uniqueBrands });
}

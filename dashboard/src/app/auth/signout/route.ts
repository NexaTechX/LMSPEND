import { NextRequest, NextResponse } from 'next/server';
import { supabaseConfigured } from '@/lib/supabase/config';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (supabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
  return NextResponse.redirect(new URL('/', req.nextUrl.origin));
}

import { NextRequest, NextResponse } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { safeNextPath } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Where the sign-up confirmation and password-reset emails land.
 * PKCE links arrive as ?code=; token-hash templates as ?token_hash=&type=.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = req.nextUrl;
  const next = safeNextPath(searchParams.get('next')) ?? '/dashboard';
  const supabase = await createSupabaseServerClient();

  const code = searchParams.get('code');
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}

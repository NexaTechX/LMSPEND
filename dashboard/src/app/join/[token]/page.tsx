import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUserEmail } from '@/lib/auth';
import { getStore } from '@/lib/store';

export const dynamic = 'force-dynamic';

async function accept(formData: FormData): Promise<void> {
  'use server';
  const email = await currentUserEmail();
  const token = String(formData.get('token') ?? '');
  if (!email || !token) redirect('/login');
  const result = await getStore().acceptTeamInvite(token, email);
  redirect(result === 'ok' ? '/team' : `/join/${token}?status=${result}`);
}

export default async function JoinPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { token } = await params;
  const { status } = await searchParams;
  const invite = await getStore().getTeamInvite(token);

  return (
    <main className="auth-wrap">
      <div className="auth-card">
        <Link href="/" className="wordmark">lmspend<span className="cursor">_</span></Link>
        {!invite ? (
          <>
            <h1>Invite not found</h1>
            <p className="muted">
              This invite link is invalid or was replaced. Ask your team owner for a fresh one.
            </p>
            <Link className="btn btn-ghost btn-block" href="/dashboard">Go to your dashboard</Link>
          </>
        ) : (
          <>
            <h1>Join {invite.teamName}</h1>
            <p className="muted">
              Your spend syncs stay yours — the team sees monthly totals and tool breakdowns,
              never your code or prompts.
            </p>
            {status === 'team-full' && (
              <div className="notice notice-err">This team&apos;s seats are full. Ask the owner to free one up.</div>
            )}
            {status === 'already-in-team' && (
              <div className="notice notice-err">
                You&apos;re already in another team — leave it first (ask that team&apos;s owner to remove you).
              </div>
            )}
            {status === 'invalid' && (
              <div className="notice notice-err">Couldn&apos;t join — try again or ask for a new link.</div>
            )}
            <form action={accept}>
              <input type="hidden" name="token" value={token} />
              <button type="submit" className="btn btn-primary btn-block">Join team</button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}

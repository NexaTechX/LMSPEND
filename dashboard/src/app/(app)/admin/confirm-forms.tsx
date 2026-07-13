'use client';

import { useTransition } from 'react';
import { demoteAdmin, grantPlan, promoteAdmin, revokePlan } from './actions';

export function ConfirmRevokeForm({ email }: { email: string }) {
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      className="btn btn-danger btn-sm"
      disabled={pending}
      onClick={() => {
        start(async () => {
          const reason = window.prompt(`Reason for revoking ${email}?`);
          if (!reason?.trim()) return;
          if (!window.confirm(`Revoke paid access for ${email}?`)) return;
          const fd = new FormData();
          fd.set('email', email);
          fd.set('reason', reason.trim());
          await revokePlan(fd);
        });
      }}
    >
      {pending ? '…' : 'Revoke'}
    </button>
  );
}

export function ConfirmPromoteForm({ email, isAdmin }: { email: string; isAdmin: boolean }) {
  const [pending, start] = useTransition();

  if (isAdmin) {
    return (
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        disabled={pending}
        onClick={() => {
          start(async () => {
            const reason = window.prompt(`Reason for demoting ${email}?`) ?? '';
            if (!window.confirm(`Remove admin access for ${email}?`)) return;
            const fd = new FormData();
            fd.set('email', email);
            fd.set('reason', reason);
            await demoteAdmin(fd);
          });
        }}
      >
        Demote admin
      </button>
    );
  }

  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm"
      disabled={pending}
      onClick={() => {
        start(async () => {
          const reason = window.prompt(`Reason for promoting ${email}?`) ?? '';
          if (!window.confirm(`Make ${email} an admin?`)) return;
          const fd = new FormData();
          fd.set('email', email);
          fd.set('reason', reason);
          await promoteAdmin(fd);
        });
      }}
    >
      Make admin
    </button>
  );
}

export function ConfirmGrantForm() {
  const [pending, start] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = new FormData(form);
        start(async () => {
          const email = String(fd.get('email') ?? '');
          if (!window.confirm(`Grant/comp access to ${email}?`)) return;
          await grantPlan(fd);
        });
      }}
      style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}
    >
      <input name="email" type="email" placeholder="email@user.com" className="input" style={{ maxWidth: 240, margin: 0 }} required />
      <select name="plan" className="input" style={{ maxWidth: 110, margin: 0 }} defaultValue="solo">
        <option value="solo">solo</option>
        <option value="team">team</option>
      </select>
      <input name="days" type="number" min="1" defaultValue={31} className="input" style={{ maxWidth: 80, margin: 0 }} />
      <span className="muted small">days</span>
      <input name="reason" type="text" placeholder="reason (required)" className="input" style={{ maxWidth: 220, margin: 0 }} required />
      <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
        {pending ? '…' : 'Grant'}
      </button>
    </form>
  );
}

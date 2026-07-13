import { randomUUID } from 'node:crypto';
import { PLAN_PRICES_USD, paymentsEnabled, type Plan } from './billing/types';
import { effectivePlan, isPaid } from './plan';
import { supabaseConfigured } from './supabase/config';
import { createSupabaseAdminClient } from './supabase/server';
import {
  _memoryInternals,
  getStore,
  type AccessSource,
  type UserRecord,
} from './store';
import type {
  AdminAuditEntry,
  AdminOverview,
  AdminUserDetail,
  AdminUserFilter,
  AdminUserListRow,
  SystemHealth,
  WaitlistEntry,
  WaitlistStatus,
} from './admin-types';
import { currentUtcMonth, snapshotUser } from './admin-types';

const PAGE_SIZE_DEFAULT = 25;

const g = globalThis as unknown as {
  __lmspendAudit?: AdminAuditEntry[];
  __lmspendMeta?: Map<string, string>;
};
const memAudit: AdminAuditEntry[] = g.__lmspendAudit ?? [];
const memMeta: Map<string, string> = g.__lmspendMeta ?? new Map();
g.__lmspendAudit = memAudit;
g.__lmspendMeta = memMeta;

function useDb(): boolean {
  return supabaseConfigured() && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function windowOpen(u: UserRecord): boolean {
  return u.paidUntil !== null && new Date(u.paidUntil) > new Date();
}

function matchesFilter(u: UserRecord, filter: AdminUserFilter): boolean {
  const paid = isPaid(u);
  switch (filter) {
    case 'paid': return paid && u.accessSource === 'payment';
    case 'comp': return paid && u.accessSource === 'comp';
    case 'free': return !paid;
    case 'admin': return u.isAdmin;
    default: return true;
  }
}

export async function writeAdminAudit(input: {
  actorEmail: string;
  action: string;
  targetEmail?: string | null;
  reason?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}): Promise<void> {
  const entry: AdminAuditEntry = {
    id: randomUUID(),
    actorEmail: input.actorEmail,
    action: input.action,
    targetEmail: input.targetEmail ?? null,
    reason: input.reason ?? null,
    before: input.before ?? null,
    after: input.after ?? null,
    createdAt: new Date().toISOString(),
  };

  if (!useDb()) {
    memAudit.unshift(entry);
    if (memAudit.length > 500) memAudit.length = 500;
    return;
  }

  const db = createSupabaseAdminClient();
  const { error } = await db.from('admin_audit_log').insert({
    id: entry.id,
    actor_email: entry.actorEmail,
    action: entry.action,
    target_email: entry.targetEmail,
    reason: entry.reason,
    before_state: entry.before,
    after_state: entry.after,
    created_at: entry.createdAt,
  });
  if (error) console.error('writeAdminAudit:', error.message);
}

export async function listAdminAudit(limit = 40): Promise<AdminAuditEntry[]> {
  if (!useDb()) return memAudit.slice(0, limit);

  const db = createSupabaseAdminClient();
  const { data, error } = await db.from('admin_audit_log')
    .select('id, actor_email, action, target_email, reason, before_state, after_state, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.error('listAdminAudit:', error.message);
    return [];
  }
  return (data ?? []).map((r) => ({
    id: r.id,
    actorEmail: r.actor_email,
    action: r.action,
    targetEmail: r.target_email,
    reason: r.reason,
    before: (r.before_state as Record<string, unknown> | null) ?? null,
    after: (r.after_state as Record<string, unknown> | null) ?? null,
    createdAt: r.created_at,
  }));
}

export async function setSystemMeta(key: string, value: string): Promise<void> {
  if (!useDb()) {
    memMeta.set(key, value);
    return;
  }
  const db = createSupabaseAdminClient();
  await db.from('system_meta').upsert({
    key, value, updated_at: new Date().toISOString(),
  }, { onConflict: 'key' });
}

export async function getSystemMeta(key: string): Promise<string | null> {
  if (!useDb()) return memMeta.get(key) ?? null;
  const db = createSupabaseAdminClient();
  const { data } = await db.from('system_meta').select('value').eq('key', key).maybeSingle();
  return data?.value ?? null;
}

export async function getSystemHealth(): Promise<SystemHealth> {
  const [lastCronAt, lastWebhookAt] = await Promise.all([
    getSystemMeta('last_cron_alerts'),
    getSystemMeta('last_billing_webhook'),
  ]);
  return {
    paymentsEnabled: paymentsEnabled(),
    resendConfigured: Boolean(process.env.RESEND_API_KEY),
    cronSecretConfigured: Boolean(process.env.CRON_SECRET),
    supabaseConfigured: useDb(),
    lastCronAt,
    lastWebhookAt,
  };
}

export async function getAdminOverview(month = currentUtcMonth()): Promise<AdminOverview> {
  const store = getStore();
  const users = await store.listUsers();
  let paidCount = 0;
  let compedCount = 0;
  let paidMrr = 0;
  let compedMrr = 0;

  for (const u of users) {
    if (!isPaid(u)) continue;
    const price = PLAN_PRICES_USD[effectivePlan(u) as Plan] ?? 0;
    if (u.accessSource === 'comp') {
      compedCount++;
      compedMrr += price;
    } else {
      paidCount++;
      paidMrr += price;
    }
  }

  let trackedThisMonth = 0;
  if (useDb()) {
    const db = createSupabaseAdminClient();
    const { data } = await db.from('monthly_spend').select('total_usd').eq('month', month);
    trackedThisMonth = (data ?? []).reduce((s, r) => s + Number(r.total_usd), 0);
  } else {
    const { mem } = _memoryInternals();
    for (const u of mem.values()) {
      const m = u.months.get(month);
      if (m) trackedThisMonth += m.estimatedTotalUsd;
    }
  }

  return {
    userCount: users.length,
    paidCount,
    compedCount,
    paidMrr,
    compedMrr,
    teamCount: await store.countTeams(),
    trackedThisMonth,
  };
}

export async function listAdminUsersPage(opts: {
  q?: string;
  filter?: AdminUserFilter;
  page?: number;
  pageSize?: number;
  month?: string;
}): Promise<{ rows: AdminUserListRow[]; total: number; page: number; pageSize: number }> {
  const q = (opts.q ?? '').trim().toLowerCase();
  const filter = opts.filter ?? 'all';
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? PAGE_SIZE_DEFAULT));
  const page = Math.max(1, opts.page ?? 1);
  const month = opts.month ?? currentUtcMonth();
  const store = getStore();

  let users = await store.listUsers();
  if (q) users = users.filter((u) => u.email.toLowerCase().includes(q));
  users = users.filter((u) => matchesFilter(u, filter));

  const spendByEmail = new Map<string, { total: number; syncedAt: string | null }>();

  if (useDb() && users.length > 0) {
    const db = createSupabaseAdminClient();
    const emails = users.map((u) => u.email);
    const { data: idRows } = await db.from('users').select('id, email').in('email', emails);
    const idToEmail = new Map((idRows ?? []).map((r) => [r.id as string, r.email as string]));
    const ids = [...idToEmail.keys()];
    if (ids.length > 0) {
      const { data: spends } = await db.from('monthly_spend')
        .select('user_id, total_usd, synced_at')
        .eq('month', month)
        .in('user_id', ids);
      for (const s of spends ?? []) {
        const email = idToEmail.get(s.user_id as string);
        if (email) {
          spendByEmail.set(email, {
            total: Number(s.total_usd),
            syncedAt: s.synced_at as string,
          });
        }
      }
      // last sync across any month — one query for max synced_at per user on page slice later
    }
  } else {
    const { mem } = _memoryInternals();
    for (const u of users) {
      const mu = mem.get(u.email);
      const cur = mu?.months.get(month);
      const latest = mu ? [...mu.months.values()].sort((a, b) => b.month.localeCompare(a.month))[0] : null;
      spendByEmail.set(u.email, {
        total: cur?.estimatedTotalUsd ?? 0,
        syncedAt: latest?.syncedAt ?? null,
      });
    }
  }

  // Enrich lastSync for DB users (any month) in one pass for the full filtered set is heavy;
  // for list we use current-month synced_at, and fall back to a light query for page rows only.
  const total = users.length;
  users.sort((a, b) => {
    const pa = isPaid(b) ? 1 : 0;
    const pb = isPaid(a) ? 1 : 0;
    if (pa !== pb) return pa - pb;
    const sa = spendByEmail.get(b.email)?.total ?? 0;
    const sb = spendByEmail.get(a.email)?.total ?? 0;
    return sa - sb;
  });

  const slice = users.slice((page - 1) * pageSize, page * pageSize);

  if (useDb() && slice.length > 0) {
    const db = createSupabaseAdminClient();
    const emails = slice.map((u) => u.email);
    const { data: idRows } = await db.from('users').select('id, email').in('email', emails);
    const idToEmail = new Map((idRows ?? []).map((r) => [r.id as string, r.email as string]));
    const ids = [...idToEmail.keys()];
    if (ids.length > 0) {
      const { data: allSpend } = await db.from('monthly_spend')
        .select('user_id, synced_at, month')
        .in('user_id', ids)
        .order('month', { ascending: false });
      const seen = new Set<string>();
      for (const s of allSpend ?? []) {
        const email = idToEmail.get(s.user_id as string);
        if (!email || seen.has(email)) continue;
        seen.add(email);
        const cur = spendByEmail.get(email) ?? { total: 0, syncedAt: null };
        spendByEmail.set(email, { total: cur.total, syncedAt: s.synced_at as string });
      }
    }
  }

  const rows: AdminUserListRow[] = slice.map((user) => {
    const s = spendByEmail.get(user.email);
    return {
      user,
      monthSpend: s?.total ?? 0,
      lastSync: s?.syncedAt ?? null,
    };
  });

  return { rows, total, page, pageSize };
}

export async function getAdminUserDetail(email: string): Promise<AdminUserDetail | null> {
  const store = getStore();
  const users = await store.listUsers();
  const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (!user) return null;

  const [spend, keys, team, budget, slackWebhook] = await Promise.all([
    store.getSpend(user.email),
    store.listApiKeys(user.email),
    store.getTeam(user.email),
    store.getBudget(user.email),
    store.getSlackWebhook(user.email),
  ]);

  return { user, spend, keys, team, budget, slackWebhook };
}

export type SetAdminResult = 'ok' | 'self' | 'last_admin' | 'not_found';

export async function setUserAdmin(
  actorEmail: string,
  targetEmail: string,
  makeAdmin: boolean,
  reason?: string | null,
): Promise<SetAdminResult> {
  const store = getStore();
  const target = (await store.listUsers()).find(
    (u) => u.email.toLowerCase() === targetEmail.toLowerCase(),
  );
  if (!target) return 'not_found';

  if (!makeAdmin && target.email.toLowerCase() === actorEmail.toLowerCase()) {
    return 'self';
  }

  if (!makeAdmin && target.isAdmin) {
    const admins = (await store.listUsers()).filter((u) => u.isAdmin);
    if (admins.length <= 1) return 'last_admin';
  }

  const before = snapshotUser(target);

  if (useDb()) {
    const db = createSupabaseAdminClient();
    const { error } = await db.from('users')
      .update({ is_admin: makeAdmin })
      .eq('email', target.email);
    if (error) throw new Error(`setUserAdmin: ${error.message}`);
  } else {
    const { mem } = _memoryInternals();
    const u = mem.get(target.email);
    if (u) u.isAdmin = makeAdmin;
  }

  const afterUser = await store.ensureUser(target.email);
  await writeAdminAudit({
    actorEmail,
    action: makeAdmin ? 'promote_admin' : 'demote_admin',
    targetEmail: target.email,
    reason,
    before,
    after: snapshotUser(afterUser),
  });
  return 'ok';
}

export async function setAdminNotes(
  actorEmail: string,
  targetEmail: string,
  notes: string,
): Promise<boolean> {
  const store = getStore();
  await store.ensureUser(targetEmail);

  if (useDb()) {
    const db = createSupabaseAdminClient();
    const { error } = await db.from('users')
      .update({ admin_notes: notes || null })
      .eq('email', targetEmail);
    if (error) throw new Error(`setAdminNotes: ${error.message}`);
  } else {
    const { mem } = _memoryInternals();
    const u = mem.get(targetEmail) ?? mem.get(targetEmail.toLowerCase());
    // ensureUser already created
    for (const mu of mem.values()) {
      if (mu.email.toLowerCase() === targetEmail.toLowerCase()) {
        mu.adminNotes = notes || null;
        break;
      }
    }
    void u;
  }

  await writeAdminAudit({
    actorEmail,
    action: 'update_notes',
    targetEmail,
    after: { adminNotes: notes || null },
  });
  return true;
}

export async function setAccessSource(email: string, source: AccessSource): Promise<void> {
  if (useDb()) {
    const db = createSupabaseAdminClient();
    await db.from('users').update({ access_source: source }).eq('email', email);
  } else {
    const { mem } = _memoryInternals();
    for (const mu of mem.values()) {
      if (mu.email.toLowerCase() === email.toLowerCase()) {
        mu.accessSource = source;
        break;
      }
    }
  }
}

export async function listWaitlistEntries(): Promise<WaitlistEntry[]> {
  const rows = await getStore().listWaitlist();
  return rows.map((r) => ({
    email: r.email,
    tool: r.tool,
    createdAt: r.createdAt,
    status: (['new', 'contacted', 'converted'].includes(r.status)
      ? r.status
      : 'new') as WaitlistStatus,
  }));
}

export async function setWaitlistStatus(
  actorEmail: string,
  email: string,
  tool: string,
  status: WaitlistStatus,
): Promise<void> {
  if (useDb()) {
    const db = createSupabaseAdminClient();
    const { error } = await db.from('waitlist')
      .update({ status })
      .eq('email', email)
      .eq('tool', tool);
    if (error) throw new Error(`setWaitlistStatus: ${error.message}`);
  } else {
    const { memWaitlist } = _memoryInternals();
    const key = `${tool}:${email}`;
    const cur = memWaitlist.get(key);
    if (cur) memWaitlist.set(key, { ...cur, status });
  }

  await writeAdminAudit({
    actorEmail,
    action: 'waitlist_status',
    targetEmail: email,
    after: { tool, status },
  });
}

export function waitlistToCsv(entries: WaitlistEntry[]): string {
  const lines = ['email,tool,status,created_at'];
  for (const w of entries) {
    lines.push([w.email, w.tool, w.status, w.createdAt].map(csvEscape).join(','));
  }
  return lines.join('\n');
}

export function usersToCsv(rows: AdminUserListRow[], month: string): string {
  const lines = [`email,plan,status,access_source,is_admin,paid_until,${month}_spend,last_sync`];
  for (const r of rows) {
    const u = r.user;
    lines.push([
      u.email,
      effectivePlan(u),
      u.subscriptionStatus,
      u.accessSource,
      String(u.isAdmin),
      u.paidUntil ?? '',
      String(r.monthSpend),
      r.lastSync ?? '',
    ].map(csvEscape).join(','));
  }
  return lines.join('\n');
}

function csvEscape(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

export { snapshotUser, currentUtcMonth, windowOpen };

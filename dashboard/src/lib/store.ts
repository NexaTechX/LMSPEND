import { createHash, randomBytes } from 'node:crypto';
import type { Plan, SubscriptionStatus } from './billing/types';
import { supabaseConfigured } from './supabase/config';
import { createSupabaseAdminClient } from './supabase/server';

/**
 * Data layer. One async interface, two implementations:
 *  - SupabaseStore: Postgres via service-role client (see schema.sql). RLS is on;
 *    only this server-side module touches the tables.
 *  - MemoryStore: zero-dependency dev fallback when Supabase env vars are absent.
 */

export interface SpendBucket {
  cost: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  events: number;
}

export interface MonthlySpend {
  month: string; // YYYY-MM
  estimatedTotalUsd: number;
  /** Flat plan cost + ROI, when the CLI has a plan configured (~/.lmspend.json). */
  planMonthly?: number | null;
  roiMultiple?: number | null;
  byTool: Record<string, SpendBucket>;
  byModel: Record<string, SpendBucket>;
  byProject: Record<string, SpendBucket>; // hashed by the CLI before upload
  byDay: Record<string, SpendBucket>;
  syncedAt: string;
}

export interface UserRecord {
  email: string;
  plan: Plan;
  subscriptionStatus: SubscriptionStatus;
  paidUntil: string | null;
  emailReports: boolean;
  realtimeEnabled: boolean;
}

export interface ApiKeyInfo {
  keyPrefix: string;
  label: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface ShareCardData {
  month: string;
  totalUsd: number;
  topModel: string | null;
  topModelUsd: number | null;
  topDay: string | null;
  topDayUsd: number | null;
  planMonthly: number | null;
  roiMultiple: number | null;
}

export const TEAM_SEATS = 5;

export interface TeamMemberInfo {
  email: string;
  role: 'owner' | 'member';
}

export interface TeamInfo {
  id: string;
  name: string;
  role: 'owner' | 'member'; // the requesting user's role
  members: TeamMemberInfo[];
}

export type JoinResult = 'ok' | 'already-in-team' | 'team-full' | 'invalid';

export interface Store {
  ensureUser(email: string): Promise<UserRecord>;
  listUsers(): Promise<UserRecord[]>;
  upsertSpend(email: string, spend: MonthlySpend): Promise<void>;
  getSpend(email: string): Promise<MonthlySpend[]>;
  setSubscription(email: string, plan: Plan, status: SubscriptionStatus, paidUntil?: string | null): Promise<void>;
  setEmailReports(email: string, on: boolean): Promise<void>;
  setRealtimeEnabled(email: string, on: boolean): Promise<void>;

  emailForApiKey(rawKey: string): Promise<string | null>;
  createApiKey(email: string, label: string): Promise<string>; // returns the raw key — shown once
  listApiKeys(email: string): Promise<ApiKeyInfo[]>;
  revokeApiKey(email: string, keyPrefix: string): Promise<void>;

  setBudget(email: string, monthlyLimitUsd: number | null): Promise<void>;
  getBudget(email: string): Promise<number | null>;
  setSlackWebhook(email: string, url: string | null): Promise<void>;
  getSlackWebhook(email: string): Promise<string | null>;

  createTeam(ownerEmail: string, name: string): Promise<TeamInfo>;
  getTeam(email: string): Promise<TeamInfo | null>;
  createTeamInvite(teamId: string): Promise<string>; // returns token (reusable link, seat-capped)
  getTeamInvite(token: string): Promise<{ teamId: string; teamName: string } | null>;
  acceptTeamInvite(token: string, email: string): Promise<JoinResult>;
  removeTeamMember(teamId: string, email: string): Promise<void>;

  /** All synced totals for a month — for percentile ("top X% of spenders"). */
  getMonthTotals(month: string): Promise<number[]>;

  createShare(data: ShareCardData): Promise<string>; // returns slug
  getShare(slug: string): Promise<ShareCardData | null>;

  addToWaitlist(email: string, tool: string): Promise<void>;

  // Admin (owner console)
  listWaitlist(): Promise<Array<{ email: string; tool: string; createdAt: string }>>;
  countTeams(): Promise<number>;
}

function hashKey(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

function newRawKey(): string {
  return `lm_live_${randomBytes(24).toString('hex')}`;
}

function newSlug(): string {
  return randomBytes(4).toString('base64url').replace(/[^a-zA-Z0-9]/g, '').slice(0, 6) ||
    randomBytes(4).toString('hex').slice(0, 6);
}

/* ------------------------------- MemoryStore ------------------------------ */

interface MemUser extends UserRecord {
  months: Map<string, MonthlySpend>;
  keys: Map<string, ApiKeyInfo & { keyHash: string }>;
  budget: number | null;
  slackWebhook: string | null;
}

interface MemTeam {
  id: string;
  name: string;
  members: Map<string, 'owner' | 'member'>; // email → role
}

const g = globalThis as unknown as {
  __lmspendMem?: Map<string, MemUser>;
  __lmspendShares?: Map<string, ShareCardData>;
  __lmspendWaitlist?: Map<string, string>;
  __lmspendTeams?: Map<string, MemTeam>;
  __lmspendInvites?: Map<string, string>; // token → teamId
};
const mem: Map<string, MemUser> = g.__lmspendMem ?? new Map();
const memShares: Map<string, ShareCardData> = g.__lmspendShares ?? new Map();
const memWaitlist: Map<string, string> = g.__lmspendWaitlist ?? new Map();
const memTeams: Map<string, MemTeam> = g.__lmspendTeams ?? new Map();
const memInvites: Map<string, string> = g.__lmspendInvites ?? new Map();
g.__lmspendMem = mem;
g.__lmspendShares = memShares;
g.__lmspendWaitlist = memWaitlist;
g.__lmspendTeams = memTeams;
g.__lmspendInvites = memInvites;

function memUser(email: string): MemUser {
  let u = mem.get(email);
  if (!u) {
    u = {
      email, plan: 'solo', subscriptionStatus: 'none', paidUntil: null,
      emailReports: true, realtimeEnabled: false, months: new Map(), keys: new Map(), budget: null,
      slackWebhook: null,
    };
    mem.set(email, u);
  }
  return u;
}

function pub(u: MemUser): UserRecord {
  return {
    email: u.email, plan: u.plan, subscriptionStatus: u.subscriptionStatus,
    paidUntil: u.paidUntil, emailReports: u.emailReports, realtimeEnabled: u.realtimeEnabled,
  };
}

const memoryStore: Store = {
  async ensureUser(email) { return pub(memUser(email)); },
  async listUsers() { return [...mem.values()].map(pub); },

  async upsertSpend(email, spend) { memUser(email).months.set(spend.month, spend); },

  async getSpend(email) {
    const u = mem.get(email);
    return u ? [...u.months.values()].sort((a, b) => b.month.localeCompare(a.month)) : [];
  },

  async setSubscription(email, plan, status, paidUntil) {
    const u = memUser(email);
    u.plan = plan;
    u.subscriptionStatus = status;
    if (paidUntil !== undefined) u.paidUntil = paidUntil;
  },

  async setEmailReports(email, on) { memUser(email).emailReports = on; },
  async setRealtimeEnabled(email, on) { memUser(email).realtimeEnabled = on; },

  async emailForApiKey(rawKey) {
    for (const pair of (process.env.LMSPEND_DEV_KEYS ?? '').split(',')) {
      const [k, email] = pair.split(':');
      if (k && k.trim() === rawKey && email) return email.trim();
    }
    const h = hashKey(rawKey);
    for (const u of mem.values()) {
      for (const info of u.keys.values()) {
        if (info.keyHash === h) return u.email;
      }
    }
    return null;
  },

  async createApiKey(email, label) {
    const raw = newRawKey();
    const prefix = raw.slice(0, 16);
    memUser(email).keys.set(prefix, {
      keyPrefix: prefix, label,
      createdAt: new Date().toISOString(), lastUsedAt: null, keyHash: hashKey(raw),
    });
    return raw;
  },

  async listApiKeys(email) {
    const u = mem.get(email);
    return u ? [...u.keys.values()].map(({ keyHash: _ignored, ...info }) => info) : [];
  },

  async revokeApiKey(email, keyPrefix) { mem.get(email)?.keys.delete(keyPrefix); },

  async setBudget(email, limit) { memUser(email).budget = limit; },
  async getBudget(email) { return mem.get(email)?.budget ?? null; },
  async setSlackWebhook(email, url) { memUser(email).slackWebhook = url; },
  async getSlackWebhook(email) { return mem.get(email)?.slackWebhook ?? null; },

  async createTeam(ownerEmail, name) {
    memUser(ownerEmail);
    const id = randomBytes(8).toString('hex');
    memTeams.set(id, { id, name, members: new Map([[ownerEmail, 'owner']]) });
    return { id, name, role: 'owner', members: [{ email: ownerEmail, role: 'owner' }] };
  },

  async getTeam(email) {
    for (const t of memTeams.values()) {
      const role = t.members.get(email);
      if (role) {
        return {
          id: t.id, name: t.name, role,
          members: [...t.members.entries()].map(([e, r]) => ({ email: e, role: r })),
        };
      }
    }
    return null;
  },

  async createTeamInvite(teamId) {
    const token = randomBytes(12).toString('hex');
    memInvites.set(token, teamId);
    return token;
  },

  async getTeamInvite(token) {
    const teamId = memInvites.get(token);
    const team = teamId ? memTeams.get(teamId) : undefined;
    return team ? { teamId: team.id, teamName: team.name } : null;
  },

  async acceptTeamInvite(token, email) {
    const teamId = memInvites.get(token);
    const team = teamId ? memTeams.get(teamId) : undefined;
    if (!team) return 'invalid';
    if (team.members.has(email)) return 'ok';
    for (const t of memTeams.values()) if (t.members.has(email)) return 'already-in-team';
    if (team.members.size >= TEAM_SEATS) return 'team-full';
    memUser(email);
    team.members.set(email, 'member');
    return 'ok';
  },

  async removeTeamMember(teamId, email) {
    const team = memTeams.get(teamId);
    if (team && team.members.get(email) !== 'owner') team.members.delete(email);
  },

  async getMonthTotals(month) {
    const totals: number[] = [];
    for (const u of mem.values()) {
      const m = u.months.get(month);
      if (m) totals.push(m.estimatedTotalUsd);
    }
    return totals;
  },

  async createShare(data) {
    const slug = newSlug();
    memShares.set(slug, data);
    return slug;
  },
  async getShare(slug) { return memShares.get(slug) ?? null; },

  async addToWaitlist(email, tool) { memWaitlist.set(`${tool}:${email}`, new Date().toISOString()); },

  async listWaitlist() {
    return [...memWaitlist.entries()]
      .map(([k, createdAt]) => {
        const [tool, ...rest] = k.split(':');
        return { email: rest.join(':'), tool, createdAt };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async countTeams() { return memTeams.size; },
};

/* ------------------------------ SupabaseStore ----------------------------- */

interface DbUserRow {
  email: string;
  plan: Plan;
  sub_status: SubscriptionStatus;
  paid_until: string | null;
  email_reports: boolean;
  realtime_enabled: boolean;
}

function fromRow(r: DbUserRow): UserRecord {
  return {
    email: r.email, plan: r.plan, subscriptionStatus: r.sub_status,
    paidUntil: r.paid_until, emailReports: r.email_reports,
    realtimeEnabled: r.realtime_enabled ?? false,
  };
}

async function userId(email: string): Promise<string> {
  const db = createSupabaseAdminClient();
  const { data, error } = await db
    .from('users').upsert({ email }, { onConflict: 'email' }).select('id').single();
  if (error) throw new Error(`userId: ${error.message}`);
  return data.id;
}

// Newer columns may not exist yet on a database that hasn't run the latest
// migration. Select them, but fall back gracefully so the app keeps working.
const USER_COLS = 'email, plan, sub_status, paid_until, email_reports, realtime_enabled';
const USER_COLS_LEGACY = 'email, plan, sub_status, paid_until, email_reports';

function isMissingColumn(err: { message?: string; code?: string } | null): boolean {
  return !!err && (/realtime_enabled/.test(err.message ?? '') || err.code === '42703' || err.code === 'PGRST204');
}

const supabaseStore: Store = {
  async ensureUser(email) {
    const db = createSupabaseAdminClient();
    let res = await db.from('users').upsert({ email }, { onConflict: 'email' }).select(USER_COLS).single();
    if (res.error && isMissingColumn(res.error)) {
      res = await db.from('users').upsert({ email }, { onConflict: 'email' }).select(USER_COLS_LEGACY).single();
    }
    if (res.error) throw new Error(`ensureUser: ${res.error.message}`);
    return fromRow(res.data as DbUserRow);
  },

  async listUsers() {
    const db = createSupabaseAdminClient();
    let res = await db.from('users').select(USER_COLS);
    if (res.error && isMissingColumn(res.error)) {
      res = await db.from('users').select(USER_COLS_LEGACY);
    }
    if (res.error) throw new Error(`listUsers: ${res.error.message}`);
    return (res.data as DbUserRow[]).map(fromRow);
  },

  async upsertSpend(email, spend) {
    const db = createSupabaseAdminClient();
    const id = await userId(email);
    const row: Record<string, unknown> = {
      user_id: id,
      month: spend.month,
      total_usd: spend.estimatedTotalUsd,
      plan_monthly: spend.planMonthly ?? null,
      roi_multiple: spend.roiMultiple ?? null,
      by_tool: spend.byTool,
      by_model: spend.byModel,
      by_project: spend.byProject,
      by_day: spend.byDay,
      synced_at: new Date().toISOString(),
    };
    let { error } = await db.from('monthly_spend').upsert(row, { onConflict: 'user_id,month' });
    if (error && /plan_monthly|roi_multiple/.test(error.message)) {
      // Database not migrated yet (see schema.sql upgrade note) — sync still works.
      delete row.plan_monthly;
      delete row.roi_multiple;
      ({ error } = await db.from('monthly_spend').upsert(row, { onConflict: 'user_id,month' }));
    }
    if (error) throw new Error(`upsertSpend: ${error.message}`);
  },

  async getSpend(email) {
    const db = createSupabaseAdminClient();
    const { data: user } = await db.from('users').select('id').eq('email', email).maybeSingle();
    if (!user) return [];
    const { data, error } = await db
      .from('monthly_spend')
      .select('*')
      .eq('user_id', user.id)
      .order('month', { ascending: false });
    if (error) throw new Error(`getSpend: ${error.message}`);
    return (data ?? []).map((r) => ({
      month: r.month,
      estimatedTotalUsd: Number(r.total_usd),
      planMonthly: r.plan_monthly === null || r.plan_monthly === undefined ? null : Number(r.plan_monthly),
      roiMultiple: r.roi_multiple === null || r.roi_multiple === undefined ? null : Number(r.roi_multiple),
      byTool: r.by_tool,
      byModel: r.by_model,
      byProject: r.by_project,
      byDay: r.by_day,
      syncedAt: r.synced_at,
    }));
  },

  async setSubscription(email, plan, status, paidUntil) {
    const db = createSupabaseAdminClient();
    const { error } = await db.from('users').upsert(
      {
        email, plan, sub_status: status,
        ...(paidUntil !== undefined ? { paid_until: paidUntil } : {}),
      },
      { onConflict: 'email' },
    );
    if (error) throw new Error(`setSubscription: ${error.message}`);
  },

  async setEmailReports(email, on) {
    const db = createSupabaseAdminClient();
    const { error } = await db.from('users')
      .upsert({ email, email_reports: on }, { onConflict: 'email' });
    if (error) throw new Error(`setEmailReports: ${error.message}`);
  },

  async setRealtimeEnabled(email, on) {
    const db = createSupabaseAdminClient();
    const { error } = await db.from('users')
      .upsert({ email, realtime_enabled: on }, { onConflict: 'email' });
    if (error) {
      if (isMissingColumn(error)) {
        throw new Error('Run the realtime_enabled migration in Supabase (see schema.sql) to enable real-time.');
      }
      throw new Error(`setRealtimeEnabled: ${error.message}`);
    }
  },

  async emailForApiKey(rawKey) {
    const db = createSupabaseAdminClient();
    const { data } = await db
      .from('api_keys')
      .select('key_hash, users!inner(email)')
      .eq('key_hash', hashKey(rawKey))
      .maybeSingle();
    if (!data) return null;
    await db.from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('key_hash', data.key_hash);
    return (data.users as unknown as { email: string }).email;
  },

  async createApiKey(email, label) {
    const db = createSupabaseAdminClient();
    const id = await userId(email);
    const raw = newRawKey();
    const { error } = await db.from('api_keys').insert({
      key_hash: hashKey(raw), key_prefix: raw.slice(0, 16), user_id: id, label,
    });
    if (error) throw new Error(`createApiKey: ${error.message}`);
    return raw;
  },

  async listApiKeys(email) {
    const db = createSupabaseAdminClient();
    const { data: user } = await db.from('users').select('id').eq('email', email).maybeSingle();
    if (!user) return [];
    const { data, error } = await db
      .from('api_keys')
      .select('key_prefix, label, created_at, last_used_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (error) throw new Error(`listApiKeys: ${error.message}`);
    return (data ?? []).map((k) => ({
      keyPrefix: k.key_prefix, label: k.label ?? '',
      createdAt: k.created_at, lastUsedAt: k.last_used_at,
    }));
  },

  async revokeApiKey(email, keyPrefix) {
    const db = createSupabaseAdminClient();
    const { data: user } = await db.from('users').select('id').eq('email', email).maybeSingle();
    if (!user) return;
    await db.from('api_keys').delete().eq('user_id', user.id).eq('key_prefix', keyPrefix);
  },

  async setBudget(email, limit) {
    const db = createSupabaseAdminClient();
    const id = await userId(email);
    // null clears the limit but keeps the row (it may hold the Slack webhook)
    const { error } = await db.from('budgets')
      .upsert({ user_id: id, monthly_limit_usd: limit }, { onConflict: 'user_id' });
    if (error) throw new Error(`setBudget: ${error.message}`);
  },

  async getBudget(email) {
    const db = createSupabaseAdminClient();
    const { data: user } = await db.from('users').select('id').eq('email', email).maybeSingle();
    if (!user) return null;
    const { data } = await db.from('budgets')
      .select('monthly_limit_usd').eq('user_id', user.id).maybeSingle();
    return data ? Number(data.monthly_limit_usd) : null;
  },

  async getMonthTotals(month) {
    const db = createSupabaseAdminClient();
    const { data, error } = await db.from('monthly_spend').select('total_usd').eq('month', month);
    if (error) throw new Error(`getMonthTotals: ${error.message}`);
    return (data ?? []).map((r) => Number(r.total_usd));
  },

  async setSlackWebhook(email, url) {
    const db = createSupabaseAdminClient();
    const id = await userId(email);
    const { error } = await db.from('budgets')
      .upsert({ user_id: id, notify_slack_webhook: url }, { onConflict: 'user_id' });
    if (error) throw new Error(`setSlackWebhook: ${error.message}`);
  },

  async getSlackWebhook(email) {
    const db = createSupabaseAdminClient();
    const { data: user } = await db.from('users').select('id').eq('email', email).maybeSingle();
    if (!user) return null;
    const { data } = await db.from('budgets')
      .select('notify_slack_webhook').eq('user_id', user.id).maybeSingle();
    return data?.notify_slack_webhook ?? null;
  },

  async createTeam(ownerEmail, name) {
    const db = createSupabaseAdminClient();
    const ownerId = await userId(ownerEmail);
    const { data: team, error } = await db.from('teams')
      .insert({ name, owner_user_id: ownerId }).select('id, name').single();
    if (error) throw new Error(`createTeam: ${error.message}`);
    const { error: mErr } = await db.from('team_members')
      .insert({ team_id: team.id, user_id: ownerId, role: 'owner' });
    if (mErr) throw new Error(`createTeam/member: ${mErr.message}`);
    return { id: team.id, name: team.name, role: 'owner', members: [{ email: ownerEmail, role: 'owner' }] };
  },

  async getTeam(email) {
    const db = createSupabaseAdminClient();
    const { data: user } = await db.from('users').select('id').eq('email', email).maybeSingle();
    if (!user) return null;
    const { data: membership } = await db.from('team_members')
      .select('team_id, role, teams!inner(name)')
      .eq('user_id', user.id)
      .maybeSingle();
    if (!membership) return null;
    const { data: members, error } = await db.from('team_members')
      .select('role, users!inner(email)')
      .eq('team_id', membership.team_id);
    if (error) throw new Error(`getTeam: ${error.message}`);
    const teams = membership.teams as unknown as { name: string };
    return {
      id: membership.team_id,
      name: teams.name,
      role: membership.role as 'owner' | 'member',
      members: (members ?? []).map((m) => ({
        email: (m.users as unknown as { email: string }).email,
        role: m.role as 'owner' | 'member',
      })),
    };
  },

  async createTeamInvite(teamId) {
    const db = createSupabaseAdminClient();
    const token = randomBytes(12).toString('hex');
    const { error } = await db.from('team_invites').insert({ token, team_id: teamId });
    if (error) throw new Error(`createTeamInvite: ${error.message}`);
    return token;
  },

  async getTeamInvite(token) {
    const db = createSupabaseAdminClient();
    const { data } = await db.from('team_invites')
      .select('team_id, teams!inner(name)').eq('token', token).maybeSingle();
    if (!data) return null;
    return { teamId: data.team_id, teamName: (data.teams as unknown as { name: string }).name };
  },

  async acceptTeamInvite(token, email) {
    const db = createSupabaseAdminClient();
    const invite = await this.getTeamInvite(token);
    if (!invite) return 'invalid';

    const uid = await userId(email);
    const { data: existing } = await db.from('team_members')
      .select('team_id').eq('user_id', uid).maybeSingle();
    if (existing) return existing.team_id === invite.teamId ? 'ok' : 'already-in-team';

    const { count } = await db.from('team_members')
      .select('user_id', { count: 'exact', head: true }).eq('team_id', invite.teamId);
    if ((count ?? 0) >= TEAM_SEATS) return 'team-full';

    const { error } = await db.from('team_members')
      .insert({ team_id: invite.teamId, user_id: uid, role: 'member' });
    if (error) return 'invalid';
    return 'ok';
  },

  async removeTeamMember(teamId, email) {
    const db = createSupabaseAdminClient();
    const { data: user } = await db.from('users').select('id').eq('email', email).maybeSingle();
    if (!user) return;
    await db.from('team_members')
      .delete().eq('team_id', teamId).eq('user_id', user.id).neq('role', 'owner');
  },

  async createShare(data) {
    const db = createSupabaseAdminClient();
    const slug = newSlug();
    const { error } = await db.from('shares').insert({
      slug,
      month: data.month,
      total_usd: data.totalUsd,
      top_model: data.topModel,
      top_model_usd: data.topModelUsd,
      top_day: data.topDay,
      top_day_usd: data.topDayUsd,
      plan_monthly: data.planMonthly,
      roi_multiple: data.roiMultiple,
    });
    if (error) throw new Error(`createShare: ${error.message}`);
    return slug;
  },

  async getShare(slug) {
    const db = createSupabaseAdminClient();
    const { data } = await db.from('shares')
      .select('month, total_usd, top_model, top_model_usd, top_day, top_day_usd, plan_monthly, roi_multiple')
      .eq('slug', slug)
      .maybeSingle();
    if (!data) return null;
    return {
      month: data.month,
      totalUsd: Number(data.total_usd),
      topModel: data.top_model,
      topModelUsd: data.top_model_usd === null ? null : Number(data.top_model_usd),
      topDay: data.top_day,
      topDayUsd: data.top_day_usd === null ? null : Number(data.top_day_usd),
      planMonthly: data.plan_monthly === null ? null : Number(data.plan_monthly),
      roiMultiple: data.roi_multiple === null ? null : Number(data.roi_multiple),
    };
  },

  async addToWaitlist(email, tool) {
    const db = createSupabaseAdminClient();
    await db.from('waitlist').upsert({ email, tool }, { onConflict: 'email,tool' });
  },

  async listWaitlist() {
    const db = createSupabaseAdminClient();
    const { data, error } = await db.from('waitlist')
      .select('email, tool, created_at').order('created_at', { ascending: false });
    if (error) throw new Error(`listWaitlist: ${error.message}`);
    return (data ?? []).map((r) => ({ email: r.email, tool: r.tool, createdAt: r.created_at }));
  },

  async countTeams() {
    const db = createSupabaseAdminClient();
    const { count, error } = await db.from('teams')
      .select('id', { count: 'exact', head: true });
    if (error) throw new Error(`countTeams: ${error.message}`);
    return count ?? 0;
  },
};

/* --------------------------------- Export -------------------------------- */

export function getStore(): Store {
  return supabaseConfigured() && process.env.SUPABASE_SERVICE_ROLE_KEY ? supabaseStore : memoryStore;
}

/** Percentile rank as "top X%": share of synced users spending less than you. */
export function topPercentile(totals: number[], mine: number): number {
  if (totals.length <= 1) return 1;
  const above = totals.filter((t) => t > mine).length;
  return Math.max(1, Math.round(((above + 1) / totals.length) * 100));
}

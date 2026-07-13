import type { Plan, SubscriptionStatus } from './billing/types';
import type { ApiKeyInfo, MonthlySpend, TeamInfo, UserRecord } from './store';

export type AccessSource = 'none' | 'payment' | 'comp';
export type WaitlistStatus = 'new' | 'contacted' | 'converted';
export type AdminUserFilter = 'all' | 'paid' | 'free' | 'comp' | 'admin';

export interface AdminAuditEntry {
  id: string;
  actorEmail: string;
  action: string;
  targetEmail: string | null;
  reason: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  createdAt: string;
}

export interface WaitlistEntry {
  email: string;
  tool: string;
  status: WaitlistStatus;
  createdAt: string;
}

export interface AdminUserListRow {
  user: UserRecord;
  monthSpend: number;
  lastSync: string | null;
}

export interface AdminUserDetail {
  user: UserRecord;
  spend: MonthlySpend[];
  keys: ApiKeyInfo[];
  team: TeamInfo | null;
  budget: number | null;
  slackWebhook: string | null;
}

export interface AdminOverview {
  userCount: number;
  paidCount: number;
  compedCount: number;
  paidMrr: number;
  compedMrr: number;
  teamCount: number;
  trackedThisMonth: number;
}

export interface SystemHealth {
  paymentsEnabled: boolean;
  resendConfigured: boolean;
  cronSecretConfigured: boolean;
  supabaseConfigured: boolean;
  lastCronAt: string | null;
  lastWebhookAt: string | null;
}

export function snapshotUser(u: UserRecord): Record<string, unknown> {
  return {
    plan: u.plan,
    subscriptionStatus: u.subscriptionStatus,
    paidUntil: u.paidUntil,
    accessSource: u.accessSource,
    isAdmin: u.isAdmin,
  };
}

export function currentUtcMonth(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import {
  listAdminUsersPage,
  listWaitlistEntries,
  usersToCsv,
  waitlistToCsv,
} from '@/lib/admin-ops';
import type { AdminUserFilter } from '@/lib/admin-types';
import { currentUtcMonth } from '@/lib/admin-types';

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const kind = req.nextUrl.searchParams.get('kind') ?? 'waitlist';

  if (kind === 'waitlist') {
    const csv = waitlistToCsv(await listWaitlistEntries());
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="lmspend-waitlist.csv"',
      },
    });
  }

  if (kind === 'users') {
    const q = req.nextUrl.searchParams.get('q') ?? '';
    const filterRaw = req.nextUrl.searchParams.get('filter') ?? 'all';
    const filter = (
      ['all', 'paid', 'free', 'comp', 'admin'].includes(filterRaw) ? filterRaw : 'all'
    ) as AdminUserFilter;
    const month = currentUtcMonth();
    const { rows } = await listAdminUsersPage({ q, filter, page: 1, pageSize: 10_000, month });
    const csv = usersToCsv(rows, month);
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="lmspend-users.csv"',
      },
    });
  }

  return NextResponse.json({ error: 'unknown kind' }, { status: 400 });
}

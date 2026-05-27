import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export function GET() {
  let dbStatus = 'error';
  try {
    const db = getDb();
    const row = db.prepare('SELECT 1 AS ok').get() as { ok: number } | undefined;
    if (row?.ok === 1) dbStatus = 'ok';
  } catch {
    // db connection failed
  }

  return NextResponse.json({ status: 'ok', database: dbStatus });
}

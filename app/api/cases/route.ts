import { NextResponse } from 'next/server';
import { listCases, createCase } from '@/services/cases';

export const dynamic = 'force-dynamic';

export function GET() {
  try {
    const cases = listCases();
    return NextResponse.json(cases);
  } catch (err) {
    console.error('[GET /api/cases]', err);
    return NextResponse.json({ error: '案件一覧の取得に失敗しました' }, { status: 500 });
  }
}

export function POST() {
  try {
    const newCase = createCase();
    return NextResponse.json(newCase, { status: 201 });
  } catch (err) {
    console.error('[POST /api/cases]', err);
    return NextResponse.json({ error: '案件の作成に失敗しました' }, { status: 500 });
  }
}

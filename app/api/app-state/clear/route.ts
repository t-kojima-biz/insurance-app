import { NextRequest, NextResponse } from 'next/server';
import { clearData } from '@/services/appState';

export function POST(request: NextRequest) {
  try {
    const caseId = request.nextUrl.searchParams.get('caseId') || 'default';
    const state = clearData(caseId);
    return NextResponse.json(state);
  } catch (err) {
    console.error('[POST /api/app-state/clear]', err);
    return NextResponse.json({ error: 'データ消去に失敗しました' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { resetToSample } from '@/services/appState';

export function POST(request: NextRequest) {
  try {
    const caseId = request.nextUrl.searchParams.get('caseId') || 'default';
    const state = resetToSample(caseId);
    return NextResponse.json(state);
  } catch (err) {
    console.error('[POST /api/app-state/reset]', err);
    return NextResponse.json({ error: 'リセットに失敗しました' }, { status: 500 });
  }
}

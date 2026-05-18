import { NextRequest, NextResponse } from 'next/server';
import { getAppState, saveAppState } from '@/services/appState';
import { validateAppState } from '@/validators/appState';

function getCaseId(request: NextRequest): string {
  return request.nextUrl.searchParams.get('caseId') || 'default';
}

export function GET(request: NextRequest) {
  try {
    const caseId = getCaseId(request);
    const state = getAppState(caseId);
    if (!state) {
      return NextResponse.json({ error: '案件が見つかりません' }, { status: 404 });
    }
    return NextResponse.json(state);
  } catch (err) {
    console.error('[GET /api/app-state]', err);
    return NextResponse.json({ error: 'データの取得に失敗しました' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return NextResponse.json({ error: 'Content-Type は application/json が必要です' }, { status: 415 });
    }

    const body = await request.json();
    const { valid, errors } = validateAppState(body);
    if (!valid) {
      return NextResponse.json({ errors }, { status: 400 });
    }

    const caseId = getCaseId(request);
    const saved = saveAppState(caseId, body);
    return NextResponse.json(saved);
  } catch (err) {
    console.error('[PUT /api/app-state]', err);
    return NextResponse.json({ error: '保存に失敗しました' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getAppState, updateExportTimestamp } from '@/services/appState';

export function GET(request: NextRequest) {
  try {
    const caseId = request.nextUrl.searchParams.get('caseId') || 'default';
    const state = getAppState(caseId);
    if (!state) {
      return NextResponse.json({ error: '案件が見つかりません' }, { status: 404 });
    }

    updateExportTimestamp(caseId);

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const filename = `insurance-app-state-${ts}.json`;

    const exportData = {
      schemaVersion: 1,
      exportedAt: now.toISOString(),
      ...state,
    };

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error('[GET /api/app-state/export]', err);
    return NextResponse.json({ error: 'JSON 出力に失敗しました' }, { status: 500 });
  }
}

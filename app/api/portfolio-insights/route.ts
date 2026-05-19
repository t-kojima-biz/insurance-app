import { NextRequest, NextResponse } from 'next/server';
import { listInsights, saveInsights, deleteInsights, hasInsights } from '@/services/portfolioInsights';

function getCaseId(request: NextRequest): string | null {
  return request.nextUrl.searchParams.get('caseId');
}

export function GET(request: NextRequest) {
  const caseId = getCaseId(request);
  if (!caseId) return NextResponse.json({ error: 'caseId is required' }, { status: 400 });

  return NextResponse.json({
    insights: listInsights(caseId),
    hasData: hasInsights(caseId),
  });
}

export async function PUT(request: NextRequest) {
  const caseId = getCaseId(request);
  if (!caseId) return NextResponse.json({ error: 'caseId is required' }, { status: 400 });

  const body = await request.json();
  if (!Array.isArray(body.insights)) {
    return NextResponse.json({ error: 'insights array is required' }, { status: 400 });
  }

  const saved = saveInsights(caseId, body.insights);
  return NextResponse.json({ insights: saved });
}

export function DELETE(request: NextRequest) {
  const caseId = getCaseId(request);
  if (!caseId) return NextResponse.json({ error: 'caseId is required' }, { status: 400 });

  deleteInsights(caseId);
  return NextResponse.json({ ok: true });
}

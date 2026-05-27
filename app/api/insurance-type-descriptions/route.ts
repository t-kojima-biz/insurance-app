import { NextResponse } from 'next/server';
import { listDescriptions, updateDescription } from '@/services/insuranceTypeDescriptions';
import { INSURANCE_TYPE_INFO } from '@/utils/analysisUtils';
import type { PolicyType } from '@/types';

export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json(listDescriptions());
}

export async function PUT(request: Request) {
  const body = await request.json();
  const { policyType, longDescription, purpose } = body;

  if (!policyType || !longDescription?.trim() || !purpose?.trim()) {
    return NextResponse.json({ error: '全項目を入力してください' }, { status: 400 });
  }

  if (!(policyType in INSURANCE_TYPE_INFO)) {
    return NextResponse.json({ error: '不正な保険種類です' }, { status: 400 });
  }

  const result = updateDescription(policyType as PolicyType, longDescription.trim(), purpose.trim());
  return NextResponse.json(result);
}

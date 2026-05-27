import { NextResponse } from 'next/server';
import { listAgencyMasters, createAgencyMaster } from '@/services/agencyMasters';

export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json(listAgencyMasters());
}

export async function POST(request: Request) {
  const body = await request.json();
  if (!body.name || !body.representative || !body.phone) {
    return NextResponse.json({ error: '全項目を入力してください' }, { status: 400 });
  }
  const master = createAgencyMaster({
    name: body.name,
    representative: body.representative,
    phone: body.phone,
  });
  return NextResponse.json(master, { status: 201 });
}

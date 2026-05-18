import { NextResponse } from 'next/server';
import { updateAgencyMaster, deleteAgencyMaster } from '@/services/agencyMasters';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  if (!body.name || !body.representative || !body.phone) {
    return NextResponse.json({ error: '全項目を入力してください' }, { status: 400 });
  }
  const updated = updateAgencyMaster(id, {
    name: body.name,
    representative: body.representative,
    phone: body.phone,
  });
  if (!updated) {
    return NextResponse.json({ error: '代理店が見つかりません' }, { status: 404 });
  }
  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deleted = deleteAgencyMaster(id);
  if (!deleted) {
    return NextResponse.json({ error: '代理店が見つかりません' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

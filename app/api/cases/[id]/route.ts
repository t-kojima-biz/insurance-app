import { NextResponse } from 'next/server';
import { deleteCase } from '@/services/cases';

export function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return params.then(({ id }) => {
    try {
      const deleted = deleteCase(id);
      if (!deleted) {
        return NextResponse.json({ error: '案件が見つかりません' }, { status: 404 });
      }
      return NextResponse.json({ ok: true });
    } catch (err) {
      console.error('[DELETE /api/cases/:id]', err);
      return NextResponse.json({ error: '案件の削除に失敗しました' }, { status: 500 });
    }
  });
}

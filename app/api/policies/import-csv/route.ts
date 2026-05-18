import { NextRequest, NextResponse } from 'next/server';
import { importCsv } from '@/services/csvImport';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: 'CSV ファイルが添付されていません' }, { status: 400 });
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'ファイルサイズが5MBを超えています' }, { status: 400 });
    }

    const caseId = formData.get('caseId')?.toString()
      || request.nextUrl.searchParams.get('caseId')
      || 'default';
    const overwrite = formData.get('overwriteDuplicates') === 'true'
      || request.nextUrl.searchParams.get('overwriteDuplicates') === 'true';

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = importCsv(caseId, buffer, overwrite);

    if (result.code === 'DUPLICATE_POLICY_NUMBER') {
      return NextResponse.json(result, { status: 409 });
    }

    if (result.failedCount > 0 || (result.errors.length > 0 && !result.state)) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('[POST /api/policies/import-csv]', err);
    return NextResponse.json({ error: 'CSV 取り込みに失敗しました' }, { status: 500 });
  }
}

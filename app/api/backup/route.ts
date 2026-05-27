import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getDb, closeDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

const isServerless = process.env.VERCEL || process.env.LAMBDA_TASK_ROOT || process.env.AWS_LAMBDA_FUNCTION_NAME;
const getDatabasePath = () =>
  process.env.DATABASE_PATH
    ? resolve(process.env.DATABASE_PATH)
    : isServerless
      ? resolve('/tmp', 'insurance.sqlite')
      : resolve(process.cwd(), 'data', 'insurance.sqlite');

export function GET() {
  try {
    const db = getDb();
    db.pragma('wal_checkpoint(TRUNCATE)');

    const dbPath = getDatabasePath();
    const buffer = readFileSync(dbPath);

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
    const filename = `insurance-backup-${ts}.sqlite`;

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(buffer.length),
      },
    });
  } catch (err) {
    console.error('[GET /api/backup]', err);
    return NextResponse.json({ error: 'バックアップに失敗しました' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'ファイルが指定されていません' }, { status: 400 });
    }

    if (!file.name.endsWith('.sqlite') && !file.name.endsWith('.db')) {
      return NextResponse.json({ error: 'SQLiteファイル(.sqlite/.db)のみ対応しています' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const header = buffer.subarray(0, 16).toString('ascii');
    if (!header.startsWith('SQLite format 3')) {
      return NextResponse.json({ error: '有効なSQLiteファイルではありません' }, { status: 400 });
    }

    const dbPath = getDatabasePath();

    closeDb();
    writeFileSync(dbPath, buffer);

    return NextResponse.json({ ok: true, message: 'データベースを復元しました。ページをリロードしてください。' });
  } catch (err) {
    console.error('[POST /api/backup]', err);
    return NextResponse.json({ error: '復元に失敗しました' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { DEFAULT_POLICY_PROMPT } from '@/lib/policyPrompt';
import { getSetting, POLICY_PROMPT_SETTING_KEY, saveSetting } from '@/services/appSettings';

export const dynamic = 'force-dynamic';

export function GET() {
  try {
    const saved = getSetting(POLICY_PROMPT_SETTING_KEY);
    return NextResponse.json({
      prompt: saved?.value || DEFAULT_POLICY_PROMPT,
      source: saved ? 'saved' : 'default',
      updatedAt: saved?.updatedAt ?? null,
    });
  } catch (err) {
    console.error('[GET /api/settings/policy-prompt]', err);
    return NextResponse.json({ error: 'プロンプトの取得に失敗しました' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';

    if (!prompt) {
      return NextResponse.json({ error: 'プロンプトを入力してください' }, { status: 400 });
    }
    if (prompt.length > 20000) {
      return NextResponse.json({ error: 'プロンプトは20,000文字以内にしてください' }, { status: 400 });
    }

    const saved = saveSetting(POLICY_PROMPT_SETTING_KEY, prompt);
    return NextResponse.json({
      prompt: saved.value,
      source: 'saved',
      updatedAt: saved.updatedAt,
    });
  } catch (err) {
    console.error('[PUT /api/settings/policy-prompt]', err);
    return NextResponse.json({ error: 'プロンプトの保存に失敗しました' }, { status: 500 });
  }
}


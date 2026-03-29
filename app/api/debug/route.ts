import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export const runtime = 'nodejs';

export async function GET() {
  const raw = process.env.DATABASE_URL ?? '';

  const info: Record<string, unknown> = {
    has_url: !!raw,
    url_preview: raw ? raw.replace(/:([^:@]+)@/, ':***@').slice(0, 120) : null,
  };

  if (!raw) {
    return NextResponse.json({ ...info, error: 'DATABASE_URL not set' }, { status: 500 });
  }

  // Try with channel_binding stripped
  try {
    const u = new URL(raw);
    const hadChannelBinding = u.searchParams.has('channel_binding');
    u.searchParams.delete('channel_binding');
    info.had_channel_binding = hadChannelBinding;
    info.cleaned_url_preview = u.toString().replace(/:([^:@]+)@/, ':***@').slice(0, 120);

    const db = neon(u.toString());
    const [row] = await db`SELECT COUNT(*)::int AS n FROM institutions`;
    info.institution_count = row.n;
    info.status = 'ok';
    return NextResponse.json(info);
  } catch (e: unknown) {
    info.status = 'error';
    info.error = e instanceof Error ? e.message : String(e);
    info.stack = e instanceof Error ? e.stack?.split('\n').slice(0, 5) : null;
    return NextResponse.json(info, { status: 500 });
  }
}

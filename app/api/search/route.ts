import { NextRequest, NextResponse } from "next/server";
import { searchIndex } from "@/lib/db";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q     = searchParams.get("q")?.trim() ?? "";
  const state = searchParams.get("state")?.trim().toUpperCase() ?? "";
  const page  = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));

  if (!q && !state) return NextResponse.json({ results: [], total: 0 });

  try {
    const { results, total } = await searchIndex(q, state, page);
    return NextResponse.json({ results, total, page, limit: 25 });
  } catch (e) {
    return NextResponse.json({ error: String(e), results: [], total: 0 }, { status: 500 });
  }
}

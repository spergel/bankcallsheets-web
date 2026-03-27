import { NextResponse } from "next/server";
import { getStats } from "@/lib/db";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    return NextResponse.json(await getStats());
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

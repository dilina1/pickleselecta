import { NextRequest, NextResponse } from "next/server";
import { search } from "@/lib/deezer";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ tracks: [] });
  try {
    return NextResponse.json({ tracks: await search(q) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}

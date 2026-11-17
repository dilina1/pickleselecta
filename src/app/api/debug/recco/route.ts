// TEMPORARY: raw ReccoBeats shape check. Remove after verifying.
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") ?? "3n3Ppam7vgaVa1iaRUc9Lp";
  const [feat, rec] = await Promise.all([
    fetch(`https://api.reccobeats.com/v1/audio-features?ids=${id}`).then(
      async (r) => ({ status: r.status, body: await r.text() })
    ),
    fetch(
      `https://api.reccobeats.com/v1/track/recommendation?size=3&seeds=${id}`
    ).then(async (r) => ({ status: r.status, body: await r.text() })),
  ]);
  return NextResponse.json({
    features: { status: feat.status, body: feat.body.slice(0, 1500) },
    recommendation: { status: rec.status, body: rec.body.slice(0, 2500) },
  });
}

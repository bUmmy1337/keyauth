// ─────────────────────────────────────────────────────────
// POST /api/radar/push — Receive radar data from the cheat
// No auth required — identified by session_id in payload
// ─────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { pushFrame, type RadarFrame } from "@/lib/radar-store";

export const runtime = "nodejs";

// CORS headers for the cheat's WinHTTP client
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as RadarFrame;

    if (!body.session_id || typeof body.session_id !== "string") {
      return NextResponse.json(
        { success: false, error: "Missing session_id" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate session_id format (8 hex chars)
    if (!/^[0-9a-f]{8}$/i.test(body.session_id)) {
      return NextResponse.json(
        { success: false, error: "Invalid session_id format" },
        { status: 400, headers: corsHeaders }
      );
    }

    const ok = pushFrame(body);

    return NextResponse.json(
      { success: ok },
      { status: 200, headers: corsHeaders }
    );
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON" },
      { status: 400, headers: corsHeaders }
    );
  }
}

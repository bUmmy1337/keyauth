// ─────────────────────────────────────────────────────────
// GET /api/radar/pull?session=<id> — SSE stream for web radar clients
// Returns Server-Sent Events with radar data frames
// ─────────────────────────────────────────────────────────

import { NextRequest } from "next/server";
import { subscribe, getLatestFrame, type RadarFrame } from "@/lib/radar-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("session");

  if (!sessionId || !/^[0-9a-f]{8}$/i.test(sessionId)) {
    return new Response(
      JSON.stringify({ success: false, error: "Invalid session parameter" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // Create SSE stream
  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      // Send initial frame if available
      const latest = getLatestFrame(sessionId);
      if (latest) {
        const data = `data: ${JSON.stringify(latest)}\n\n`;
        controller.enqueue(encoder.encode(data));
      }

      // Subscribe to new frames
      unsubscribe = subscribe(sessionId, (frame: RadarFrame) => {
        if (closed) return;
        try {
          if (frame === null) {
            // Session expired
            controller.enqueue(encoder.encode("event: expired\ndata: {}\n\n"));
            controller.close();
            closed = true;
          } else {
            const data = `data: ${JSON.stringify(frame)}\n\n`;
            controller.enqueue(encoder.encode(data));
          }
        } catch {
          // Client disconnected
          closed = true;
          if (unsubscribe) unsubscribe();
        }
      });

      // Send keepalive every 15 seconds
      const keepalive = setInterval(() => {
        if (closed) {
          clearInterval(keepalive);
          return;
        }
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          closed = true;
          clearInterval(keepalive);
          if (unsubscribe) unsubscribe();
        }
      }, 15_000);
    },
    cancel() {
      closed = true;
      if (unsubscribe) unsubscribe();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "X-Accel-Buffering": "no",
    },
  });
}

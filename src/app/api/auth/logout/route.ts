// ─────────────────────────────────────────────────────────
// POST /api/auth/logout — Clear auth cookie
// ─────────────────────────────────────────────────────────

import { success } from "@/lib/api-response";

export async function POST() {
  const response = success({ message: "Logged out" });

  response.headers.set(
    "Set-Cookie",
    "auth_token=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0"
  );

  return response;
}

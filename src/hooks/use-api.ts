"use client";

// ─────────────────────────────────────────────────────────
// useApi — Lightweight API fetch hook with auth
// ─────────────────────────────────────────────────────────

import { useState, useCallback } from "react";

interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export function useApi<T = unknown>() {
  const [state, setState] = useState<ApiState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const request = useCallback(
    async (
      url: string,
      options: RequestInit = {}
    ): Promise<{ success: boolean; data?: T; error?: string }> => {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const res = await fetch(url, {
          headers: {
            "Content-Type": "application/json",
            ...options.headers,
          },
          credentials: "include",
          ...options,
        });

        const json = await res.json();

        if (!res.ok || !json.success) {
          const errorMsg = json.error || `Request failed (${res.status})`;
          setState({ data: null, loading: false, error: errorMsg });
          return { success: false, error: errorMsg };
        }

        setState({ data: json.data as T, loading: false, error: null });
        return { success: true, data: json.data as T };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Network error";
        setState({ data: null, loading: false, error: errorMsg });
        return { success: false, error: errorMsg };
      }
    },
    []
  );

  const get = useCallback((url: string) => request(url), [request]);

  const post = useCallback(
    (url: string, body: unknown) =>
      request(url, { method: "POST", body: JSON.stringify(body) }),
    [request]
  );

  const patch = useCallback(
    (url: string, body: unknown) =>
      request(url, { method: "PATCH", body: JSON.stringify(body) }),
    [request]
  );

  const del = useCallback(
    (url: string) => request(url, { method: "DELETE" }),
    [request]
  );

  return { ...state, get, post, patch, del, request };
}

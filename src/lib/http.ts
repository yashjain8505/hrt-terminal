export const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

export async function fetchText(url: string, opts: { timeoutMs?: number; headers?: Record<string, string>; method?: string; body?: string } = {}): Promise<{ ok: boolean; status: number; url: string; text: string }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 12000);
  try {
    const res = await fetch(url, {
      method: opts.method || "GET",
      redirect: "follow",
      signal: ctrl.signal,
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        ...(opts.headers || {}),
      },
      body: opts.body,
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, url: res.url, text };
  } catch (e) {
    return { ok: false, status: 0, url, text: String((e as Error).message || e) };
  } finally {
    clearTimeout(t);
  }
}

export async function fetchJson<T = unknown>(url: string, opts: { timeoutMs?: number; headers?: Record<string, string>; method?: string; body?: string } = {}): Promise<{ ok: boolean; status: number; data: T | null; raw: string }> {
  const r = await fetchText(url, { ...opts, headers: { Accept: "application/json", ...(opts.headers || {}) } });
  if (!r.ok) return { ok: false, status: r.status, data: null, raw: r.text };
  try {
    return { ok: true, status: r.status, data: JSON.parse(r.text) as T, raw: r.text };
  } catch {
    return { ok: false, status: r.status, data: null, raw: r.text };
  }
}

export function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

export function nowIso() { return new Date().toISOString().replace("T", " ").slice(0, 19); }

/** Tiny concurrency limiter (avoids ESM-only deps). */
export function pLimit(concurrency: number) {
  let active = 0;
  const queue: (() => void)[] = [];
  const next = () => { active--; const fn = queue.shift(); if (fn) fn(); };
  return function <T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const run = () => { active++; fn().then(resolve, reject).finally(next); };
      if (active < concurrency) run(); else queue.push(run);
    });
  };
}

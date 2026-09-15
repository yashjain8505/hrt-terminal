/**
 * Step 13: People movement. Sources: 8-K item 5.02 bodies (official, dated, named), news appointments /
 * departures (12-news), and board diffs (09-diff). Everything lands in `moves`, deduped by person+role,
 * with the sources that corroborate it. HR moves are flagged; other officer moves are kept as context.
 */
import { db, logRun } from "../src/lib/db";
import { fetchText, nowIso, pLimit, sleep } from "../src/lib/http";
import { parse8K, item502Text, HR_ROLE_RE, roleKey } from "../src/lib/moves";

const d = db();
d.exec(`CREATE TABLE IF NOT EXISTS filing_text (accession TEXT PRIMARY KEY, company_id INTEGER, fetched_at TEXT, text TEXT);
CREATE TABLE IF NOT EXISTS moves (
  id INTEGER PRIMARY KEY, company_id INTEGER NOT NULL, kind TEXT NOT NULL, person TEXT, role TEXT, hr INTEGER DEFAULT 0, date TEXT, source_kind TEXT, source_url TEXT, title TEXT, confidence TEXT, sources_json TEXT, created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(company_id, kind, person, role));
CREATE INDEX IF NOT EXISTS idx_moves_co ON moves(company_id);`);
const UA = "HRTerminal/0.1 research (earanyash@gmail.com)";
const DAYS = Number(process.env.DAYS || 180);
const started = nowIso();
const cutoff = new Date(Date.now() - DAYS * 864e5).toISOString().slice(0, 10);

async function main() {
  // 1. Fetch 8-K 5.02 bodies not yet cached
  const filings = d.prepare("SELECT f.company_id, f.accession, f.url, f.filed_at FROM sec_filings f WHERE f.items LIKE '%5.02%' AND f.filed_at >= ? AND f.accession NOT IN (SELECT accession FROM filing_text) ORDER BY f.filed_at DESC").all(cutoff) as { company_id: number; accession: string; url: string; filed_at: string }[];
  console.log(`8-K 5.02 bodies to fetch: ${filings.length}`);
  const ins = d.prepare("INSERT OR REPLACE INTO filing_text (accession, company_id, fetched_at, text) VALUES (?,?,datetime('now'),?)");
  const limit = pLimit(2); let ok = 0, fail = 0;
  await Promise.all(filings.map((f) => limit(async () => {
    await sleep(400);
    const r = await fetchText(f.url, { headers: { "User-Agent": UA, "Accept-Encoding": "gzip, deflate" }, timeoutMs: 30000 });
    if (!r.ok) { fail++; return; }
    ins.run(f.accession, f.company_id, item502Text(r.text)); ok++;
  })));
  console.log(`fetched ok=${ok} fail=${fail}`);
  // 2. Parse moves from filings
  const texts = d.prepare("SELECT ft.accession, ft.company_id, ft.text, f.filed_at, f.url FROM filing_text ft JOIN sec_filings f ON f.accession=ft.accession WHERE f.filed_at >= ?").all(cutoff) as { accession: string; company_id: number; text: string; filed_at: string; url: string }[];
  const up = d.prepare(`INSERT INTO moves (company_id, kind, person, role, hr, date, source_kind, source_url, title, confidence, sources_json) VALUES (?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(company_id, kind, person, role) DO UPDATE SET date=COALESCE(excluded.date, moves.date), hr=max(moves.hr, excluded.hr), confidence=CASE WHEN moves.source_kind='8-K' THEN moves.confidence ELSE excluded.confidence END, sources_json=excluded.sources_json`);
  const existing = d.prepare("SELECT sources_json FROM moves WHERE company_id=? AND kind=? AND person=? AND role=?");
  const addMove = (company_id: number, kind: string, person: string, role: string, hr: boolean, date: string | null, source_kind: string, url: string | null, title: string, confidence: string) => {
    const prev = existing.get(company_id, kind, person, role) as { sources_json: string } | undefined;
    const sources = prev ? JSON.parse(prev.sources_json || "[]") : [];
    if (!sources.some((s: { url: string | null; kind: string }) => s.url === url && s.kind === source_kind)) sources.push({ kind: source_kind, url, title, date });
    up.run(company_id, kind, person, role, hr ? 1 : 0, date, source_kind, url, title, confidence, JSON.stringify(sources));
  };
  let parsed = 0, hrMoves = 0;
  const tx1 = d.transaction(() => {
    d.prepare("DELETE FROM moves").run();
    for (const t of texts) for (const m of parse8K(t.text, t.filed_at)) { addMove(t.company_id, m.kind, m.person, m.role, m.hr, m.date, "8-K", t.url, m.text, "official"); parsed++; if (m.hr) hrMoves++; }
  });
  tx1();
  console.log(`8-K moves parsed=${parsed} hr=${hrMoves}`);
  // 3. News appointments / departures → moves (merge with 8-K when person matches)
  const news = d.prepare("SELECT company_id, kind, title, url, published_at, person, role, confidence FROM news WHERE kind IN ('appointment','departure') AND published_at >= ?").all(cutoff) as { company_id: number; kind: string; title: string; url: string; published_at: string; person: string | null; role: string | null; confidence: string }[];
  const byCoKind = d.prepare("SELECT id, person, role, date, sources_json FROM moves WHERE company_id=? AND kind=?");
  let merged = 0, added = 0;
  const near = (a: string | null, b: string | null) => !!a && !!b && Math.abs(new Date(a).getTime() - new Date(b).getTime()) <= 45 * 864e5;
  // named first, so unnamed items can attach to them
  news.sort((a, b) => (a.person ? 0 : 1) - (b.person ? 0 : 1));
  const tx2 = d.transaction(() => {
    for (const n of news) {
      const kind = n.kind === "appointment" ? "arrival" : "departure";
      const role = (n.role || "HR leader").replace(/\s+/g, " ").trim();
      const person = n.person ? n.person.trim() : null;
      const last = person ? person.split(" ").slice(-1)[0].toLowerCase() : null;
      const rk = roleKey(role);
      const cands = byCoKind.all(n.company_id, kind) as { id: number; person: string | null; role: string; date: string | null; sources_json: string }[];
      const match = cands.find((m) => (last && m.person && !m.person.startsWith("(unnamed)") && m.person.toLowerCase().split(" ").slice(-1)[0] === last) || (roleKey(m.role) === rk && near(m.date, n.published_at)));
      if (match) {
        const src = JSON.parse(match.sources_json || "[]"); if (!src.some((s: { url: string }) => s.url === n.url)) src.push({ kind: "news", url: n.url, title: n.title, date: n.published_at });
        const newPerson = match.person && !match.person.startsWith("(unnamed)") ? match.person : person || match.person;
        d.prepare("UPDATE moves SET sources_json=?, hr=max(hr, ?), person=?, date=CASE WHEN date IS NULL OR ? < date THEN ? ELSE date END WHERE id=?").run(JSON.stringify(src), HR_ROLE_RE.test(role) ? 1 : 0, newPerson, n.published_at, n.published_at, match.id); merged++;
      } else { addMove(n.company_id, kind, person || `(unnamed) ${role}`, role, HR_ROLE_RE.test(role) || n.kind === "appointment", n.published_at, "news", n.url, n.title, n.confidence === "high" ? "reported" : "weak"); added++; }
    }
  });
  tx2();
  console.log(`news merged=${merged} added=${added}`);
  // 4. Board diffs → role filled / opened (HR buckets only)
  const diffs = d.prepare("SELECT company_id, type, observed_at, title, source_url, payload_json FROM signals WHERE type IN ('hiring.role_filled','hiring.role_opened') AND observed_at >= ?").all(cutoff) as { company_id: number; type: string; observed_at: string; title: string; source_url: string | null; payload_json: string }[];
  const tx3 = d.transaction(() => { for (const s of diffs) { const p = JSON.parse(s.payload_json || "{}"); addMove(s.company_id, s.type === "hiring.role_filled" ? "role_filled" : "role_opened", null as unknown as string, String(p.title || s.title), p.bucket === "people_exec" || p.bucket === "hr_leader", s.observed_at.slice(0, 10), "board", s.source_url, s.title, "board"); } });
  tx3();
  // 5. Signals from HR moves (so situations + UI see them)
  const sig = d.prepare(`INSERT INTO signals (company_id, type, strength, observed_at, source, source_url, title, summary, payload_json, dedupe_key) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(dedupe_key) DO UPDATE SET strength=excluded.strength, title=excluded.title, summary=excluded.summary, payload_json=excluded.payload_json, observed_at=excluded.observed_at, source_url=excluded.source_url`);
  const moves = d.prepare("SELECT m.*, c.name FROM moves m JOIN companies c ON c.id=m.company_id WHERE m.kind IN ('arrival','departure') AND m.date IS NOT NULL").all() as { company_id: number; kind: string; person: string; role: string; hr: number; date: string; source_kind: string; source_url: string; title: string; confidence: string; sources_json: string; name: string }[];
  let sigs = 0;
  const tx4 = d.transaction(() => {
    d.prepare("DELETE FROM signals WHERE type IN ('exec.hr_appointment','exec.hr_departure','exec.officer_appointment','exec.officer_departure')").run();
    for (const m of moves) {
      const src = JSON.parse(m.sources_json || "[]");
      const type = m.hr ? (m.kind === "arrival" ? "exec.hr_appointment" : "exec.hr_departure") : (m.kind === "arrival" ? "exec.officer_appointment" : "exec.officer_departure");
      const strength = m.hr ? (m.confidence === "official" || src.length >= 2 ? 5 : 4) : 2;
      const who = m.person && !m.person.startsWith("(unnamed)") ? m.person : "an unnamed executive";
      const title = m.kind === "arrival" ? `${who} named ${m.role}` : `${who}, ${m.role}, is leaving`;
      sig.run(m.company_id, type, strength, m.date, m.source_kind === "8-K" ? "SEC 8-K 5.02" : "news", m.source_url, title, `${m.name}: ${title} (${m.source_kind}${src.length > 1 ? ", " + src.length + " sources" : ""}, ${m.date}).`, JSON.stringify({ person: m.person, role: m.role, hr: !!m.hr, confidence: m.confidence, sources: src, kind: m.kind }), `${m.company_id}:${type}:${(m.person || m.role).toLowerCase().slice(0, 60)}`);
      sigs++;
    }
  });
  tx4();
  const stats = d.prepare("SELECT kind, hr, count(*) n FROM moves GROUP BY kind, hr").all();
  console.log(stats);
  const note = `filings_fetched=${ok} moves_8k=${parsed} hr_8k=${hrMoves} news_merged=${merged} news_added=${added} signals=${sigs}`;
  console.log("DONE", note);
  logRun("13-moves", started, true, note);
}
main().catch((e) => { console.error(e); process.exit(1); });

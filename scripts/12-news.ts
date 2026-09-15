/**
 * Step 12: Free news feeds. Google News RSS (no key) for HR-leader appointments, layoffs,
 * acquisitions and funding, matched to companies in the universe. Stores rows in `news`
 * and emits signals: exec.hr_appointment, news.layoffs, news.acquisition, news.funding.
 */
import { db, logRun } from "../src/lib/db";
import { fetchText, nowIso, pLimit, sleep } from "../src/lib/http";

const d = db();
d.exec(`CREATE TABLE IF NOT EXISTS news (
  id INTEGER PRIMARY KEY, company_id INTEGER REFERENCES companies(id), kind TEXT NOT NULL, title TEXT NOT NULL, url TEXT, source TEXT, published_at TEXT,
  person TEXT, role TEXT, query TEXT, confidence TEXT, created_at TEXT DEFAULT (datetime('now')), UNIQUE(company_id, kind, title));
CREATE INDEX IF NOT EXISTS idx_news_co ON news(company_id);`);

const DAYS = Number(process.env.DAYS || 90);
const LIMIT = Number(process.env.LIMIT || 0);
const ROLE_RE = /\b(chief (people|human resources?|talent|hr|diversity|learning|culture) officer|chro\b|cpo\b|head of (people|talent|hr|human resources|talent acquisition|recruiting|payroll|total rewards)|(senior |executive |group )?vice president(,| of| -| for)? (global )?(people|human resources|hr|talent|talent acquisition|total rewards)|vp(,| of)? (people|hr|human resources|talent|talent acquisition)|chief talent|people officer|human resources officer)\b/i;
const APPOINT_RE = /\b(appoint(s|ed|ment)?|names?d?|joins?|hires?d?|taps?|welcomes?|promot(es|ed)|becomes|to lead|tapped|hired as|new (chief|head|vp|vice president))\b/i;

interface Co { id: number; name: string; domain: string | null; }
const GENERIC = new Set(["target", "apple", "oracle", "visa", "gap", "progressive", "southern", "dominion", "ally", "block", "nucor", "meta", "alphabet", "amazon", "corning", "carrier", "vistra", "equitable", "fm", "vf", "guardian", "principal", "ball", "universal", "united", "general", "american", "national", "first", "global", "energy", "health", "capital", "financial", "resources", "news", "api", "dana", "williams", "ferguson", "crown", "dow", "lincoln", "ross", "dollar", "jones", "morgan", "wells", "baker", "hughes", "marsh", "howard", "murphy", "ryan", "casey", "kelly", "thor", "sprouts", "molina", "jabil", "stryker", "deere", "moody", "sherwin", "nordstrom", "kohl", "macy", "penske", "hertz", "avis", "lear", "mars", "lowe", "best buy", "kroger", "cigna", "humana", "centene", "aflac", "chubb", "travelers", "nike", "starbucks", "boeing", "ford", "tesla", "intel", "micron", "nvidia", "broadcom", "qualcomm", "workday", "salesforce", "adobe", "netflix", "paypal", "visa", "mastercard", "uber", "airbnb", "booking", "expedia", "marriott", "hilton", "carnival", "delta", "united", "southwest", "american", "jetblue", "fedex", "ups", "xpo", "ryder", "hub", "target"].filter((x) => !["kroger","cigna","humana","centene","aflac","chubb","travelers","nike","starbucks","boeing","ford","tesla","intel","micron","nvidia","broadcom","qualcomm","workday","salesforce","adobe","netflix","paypal","mastercard","uber","airbnb","booking","expedia","marriott","hilton","carnival","jetblue","fedex","xpo","ryder","molina","jabil","stryker","deere","sherwin","nordstrom","penske","hertz","avis","lear","mars","sprouts"].includes(x)));
/** The company that is hiring / the subject of the sentence, from headline syntax. */
function subjectCompany(title: string): { hiring: string | null; from: string | null } {
  const t = title.replace(/\s+-\s+[^-]+$/, "").replace(/[’]/g, "'");
  const NAME = "([A-Z0-9][A-Za-z0-9&.' -]{1,60}?)";
  let hiring: string | null = null, from: string | null = null;
  let m = t.match(new RegExp("^" + NAME + "\\s+(?:\\([A-Z.]+\\)\\s+)?(?:appoints|names|hires|taps|welcomes|promotes|announces|elevates|selects|adds)\\b", "i"));
  if (m) hiring = m[1].trim();
  if (!hiring) { m = t.match(new RegExp("\\b(?:joins|joined|rejoins|to join|at|with|to lead)\\s+" + NAME + "(?:\\s+as\\b|\\s+in\\b|\\s+for\\b|,|\\s+-|$)", "i")); if (m && !/^(the|a|an|as|as chro|its)$/i.test(m[1]) && !/^as\b/i.test(m[1])) hiring = m[1].trim(); }
  if (!hiring) { m = t.match(new RegExp("\\b(?:officer|head|president|leader|chro|cpo|partner|director)\\s+(?:of|at|for)\\s+" + NAME + "$", "i")); if (m && !/human|people|talent|hr\b/i.test(m[1])) hiring = m[1].trim(); }
  if (!hiring) { m = t.match(new RegExp("\\b(?:appointed|named|promoted to)\\s+" + NAME + "\\s+(?:chief|head|vp|vice president|evp|svp|senior vice president|executive vice president)\\b", "i")); if (m && !/^(as|the|new|its|to)$/i.test(m[1])) hiring = m[1].trim(); }
  m = t.match(new RegExp("\\b(?:former|ex-|ex |from)\\s*" + NAME + "(?:\\s+(?:executive|exec|veteran|leader|hr leader|chro|officer|vp|alum|head)\\b|,|\\s+joins|\\s+named|\\s+to\\b)", "i"));
  if (m) from = m[1].trim();
  if (!from) { m = t.match(/\b([A-Z0-9][A-Za-z0-9&.']+(?: [A-Z][A-Za-z0-9&.']+)?)\s+(?:veteran|exec|executive|alum|hr leader|hr chief|people chief)\b/); if (m && !/^(former|ex|the|new|next|a|an)$/i.test(m[1]) && m[1] !== hiring) from = m[1].trim(); }
  if (!from) { m = t.match(new RegExp("^" + NAME + "'s\\s+[A-Z]")); if (m && m[1] !== hiring) from = m[1].trim(); }
  const clean = (x: string | null) => x ? x.replace(/\s+(?:veteran|exec|executive|alum)$/i, "").replace(/^(?:the|new)\s+/i, "").trim() : null;
  return { hiring: clean(hiring), from: clean(from) };
}
function variants(c: Co): string[] {
  const base = c.name.replace(/\(.*?\)/g, "").replace(/\b(Holdings?|Inc\.?|Corp\.?|Corporation|Company|Cos\.?|Group|Technologies|International|Enterprises|Industries|Financial|Services|Systems|Brands|Companies)\b/g, "").replace(/[,.]/g, "").replace(/\s+/g, " ").trim();
  const out = new Set<string>([c.name]);
  if (base.length >= 3) out.add(base);
  return [...out];
}
function matchCompany(title: string, cos: Co[]): { co: Co; strong: boolean } | null {
  const t = " " + title.replace(/[’']/g, "'") + " ";
  let best: { co: Co; strong: boolean; len: number } | null = null;
  for (const c of cos) {
    for (const v of variants(c)) {
      const re = new RegExp("(^|[^A-Za-z0-9])" + v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "([^A-Za-z0-9]|'s|$)", "i");
      if (!re.test(t)) continue;
      const generic = GENERIC.has(v.toLowerCase());
      const capitalized = new RegExp("(^|[^A-Za-z0-9])" + v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "([^A-Za-z0-9]|'s|$)").test(t);
      if (generic && !capitalized) continue;
      const strong = !generic || /\b(Corp|Inc|Corporation)\b/.test(title) || t.trim().startsWith(v);
      if (!best || v.length > best.len) best = { co: c, strong, len: v.length };
    }
  }
  return best ? { co: best.co, strong: best.strong } : null;
}
/** Subject string must BE the company (allowing Inc/Corp/Holdings/ticker suffixes), not merely contain it. */
function matchExact(subject: string, co: Co): boolean {
  const norm = (x: string) => x.toLowerCase().replace(/[’']/g, "'").replace(/\((?:[a-z.:]+)\)/g, "").replace(/\b(inc|corp|corporation|company|co|holdings?|group|international|incorporated|plc|ltd|the)\b\.?/g, " ").replace(/[^a-z0-9& ]/g, " ").replace(/\s+/g, " ").trim();
  const sub = norm(subject);
  return variants(co).some((v) => { const n = norm(v); return n.length >= 2 && (sub === n || sub === n.replace(/\s+/g, "")); });
}
const PERSON = "([A-Z][a-z.'’-]+(?: [A-Z]\\.)?(?: \\(?[A-Z][a-z.'’-]+\\)?){1,3})";
const NOT_PERSON = /\b(chief|officer|president|vice|executive|senior|head|director|global|human|resources|people|talent|rewards|acquisition|new|company|group|inc|corp|the|its|former|veteran|exec|appointment|board)\b/i;
function person(title: string): string | null {
  const t = title.replace(/\s+-\s+[^-]+$/, "").replace(/’/g, "'");
  const ok = (x: string) => { if (!x) return null; const y = x.replace(/\s*\(.*?\)\s*/g, " ").replace(/\s+(For|As|To|At|With|Of|And|The|New)$/g, "").replace(/\s+/g, " ").trim(); return !NOT_PERSON.test(y) && y.split(" ").length >= 2 ? y : null; };
  const V1 = "(?:[Aa]ppointed|[Nn]amed|[Jj]oins|[Hh]ired|[Tt]apped|[Pp]romoted|[Bb]ecomes|[Tt]o [Jj]oin|[Tt]o [Ll]ead|[Rr]ejoins)";
  const V2 = "(?:[Aa]ppoints|[Nn]ames|[Hh]ires|[Tt]aps|[Ww]elcomes|[Pp]romotes|[Aa]nnounces|[Ee]levates|[Ss]elects|[Aa]dds)";
  let m = t.match(new RegExp("^(?:[A-Z][A-Za-z&.' -]{1,40}?'s )?(?:Dr\\. |Mr\\. |Ms\\. )?" + PERSON + " (?:[Hh]as [Bb]een |[Ii]s |[Ww]as )?" + V1 + "\\b"));
  if (m && ok(m[1])) return ok(m[1]);
  m = t.match(new RegExp("\\b" + V2 + "\\s+(?:Dr\\. |Mr\\. |Ms\\. )?" + PERSON + "\\s+(?:[Aa]s|[Tt]o|[Ff]or|[Cc]hief|[Hh]ead|VP|[Vv]ice|EVP|SVP|[Ee]xecutive|[Ss]enior|[Ii]ts|[Nn]ew)\\b"));
  if (m && ok(m[1])) return ok(m[1]);
  m = t.match(new RegExp("\\b(?:[Aa]ppointment|[Pp]romotion|[Hh]iring) of\\s+(?:Dr\\. |Mr\\. |Ms\\. )?" + PERSON + "\\s+(?:[Aa]s|[Tt]o)\\b"));
  if (m && ok(m[1])) return ok(m[1]);
  return null;
}
function decode(s: string): string { return s.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">"); }
async function rss(q: string): Promise<{ title: string; link: string; date: string; source: string }[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q + " when:" + DAYS + "d")}&hl=en-US&gl=US&ceid=US:en`;
  const r = await fetchText(url, { timeoutMs: 20000 });
  if (!r.ok) return [];
  const items: { title: string; link: string; date: string; source: string }[] = [];
  for (const m of r.text.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const b = m[1];
    const title = decode((b.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || "");
    const link = decode((b.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || "");
    const pub = (b.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || "";
    const source = decode((b.match(/<source[^>]*>([\s\S]*?)<\/source>/) || [])[1] || "");
    const date = pub ? new Date(pub).toISOString().slice(0, 10) : "";
    if (title) items.push({ title: title.replace(/\s+-\s+[^-]+$/, ""), link, date, source });
  }
  return items;
}
const FUNDING_ON = process.env.FUNDING === "1"; // only meaningful for private / mid-market companies
const escRe = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Is the company the grammatical subject/object of the event, not a passing mention? */
function subjectOf(title: string, co: Co, verbs: string): boolean {
  const t = title.replace(/[’]/g, "'");
  return variants(co).some((v) => { const e = escRe(v); return new RegExp(`^(?:the )?${e}(?:'s)?\\b`, "i").test(t) || new RegExp(`\\b${e}(?:'s)?\\s+(?:\\([A-Z.:]+\\)\\s+)?(?:${verbs})\\b`, "i").test(t) || new RegExp(`\\b(?:${verbs})\\s+(?:the |its |a |an )?(?:\\w+\\s+){0,2}?${e}\\b`, "i").test(t) || new RegExp(`\\b(?:at|by|from|hits?|hit)\\s+${e}\\b`, "i").test(t); });
}
function kindOf(title: string, co?: Co): "appointment" | "layoffs" | "acquisition" | "funding" | null {
  if (ROLE_RE.test(title) && APPOINT_RE.test(title) && !/\b(assistant vice president|associate vice president|avp|assistant director|associate director|intern|analyst|coordinator|specialist)\b/i.test(title)) return "appointment";
  const names = co ? variants(co) : [];
  const near = (re: string) => names.some((v) => { const e = v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); return new RegExp(`(${e}\\W+(?:\\w+\\W+){0,4}?(?:${re}))|((?:${re})\\W+(?:\\w+\\W+){0,4}?${e})`, "i").test(title); });
  if (/\b(lays off|laying off|layoffs|to cut \d|cuts \d[\d,]* (jobs|roles|positions|workers|employees)|job cuts|jobs cut|reduction in force|slashes \d[\d,]* jobs|eliminat\w+ \d[\d,]* (jobs|roles|positions))\b/i.test(title) && !/\b(playbook|explained|what .* means|how to|opinion|analysis)\b/i.test(title) && (!co || subjectOf(title, co, "lays off|laying off|layoffs|to cut|cuts|job cuts|reduction in force|slashes|eliminat\\w+|axes|trims"))) return "layoffs";
  if (/\b(acquires|to acquire|agrees to acquire|completes (the )?acquisition|closes (the )?acquisition|acquisition of|buys|to buy|merger with|merges with|agreed to buy)\b/i.test(title) && !/\b(stake|shares|stock|price target|holdings? in|position in|bond|analyst|rating|units|land|property|building|stadium|rights|licen[cs]e|patent|fleet|aircraft|737|787|a320|contract|lease|portfolio of|acres|site|facility|plant)\b/i.test(title) && (!co || subjectOf(title, co, "acquires|to acquire|agrees to acquire|completes|closes|acquisition of|buys|to buy|merger with|merges with|agreed to buy|snaps up"))) return "acquisition";
  if (FUNDING_ON && /\b(raises? \$\d|raised \$\d|funding round|series [a-f]\b|secures? \$\d|closes? \$\d|files for ipo|goes public|ipo\b)\b/i.test(title)) return "funding";
  return null;
}

async function main() {
  const started = nowIso();
  let cos = d.prepare("SELECT id,name,domain FROM companies ORDER BY rank").all() as Co[];
  if (LIMIT) cos = cos.slice(0, LIMIT);
  if (process.env.RECLASSIFY === "1") {
    const rows = d.prepare("SELECT id, company_id, kind, title FROM news").all() as { id: number; company_id: number; kind: string; title: string }[];
    const byId = new Map(cos.map((c) => [c.id, c]));
    const del = d.prepare("DELETE FROM news WHERE id=?"), upd = d.prepare("UPDATE news SET kind=?, confidence=? WHERE id=?");
    let kept = 0, dropped = 0;
    const tx = d.transaction(() => {
      for (const r of rows) {
        const co = byId.get(r.company_id)!; const k = kindOf(r.title, co);
        if (!k) { del.run(r.id); dropped++; continue; }
        if (k === "appointment") { const sub = subjectCompany(r.title); const mh = sub.hiring ? matchExact(sub.hiring, co) : false; const mf = sub.from ? matchExact(sub.from, co) : false; if (mh) upd.run("appointment", "high", r.id); else if (mf) upd.run("departure", "high", r.id); else if (!sub.hiring && !sub.from && !GENERIC.has(variants(co)[1]?.toLowerCase() || "")) upd.run("appointment", "low", r.id); else { del.run(r.id); dropped++; continue; } d.prepare("UPDATE news SET person=?, role=? WHERE id=?").run(person(r.title), (r.title.match(ROLE_RE) || [""])[0] || null, r.id); kept++; continue; }
        upd.run(k, "high", r.id); kept++;
      }
      d.prepare("DELETE FROM signals WHERE type IN ('exec.hr_appointment','exec.hr_departure','news.layoffs','news.acquisition','news.funding')").run();
    });
    tx();
    console.log(`reclassified: kept ${kept}, dropped ${dropped}`);
    await emitSignals(); logRun("12-news-reclassify", started, true, `kept=${kept} dropped=${dropped}`); return;
  }
  const ins = d.prepare("INSERT OR IGNORE INTO news (company_id, kind, title, url, source, published_at, person, role, query, confidence) VALUES (?,?,?,?,?,?,?,?,?,?)");
  let rows = 0, appts = 0;
  const seen = new Set<string>();
  const add = (co: Co, kind: string, it: { title: string; link: string; date: string; source: string }, query: string, strong: boolean) => {
    const key = co.id + "|" + kind + "|" + it.title.toLowerCase(); if (seen.has(key)) return; seen.add(key);
    const role = kind === "appointment" || kind === "departure" ? (it.title.match(ROLE_RE) || [""])[0] : null;
    const r = ins.run(co.id, kind, it.title, it.link, it.source, it.date || null, kind === "appointment" || kind === "departure" ? person(it.title) : null, role, query, strong ? "high" : "low");
    if (r.changes) { rows++; if (kind === "appointment") appts++; }
  };
  // 1. Broad sweeps for HR-leader appointments (catch the ones per-company queries miss)
  const sweeps = ['"chief people officer" (appointed OR names OR joins OR appoints OR hires)', '"chief human resources officer" (appointed OR names OR joins OR appoints OR hires)', '"head of talent acquisition" (appointed OR names OR joins OR hires)', '"vice president of human resources" (appointed OR names OR joins OR promoted)', '"head of people" (appointed OR joins OR names OR hires)', '"chief talent officer" (appointed OR names OR joins)', 'CHRO (appointed OR names OR joins OR hires)'];
  for (const q of sweeps) {
    const items = await rss(q); await sleep(500);
    for (const it of items) { const k = kindOf(it.title); if (k !== "appointment") continue; const sub = subjectCompany(it.title); const mh = sub.hiring ? cos.find((c) => matchExact(sub.hiring!, c)) : undefined; const mf = sub.from ? cos.find((c) => matchExact(sub.from!, c)) : undefined; if (mh) add(mh, "appointment", it, "sweep", true); if (mf && (!mh || mf.id !== mh.id)) add(mf, "departure", it, "sweep", true); if (!mh && !mf && !sub.hiring && !sub.from) { const m = matchCompany(it.title, cos); if (m && !GENERIC.has(m.co.name.toLowerCase())) add(m.co, "appointment", it, "sweep", false); } }
  }
  console.log(`sweeps done: ${appts} appointments matched`);
  // 2. Per-company queries: leaders + events
  const limit = pLimit(3); let done = 0;
  await Promise.all(cos.map((co) => limit(async () => {
    const v = variants(co)[1] || co.name;
    const qs = [`"${v}" (CHRO OR "chief people officer" OR "chief human resources officer" OR "head of talent" OR "vice president" "human resources" OR "VP of people")`, `"${v}" (layoffs OR "lays off" OR "job cuts" OR acquires OR "to acquire" OR "acquisition of" OR merger)`];
    for (const q of qs) {
      const items = await rss(q); await sleep(350);
      for (const it of items) {
        const k = kindOf(it.title, co); if (!k) continue;
        if (k === "appointment") { const sub = subjectCompany(it.title); const mh = sub.hiring ? matchExact(sub.hiring, co) : false; const mf = sub.from ? matchExact(sub.from, co) : false; if (mh) add(co, "appointment", it, "company", true); else if (mf) add(co, "departure", it, "company", true); else if (!sub.hiring && !sub.from) { const m = matchCompany(it.title, [co]); if (m && m.strong && !GENERIC.has(variants(co)[1]?.toLowerCase() || "")) add(co, "appointment", it, "company", false); } continue; }
        if (/\bto acquire \d|acquires? \d+ /i.test(it.title)) continue; // "to acquire 21 Boeing 737s"
        const m = matchCompany(it.title, [co]); if (!m || !m.strong) continue; add(co, k, it, "company", m.strong);
      }
    }
    done++; if (done % 50 === 0) console.log(`${done}/${cos.length} companies`);
  })));
  await emitSignals();
  const note = `news_rows=${rows} appointments=${appts}`;
  console.log("DONE", note);
  logRun("12-news", started, true, note);
}
async function emitSignals() {
  const sig = d.prepare(`INSERT INTO signals (company_id, type, strength, observed_at, source, source_url, title, summary, payload_json, dedupe_key) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(dedupe_key) DO UPDATE SET title=excluded.title, source_url=excluded.source_url, payload_json=excluded.payload_json`);
  const news = d.prepare("SELECT n.*, c.name FROM news n JOIN companies c ON c.id=n.company_id WHERE n.published_at IS NOT NULL").all() as { company_id: number; kind: string; title: string; url: string; source: string; published_at: string; person: string | null; role: string | null; confidence: string; name: string }[];
  let sigs = 0;
  const tx = d.transaction(() => {
    for (const n of news) {
      const type = n.kind === "appointment" ? "exec.hr_appointment" : n.kind === "departure" ? "exec.hr_departure" : n.kind === "layoffs" ? "news.layoffs" : n.kind === "acquisition" ? "news.acquisition" : "news.funding";
      const strength = n.kind === "appointment" ? (n.confidence === "high" ? 5 : 3) : n.kind === "departure" ? 4 : 3;
      const summary = n.kind === "appointment" ? `${n.name}: ${n.person ? n.person + " " : ""}${n.role || "HR leader"} appointment reported by ${n.source} on ${n.published_at}.` : n.kind === "departure" ? `An HR leader left ${n.name} (${n.source}, ${n.published_at}): ${n.title}` : `${n.name} in the news (${n.source}, ${n.published_at}): ${n.title}`;
      sig.run(n.company_id, type, strength, n.published_at, n.source || "news", n.url, n.title, summary, JSON.stringify({ person: n.person, role: n.role, source: n.source, confidence: n.confidence }), `${n.company_id}:${type}:${n.title.toLowerCase().slice(0, 80)}`);
      sigs++;
    }
  });
  tx();
  console.log(`signals=${sigs}`);
}
main().catch((e) => { console.error(e); process.exit(1); });

/* Shared chrome + helpers for the HRT design samples. Requires data.js and hrt-lib.js loaded first. */
(function () {
  const L = window.HRTLIB, D = window.HRT;
  const css = `
  :root{--ground:#070605;--panel:#0e0c0a;--panel2:#141210;--line:#2a2521;--line2:#3b342d;--ink:#efe9dc;--muted:#9b9283;--dim:#5e574d;--amber:#ffa028;--amber2:#ffbd63;--amberdeep:#b86a12;
    --hiring:#1fa862;--stack:#2b8fd0;--list:#b8891a;--filings:#8f78d6;--risk:#d24a4a;--hiring-t:#3ddc84;--stack-t:#5cc8ff;--list-t:#ffd469;--filings-t:#c48bff;--risk-t:#ff5d5d;
    --mono:"IBM Plex Mono","SFMono-Regular",Menlo,Consolas,monospace;--sans:"IBM Plex Sans","Helvetica Neue",Arial,sans-serif}
  *{box-sizing:border-box}html,body{height:100%}body{margin:0;background:var(--ground);color:var(--ink);font-family:var(--mono);font-size:12.5px;line-height:1.4;-webkit-font-smoothing:antialiased;overflow-x:hidden}
  a{color:inherit;text-decoration:none}::selection{background:var(--amber);color:#000}
  *{scrollbar-width:thin;scrollbar-color:#3b342d #070605}
  .hrt-bar{display:flex;align-items:stretch;border-bottom:1px solid var(--line);background:#050403;font-size:11.5px;position:sticky;top:0;z-index:40}
  .hrt-bar .logo{display:flex;align-items:center;gap:8px;padding:0 12px;border-right:1px solid var(--line)}
  .hrt-bar .logo b{background:var(--amber);color:#000;padding:2px 6px;letter-spacing:.18em;font-weight:700}
  .hrt-bar .logo span{color:var(--muted);letter-spacing:.14em}
  .hrt-bar .cell{display:flex;align-items:center;gap:8px;padding:6px 12px;border-right:1px solid var(--line);white-space:nowrap}
  .hrt-bar .cell.grow{flex:1;min-width:0}
  .hrt-bar select{background:#000;color:var(--amber);border:1px solid var(--line2);font:inherit;padding:2px 6px}
  .hrt-bar .live{margin-left:auto}
  .lbl{color:var(--muted);font-size:10px;letter-spacing:.12em;text-transform:uppercase}
  .kbd{border:1px solid var(--line2);background:#111;color:var(--muted);padding:1px 6px;font-size:10px;border-radius:2px;font-family:var(--mono);cursor:pointer}
  .kbd:hover,.kbd.on{color:var(--amber);border-color:var(--amber)}
  .kbd:focus-visible,button:focus-visible,select:focus-visible,input:focus-visible{outline:1px solid var(--amber);outline-offset:1px}
  .panel{background:var(--panel);border:1px solid var(--line)}
  .ptitle{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:4px 10px;background:#12100d;border-bottom:1px solid var(--line);color:var(--amber);font-size:10.5px;letter-spacing:.12em;text-transform:uppercase}
  .ptitle .k{color:#000;background:var(--amber);padding:0 5px;margin-right:6px;font-weight:700}
  .ptitle .r{color:var(--muted);text-transform:none;letter-spacing:0}
  .badge{display:inline-block;padding:0 6px;font-size:10px;letter-spacing:.08em;text-transform:uppercase;border:1px solid;line-height:16px}
  .b-HIRING{color:var(--hiring-t);border-color:var(--hiring)}.b-STACK{color:var(--stack-t);border-color:var(--stack)}.b-FILINGS{color:var(--filings-t);border-color:var(--filings)}.b-RISK{color:var(--risk-t);border-color:var(--risk)}.b-LIST{color:var(--list-t);border-color:var(--list)}
  .prose{font-family:var(--sans);font-size:13px;line-height:1.5;color:var(--ink)}
  .num{font-variant-numeric:tabular-nums;text-align:right}
  .glow{text-shadow:0 0 8px rgba(255,160,40,.35)}
  .tip{position:fixed;pointer-events:none;z-index:100;background:#000;border:1px solid var(--line2);padding:6px 9px;font-size:11px;max-width:320px;color:var(--ink);box-shadow:0 6px 24px rgba(0,0,0,.6);display:none}
  .tip b{color:var(--amber)}
  @media (prefers-reduced-motion: reduce){*{animation:none!important;transition:none!important}}
  `;
  const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
  const fl = document.createElement("link"); fl.rel = "stylesheet"; fl.href = "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600&display=swap"; document.head.appendChild(fl);

  const byId = new Map(D.companies.map((c) => [c.id, c]));
  const sigsByCo = new Map(); for (const s of D.signals) { if (!sigsByCo.has(s.company_id)) sigsByCo.set(s.company_id, []); sigsByCo.get(s.company_id).push(s); }
  const jobsByCo = new Map(); for (const j of D.jobs) { if (!jobsByCo.has(j.company_id)) jobsByCo.set(j.company_id, []); jobsByCo.get(j.company_id).push(j); }
  const GROUP = (t) => L.SIGNAL_GROUP[t] || "STACK";
  const GROUP_COLOR = { HIRING: "var(--hiring)", STACK: "var(--stack)", FILINGS: "var(--filings)", RISK: "var(--risk)", LIST: "var(--list)" };
  const GROUP_HEX = { HIRING: "#1fa862", STACK: "#2b8fd0", FILINGS: "#8f78d6", RISK: "#d24a4a", LIST: "#b8891a" };
  const GROUP_TEXT = { HIRING: "#3ddc84", STACK: "#5cc8ff", FILINGS: "#c48bff", RISK: "#ff5d5d", LIST: "#ffd469" };

  function profileKey() { try { return localStorage.getItem("hrt_profile") || new URLSearchParams(location.search).get("p") || "ats"; } catch { return "ats"; } }
  function profile() { return L.PROFILE_BY_KEY[profileKey()] || L.PROFILES[0]; }
  function setProfile(k) { try { localStorage.setItem("hrt_profile", k); } catch { /* */ } window.dispatchEvent(new CustomEvent("hrt:profile", { detail: k })); }
  function scoredSignals(co, p) { return (sigsByCo.get(co.id) || []).map((s) => ({ ...s, score: L.scoreSignal(p, s.type, s.strength, s.payload_json), group: GROUP(s.type) })).filter((s) => s.score > 0).sort((a, b) => b.score - a.score || (b.observed_at > a.observed_at ? 1 : -1)); }
  function companyScore(co, p) { return Math.round(scoredSignals(co, p).reduce((a, s) => a + s.score, 0) * 10) / 10; }
  function ranked(p) { return D.companies.map((c) => ({ co: c, score: companyScore(c, p) })).sort((a, b) => b.score - a.score || a.co.rank - b.co.rank); }
  function card(co, p) { const sn = D.snapshots[co.id] || {}; return L.buildBattlecard({ company: co, signals: scoredSignals(co, p), counts: sn.counts || {}, states: sn.states || {}, countries: sn.countries || {}, tools: sn.tools || {} }, p); }
  function vendorName(k) { return k ? (L.VENDOR_BY_KEY[k] ? L.VENDOR_BY_KEY[k].name : k) : "unknown"; }
  function fmtNum(n) { return n == null ? "–" : Number(n).toLocaleString(); }
  function fmtMoney(m) { if (m == null) return "–"; return Math.abs(m) >= 1000 ? "$" + (m / 1000).toFixed(1) + "B" : "$" + Math.round(m) + "M"; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
  function events(p, days) {
    const cutoff = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
    const out = [];
    for (const s of D.signals) {
      if (/^(hiring|stack|fortune)\./.test(s.type) || s.observed_at < cutoff) continue;
      const co = byId.get(s.company_id); if (!co) continue;
      out.push({ id: "s" + s.id, co, date: s.observed_at.slice(0, 10), type: s.type, group: GROUP(s.type), title: s.title, strength: s.strength, score: L.scoreSignal(p, s.type, s.strength, s.payload_json), url: s.source_url });
    }
    const bt = { people_exec: "hiring.people_exec_open", hr_leader: "hiring.hr_leader_open", hris: "hiring.hris_open", payroll: "hiring.payroll_open", recruiting: "hiring.recruiting_open", comp_benefits: "hiring.comp_benefits_open", learning: "hiring.learning_open", wfm: "hiring.wfm_open", engagement: "hiring.engagement_open", hr_generalist: "hiring.hr_generalist_open" };
    for (const j of D.jobs) {
      if (!j.date || j.approx || j.date < cutoff) continue;
      const co = byId.get(j.company_id); if (!co) continue;
      const type = bt[j.bucket]; const strength = j.bucket === "people_exec" ? 5 : j.bucket === "hr_leader" ? 4 : j.bucket === "hris" ? 3 : 2;
      out.push({ id: "j" + j.id, co, date: j.date, type, group: "HIRING", title: "Role opened: " + j.title, strength, score: L.scoreSignal(p, type, strength, JSON.stringify({ domain: L.execDomain(j.title) })), url: j.url, bucket: j.bucket });
    }
    out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : b.score - a.score));
    return out;
  }
  function bar(title, opts) {
    const p = profile();
    const el = document.createElement("div"); el.className = "hrt-bar";
    el.innerHTML = `<a class="logo" href="#"><b>HRT</b><span>${esc(title)}</span></a>
      <div class="cell"><span class="lbl">Profile</span><select id="hrt-prof">${L.PROFILES.map((x) => `<option value="${x.key}" ${x.key === p.key ? "selected" : ""}>${x.short} · ${esc(x.name)}</option>`).join("")}</select></div>
      <div class="cell grow" id="hrt-bar-slot">${opts && opts.slot ? opts.slot : ""}</div>
      <div class="cell"><span class="lbl">Univ</span><span>${D.meta.companies}</span><span class="lbl">Sig</span><span>${D.meta.signals.toLocaleString()}</span></div>
      <div class="cell live"><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--hiring-t);box-shadow:0 0 8px var(--hiring-t)"></span><span style="color:var(--muted)">DATA ${D.meta.generated} · design sample</span></div>`;
    document.body.prepend(el);
    el.querySelector("#hrt-prof").addEventListener("change", (e) => setProfile(e.target.value));
    return el;
  }
  const tip = document.createElement("div"); tip.className = "tip"; document.addEventListener("DOMContentLoaded", () => document.body.appendChild(tip));
  function showTip(html, x, y) { tip.innerHTML = html; tip.style.display = "block"; const w = tip.offsetWidth, h = tip.offsetHeight; tip.style.left = Math.min(x + 14, innerWidth - w - 8) + "px"; tip.style.top = Math.min(y + 14, innerHeight - h - 8) + "px"; }
  function hideTip() { tip.style.display = "none"; }
  window.HRTUI = { L, D, byId, sigsByCo, jobsByCo, GROUP, GROUP_COLOR, GROUP_HEX, GROUP_TEXT, profile, profileKey, setProfile, scoredSignals, companyScore, ranked, card, vendorName, fmtNum, fmtMoney, esc, events, bar, showTip, hideTip };
})();

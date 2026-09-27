/* Situation Room: wire + globe + situations. Needs hrt-lib.js, data.js, globe.gl. */
(async function () {
  const L = window.HRTLIB;
  const APP = !window.HRT;
  const D = window.HRT || await fetch("/api/data", { cache: "no-store" }).then((r) => r.json());
  const ASSET = window.HRT_ASSET_BASE || "";
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const byId = new Map(D.companies.map((c) => [c.id, c]));
  const jobsByCo = new Map(); for (const j of D.jobs) { if (!jobsByCo.has(j.company_id)) jobsByCo.set(j.company_id, []); jobsByCo.get(j.company_id).push(j); }
  const sigsByCo = new Map(); for (const s of D.signals) { if (!sigsByCo.has(s.company_id)) sigsByCo.set(s.company_id, []); sigsByCo.get(s.company_id).push(s); }
  const ASOF = D.meta.generated;
  const daysAgo = (d) => Math.round((new Date(ASOF) - new Date(d)) / 864e5);
  const ago = (d) => { const n = daysAgo(d); return n <= 0 ? "today" : n === 1 ? "yesterday" : n + "d ago"; };
  const vname = (k) => (k ? (L.VENDOR_BY_KEY[k] ? L.VENDOR_BY_KEY[k].name : k) : null);
  const COLOR = { new_leader: "#3fd47e", systems_project: "#5fa8ff", recruiting_build: "#f0b04a", consolidation: "#c08cff", cost_cutting: "#ff6b66", expansion: "#3cc9c9", funded: "#e2c14a", hr_forming: "#9ad36a", threshold: "#b9a2ff", hourly_surge: "#ff9c6b" };
  const store = { get: (k, d) => { try { const v = localStorage.getItem("hrtroom_" + k); return v == null ? d : JSON.parse(v); } catch { return d; } }, set: (k, v) => { try { localStorage.setItem("hrtroom_" + k, JSON.stringify(v)); } catch {} } };
  const S = { profile: store.get("profile", "ats"), sit: "all", account: null, view: "list", playing: true, idx: 0, book: store.get("book", []) };
  const inBook = (co) => !S.book.length || (co.domain && S.book.includes(String(co.domain).toLowerCase()));
  const P = () => L.PROFILE_BY_KEY[S.profile] || L.PROFILES[0];

  // situations
  const all = [];
  for (const co of D.companies) { const sn = D.snapshots[co.id] || null; for (const s of L.detectSituations(co, jobsByCo.get(co.id) || [], sigsByCo.get(co.id) || [], sn, ASOF)) all.push({ co, s }); }
  let active = [], bySit = {}, topOf = new Map(), wireAll = [];
  function recompute() {
    active = all.filter((x) => x.s.confidence !== "low" && x.s.openedAt && inBook(x.co));
    bySit = {}; for (const x of active) (bySit[x.s.key] ||= []).push(x);
    for (const k in bySit) bySit[k].sort((a, b) => (b.s.openedAt > a.s.openedAt ? 1 : -1));
    topOf = new Map(); for (const x of active) if (!topOf.has(x.co.id)) topOf.set(x.co.id, x.s);
    wireAll = [...active].sort((a, b) => (a.s.openedAt < b.s.openedAt ? -1 : a.s.openedAt > b.s.openedAt ? 1 : 0)); // oldest → newest
  }
  recompute();
  const KEYS = L.SITUATIONS.filter((m) => m.active).map((m) => m.key);
  const visible = () => (S.sit === "all" ? wireAll : wireAll.filter((x) => x.s.key === S.sit));

  // header + tickers
  const prof = document.getElementById("prof");
  prof.innerHTML = L.PROFILES.map((x) => `<option value="${x.key}" ${x.key === S.profile ? "selected" : ""}>${esc(x.name)}</option>`).join("");
  prof.addEventListener("change", () => { S.profile = prof.value; store.set("profile", prof.value); renderRight(); });
  const clock = document.getElementById("clock"); const tick = () => { const d = new Date(); clock.textContent = d.toISOString().slice(11, 19) + " UTC"; }; tick(); setInterval(tick, 1000);
  const bookBtn = document.getElementById("book"); const bookLabel = () => { bookBtn.textContent = S.book.length ? `My book · ${S.book.length}` : "All " + D.companies.length; };
  bookLabel();
  bookBtn.addEventListener("click", () => {
    const m = document.getElementById("modal"); m.classList.add("show");
    document.getElementById("modal-body").innerHTML = `<h2>My book</h2><p class="lm">Paste the domains of the accounts you own, one per line or comma-separated (e.g. kroger.com). Leave empty to see all ${D.companies.length}. Only companies in this universe will match.</p><textarea id="bookta" rows="8" placeholder="kroger.com\ncencora.com\n3m.com">${esc(S.book.join("\n"))}</textarea><div class="mrow"><button class="btn p" id="booksave">Save</button><button class="btn" id="bookclear">Clear</button><span class="cnt" id="bookinfo"></span></div>
      <h2 style="margin-top:18px">Data</h2><p class="lm">Snapshot ${esc(String(D.meta.snapshot_at || D.meta.generated))} · ${D.meta.companies} companies · ${D.meta.boards} boards read · ${Number(D.meta.signals).toLocaleString()} signals · ${D.meta.filings ? Number(D.meta.filings).toLocaleString() + " SEC filings · " : ""}${D.meta.moves != null ? D.meta.moves + " leadership moves" : ""}</p>${Array.isArray(D.meta.runs) && D.meta.runs.length ? `<ul class="facts">${D.meta.runs.slice(0, 8).map((r) => `<li><span class="fd">${esc(String(r.finished_at || "").slice(0, 16))}</span><span>${esc(r.step)} · ${esc(String(r.note || "").slice(0, 110))}</span></li>`).join("")}</ul>` : ""}`;
    const ta = document.getElementById("bookta"); const info = document.getElementById("bookinfo");
    const parse = () => ta.value.split(/[\s,;]+/).map((x) => x.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "")).filter(Boolean);
    const upd = () => { const b = parse(); const hit = D.companies.filter((c) => c.domain && b.includes(String(c.domain).toLowerCase())).length; info.textContent = b.length ? `${hit} of ${b.length} domains are in this universe` : ""; };
    ta.addEventListener("input", upd); upd();
    document.getElementById("booksave").addEventListener("click", () => { S.book = [...new Set(parse())]; store.set("book", S.book); bookLabel(); m.classList.remove("show"); recompute(); S.view = "list"; S.idx = Math.max(0, visible().length - 1); tickers(); renderRight(); renderWire(); paintGlobe(); });
    document.getElementById("bookclear").addEventListener("click", () => { ta.value = ""; upd(); });
  });
  document.getElementById("modal").addEventListener("click", (e) => { if (e.target.id === "modal" || e.target.dataset.close != null) document.getElementById("modal").classList.remove("show"); });
  const q = document.getElementById("q"), hits = document.getElementById("hits"); let hitList = [], hi = 0;
  q.addEventListener("input", () => { const v = q.value.trim().toLowerCase(); if (!v) { hits.classList.remove("show"); return; } hitList = D.companies.filter((c) => c.name.toLowerCase().includes(v)).sort((a, b) => (a.name.toLowerCase().startsWith(v) ? 0 : 1) - (b.name.toLowerCase().startsWith(v) ? 0 : 1) || a.rank - b.rank).slice(0, 8); hi = 0; hits.innerHTML = hitList.map((c, i) => { const t = topOf.get(c.id); return `<div class="hit ${i === 0 ? "on" : ""}" data-i="${i}"><span>${esc(c.name)}</span><span class="sub">${t ? esc(L.SITUATION_BY_KEY[t.key].short) : "no active situation"}</span></div>`; }).join("") || `<div class="hit"><span class="sub">Not in this universe.</span></div>`; hits.classList.add("show"); });
  q.addEventListener("keydown", (e) => { if (e.key === "ArrowDown") hi = Math.min(hi + 1, hitList.length - 1); else if (e.key === "ArrowUp") hi = Math.max(hi - 1, 0); else if (e.key === "Enter") { if (hitList[hi]) openCo(hitList[hi]); return; } else if (e.key === "Escape") { q.blur(); hits.classList.remove("show"); return; } else return; e.preventDefault(); [...hits.children].forEach((x, i) => x.classList.toggle("on", i === hi)); });
  hits.addEventListener("mousedown", (e) => { const h = e.target.closest("[data-i]"); if (h) { e.preventDefault(); openCo(hitList[Number(h.dataset.i)]); } });
  q.addEventListener("blur", () => setTimeout(() => hits.classList.remove("show"), 120));
  document.addEventListener("keydown", (e) => { const tag = (e.target.tagName || "").toLowerCase(); if (tag === "input" || tag === "select" || tag === "textarea") return; if (e.key === "/") { e.preventDefault(); q.focus(); } if (e.key === " ") { e.preventDefault(); togglePlay(); } if (e.key === "Escape" && S.view === "story") { S.view = "list"; renderRight(); } });
  function tickers() {
    const fresh = [...active].filter((x) => daysAgo(x.s.openedAt) <= 7).sort((a, b) => (b.s.openedAt > a.s.openedAt ? 1 : -1));
    const item = (x) => `<span class="ti"><i class="dot" style="background:${COLOR[x.s.key]}"></i><b>${esc(x.co.name.toUpperCase())}</b> ${esc(x.s.headline.replace(x.co.name + " ", ""))} <span class="tm">${ago(x.s.openedAt)}</span></span>`;
    const top = fresh.map(item).join(""); document.getElementById("ttop").innerHTML = `<div>${top}${top}</div>`;
    const counts = KEYS.map((k) => `<span class="ti"><i class="dot" style="background:${COLOR[k]}"></i><b>${(bySit[k] || []).length}</b> ${esc(L.SITUATION_BY_KEY[k].name.toLowerCase())}</span>`).join("");
    const bottom = counts + [...active].sort((a, b) => (b.s.openedAt > a.s.openedAt ? 1 : -1)).slice(0, 60).map(item).join("");
    document.getElementById("tbot").innerHTML = `<div>${bottom}${bottom}</div>`;
    document.getElementById("ttop-n").textContent = fresh.length + " NEW THIS WEEK";
  }

  // globe
  const gel = document.getElementById("globe");
  const g = Globe()(gel).backgroundColor("rgba(0,0,0,0)").globeImageUrl(ASSET + "earth-night.jpg").backgroundImageUrl(ASSET + "night-sky.png")
    .showAtmosphere(true).atmosphereColor("#ffa028").atmosphereAltitude(0.17)
    .pointLat("lat").pointLng("lng").pointsMerge(false).pointColor((d) => d.color).pointAltitude((d) => d.alt).pointRadius((d) => d.rad)
    .pointLabel((d) => `<div class="gtip"><b>${esc(d.co.name)}</b>${d.sit ? esc(d.sit.headline) : "No active situation"}${d.sit && d.sit.openedAt ? `<span>${ago(d.sit.openedAt)} · ${esc(d.co.sector || "")}</span>` : `<span>${esc(d.co.sector || "")}</span>`}</div>`)
    .onPointClick((d) => openCo(d.co))
    .arcStartLat("startLat").arcStartLng("startLng").arcEndLat("endLat").arcEndLng("endLng").arcColor(() => ["rgba(240,176,74,.55)", "rgba(95,168,255,.15)"]).arcStroke(0.2).arcDashLength(0.35).arcDashGap(1).arcDashAnimateTime(2800).arcAltitudeAutoScale(0.32)
    .arcLabel((d) => `<div class="gtip"><b>${esc(d.name)}</b>hiring in ${d.country}: ${d.count} open roles</div>`)
    .ringLat("lat").ringLng("lng").ringColor((d) => (t) => d.color + Math.round((1 - t) * 220).toString(16).padStart(2, "0")).ringMaxRadius(3).ringPropagationSpeed(1.4).ringRepeatPeriod(1000)
    .labelLat("lat").labelLng("lng").labelText((d) => d.co.name.toUpperCase()).labelSize(0.42).labelDotRadius(0.001).labelColor(() => "rgba(228,230,234,.8)").labelResolution(2).labelAltitude(0.07);
  const resize = () => g.width(gel.clientWidth).height(gel.clientHeight); new ResizeObserver(resize).observe(gel); resize();
  setTimeout(() => { const c = g.controls(); c.autoRotate = true; c.autoRotateSpeed = 0.3; g.pointOfView({ lat: 36, lng: -96, altitude: 1.7 }, 0); }, 150);
  function paintGlobe() {
    const lit = new Map(); for (const x of visible()) if (!lit.has(x.co.id)) lit.set(x.co.id, x.s);
    const pts = D.companies.filter((c) => c.lat != null).map((co) => { const sit = lit.get(co.id) || null; return { co, lat: co.lat, lng: co.lng, sit, color: sit ? COLOR[sit.key] : "#4a5566", alt: sit ? 0.022 : 0.004, rad: sit ? 0.22 : 0.07 }; });
    g.pointsData(pts);
    const litPts = pts.filter((p) => p.sit);
    g.labelsData(litPts.sort((a, b) => (b.sit.openedAt > a.sit.openedAt ? 1 : -1)).slice(0, 30));
    const arcs = [];
    for (const p of litPts.slice(0, 22)) { const sn = D.snapshots[p.co.id]; if (!sn) continue; Object.entries(sn.countries || {}).filter(([k]) => k.length === 2 && k !== "US" && L.COUNTRY_LATLNG[k]).sort((a, b) => b[1] - a[1]).slice(0, 2).forEach(([k, n]) => { const ll = L.COUNTRY_LATLNG[k]; arcs.push({ name: p.co.name, startLat: p.lat, startLng: p.lng, endLat: ll[0], endLng: ll[1], country: k, count: n }); }); }
    g.arcsData(arcs);
    document.getElementById("glegend").innerHTML = KEYS.map((k) => `<span class="${S.sit !== "all" && S.sit !== k ? "dim" : ""}"><i class="dot" style="background:${COLOR[k]}"></i>${esc(L.SITUATION_BY_KEY[k].short)} ${(bySit[k] || []).length}</span>`).join("") + `<span class="dim">grey · no active situation · arcs · hiring abroad</span>`;
  }

  // wire (replay)
  let timer = null;
  function renderWire() {
    const list = visible(); if (!list.length) { document.getElementById("wire").innerHTML = `<div class="empty">Nothing in this situation.</div>`; return; }
    S.idx = Math.min(S.idx, list.length - 1);
    const cur = list[S.idx];
    const show = list.slice(Math.max(0, S.idx - 14), S.idx + 1).reverse();
    document.getElementById("wire").innerHTML = show.map((x, i) => `<div class="w ${i === 0 ? "now" : ""}" data-id="${x.co.id}" data-k="${x.s.key}"><i class="dot" style="background:${COLOR[x.s.key]}"></i><span class="wd">${x.s.openedAt}</span><span class="wc">${esc(x.co.name)}</span><span class="wt">${esc(x.s.headline.replace(x.co.name + " ", ""))}</span><span class="wf">${esc(x.s.facts.filter((f) => f.date)[0]?.text.replace(/^Posted /, "") || "")}</span></div>`).join("");
    document.getElementById("wire").querySelectorAll(".w").forEach((r) => r.addEventListener("click", () => { S.sit = r.dataset.k === S.sit ? S.sit : S.sit; openCo(byId.get(Number(r.dataset.id)), r.dataset.k); }));
    document.getElementById("wdate").textContent = cur.s.openedAt + " · " + (S.idx + 1) + "/" + list.length;
    const rings = show.slice(0, 5).map((x) => ({ lat: x.co.lat, lng: x.co.lng, color: COLOR[x.s.key] })).filter((r) => r.lat != null);
    g.ringsData(rings);
    if (cur.co.lat != null) g.pointOfView({ lat: cur.co.lat, lng: cur.co.lng, altitude: 1.5 }, 1200);
  }
  function step(n) { const list = visible(); if (!list.length) return; S.idx = (S.idx + n + list.length) % list.length; renderWire(); }
  function togglePlay() { S.playing = !S.playing; document.getElementById("play").textContent = S.playing ? "❚❚" : "▶"; }
  document.getElementById("play").addEventListener("click", togglePlay);
  document.getElementById("prev").addEventListener("click", () => { S.playing = false; document.getElementById("play").textContent = "▶"; step(-1); });
  document.getElementById("next").addEventListener("click", () => { S.playing = false; document.getElementById("play").textContent = "▶"; step(1); });
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  timer = setInterval(() => { if (S.playing && !reduce) step(1); }, 3200);

  function openCo(co, k) { q.value = ""; hits.classList.remove("show"); q.blur(); S.account = co; S.view = "story"; S.storyKey = k || (topOf.get(co.id) || {}).key; try { history.replaceState(null, "", "#a=" + co.slug); } catch {} renderRight(); if (co.lat != null) g.pointOfView({ lat: co.lat, lng: co.lng, altitude: 1.2 }, 900); }

  // right panel
  function renderRight() {
    const p = P();
    document.getElementById("tiles").innerHTML = `<button class="tile ${S.sit === "all" ? "on" : ""}" data-k="all"><span class="tn">All situations</span><span class="tc">${active.length}</span></button>` + KEYS.map((k) => { const arr = bySit[k] || []; const fresh = arr.filter((x) => daysAgo(x.s.openedAt) <= 7).length; return `<button class="tile ${S.sit === k ? "on" : ""}" data-k="${k}" style="--c:${COLOR[k]}"><i class="dot" style="background:${COLOR[k]}"></i><span class="tn">${esc(L.SITUATION_BY_KEY[k].name)}</span><span class="tc">${arr.length}</span><span class="tf">${fresh ? "+" + fresh : ""}</span></button>`; }).join("") + L.SITUATIONS.filter((m) => !m.active).map((m) => `<div class="tile off" title="needs ${esc(m.needs)}"><i class="dot" style="background:#2e343c"></i><span class="tn">${esc(m.name)}</span><span class="tc">–</span><span class="tf">soon</span></div>`).join("");
    document.querySelectorAll(".tile[data-k]").forEach((t) => t.addEventListener("click", () => { S.sit = t.dataset.k; S.view = "list"; S.idx = Math.max(0, visible().length - 1); renderRight(); renderWire(); paintGlobe(); }));
    if (S.view === "story" && S.account) renderStory(p); else renderList(p);
  }
  function renderList(p) {
    const rows = S.sit === "all" ? [...active].sort((a, b) => (b.s.openedAt > a.s.openedAt ? 1 : -1)).slice(0, 80) : (bySit[S.sit] || []);
    const meta = S.sit === "all" ? null : L.SITUATION_BY_KEY[S.sit];
    const el = document.getElementById("main");
    el.innerHTML = `<div class="lh"><div><h2>${meta ? esc(meta.name) : "Newest situations"}</h2><p class="lm">${meta ? esc(meta.means[p.family]) : "Every account that entered a buying situation, newest first. Pick a situation on the left of this panel to build a list."}</p></div><div class="la"><span class="cnt">${rows.length} accounts${meta ? " · window " + meta.windowDays + " days" : ""}</span><span style="display:flex;gap:6px">${APP ? `<a class="btn p" id="dl" href="/api/export?profile=${encodeURIComponent(S.profile)}&situation=${encodeURIComponent(S.sit)}${S.book.length ? "&book=" + encodeURIComponent(S.book.join(",")) : ""}">Download CSV</a>` : ""}<button class="btn ${APP ? "" : "p"}" id="csv">Copy CSV</button></span></div></div>
      <div class="rows">${rows.map((x) => { const st = L.situationStory(x.s, x.co, p); const f = x.s.facts.filter((f) => f.date)[0]; return `<div class="row" data-id="${x.co.id}" data-k="${x.s.key}"><div class="r1"><i class="dot" style="background:${COLOR[x.s.key]}"></i><span class="co">${esc(x.co.name)}</span><span class="meta">${esc(x.co.sector || "")}${x.co.ats_vendor ? " · " + esc(vname(x.co.ats_vendor)) : ""}</span><span class="when">${ago(x.s.openedAt)}</span></div><div class="hl">${esc(x.s.headline)}</div>${f ? `<div class="fact"><span class="fd">${f.date}</span><span>${esc(f.text)}${f.url ? ` <a href="${esc(f.url)}" target="_blank" onclick="event.stopPropagation()">proof</a>` : ""}</span></div>` : ""}<div class="who">→ ${esc(st.who[0])}<span class="conf ${x.s.confidence}">${x.s.confidence === "high" ? "2+ dated facts" : "1 dated fact"}</span></div></div>`; }).join("") || `<div class="empty">No accounts here right now.</div>`}</div>`;
    el.querySelectorAll(".row").forEach((r) => r.addEventListener("click", () => openCo(byId.get(Number(r.dataset.id)), r.dataset.k)));
    document.getElementById("csv").addEventListener("click", (ev) => { const e = (v) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }; const csv = ["company,domain,sector,hq_state,employees,runs,situation,headline,trigger_date,window_ends,confidence,fact_1,fact_1_url,fact_2,fact_2_url,contact_title_1,contact_title_2,first_line"].concat(rows.map((x) => { const st = L.situationStory(x.s, x.co, p); const f = x.s.facts; return [x.co.name, x.co.domain, x.co.sector, L.stateCode(x.co.hq_state), x.co.employees, vname(x.co.ats_vendor || x.co.hris_vendor), L.SITUATION_BY_KEY[x.s.key].name, x.s.headline, x.s.openedAt, x.s.windowEnds, x.s.confidence, f[0] && f[0].text, f[0] && f[0].url, f[1] && f[1].text, f[1] && f[1].url, st.who[0], st.who[1], st.firstLine].map(e).join(","); })).join("\n"); navigator.clipboard.writeText(csv).then(() => { ev.target.textContent = "Copied " + rows.length; setTimeout(() => (ev.target.textContent = "Copy CSV"), 1500); }); });
  }
  function renderStory(p) {
    const co = S.account; const mine = all.filter((x) => x.co.id === co.id); const main = mine.find((x) => x.s.key === S.storyKey) || mine[0];
    const el = document.getElementById("main");
    if (!main) { el.innerHTML = `<div class="lh"><button class="btn" id="back">← back</button></div><div class="story"><h1>${esc(co.name)}</h1><p class="means">No active situation. ${co.open_roles != null ? Number(co.open_roles).toLocaleString() + " open roles. " : ""}${co.ats_vendor ? "Runs " + esc(vname(co.ats_vendor)) + "." : "HR systems not visible from the careers site."}</p></div>`; document.getElementById("back").addEventListener("click", () => { S.view = "list"; renderRight(); }); return; }
    const st = L.situationStory(main.s, co, p);
    el.innerHTML = `<div class="lh"><button class="btn" id="back">← back</button><div class="la"><span class="cnt">${esc(co.sector || "")} · ${esc(co.hq_city || "")}, ${esc(L.stateCode(co.hq_state))}${co.employees ? " · " + Number(co.employees).toLocaleString() + " emp" : ""}${co.open_roles != null ? " · " + Number(co.open_roles).toLocaleString() + " open roles" : ""}</span></div></div>
      <div class="story">
        <div class="stag" style="color:${COLOR[main.s.key]}"><i class="dot" style="background:${COLOR[main.s.key]}"></i>${esc(L.SITUATION_BY_KEY[main.s.key].name)} · ${ago(main.s.openedAt || ASOF)}</div>
        <h1>${esc(main.s.headline)}</h1>
        <p class="means">${esc(st.means)}</p>
        <h3>The facts</h3><ul class="facts">${main.s.facts.map((f) => `<li><span class="fd">${f.date || "undated"}</span><span>${esc(f.text)}${f.url ? ` <a href="${esc(f.url)}" target="_blank">proof</a>` : ""}</span></li>`).join("")}</ul>
        <div class="grid2">
          <div><h3>Window</h3><p>${esc(st.window)}<br><span class="cnt">${main.s.confidence === "high" ? "confirmed by two or more dated facts" : main.s.confidence === "medium" ? "one dated fact so far" : "undated facts only"}</span></p>
            <h3>Who to talk to</h3><p class="who2">${st.who.map((w) => `<a href="https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent('"' + w + '" ' + co.name)}" target="_blank">${esc(w)}</a>`).join("<br>")}</p></div>
          <div>${st.angle ? `<h3>Against ${esc(vname(co.ats_vendor || co.hris_vendor))}</h3><p class="angle">${esc(st.angle)}</p>` : ""}
            ${mine.length > 1 ? `<h3>Also at ${esc(co.name)}</h3><ul class="also">${mine.filter((x) => x !== main).map((x) => `<li data-k="${x.s.key}"><i class="dot" style="background:${COLOR[x.s.key]}"></i>${esc(x.s.headline.replace(co.name + " ", ""))}</li>`).join("")}</ul>` : ""}</div>
        </div>
        ${(() => {
          const mv = (D.moves || []).filter((m) => m.company_id === co.id && m.date && daysAgo(m.date) <= 90 && daysAgo(m.date) >= -400).sort((a, b) => (b.date > a.date ? 1 : -1));
          if (!mv.length) return "";
          const lab = (m) => { const src = (() => { try { return JSON.parse(m.sources_json || "[]"); } catch { return []; } })(); const who = m.person && !String(m.person).startsWith("(unnamed)") ? m.person : null; const via = m.source_kind === "8-K" ? "SEC 8-K" : m.source_kind === "board" ? "job board" : src.length > 1 ? src.length + " articles" : "news"; const link = m.source_url ? ` <a href="${esc(m.source_url)}" target="_blank">${via}</a>` : ` <span class="fd">${via}</span>`; if (m.kind === "arrival") return `<b>${who ? esc(who) + " named " : "New "}${esc(m.role)}</b>${m.hr ? "" : ' <span class="fd">· not HR</span>'}${link}`; if (m.kind === "departure") return `<b>${who ? esc(who) + ", " : ""}${esc(m.role)}, leaving</b>${m.hr ? "" : ' <span class="fd">· not HR</span>'}${link}`; if (m.kind === "role_filled") return `Posting filled or closed: ${esc(m.role)}${link}`; return `New posting: ${esc(m.role)}${link}`; };
          const hrIn = mv.filter((m) => m.kind === "arrival" && m.hr).length, hrOut = mv.filter((m) => m.kind === "departure" && m.hr).length, other = mv.filter((m) => (m.kind === "arrival" || m.kind === "departure") && !m.hr).length, filled = mv.filter((m) => m.kind === "role_filled").length, opened = mv.filter((m) => m.kind === "role_opened").length;
          const sum = [hrIn ? hrIn + " HR leader" + (hrIn > 1 ? "s" : "") + " arrived" : "", hrOut ? hrOut + " HR leader" + (hrOut > 1 ? "s" : "") + " leaving" : "", other ? other + " other officer change" + (other > 1 ? "s" : "") : "", filled ? filled + " HR posting" + (filled > 1 ? "s" : "") + " filled" : "", opened ? opened + " new HR posting" + (opened > 1 ? "s" : "") : ""].filter(Boolean).join(" · ");
          return `<h3>People movement · last 90 days</h3><p class="means">${sum}</p><ul class="facts">${mv.slice(0, 8).map((m) => `<li><span class="fd">${m.date}</span><span>${lab(m)}</span></li>`).join("")}</ul>`;
        })()}
        <h3>First line <button class="btn s" id="copyline">Copy</button></h3><p class="first">${esc(st.firstLine)}</p>
      </div>`;
    document.getElementById("back").addEventListener("click", () => { S.view = "list"; renderRight(); });
    document.getElementById("copyline").addEventListener("click", (ev) => navigator.clipboard.writeText(st.firstLine).then(() => { ev.target.textContent = "Copied"; setTimeout(() => (ev.target.textContent = "Copy"), 1200); }));
    el.querySelectorAll(".also li").forEach((li) => li.addEventListener("click", () => { S.storyKey = li.dataset.k; renderStory(p); }));
  }
  tickers(); renderRight(); S.idx = Math.max(0, visible().length - 40); renderWire(); paintGlobe();
  const h = (location.hash.match(/a=([a-z0-9-]+)/) || [])[1]; if (h) { const co = D.companies.find((c) => c.slug === h); if (co) openCo(co); }
})();

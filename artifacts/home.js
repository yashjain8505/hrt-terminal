/* Home screen logic shared by the two look options. Needs hrt-lib.js + data.js + globe.gl. */
(function () {
  const L = window.HRTLIB, D = window.HRT;
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const byId = new Map(D.companies.map((c) => [c.id, c]));
  const jobsByCo = new Map(); for (const j of D.jobs) { if (!jobsByCo.has(j.company_id)) jobsByCo.set(j.company_id, []); jobsByCo.get(j.company_id).push(j); }
  const sigsByCo = new Map(); for (const s of D.signals) { if (!sigsByCo.has(s.company_id)) sigsByCo.set(s.company_id, []); sigsByCo.get(s.company_id).push(s); }
  const ASOF = D.meta.generated;
  const daysAgo = (d) => Math.round((new Date(ASOF) - new Date(d)) / 864e5);
  const ago = (d) => { const n = daysAgo(d); return n <= 0 ? "today" : n === 1 ? "yesterday" : n + " days ago"; };
  const vname = (k) => (k ? (L.VENDOR_BY_KEY[k] ? L.VENDOR_BY_KEY[k].name : k) : null);
  const COLOR = { new_leader: "#3fb950", systems_project: "#5b9dff", recruiting_build: "#d9a441", consolidation: "#b48cff", cost_cutting: "#f25f5c" };
  const store = { get: (k, d) => { try { const v = localStorage.getItem("hrthome_" + k); return v == null ? d : JSON.parse(v); } catch { return d; } }, set: (k, v) => { try { localStorage.setItem("hrthome_" + k, JSON.stringify(v)); } catch {} } };
  const S = { profile: store.get("profile", "ats"), sit: "new_leader", account: null, view: "list" };
  const P = () => L.PROFILE_BY_KEY[S.profile] || L.PROFILES[0];

  // compute situations once (rules do not depend on the profile; story text does)
  const all = [];
  for (const co of D.companies) {
    const sn = D.snapshots[co.id] || null;
    const sits = L.detectSituations(co, jobsByCo.get(co.id) || [], sigsByCo.get(co.id) || [], sn, ASOF);
    for (const s of sits) all.push({ co, s });
  }
  const active = all.filter((x) => x.s.confidence !== "low" && x.s.openedAt);
  const bySit = {}; for (const x of active) (bySit[x.s.key] ||= []).push(x);
  for (const k in bySit) bySit[k].sort((a, b) => (b.s.openedAt > a.s.openedAt ? 1 : -1));
  const topOf = new Map(); for (const x of active) if (!topOf.has(x.co.id)) topOf.set(x.co.id, x.s);

  // header
  const prof = document.getElementById("prof");
  prof.innerHTML = L.PROFILES.map((x) => `<option value="${x.key}" ${x.key === S.profile ? "selected" : ""}>${esc(x.name)}</option>`).join("");
  prof.addEventListener("change", () => { S.profile = prof.value; store.set("profile", prof.value); render(); });
  const q = document.getElementById("q"), hits = document.getElementById("hits"); let hitList = [], hi = 0;
  q.addEventListener("input", () => { const v = q.value.trim().toLowerCase(); if (!v) { hits.classList.remove("show"); return; } hitList = D.companies.filter((c) => c.name.toLowerCase().includes(v)).sort((a, b) => (a.name.toLowerCase().startsWith(v) ? 0 : 1) - (b.name.toLowerCase().startsWith(v) ? 0 : 1) || a.rank - b.rank).slice(0, 8); hi = 0; hits.innerHTML = hitList.map((c, i) => { const t = topOf.get(c.id); return `<div class="hit ${i === 0 ? "on" : ""}" data-i="${i}"><span>${esc(c.name)}</span><span class="sub">${t ? esc(L.SITUATION_BY_KEY[t.key].short) : "no active situation"}</span></div>`; }).join("") || `<div class="hit"><span class="sub">Not in this universe.</span></div>`; hits.classList.add("show"); });
  q.addEventListener("keydown", (e) => { if (e.key === "ArrowDown") hi = Math.min(hi + 1, hitList.length - 1); else if (e.key === "ArrowUp") hi = Math.max(hi - 1, 0); else if (e.key === "Enter") { if (hitList[hi]) openCo(hitList[hi]); return; } else if (e.key === "Escape") { q.blur(); hits.classList.remove("show"); return; } else return; e.preventDefault(); [...hits.children].forEach((x, i) => x.classList.toggle("on", i === hi)); });
  hits.addEventListener("mousedown", (e) => { const h = e.target.closest("[data-i]"); if (h) { e.preventDefault(); openCo(hitList[Number(h.dataset.i)]); } });
  q.addEventListener("blur", () => setTimeout(() => hits.classList.remove("show"), 120));
  document.addEventListener("keydown", (e) => { const tag = (e.target.tagName || "").toLowerCase(); if (tag === "input" || tag === "select" || tag === "textarea") return; if (e.key === "/") { e.preventDefault(); q.focus(); } if (e.key === "Escape" && S.view === "story") { S.view = "list"; render(); } });
  function openCo(co) { q.value = ""; hits.classList.remove("show"); q.blur(); S.account = co; S.view = "story"; const t = topOf.get(co.id); if (t) S.sit = t.key; render(); }

  // globe
  const gel = document.getElementById("globe");
  const dark = document.documentElement.dataset.look !== "light";
  const g = Globe()(gel).backgroundColor("rgba(0,0,0,0)").showAtmosphere(true).atmosphereColor(dark ? "#5b9dff" : "#9cc2ff").atmosphereAltitude(0.14)
    .globeImageUrl(dark ? "earth-night.jpg" : "earth-day.jpg")
    .pointLat("lat").pointLng("lng").pointsMerge(false).pointColor((d) => d.color).pointAltitude((d) => d.alt).pointRadius((d) => d.rad)
    .pointLabel((d) => `<div class="gtip"><b>${esc(d.co.name)}</b><br>${d.sit ? esc(d.sit.headline) : "No active situation"}${d.sit && d.sit.openedAt ? "<br><span>" + ago(d.sit.openedAt) + "</span>" : ""}</div>`)
    .onPointClick((d) => openCo(d.co))
    .labelLat("lat").labelLng("lng").labelText((d) => d.co.name).labelSize(0.42).labelDotRadius(0.001).labelColor(() => dark ? "rgba(228,230,234,.85)" : "rgba(20,20,20,.8)").labelResolution(2).labelAltitude(0.06)
    .ringLat("lat").ringLng("lng").ringColor((d) => (t) => d.color + Math.round((1 - t) * 200).toString(16).padStart(2, "0")).ringMaxRadius(2.6).ringPropagationSpeed(1.2).ringRepeatPeriod(1400);
  const resize = () => g.width(gel.clientWidth).height(gel.clientHeight); new ResizeObserver(resize).observe(gel); resize();
  setTimeout(() => { const c = g.controls(); c.autoRotate = true; c.autoRotateSpeed = 0.25; c.enableZoom = true; g.pointOfView({ lat: 37, lng: -95, altitude: 1.55 }, 0); }, 150);
  function paintGlobe() {
    const pts = D.companies.filter((c) => c.lat != null).map((co) => { const t = topOf.get(co.id); const lit = t && (S.sit === "all" || t.key === S.sit || bySit[S.sit]?.some((x) => x.co.id === co.id)); const sit = lit ? (bySit[S.sit]?.find((x) => x.co.id === co.id)?.s || t) : t; return { co, lat: co.lat, lng: co.lng, sit, color: lit ? COLOR[sit.key] : (dark ? "#3a4048" : "#c9ced6"), alt: lit ? 0.02 : 0.004, rad: lit ? 0.22 : 0.08 }; });
    g.pointsData(pts);
    const lit = pts.filter((p) => p.alt > 0.01);
    g.labelsData(lit.slice(0, 40));
    const fresh = lit.filter((p) => p.sit && p.sit.openedAt && daysAgo(p.sit.openedAt) <= 7).slice(0, 25).map((p) => ({ lat: p.lat, lng: p.lng, color: p.color }));
    g.ringsData(fresh);
    document.getElementById("glegend").innerHTML = `<span class="dot" style="background:${COLOR[S.sit] || "#888"}"></span> ${lit.length} lit: ${esc(L.SITUATION_BY_KEY[S.sit]?.name || "")} · rings = new this week · grey = no active situation`;
  }

  // right side
  function render() {
    const p = P();
    const keys = L.SITUATIONS.filter((m) => m.active).map((m) => m.key);
    document.getElementById("tiles").innerHTML = keys.map((k) => { const arr = bySit[k] || []; const fresh = arr.filter((x) => daysAgo(x.s.openedAt) <= 7).length; return `<button class="tile ${S.sit === k ? "on" : ""}" data-k="${k}" style="--c:${COLOR[k]}"><span class="tn">${esc(L.SITUATION_BY_KEY[k].name)}</span><span class="tc">${arr.length}</span><span class="tf">${fresh ? "+" + fresh + " this week" : "none new this week"}</span></button>`; }).join("") + L.SITUATIONS.filter((m) => !m.active).map((m) => `<div class="tile off" title="${esc(m.needs)}"><span class="tn">${esc(m.name)}</span><span class="tc">–</span><span class="tf">needs ${esc(m.needs)}</span></div>`).join("");
    document.querySelectorAll(".tile[data-k]").forEach((t) => t.addEventListener("click", () => { S.sit = t.dataset.k; S.view = "list"; render(); }));
    if (S.view === "story" && S.account) renderStory(p); else renderList(p);
    paintGlobe();
  }
  function renderList(p) {
    const meta = L.SITUATION_BY_KEY[S.sit]; const rows = bySit[S.sit] || [];
    const el = document.getElementById("main");
    el.innerHTML = `<div class="lh"><div><h2>${esc(meta.name)}</h2><p class="lm">${esc(meta.means[p.family])}</p></div><div class="la"><span class="cnt">${rows.length} accounts · window ${meta.windowDays} days</span><button class="btn p" id="csv">Copy list as CSV</button></div></div>
      <div class="rows">${rows.map((x) => { const st = L.situationStory(x.s, x.co, p); const facts = x.s.facts.filter((f) => f.date).slice(0, 2); return `<div class="row" data-id="${x.co.id}"><div class="r1"><span class="co">${esc(x.co.name)}</span><span class="meta">${esc(x.co.sector || "")} · ${esc(x.co.hq_city || "")}, ${esc(L.stateCode(x.co.hq_state))}${x.co.ats_vendor ? " · runs " + esc(vname(x.co.ats_vendor)) : ""}</span><span class="when">${ago(x.s.openedAt)}</span></div><div class="hl">${esc(x.s.headline)}</div><ul class="facts">${facts.map((f) => `<li><span class="fd">${f.date}</span><span>${esc(f.text)}${f.url ? ` <a href="${esc(f.url)}" target="_blank" onclick="event.stopPropagation()">proof</a>` : ""}</span></li>`).join("")}</ul><div class="who">Talk to: ${esc(st.who.slice(0, 2).join(" or "))}<span class="conf ${x.s.confidence}">${x.s.confidence === "high" ? "confirmed by 2+ dated facts" : "one dated fact"}</span></div></div>`; }).join("") || `<div class="empty">No accounts in this situation right now.</div>`}</div>`;
    el.querySelectorAll(".row").forEach((r) => r.addEventListener("click", () => { S.account = byId.get(Number(r.dataset.id)); S.view = "story"; render(); }));
    document.getElementById("csv").addEventListener("click", (ev) => { const e = (v) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }; const csv = ["company,domain,sector,hq_state,employees,runs,situation,headline,trigger_date,window_ends,confidence,fact_1,fact_1_url,fact_2,fact_2_url,contact_title_1,contact_title_2,first_line"].concat(rows.map((x) => { const st = L.situationStory(x.s, x.co, p); const f = x.s.facts; return [x.co.name, x.co.domain, x.co.sector, L.stateCode(x.co.hq_state), x.co.employees, vname(x.co.ats_vendor || x.co.hris_vendor), meta.name, x.s.headline, x.s.openedAt, x.s.windowEnds, x.s.confidence, f[0] && f[0].text, f[0] && f[0].url, f[1] && f[1].text, f[1] && f[1].url, st.who[0], st.who[1], st.firstLine].map(e).join(","); })).join("\n"); navigator.clipboard.writeText(csv).then(() => { ev.target.textContent = "Copied " + rows.length + " rows"; setTimeout(() => (ev.target.textContent = "Copy list as CSV"), 1500); }); });
  }
  function renderStory(p) {
    const co = S.account; const mine = all.filter((x) => x.co.id === co.id); const main = mine.find((x) => x.s.key === S.sit) || mine[0];
    const el = document.getElementById("main");
    if (!main) { el.innerHTML = `<div class="lh"><button class="btn" id="back">← back</button><h2>${esc(co.name)}</h2></div><div class="empty">No active situation. ${co.open_roles != null ? co.open_roles + " open roles, " : ""}${co.ats_vendor ? "runs " + esc(vname(co.ats_vendor)) + "." : "HR systems not visible."}</div>`; document.getElementById("back").addEventListener("click", () => { S.view = "list"; render(); }); return; }
    const st = L.situationStory(main.s, co, p);
    el.innerHTML = `<div class="lh"><div><button class="btn" id="back">← ${esc(L.SITUATION_BY_KEY[S.sit].short)} list</button></div><div class="la"><span class="cnt">${esc(co.sector || "")} · ${esc(co.hq_city || "")}, ${esc(L.stateCode(co.hq_state))} · ${co.employees ? Number(co.employees).toLocaleString() + " employees" : ""}${co.open_roles != null ? " · " + Number(co.open_roles).toLocaleString() + " open roles" : ""}</span></div></div>
      <div class="story">
        <h1>${esc(main.s.headline)}</h1>
        <p class="means">${esc(st.means)}</p>
        <div class="grid2">
          <section><h3>The facts</h3><ul class="facts big">${main.s.facts.map((f) => `<li><span class="fd">${f.date || "undated"}</span><span>${esc(f.text)}${f.url ? ` <a href="${esc(f.url)}" target="_blank">proof</a>` : ""}</span></li>`).join("")}</ul>
            <h3>Window</h3><p>${esc(st.window)} · ${main.s.confidence === "high" ? "confirmed by two or more dated facts" : main.s.confidence === "medium" ? "one dated fact so far" : "undated facts only"}</p>
            ${mine.length > 1 ? `<h3>Also at ${esc(co.name)}</h3><ul class="also">${mine.filter((x) => x !== main).map((x) => `<li><span class="dot" style="background:${COLOR[x.s.key]}"></span>${esc(x.s.headline)}${x.s.openedAt ? ` <span class="fd">${ago(x.s.openedAt)}</span>` : ""}</li>`).join("")}</ul>` : ""}
          </section>
          <section><h3>Who to talk to</h3><p class="who2">${st.who.map((w) => `<a href="https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent('"' + w + '" ' + co.name)}" target="_blank">${esc(w)}</a>`).join(" · ")}</p>
            ${st.angle ? `<h3>Against ${esc(vname(co.ats_vendor || co.hris_vendor))}</h3><p class="angle">${esc(st.angle)}</p>` : ""}
            <h3>First line <button class="btn s" id="copyline">Copy</button></h3><p class="first">${esc(st.firstLine)}</p>
          </section>
        </div>
      </div>`;
    document.getElementById("back").addEventListener("click", () => { S.view = "list"; render(); });
    document.getElementById("copyline").addEventListener("click", (ev) => navigator.clipboard.writeText(st.firstLine).then(() => { ev.target.textContent = "Copied"; setTimeout(() => (ev.target.textContent = "Copy"), 1200); }));
    try { g.pointOfView({ lat: co.lat, lng: co.lng, altitude: 1.2 }, 900); } catch {}
  }
  render();
})();

/** Step 7: HQ coordinates for the globe. Exact match from the HQ dataset, else city table, else state centroid. */
import fs from "node:fs";
import path from "node:path";
import { db, logRun } from "../src/lib/db";
import { nowIso } from "../src/lib/http";
import { STATE_LATLNG, CITY_LATLNG } from "../src/lib/geo";
import { stateCode } from "../src/lib/classify";

function normName(s: string): string {
  return s.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9 ]/g, " ").replace(/\b(inc|corp|corporation|co|company|holdings|holding|group|plc|ltd|llc|the|cos|companies|international|intl)\b/g, " ").replace(/\s+/g, " ").trim();
}

function main() {
  const started = nowIso();
  const d = db();
  for (const col of ["lat REAL", "lng REAL", "geo_method TEXT"]) { try { d.exec(`ALTER TABLE companies ADD COLUMN ${col}`); } catch { /* exists */ } }
  const csv = path.join(process.cwd(), "data", "raw", "f500_hq.csv");
  const byName = new Map<string, [number, number]>();
  const byCity = new Map<string, [number, number]>();
  if (fs.existsSync(csv)) {
    const lines = fs.readFileSync(csv, "utf8").replace(/^﻿/, "").split(/\r?\n/).filter(Boolean);
    const header = lines[0].split(",");
    const iName = header.indexOf("NAME"), iCity = header.indexOf("CITY"), iState = header.indexOf("STATE"), iLat = header.indexOf("LATITUDE"), iLng = header.indexOf("LONGITUDE");
    for (const line of lines.slice(1)) {
      const cols = line.match(/("([^"]|"")*"|[^,]*)(,|$)/g)?.map((c) => c.replace(/,$/, "").replace(/^"|"$/g, "")) || [];
      const lat = Number(cols[iLat]), lng = Number(cols[iLng]);
      if (!lat || !lng) continue;
      byName.set(normName(cols[iName] || ""), [lat, lng]);
      const ck = `${(cols[iCity] || "").toLowerCase()}, ${(cols[iState] || "").toLowerCase()}`;
      if (!byCity.has(ck)) byCity.set(ck, [lat, lng]);
    }
  }
  const rows = d.prepare("SELECT id,name,hq_city,hq_state FROM companies").all() as { id: number; name: string; hq_city: string | null; hq_state: string | null }[];
  const upd = d.prepare("UPDATE companies SET lat=?, lng=?, geo_method=? WHERE id=?");
  const counts: Record<string, number> = {};
  for (const c of rows) {
    const st = stateCode(c.hq_state).toLowerCase();
    const ck = `${(c.hq_city || "").toLowerCase()}, ${st}`;
    let ll = byName.get(normName(c.name)); let m = "name";
    if (!ll) { ll = CITY_LATLNG[ck]; m = "city"; }
    if (!ll) { ll = byCity.get(ck); m = "city_dataset"; }
    if (!ll) { const s = STATE_LATLNG[st.toUpperCase()]; if (s) { ll = [s[0] + (Math.random() - 0.5) * 0.6, s[1] + (Math.random() - 0.5) * 0.6]; m = "state"; } }
    if (!ll) { m = "none"; }
    counts[m] = (counts[m] || 0) + 1;
    if (ll) upd.run(ll[0], ll[1], m, c.id); else upd.run(null, null, m, c.id);
  }
  const note = JSON.stringify(counts);
  console.log("DONE", note);
  logRun("07-geo", started, true, note);
}
main();

"use client";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import type { GlobePoint, GlobeArc, GlobeEvent } from "@/lib/queries";

const Globe = dynamic(() => import("react-globe.gl"), { ssr: false, loading: () => <div className="flex items-center justify-center h-full text-muted">loading globe…</div> });

const GROUP_COLOR: Record<string, string> = { HIRING: "#22d37b", STACK: "#5ad1ff", FILINGS: "#d86bff", RISK: "#ff4d4d", LIST: "#ffe066", NONE: "#3a3a3a" };

type Props = { points: GlobePoint[]; arcs: GlobeArc[]; events: GlobeEvent[]; profileName: string };

export default function GlobeView({ points, arcs, events, profileName }: Props) {
  const router = useRouter();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const globeRef = useRef<any>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [idx, setIdx] = useState(events.length ? Math.max(0, events.length - 45) : 0);
  const [playing, setPlaying] = useState(true);
  const [layer, setLayer] = useState<{ arcs: boolean; labels: boolean; rings: boolean }>({ arcs: true, labels: true, rings: true });
  const [hover, setHover] = useState<GlobePoint | null>(null);
  const [follow, setFollow] = useState(true);

  useEffect(() => {
    const el = wrapRef.current; if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el); setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const g = globeRef.current; if (!g) return;
    const t = setTimeout(() => {
      try { const c = g.controls(); c.autoRotate = true; c.autoRotateSpeed = 0.35; c.enableZoom = true; g.pointOfView({ lat: 38, lng: -96, altitude: 1.9 }, 0); } catch { /* not ready */ }
    }, 300);
    return () => clearTimeout(t);
  }, []);

  // replay: advance through events
  useEffect(() => {
    if (!playing || !events.length) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % events.length), 2200);
    return () => clearInterval(t);
  }, [playing, events.length]);

  const current = events[idx];
  useEffect(() => {
    const g = globeRef.current; if (!g || !current || !follow) return;
    try { g.pointOfView({ lat: current.lat, lng: current.lng, altitude: 1.6 }, 1200); } catch { /* */ }
  }, [current, follow]);

  const rings = useMemo(() => {
    if (!current) return [] as { lat: number; lng: number; color: string }[];
    const win = events.slice(Math.max(0, idx - 6), idx + 1);
    return win.map((e) => ({ lat: e.lat, lng: e.lng, color: GROUP_COLOR[e.group] || "#fff" }));
  }, [events, idx, current]);

  const labels = useMemo(() => [...points].sort((a, b) => b.score - a.score).slice(0, 18), [points]);
  const recent = useMemo(() => events.slice(Math.max(0, idx - 9), idx + 1).reverse(), [events, idx]);
  const counts = useMemo(() => { const c: Record<string, number> = {}; for (const p of points) c[p.group] = (c[p.group] || 0) + 1; return c; }, [points]);

  const go = useCallback((slug: string) => router.push(`/a/${slug}`), [router]);

  return (
    <div className="grid grid-cols-12 gap-[6px] h-full min-h-0">
      {/* LIVE FEED */}
      <section className="panel col-span-12 lg:col-span-3 flex flex-col min-h-0">
        <div className="panel-title"><span><span className="k">1</span>Live feed · replay 180d</span><span className="normal-case tracking-normal text-muted">{events.length} events</span></div>
        <div className="flex items-center gap-2 px-2 py-1 border-b border-line text-[11px]">
          <button className="kbd hover:text-amber" onClick={() => setPlaying((p) => !p)}>{playing ? "❚❚ PAUSE" : "▶ PLAY"}</button>
          <button className="kbd hover:text-amber" onClick={() => setIdx((i) => Math.max(0, i - 1))}>◀</button>
          <button className="kbd hover:text-amber" onClick={() => setIdx((i) => Math.min(events.length - 1, i + 1))}>▶</button>
          <label className="flex items-center gap-1 text-muted cursor-pointer"><input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} /> follow</label>
          <span className="ml-auto text-amber">{current?.date}</span>
        </div>
        <input type="range" min={0} max={Math.max(0, events.length - 1)} value={idx} onChange={(e) => { setIdx(Number(e.target.value)); setPlaying(false); }} className="w-full accent-amber h-1 mx-0" />
        <div className="flex-1 overflow-auto">
          {recent.map((e, i) => (
            <div key={e.id} onClick={() => go(e.slug)} className={`px-2 py-1.5 border-b border-[#141414] cursor-pointer ${i === 0 ? "row-sel" : "row-hover fade-in"}`}>
              <div className="flex items-center gap-2 text-[10.5px]"><span style={{ color: i === 0 ? "#000" : GROUP_COLOR[e.group] }}>●</span><span className={i === 0 ? "" : "text-muted"}>{e.date}</span><span className={`ml-auto ${i === 0 ? "" : "text-amber"}`}>{e.score.toFixed(1)}</span></div>
              <div className="font-semibold">{e.name}</div>
              <div className={`text-[11px] ${i === 0 ? "" : "text-muted"}`}>{e.title}</div>
            </div>
          ))}
        </div>
      </section>

      {/* GLOBE */}
      <section className="panel col-span-12 lg:col-span-6 relative min-h-[420px]" ref={wrapRef}>
        <div className="absolute top-0 left-0 right-0 panel-title z-10"><span><span className="k">2</span>Situation room · Fortune 500 HQs · ranked for {profileName}</span><span className="normal-case tracking-normal flex gap-2">
          {(["arcs", "labels", "rings"] as const).map((k) => (<button key={k} onClick={() => setLayer((l) => ({ ...l, [k]: !l[k] }))} className={`kbd ${layer[k] ? "text-amber" : ""}`}>{k}</button>))}
        </span></div>
        <Globe
          ref={globeRef}
          width={size.w}
          height={size.h}
          backgroundColor="rgba(0,0,0,0)"
          globeImageUrl="/globe/earth-night.jpg"
          backgroundImageUrl="/globe/night-sky.png"
          showAtmosphere
          atmosphereColor="#ff9e1b"
          atmosphereAltitude={0.18}
          pointsData={points}
          pointLat={(d) => (d as GlobePoint).lat}
          pointLng={(d) => (d as GlobePoint).lng}
          pointColor={(d) => GROUP_COLOR[(d as GlobePoint).group] || "#666"}
          pointAltitude={(d) => 0.004 + Math.min(0.12, (d as GlobePoint).score / 400)}
          pointRadius={(d) => 0.09 + Math.min(0.22, (d as GlobePoint).score / 220)}
          pointsMerge={false}
          pointLabel={(d) => { const p = d as GlobePoint; return `<div style="font-family:monospace;font-size:11px;background:#000;border:1px solid #333;padding:6px 8px;color:#e8e6e3"><b style="color:#ff9e1b">#${p.rank} ${p.name}</b><br/>${p.hq}<br/>ATS: ${p.ats || "unknown"} · open roles: ${p.open_roles ?? "–"}<br/>score <b style="color:#ff9e1b">${p.score}</b> · ${p.top}</div>`; }}
          onPointClick={(d) => go((d as GlobePoint).slug)}
          onPointHover={(d) => setHover((d as GlobePoint) || null)}
          arcsData={layer.arcs ? arcs : []}
          arcStartLat={(d) => (d as GlobeArc).startLat}
          arcStartLng={(d) => (d as GlobeArc).startLng}
          arcEndLat={(d) => (d as GlobeArc).endLat}
          arcEndLng={(d) => (d as GlobeArc).endLng}
          arcColor={() => ["rgba(255,158,27,0.55)", "rgba(90,209,255,0.15)"]}
          arcStroke={0.25}
          arcDashLength={0.35}
          arcDashGap={0.9}
          arcDashAnimateTime={2600}
          arcAltitudeAutoScale={0.35}
          arcLabel={(d) => { const a = d as GlobeArc; return `<div style="font-family:monospace;font-size:11px;background:#000;border:1px solid #333;padding:4px 8px;color:#e8e6e3">${a.name} → ${a.country}: ${a.count} open roles</div>`; }}
          ringsData={layer.rings ? rings : []}
          ringLat={(d) => (d as { lat: number }).lat}
          ringLng={(d) => (d as { lng: number }).lng}
          ringColor={(d: object) => (t: number) => { const c = (d as { color: string }).color; const a = Math.max(0, 1 - t); return c + Math.round(a * 255).toString(16).padStart(2, "0"); }}
          ringMaxRadius={3.5}
          ringPropagationSpeed={1.6}
          ringRepeatPeriod={900}
          labelsData={layer.labels ? labels : []}
          labelLat={(d) => (d as GlobePoint).lat}
          labelLng={(d) => (d as GlobePoint).lng}
          labelText={(d) => (d as GlobePoint).name.toUpperCase()}
          labelSize={0.55}
          labelDotRadius={0.25}
          labelColor={() => "rgba(255,158,27,0.9)"}
          labelResolution={2}
          labelAltitude={0.13}
        />
        {/* legend */}
        <div className="absolute bottom-2 left-2 z-10 text-[10.5px] bg-black/70 border border-line p-2 space-y-[2px]">
          {Object.entries(GROUP_COLOR).filter(([k]) => k !== "NONE").map(([k, c]) => (<div key={k} className="flex items-center gap-2"><span style={{ color: c }}>●</span><span className="text-muted">{k === "HIRING" ? "hiring-led" : k === "STACK" ? "stack-led" : k === "FILINGS" ? "filing-led" : k === "RISK" ? "layoff / restructuring" : "list facts"}</span><span className="ml-auto text-fg">{counts[k] || 0}</span></div>))}
          <div className="text-dim pt-1">height = score · arcs = countries hiring in · rings = events replaying</div>
        </div>
        {hover && (
          <div className="absolute bottom-2 right-2 z-10 text-[11px] bg-black/80 border border-amber p-2 max-w-[260px]">
            <div className="text-amber font-bold">#{hover.rank} {hover.name}</div>
            <div className="text-muted">{hover.hq} · {hover.sector}</div>
            <div>ATS {hover.ats || "?"} · roles {hover.open_roles ?? "–"} · score <span className="text-amber">{hover.score}</span></div>
            <div className="text-dim">click to open account</div>
          </div>
        )}
      </section>

      {/* NOW */}
      <section className="panel col-span-12 lg:col-span-3 flex flex-col min-h-0">
        <div className="panel-title"><span><span className="k">3</span>Now playing</span></div>
        {current ? (
          <div className="p-3 text-[11.5px] space-y-2">
            <div className="text-dim">{current.date} · <span style={{ color: GROUP_COLOR[current.group] }}>{current.group}</span></div>
            <div className="text-amber text-[16px] font-bold glow leading-tight cursor-pointer link" onClick={() => go(current.slug)}>{current.name}</div>
            <div className="text-fg">{current.title}</div>
            <div className="text-muted">strength {current.strength}/5 · score for you <span className="text-amber">{current.score.toFixed(1)}</span></div>
            <div className="flex gap-2 pt-1">
              <button className="kbd hover:text-amber" onClick={() => go(current.slug)}>ACCOUNT →</button>
              {current.url && <a className="kbd hover:text-amber" href={current.url} target="_blank">PROOF ↗</a>}
              <a className="kbd hover:text-amber" href={`/cards?slug=${current.slug}`}>BATTLECARD</a>
            </div>
          </div>
        ) : <div className="p-3 text-muted">No dated events yet.</div>}
        <div className="panel-title border-t"><span>Top accounts on the globe</span></div>
        <div className="flex-1 overflow-auto">
          {labels.map((p) => (
            <div key={p.slug} onClick={() => go(p.slug)} className="px-2 py-1 border-b border-[#141414] row-hover cursor-pointer flex items-center gap-2 text-[11px]">
              <span style={{ color: GROUP_COLOR[p.group] }}>●</span><span className="text-dim">{p.rank}</span><span className="font-semibold truncate">{p.name}</span><span className="ml-auto text-amber">{p.score}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

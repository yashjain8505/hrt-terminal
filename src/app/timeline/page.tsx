import Link from "next/link";
import { cookies } from "next/headers";
import { Header } from "@/components/Chrome";
import { getProfile, getStats, getTimeline } from "@/lib/queries";
import { SIGNAL_LABEL } from "@/lib/profiles";

export const dynamic = "force-dynamic";
const LANES: { key: string; label: string; match: (t: string) => boolean; color: string }[] = [
  { key: "exec", label: "People exec / leader roles", match: (t) => t === "hiring.people_exec_open" || t === "hiring.hr_leader_open", color: "#22d37b" },
  { key: "hrroles", label: "Other HR-function roles", match: (t) => t.startsWith("hiring."), color: "#0fa85c" },
  { key: "officer", label: "8-K officer changes", match: (t) => t === "exec.officer_change", color: "#d86bff" },
  { key: "corp", label: "Acquisitions closed", match: (t) => t === "corp.acquisition", color: "#9b5cff" },
  { key: "risk", label: "Restructuring / WARN", match: (t) => t.startsWith("risk."), color: "#ff4d4d" },
];

export default async function Timeline({ searchParams }: PageProps<"/timeline">) {
  const sp = await searchParams;
  const days = Math.min(365, Number(typeof sp.d === "string" ? sp.d : 180) || 180);
  const min = Number(typeof sp.min === "string" ? sp.min : 0) || 0;
  const profile = getProfile((await cookies()).get("hrt_profile")?.value);
  const stats = getStats();
  const all = getTimeline(profile).filter((e) => e.score >= min);
  const end = new Date(); const start = new Date(end.getTime() - days * 86400000);
  const events = all.filter((e) => new Date(e.date) >= start);
  const W = 1400, H = 60 * LANES.length + 40, L = 190, R = 20, T = 24;
  const x = (d: string) => L + ((new Date(d).getTime() - start.getTime()) / (end.getTime() - start.getTime())) * (W - L - R);
  const weeks: Date[] = []; for (let t = new Date(start); t <= end; t = new Date(t.getTime() + 7 * 86400000)) weeks.push(new Date(t));
  const thisWeek = new Date(end.getTime() - 7 * 86400000).toISOString().slice(0, 10);
  const lastWeek = new Date(end.getTime() - 14 * 86400000).toISOString().slice(0, 10);
  const recent = [...events].filter((e) => e.date >= lastWeek).sort((a, b) => b.date.localeCompare(a.date) || b.score - a.score);
  return (
    <div className="flex flex-col min-h-screen">
      <Header profile={profile} stats={stats} />
      <main className="flex-1 p-[6px] grid grid-cols-12 gap-[6px]">
        <section className="panel col-span-12">
          <div className="panel-title"><span><span className="k">5</span>Trigger timeline · last {days} days · ranked for {profile.name}</span><span className="normal-case tracking-normal flex gap-1">
            {[90, 180, 365].map((d) => <Link key={d} href={`/timeline?d=${d}&min=${min}`} className={`badge ${days === d ? "bg-amber text-black border-amber" : "text-muted border-line2"}`}>{d}d</Link>)}
            <span className="text-dim mx-1">|</span>
            {[0, 2, 3, 4].map((m) => <Link key={m} href={`/timeline?d=${days}&min=${m}`} className={`badge ${min === m ? "bg-amber text-black border-amber" : "text-muted border-line2"}`}>{m ? `score ≥${m}` : "all"}</Link>)}
            <span className="text-muted ml-2">{events.length} events</span>
          </span></div>
          <div className="overflow-auto">
            <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 900 }} className="block">
              {weeks.map((w, i) => (<g key={i}><line x1={x(w.toISOString())} x2={x(w.toISOString())} y1={T} y2={H - 10} stroke={i % 4 === 0 ? "#2a2a2a" : "#161616"} /> {i % 4 === 0 && <text x={x(w.toISOString()) + 3} y={T - 8} fill="#8c8c8c" fontSize="10" fontFamily="monospace">{w.toISOString().slice(5, 10)}</text>}</g>))}
              <line x1={x(thisWeek)} x2={x(thisWeek)} y1={T} y2={H - 10} stroke="#ff9e1b" strokeDasharray="3 3" />
              <text x={x(thisWeek) + 3} y={H - 2} fill="#ff9e1b" fontSize="10" fontFamily="monospace">this week</text>
              {LANES.map((lane, li) => {
                const y0 = T + li * 60;
                const evs = events.filter((e) => lane.match(e.type) && !LANES.slice(0, li).some((l2) => l2.match(e.type)));
                return (
                  <g key={lane.key}>
                    <rect x={0} y={y0} width={W} height={60} fill={li % 2 ? "#050505" : "#080808"} />
                    <text x={8} y={y0 + 34} fill={lane.color} fontSize="11" fontFamily="monospace">{lane.label}</text>
                    <text x={8} y={y0 + 48} fill="#5a5a5a" fontSize="10" fontFamily="monospace">{evs.length} events</text>
                    {evs.map((e, i) => {
                      const r = 2.5 + Math.min(6, e.score * 1.1);
                      const jitter = ((i * 37) % 30) - 15;
                      return (
                        <a key={e.id} href={`/a/${e.slug}`}>
                          <circle cx={x(e.date)} cy={y0 + 30 + jitter} r={r} fill={lane.color} fillOpacity={0.75} stroke="#000" strokeWidth={0.5}>
                            <title>{`${e.date} · ${e.name}\n${e.title}\nscore ${e.score.toFixed(1)} · click to open`}</title>
                          </circle>
                        </a>
                      );
                    })}
                  </g>
                );
              })}
            </svg>
          </div>
        </section>
        <section className="panel col-span-12 lg:col-span-6">
          <div className="panel-title"><span>This week · act now</span><span className="normal-case tracking-normal text-muted">{recent.filter((e) => e.date >= thisWeek).length}</span></div>
          <EventTable rows={recent.filter((e) => e.date >= thisWeek)} />
        </section>
        <section className="panel col-span-12 lg:col-span-6">
          <div className="panel-title"><span>Last week · follow up</span><span className="normal-case tracking-normal text-muted">{recent.filter((e) => e.date < thisWeek).length}</span></div>
          <EventTable rows={recent.filter((e) => e.date < thisWeek)} />
        </section>
      </main>
    </div>
  );
}

function EventTable({ rows }: { rows: { id: number; slug: string; name: string; date: string; type: string; title: string; score: number; url: string | null }[] }) {
  return (
    <div className="overflow-auto max-h-[46vh]">
      <table className="tbl">
        <thead><tr><th>Date</th><th>Company</th><th>Event</th><th className="num">Score</th><th>Do</th></tr></thead>
        <tbody>
          {rows.slice(0, 80).map((e) => (
            <tr key={e.id} className="row-hover">
              <td className="text-muted whitespace-nowrap">{e.date}</td>
              <td className="whitespace-nowrap"><Link href={`/a/${e.slug}`} className="link text-fg font-semibold">{e.name}</Link></td>
              <td className="w-full max-w-0"><div className="truncate text-amber2" title={e.title}>{e.title}</div><div className="text-dim text-[10.5px]">{SIGNAL_LABEL[e.type] || e.type}</div></td>
              <td className="num text-amber">{e.score.toFixed(1)}</td>
              <td className="whitespace-nowrap text-[10.5px] flex gap-1">{e.url && <a href={e.url} target="_blank" className="kbd hover:text-amber">PROOF</a>}<Link href={`/cards?slug=${e.slug}`} className="kbd hover:text-amber">CARD</Link></td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={5} className="p-3 text-muted">Nothing in this window.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

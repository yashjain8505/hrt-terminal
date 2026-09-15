import Link from "next/link";
import { cookies } from "next/headers";
import { Header, fmtNum } from "@/components/Chrome";
import Copy from "@/components/Copy";
import { getProfile, getStats, getCampaign, getCompany, getCompanySignals, getSnapshot, getSectors } from "@/lib/queries";
import { buildBattlecard } from "@/lib/battlecard";
import { VENDOR_BY_KEY } from "@/lib/vendors";
import { stateCode } from "@/lib/classify";

export const dynamic = "force-dynamic";

export default async function Cards({ searchParams }: PageProps<"/cards">) {
  const sp = await searchParams;
  const profile = getProfile((await cookies()).get("hrt_profile")?.value);
  const stats = getStats();
  const slug = typeof sp.slug === "string" ? sp.slug : "";
  const n = Math.min(60, Number(typeof sp.n === "string" ? sp.n : 12) || 12);
  const vendor = typeof sp.vendor === "string" ? sp.vendor : "";
  const sector = typeof sp.sector === "string" ? sp.sector : "";
  const list = slug ? [getCompany(slug)].filter(Boolean).map((c) => ({ ...c!, score: 0 })) : getCampaign(profile, { vendor, sector, limit: n });
  const sectors = getSectors();
  const cards = list.map((c) => {
    const co = getCompany(c.slug)!;
    const signals = getCompanySignals(co.id, profile);
    const snap = getSnapshot(co.id);
    const card = buildBattlecard({ company: co, signals, counts: snap ? JSON.parse(snap.counts_json || "{}") : {}, states: snap ? JSON.parse(snap.states_json || "{}") : {}, countries: snap ? JSON.parse(snap.countries_json || "{}") : {}, tools: snap ? JSON.parse(snap.tools_json || "{}") : {} }, profile);
    return { co, card, score: signals.reduce((a, s) => a + s.score, 0) };
  });
  const link = (over: Record<string, string>) => { const p = new URLSearchParams({ n: String(n), vendor, sector, ...over }); for (const [k, v] of [...p.entries()]) if (!v) p.delete(k); return `/cards?${p.toString()}`; };
  return (
    <div className="flex flex-col min-h-screen">
      <div className="print:hidden"><Header profile={profile} stats={stats} /></div>
      <main className="flex-1 p-[6px]">
        <div className="panel print:hidden">
          <div className="panel-title"><span><span className="k">2</span>Battlecards · one page per account · ranked for {profile.name}</span><span className="normal-case tracking-normal text-muted">{cards.length} cards</span></div>
          <div className="flex flex-wrap items-center gap-2 px-2 py-1.5 text-[11px]">
            <span className="label">Top</span>
            {[12, 24, 48].map((k) => (<Link key={k} href={link({ n: String(k) })} className={`badge ${n === k && !slug ? "bg-amber text-black border-amber" : "text-muted border-line2 hover:text-amber"}`}>{k}</Link>))}
            <span className="label ml-3">Vendor</span>
            {["", "workday", "successfactors", "oraclehcm", "icims", "taleo", "phenom"].map((v) => (<Link key={v || "all"} href={link({ vendor: v })} className={`badge ${vendor === v ? "bg-amber text-black border-amber" : "text-muted border-line2 hover:text-amber"}`}>{v ? (VENDOR_BY_KEY[v]?.name || v) : "ALL"}</Link>))}
            <span className="label ml-3">Sector</span>
            <form action="/cards" method="get" className="inline"><input type="hidden" name="n" value={n} />{vendor && <input type="hidden" name="vendor" value={vendor} />}
              <select name="sector" defaultValue={sector} className="bg-black border border-line px-1 py-0.5 text-[11px]"><option value="">ALL</option>{sectors.map((s) => <option key={s} value={s}>{s}</option>)}</select>
              <button className="kbd ml-1 hover:text-amber">GO</button>
            </form>
            <span className="ml-auto text-dim">Print with ⌘P: one card per page.</span>
          </div>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-[6px] mt-[6px]">
          {cards.map(({ co, card, score }) => (
            <article key={co.id} className="panel print:break-after-page print:border-0 flex flex-col">
              <div className="panel-title"><span><span className="k">#{co.rank}</span>{co.name}</span><span className="normal-case tracking-normal flex items-center gap-2"><span className="text-amber font-bold">{score.toFixed(1)}</span><Link href={`/a/${co.slug}`} className="kbd hover:text-amber print:hidden">ACCOUNT →</Link></span></div>
              <div className="p-3 text-[11.5px] grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-x-5 gap-y-3">
                <div className="md:col-span-2">
                  <div className="text-muted">{co.sector} · {co.industry} · {co.hq_city}, {stateCode(co.hq_state)} · {fmtNum(co.employees)} employees · {co.domain}</div>
                  <div className="text-amber font-bold text-[14px] glow mt-1">{card.headline}</div>
                  <div className="text-muted mt-0.5">{card.footprint}</div>
                </div>
                <div>
                  <div className="label mb-1">Triggers · with proof</div>
                  <ol className="space-y-1.5">
                    {card.triggers.map((t, i) => (
                      <li key={i} className="border-l-2 pl-2" style={{ borderColor: t.group === "RISK" ? "#ff4d4d" : t.group === "HIRING" ? "#22d37b" : t.group === "STACK" ? "#5ad1ff" : t.group === "EXEC" || t.group === "CORP" ? "#d86bff" : "#ffe066" }}>
                        <div className="flex items-baseline gap-2"><span className="text-fg font-semibold">{t.title}</span><span className="text-dim text-[10px]">{t.date}</span><span className="text-amber text-[10px] ml-auto">{t.score.toFixed(1)}</span></div>
                        <div className="text-muted">{t.why}</div>
                        {t.url && <a href={t.url} target="_blank" className="text-cyan link text-[10.5px] break-all">{t.url.length > 70 ? t.url.slice(0, 70) + "…" : t.url}</a>}
                      </li>
                    ))}
                    {card.triggers.length === 0 && <li className="text-dim">No ranked triggers for this profile.</li>}
                  </ol>
                  {card.risks.length > 0 && <div className="mt-2 text-red text-[11px]">⚠ {card.risks.join(" · ")} — lead with cost and consolidation, not growth.</div>}
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="label mb-1">Incumbent stack · your angle</div>
                    {card.stack.length === 0 && <div className="text-dim">Stack not detected.</div>}
                    {card.stack.map((s, i) => (<div key={i} className="mb-1"><span className="badge b-stack">{s.label}</span>{s.angle && <div className="text-muted mt-0.5">{s.angle}</div>}</div>))}
                  </div>
                  <div>
                    <div className="label mb-1">Who to find</div>
                    <div className="flex flex-wrap gap-1">{card.buyers.map((b) => <a key={b} href={`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`"${b}" ${co.name}`)}`} target="_blank" className="badge b-list hover:text-amber print:text-fg">{b}</a>)}</div>
                  </div>
                  <div>
                    <div className="label mb-1 flex items-center gap-2">Opening line <span className="print:hidden"><Copy text={card.opening} /></span></div>
                    <div className="text-fg/90 border border-line p-2 bg-[#070707]">{card.opening}</div>
                  </div>
                  <div>
                    <div className="label mb-1">Discovery questions</div>
                    <ul className="list-disc pl-4 text-muted space-y-[2px]">{card.questions.map((q, i) => <li key={i}>{q}</li>)}</ul>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}

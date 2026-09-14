import { cookies } from "next/headers";
import { Header, Ticker, Panel } from "@/components/Chrome";
import { getProfile, getStats, tickerItems } from "@/lib/queries";
import { PROFILES, SIGNAL_LABEL } from "@/lib/profiles";

export const dynamic = "force-dynamic";
const FAMILY: Record<string, string> = { ta: "A · Talent acquisition", corehr: "B · Core HR", programs: "C · People programs", global: "D · Global & immigration" };

export default async function Profiles() {
  const profile = getProfile((await cookies()).get("hrt_profile")?.value);
  const stats = getStats();
  const fams = ["ta", "corehr", "programs", "global"];
  return (
    <div className="flex flex-col min-h-screen pb-[22px]">
      <Header profile={profile} stats={stats} />
      <main className="flex-1 p-[6px]">
        <Panel k="5" title="Offer profile · what do you sell?" right={<span>current: {profile.name}</span>}>
          <div className="p-3 text-muted text-[11.5px] border-b border-line">Same facts, different ranking. Pick the closest category to what you sell and every tape, account page and outreach draft re-ranks for it. Type a profile short code in the command line (e.g. <span className="text-amber">PAYROLL &lt;GO&gt;</span>) to switch fast.</div>
          {fams.map((f) => (
            <div key={f} className="border-b border-line">
              <div className="px-3 py-1 text-amber tracking-widest text-[11px] bg-[#070707]">{FAMILY[f]}</div>
              <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-px bg-line">
                {PROFILES.filter((p) => p.family === f).map((p) => {
                  const top = Object.entries(p.weights).sort((a, b) => b[1] - a[1]).slice(0, 4);
                  const on = p.key === profile.key;
                  return (
                    <a key={p.key} href={`/api/profile?key=${p.key}&back=/`} className={`block p-3 bg-panel hover:bg-panel2 ${on ? "outline outline-1 outline-amber" : ""}`}>
                      <div className="flex items-center justify-between"><span className="text-amber font-bold tracking-widest">{p.short}</span>{on && <span className="badge b-hiring">ACTIVE</span>}{p.partial && <span className="badge b-list">PARTIAL</span>}</div>
                      <div className="text-fg font-semibold">{p.name}</div>
                      <div className="text-muted text-[11px] mt-1">Sells: {p.sells}</div>
                      <div className="text-muted text-[11px]">Buyer: {p.buyer}</div>
                      <div className="mt-2 text-[10.5px] text-dim">Weights most: {top.map(([k, w]) => `${SIGNAL_LABEL[k] || k} ×${w}`).join(" · ")}</div>
                      {p.partial && <div className="mt-1 text-[10.5px] text-yellow">Needs Form 5500 / H-1B feeds (not in v0) for full coverage.</div>}
                    </a>
                  );
                })}
              </div>
            </div>
          ))}
        </Panel>
      </main>
      <Ticker items={tickerItems(profile, 30)} />
    </div>
  );
}

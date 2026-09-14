import Link from "next/link";
import Clock from "./Clock";
import Palette from "./Palette";
import type { Profile } from "@/lib/profiles";
import { SIGNAL_GROUP } from "@/lib/profiles";
import type { TapeRow } from "@/lib/queries";

export function Header({ profile, stats }: { profile: Profile; stats: { companies: number; signals: number; lastSnapshot: string | null } }) {
  return (
    <header className="border-b border-line bg-black sticky top-0 z-40">
      <div className="flex items-stretch text-[11.5px]">
        <Link href="/" className="flex items-center gap-2 px-3 border-r border-line">
          <span className="bg-amber text-black font-bold px-1.5 py-0.5 tracking-widest">HRT</span>
          <span className="text-muted tracking-widest hidden md:inline">HR SIGNALS TERMINAL</span>
        </Link>
        <div className="flex-1 flex items-center px-3 border-r border-line min-w-0"><Palette inline /></div>
        <Link href="/p" className="hdr-cell flex items-center gap-2 hover:bg-panel2" title="Change offer profile (F5)">
          <span className="label">Profile</span>
          <span className="text-amber font-bold">{profile.short}</span>
          <span className="text-muted hidden lg:inline">{profile.name}</span>
        </Link>
        <div className="hdr-cell flex items-center gap-2 hidden md:flex"><span className="label">Univ</span><span className="val">{stats.companies}</span><span className="label">Sig</span><span className="val">{stats.signals.toLocaleString()}</span></div>
        <div className="hdr-cell flex items-center hidden sm:flex"><Clock /></div>
        <div className="px-3 flex items-center gap-2"><span className="inline-block w-2 h-2 rounded-full bg-green shadow-[0_0_8px_#22d37b]" /><span className="text-muted">{stats.lastSnapshot ? "DATA " + stats.lastSnapshot.slice(0, 10) : "NO DATA"}</span></div>
      </div>
      <FnBar />
    </header>
  );
}

export function FnBar({ active }: { active?: string }) {
  const keys = [
    { k: "F1", l: "HELP", href: "/?help=1" }, { k: "F2", l: "TAPE", href: "/" }, { k: "F3", l: "UNIV", href: "/u" }, { k: "F4", l: "RUN", href: "/run" }, { k: "F5", l: "PROF", href: "/p" },
    { k: "F6", l: "HIRING", href: "/?g=HIRING" }, { k: "F7", l: "STACK", href: "/?g=STACK" }, { k: "F8", l: "FILINGS", href: "/?g=FILINGS" }, { k: "F9", l: "RISK", href: "/?g=RISK" },
  ];
  return (
    <div className="flex overflow-x-auto border-t border-line bg-[#040404]">
      {keys.map((x) => (<Link key={x.k} href={x.href} className={`fkey ${active === x.l ? "on" : ""}`}><b>{x.k}</b>{x.l}</Link>))}
      <div className="flex-1" />
      <div className="fkey border-l"><span className="text-dim">⌘K command · / search · ESC close</span></div>
    </div>
  );
}

export function Ticker({ items }: { items: TapeRow[] }) {
  if (!items.length) return null;
  const seq = [...items, ...items];
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-line bg-black h-[22px] flex items-center text-[11px]">
      <span className="bg-amber text-black px-2 font-bold h-full flex items-center shrink-0">TAPE</span>
      <div className="ticker flex-1">
        <div>
          {seq.map((s, i) => (
            <Link key={s.id + "-" + i} href={`/a/${s.company_slug}`} className="inline-flex items-center gap-2 mr-8 hover:text-amber">
              <span className="text-fg font-bold">{s.company_name.toUpperCase()}</span>
              <span className={`badge b-${(SIGNAL_GROUP[s.type] || "STACK").toLowerCase()}`}>{(SIGNAL_GROUP[s.type] || "").slice(0, 6)}</span>
              <span className="text-muted">{s.title}</span>
              <span className="text-amber">{s.score.toFixed(1)}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Panel({ title, k, right, children, className = "", bodyClass = "" }: { title: string; k?: string; right?: React.ReactNode; children: React.ReactNode; className?: string; bodyClass?: string }) {
  return (
    <section className={`panel flex flex-col min-h-0 ${className}`}>
      <div className="panel-title"><span>{k && <span className="k">{k}</span>}{title}</span>{right && <span className="normal-case tracking-normal text-muted">{right}</span>}</div>
      <div className={`min-h-0 overflow-auto ${bodyClass}`}>{children}</div>
    </section>
  );
}

export function Strength({ n }: { n: number }) {
  return <span className="dots" title={`strength ${n}/5`}><span className="text-amber">{"●".repeat(n)}</span><span className="text-[#2a2a2a]">{"●".repeat(5 - n)}</span></span>;
}

export function GroupBadge({ type }: { type: string }) {
  const g = SIGNAL_GROUP[type] || "STACK";
  return <span className={`badge b-${g.toLowerCase()}`}>{g}</span>;
}

export function fmtMoney(m: number | null): string {
  if (m == null) return "–";
  if (Math.abs(m) >= 1000) return `$${(m / 1000).toFixed(1)}B`;
  return `$${m.toFixed(0)}M`;
}
export function fmtNum(n: number | null | undefined): string { return n == null ? "–" : n.toLocaleString(); }

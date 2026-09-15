"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

type Hit = { slug: string; name: string; rank: number; sector: string | null; ats_vendor: string | null; domain: string | null };
const COMMANDS: { cmd: string; label: string; href: string }[] = [
  { cmd: "TAPE", label: "Signal tape (home)", href: "/" },
  { cmd: "UNIV", label: "Universe: all Fortune 500", href: "/u" },
  { cmd: "PROF", label: "Choose offer profile", href: "/p" },
  { cmd: "RUN", label: "Data run report", href: "/run" },
  { cmd: "GLOBE", label: "Situation room: globe with live replay", href: "/globe" },
  { cmd: "CARDS", label: "Battlecards: one page per account", href: "/cards" },
  { cmd: "CAMPAIGN", label: "Campaign builder: segment → list → CSV", href: "/campaign" },
  { cmd: "MATRIX", label: "Stack matrix: vendor × sector", href: "/matrix" },
  { cmd: "TIMELINE", label: "Trigger timeline: what changed when", href: "/timeline" },
  { cmd: "HIRING", label: "Tape: hiring signals", href: "/?g=HIRING" },
  { cmd: "STACK", label: "Tape: stack signals", href: "/?g=STACK" },
  { cmd: "FILINGS", label: "Tape: SEC filings", href: "/?g=FILINGS" },
  { cmd: "RISK", label: "Tape: risk signals", href: "/?g=RISK" },
  { cmd: "HELP", label: "Keys and commands", href: "/?help=1" },
];
const PROFILES = ["ATS", "SOURCE", "ASSESS", "SCREEN", "HRIS", "PAYROLL", "BENEFIT", "COMPLY", "PERFORM", "COMP", "WFM", "GLOBAL"];
const PROFILE_KEY: Record<string, string> = { ATS: "ats", SOURCE: "sourcing", ASSESS: "assessment", SCREEN: "screening", HRIS: "hris", PAYROLL: "payroll", BENEFIT: "benefits", COMPLY: "compliance", PERFORM: "performance", COMP: "compensation", WFM: "wfm", GLOBAL: "global" };

export default function Palette({ inline }: { inline?: boolean }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [idx, setIdx] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const close = useCallback(() => { setOpen(false); setQ(""); setHits([]); setIdx(0); }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen(true); }
      else if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA") { e.preventDefault(); setOpen(true); }
      else if (e.key === "Escape") close();
      else if (!e.metaKey && !e.ctrlKey && tag !== "INPUT" && tag !== "TEXTAREA") {
        if (e.key === "F1") { e.preventDefault(); router.push("/?help=1"); }
        if (e.key === "F2") { e.preventDefault(); router.push("/"); }
        if (e.key === "F3") { e.preventDefault(); router.push("/u"); }
        if (e.key === "F4") { e.preventDefault(); router.push("/run"); }
        if (e.key === "F5") { e.preventDefault(); router.push("/p"); }
        if (e.key === "F6") { e.preventDefault(); router.push("/globe"); }
        if (e.key === "F7") { e.preventDefault(); router.push("/cards"); }
        if (e.key === "F8") { e.preventDefault(); router.push("/campaign"); }
        if (e.key === "F9") { e.preventDefault(); router.push("/matrix"); }
        if (e.key === "F10") { e.preventDefault(); router.push("/timeline"); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, close]);

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 10); }, [open]);

  useEffect(() => {
    const ctrl = new AbortController();
    const term = q.trim();
    const t = setTimeout(() => {
      if (!term) { setHits([]); return; }
      fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal }).then((r) => r.json()).then((d) => { setHits(d.hits || []); setIdx(0); }).catch(() => {});
    }, 80);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q]);

  const cmdHits = q.trim() ? COMMANDS.filter((c) => c.cmd.startsWith(q.trim().toUpperCase()) || c.label.toLowerCase().includes(q.trim().toLowerCase())) : COMMANDS;
  const profHits = q.trim() ? PROFILES.filter((p) => p.startsWith(q.trim().toUpperCase())) : [];
  const items: { key: string; label: string; sub: string; href: string }[] = [
    ...profHits.map((p) => ({ key: "prof:" + p, label: `${p} <GO>`, sub: "switch offer profile", href: `/api/profile?key=${PROFILE_KEY[p]}&back=${encodeURIComponent(typeof window !== "undefined" ? window.location.pathname + window.location.search : "/")}` })),
    ...cmdHits.map((c) => ({ key: "cmd:" + c.cmd, label: `${c.cmd} <GO>`, sub: c.label, href: c.href })),
    ...hits.map((h) => ({ key: "co:" + h.slug, label: `#${h.rank} ${h.name}`, sub: `${h.sector || ""}${h.ats_vendor ? " · " + h.ats_vendor : ""}${h.domain ? " · " + h.domain : ""}`, href: `/a/${h.slug}` })),
  ];
  // When a query is present, prioritise companies
  if (q.trim() && hits.length) items.sort((a, b) => (a.key.startsWith("co:") ? 0 : 1) - (b.key.startsWith("co:") ? 0 : 1));

  const go = useCallback((href: string) => { close(); if (href.startsWith("/api/")) window.location.href = href; else router.push(href); }, [router, close]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(i + 1, items.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); const it = items[idx]; if (it) go(it.href); }
    else if (e.key === "Escape") close();
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className={`flex items-center gap-2 ${inline ? "" : "px-2"} text-left w-full`} title="Command line (Cmd+K or /)">
        <span className="text-amber glow">&gt;</span>
        <span className="text-muted flex-1">Type a company, or a command<span className="cursor" /></span>
        <span className="kbd">⌘K</span>
      </button>
      {open && (
        <div className="fixed inset-0 z-[100] bg-black/70 flex items-start justify-center pt-[12vh]" onMouseDown={close}>
          <div className="w-[720px] max-w-[94vw] panel shadow-[0_0_40px_rgba(255,158,27,0.15)] fade-in" onMouseDown={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 px-3 py-2 border-b border-line">
              <span className="text-amber glow">&gt;</span>
              <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKeyDown} placeholder="Company name, ticker, domain, or command (TAPE, UNIV, PROF, RUN, ATS, PAYROLL...)" className="flex-1 bg-transparent outline-none text-fg placeholder:text-dim" spellCheck={false} />
              <span className="kbd">ESC</span>
            </div>
            <div className="max-h-[52vh] overflow-auto">
              {items.length === 0 && <div className="px-3 py-3 text-muted">No matches.</div>}
              {items.map((it, i) => (
                <div key={it.key} onMouseEnter={() => setIdx(i)} onClick={() => go(it.href)} className={`flex items-center gap-3 px-3 py-1.5 cursor-pointer ${i === idx ? "row-sel" : "row-hover"}`}>
                  <span className={`w-[220px] shrink-0 ${i === idx ? "font-bold" : "text-amber"}`}>{it.label}</span>
                  <span className={`truncate ${i === idx ? "" : "text-muted"}`}>{it.sub}</span>
                </div>
              ))}
            </div>
            <div className="px-3 py-1 border-t border-line text-dim text-[10px] flex gap-4">
              <span>↑↓ move</span><span>↵ go</span><span>ESC close</span><span>F1 help · F2 tape · F3 univ · F5 profile · F6 globe · F7 cards · F8 campaign · F9 matrix · F10 timeline</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

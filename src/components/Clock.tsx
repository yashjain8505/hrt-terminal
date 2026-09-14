"use client";
import { useEffect, useState } from "react";

function fmt(now: Date) {
  const utc = now.toISOString().slice(11, 19);
  const local = now.toTimeString().slice(0, 8);
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone.split("/").pop();
  return { utc, local, tz };
}

export default function Clock() {
  const [tick, setTick] = useState(0);
  useEffect(() => { const t = setInterval(() => setTick((x) => x + 1), 1000); return () => clearInterval(t); }, []);
  if (tick === 0) return <span className="text-muted">--:--:--</span>;
  const { utc, local, tz } = fmt(new Date());
  return (
    <span className="text-muted whitespace-nowrap">
      <span className="text-fg">{utc}</span> UTC <span className="text-dim">|</span> <span className="text-fg">{local}</span> {tz}
    </span>
  );
}

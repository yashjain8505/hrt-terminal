"use client";
import { useState } from "react";
export default function Copy({ text, label = "COPY" }: { text: string; label?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text).then(() => { setOk(true); setTimeout(() => setOk(false), 1200); }); }} className="kbd hover:text-amber cursor-pointer">
      {ok ? "COPIED" : label}
    </button>
  );
}

import fs from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";
/** The room is a static single page; serve it as the home so it can fetch live data from /api/data. */
export async function GET() {
  const dir = path.join(process.cwd(), "public", "room");
  const v = (f: string) => { try { return Math.round(fs.statSync(path.join(dir, f)).mtimeMs); } catch { return 0; } };
  let html = fs.readFileSync(path.join(dir, "index.html"), "utf8");
  html = html.replace('/room/hrt-lib.js"', `/room/hrt-lib.js?v=${v("hrt-lib.js")}"`).replace('/room/room.js"', `/room/room.js?v=${v("room.js")}"`);
  const body = "<!doctype html><html lang=\"en\"><head><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">" + html + "</head><body></body></html>";
  return new Response(body, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

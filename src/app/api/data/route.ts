import { buildBundle } from "@/lib/bundle";
export const dynamic = "force-dynamic";
export async function GET() {
  const b = buildBundle();
  return new Response(JSON.stringify(b), { headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
}

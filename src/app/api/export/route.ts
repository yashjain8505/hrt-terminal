import { cookies } from "next/headers";
import { getProfile } from "@/lib/queries";
import { buildCampaign, campaignCsv, parseFilters } from "@/lib/campaign";

export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const u = new URL(req.url);
  const sp: Record<string, string> = {}; u.searchParams.forEach((v, k) => (sp[k] = v));
  const profile = getProfile((await cookies()).get("hrt_profile")?.value);
  const lines = buildCampaign(profile, parseFilters(sp));
  const csv = campaignCsv(lines);
  const name = `hrt-campaign-${profile.key}${sp.vendor ? "-" + sp.vendor : ""}${sp.sector ? "-" + sp.sector.toLowerCase().replace(/[^a-z0-9]+/g, "-") : ""}.csv`;
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"` } });
}

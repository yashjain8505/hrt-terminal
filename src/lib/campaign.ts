import "server-only";
import type { Profile } from "./profiles";
import { getCampaign, getCompany, getCompanySignals, getSnapshot, type CampaignRow } from "./queries";
import { buildBattlecard } from "./battlecard";
import { VENDOR_BY_KEY } from "./vendors";
import { stateCode } from "./classify";

export interface CampaignFilters { vendor?: string; sector?: string; state?: string; minRoles?: number; type?: string; limit?: number }

export interface CampaignLine {
  row: CampaignRow;
  headline: string;
  opening: string;
  buyer: string;
  buyers: string[];
  proof: string | null;
  incumbent: string;
  angle: string | null;
  triggers: { title: string; why: string; url: string | null; date: string }[];
}

export function buildCampaign(profile: Profile, f: CampaignFilters): CampaignLine[] {
  const rows = getCampaign(profile, f);
  return rows.map((row) => {
    const co = getCompany(row.slug)!;
    const signals = getCompanySignals(co.id, profile);
    const snap = getSnapshot(co.id);
    const card = buildBattlecard({ company: co, signals, counts: snap ? JSON.parse(snap.counts_json || "{}") : {}, states: snap ? JSON.parse(snap.states_json || "{}") : {}, countries: snap ? JSON.parse(snap.countries_json || "{}") : {}, tools: snap ? JSON.parse(snap.tools_json || "{}") : {} }, profile);
    const inc = co.ats_vendor || co.hris_vendor;
    return { row, headline: card.headline, opening: card.opening, buyer: card.buyers[0], buyers: card.buyers, proof: card.triggers[0]?.url || co.careers_url || null, incumbent: inc ? (VENDOR_BY_KEY[inc]?.name || inc) : "unknown", angle: card.stack.find((s) => s.angle)?.angle || null, triggers: card.triggers.slice(0, 3).map((t) => ({ title: t.title, why: t.why, url: t.url, date: t.date })) };
  });
}

export function campaignCsv(lines: CampaignLine[]): string {
  const cols = ["rank", "company", "domain", "sector", "hq_city", "hq_state", "employees", "ats", "hris", "open_roles", "score", "headline", "trigger_1", "trigger_1_why", "trigger_1_url", "trigger_1_date", "trigger_2", "trigger_2_url", "trigger_3", "trigger_3_url", "buyer_title_1", "buyer_title_2", "buyer_title_3", "opening_line", "incumbent", "incumbent_angle", "account_url"];
  const esc = (v: unknown) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const out = [cols.join(",")];
  for (const l of lines) {
    const co = getCompany(l.row.slug)!;
    const t = l.triggers;
    out.push([co.rank, co.name, co.domain, co.sector, co.hq_city, stateCode(co.hq_state), co.employees, co.ats_vendor ? VENDOR_BY_KEY[co.ats_vendor]?.name || co.ats_vendor : "", co.hris_vendor ? VENDOR_BY_KEY[co.hris_vendor]?.name || co.hris_vendor : "", co.open_roles, l.row.score, l.headline, t[0]?.title, t[0]?.why, t[0]?.url, t[0]?.date, t[1]?.title, t[1]?.url, t[2]?.title, t[2]?.url, l.buyers[0], l.buyers[1], l.buyers[2], l.opening, l.incumbent, l.angle, `/a/${co.slug}`].map(esc).join(","));
  }
  return out.join("\n");
}

export function parseFilters(sp: Record<string, string | string[] | undefined>): CampaignFilters {
  const g = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  return { vendor: g("vendor") || undefined, sector: g("sector") || undefined, state: g("state") || undefined, minRoles: Number(g("minRoles")) || undefined, type: g("type") || undefined, limit: Math.min(500, Number(g("limit")) || 100) };
}

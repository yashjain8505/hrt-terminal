/**
 * Step 4: SEC EDGAR. Map each company to a CIK via the ticker list, pull the submissions feed,
 * keep recent 8-K filings with the item codes that matter for HR sellers:
 *   5.02 officer departure/appointment, 2.05 exit/restructuring costs, 2.01 acquisition/disposition completed.
 */
import fs from "node:fs";
import path from "node:path";
import { db, logRun } from "../src/lib/db";
import { fetchJson, nowIso, pLimit, sleep } from "../src/lib/http";

const UA = "HRTerminal/0.1 research (earanyash@gmail.com)";
const RAW = path.join(process.cwd(), "data", "raw");
const DAYS = 365;

function normName(s: string): string {
  return s.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9 ]/g, " ").replace(/\b(inc|corp|corporation|co|company|holdings|holding|group|plc|ltd|llc|the|cos|companies|international|intl|de|sa|nv|ag|lp|l p|trust|fund)\b/g, " ").replace(/\s+/g, " ").trim();
}
const OVERRIDES: Record<string, string> = {
  "alphabet": "GOOGL", "meta platforms": "META", "fannie mae": "FNMA", "freddie mac": "FMCC", "walt disney": "DIS", "jpmorgan chase": "JPM", "bank of america": "BAC", "wells fargo": "WFC", "berkshire hathaway": "BRK-B", "at t": "T", "3m": "MMM", "pg e": "PCG", "cencora": "COR", "exxonmobil": "XOM", "walmart": "WMT", "target": "TGT", "nvidia": "NVDA", "apple": "AAPL", "amazon": "AMZN", "microsoft": "MSFT", "tesla": "TSLA", "ford motor": "F", "general motors": "GM", "coca cola": "KO", "pepsico": "PEP", "home depot": "HD", "lowe s": "LOW", "ups united parcel service": "UPS", "united parcel service": "UPS", "fedex": "FDX", "kroger": "KR", "costco wholesale": "COST", "cvs health": "CVS", "unitedhealth": "UNH", "elevance health": "ELV", "cigna": "CI", "humana": "HUM", "centene": "CNC", "molina healthcare": "MOH", "chevron": "CVX", "phillips 66": "PSX", "marathon petroleum": "MPC", "valero energy": "VLO", "conocophillips": "COP", "boeing": "BA", "lockheed martin": "LMT", "rtx": "RTX", "general dynamics": "GD", "northrop grumman": "NOC", "l3harris technologies": "LHX", "caterpillar": "CAT", "deere": "DE", "honeywell": "HON", "ge aerospace": "GE", "ge healthcare technologies": "GEHC", "ge vernova": "GEV", "intel": "INTC", "cisco systems": "CSCO", "oracle": "ORCL", "salesforce": "CRM", "ibm international business machines": "IBM", "international business machines": "IBM", "dell technologies": "DELL", "hp": "HPQ", "hewlett packard enterprise": "HPE", "broadcom": "AVGO", "qualcomm": "QCOM", "advanced micro devices": "AMD", "micron technology": "MU", "texas instruments": "TXN", "applied materials": "AMAT", "netflix": "NFLX", "comcast": "CMCSA", "verizon communications": "VZ", "t mobile us": "TMUS", "charter communications": "CHTR", "paramount skydance": "PSKY", "warner bros discovery": "WBD", "fox": "FOXA", "goldman sachs": "GS", "morgan stanley": "MS", "citigroup": "C", "american express": "AXP", "capital one financial": "COF", "us bancorp": "USB", "pnc financial services": "PNC", "truist financial": "TFC", "charles schwab": "SCHW", "blackrock": "BLK", "visa": "V", "mastercard": "MA", "paypal": "PYPL", "metlife": "MET", "prudential financial": "PRU", "aig american international": "AIG", "american international": "AIG", "allstate": "ALL", "progressive": "PGR", "travelers": "TRV", "chubb": "CB", "aflac": "AFL", "johnson johnson": "JNJ", "pfizer": "PFE", "merck": "MRK", "abbvie": "ABBV", "eli lilly": "LLY", "bristol myers squibb": "BMY", "amgen": "AMGN", "gilead sciences": "GILD", "abbott laboratories": "ABT", "thermo fisher scientific": "TMO", "danaher": "DHR", "medtronic": "MDT", "mckesson": "MCK", "cardinal health": "CAH", "hca healthcare": "HCA", "procter gamble": "PG", "nike": "NKE", "starbucks": "SBUX", "mcdonald s": "MCD", "uber technologies": "UBER", "booking": "BKNG", "airbnb": "ABNB", "delta air lines": "DAL", "united airlines": "UAL", "american airlines": "AAL", "southwest airlines": "LUV", "union pacific": "UNP", "csx": "CSX", "norfolk southern": "NSC", "dow": "DOW", "dupont": "DD", "linde": "LIN", "nucor": "NUE", "freeport mcmoran": "FCX", "newmont": "NEM", "duke energy": "DUK", "southern": "SO", "nextera energy": "NEE", "exelon": "EXC", "dominion energy": "D", "american electric power": "AEP", "tjx": "TJX", "ross stores": "ROST", "dollar general": "DG", "dollar tree": "DLTR", "best buy": "BBY", "macy s": "M", "kohl s": "KSS", "gap": "GAP", "ebay": "EBAY", "sysco": "SYY", "tyson foods": "TSN", "archer daniels midland": "ADM", "general mills": "GIS", "kraft heinz": "KHC", "mondelez international": "MDLZ", "altria": "MO", "philip morris international": "PM", "colgate palmolive": "CL", "kimberly clark": "KMB", "estee lauder": "EL", "automatic data processing": "ADP", "paychex": "PAYX", "accenture": "ACN", "cognizant technology solutions": "CTSH", "kyndryl": "KD", "dxc technology": "DXC", "leidos": "LDOS", "booz allen hamilton": "BAH", "caci international": "CACI", "science applications international": "SAIC", "jacobs solutions": "J", "aecom": "ACM", "fluor": "FLR", "quanta services": "PWR", "emcor": "EME", "waste management": "WM", "republic services": "RSG", "cintas": "CTAS", "manpowergroup": "MAN", "robert half": "RHI", "labcorp": "LH", "quest diagnostics": "DGX", "fidelity national information fis": "FIS", "fiserv": "FI", "global payments": "GPN", "block": "XYZ", "coinbase global": "COIN", "interactive brokers": "IBKR", "jefferies financial": "JEF", "raymond james financial": "RJF", "lpl financial": "LPLA", "ameriprise financial": "AMP", "principal financial": "PFG", "lincoln national": "LNC", "equitable": "EQH", "unum": "UNM", "hartford insurance": "HIG", "hartford financial services": "HIG", "markel": "MKL", "arthur j gallagher": "AJG", "marsh mclennan": "MMC", "aon": "AON", "willis towers watson": "WTW", "keycorp": "KEY", "fifth third bancorp": "FITB", "regions financial": "RF", "m t bank": "MTB", "citizens financial": "CFG", "huntington bancshares": "HBAN", "first citizens bancshares": "FCNCA", "ally financial": "ALLY", "synchrony financial": "SYF", "discover financial services": "DFS", "bank of new york bny": "BNY", "u s bancorp": "USB", "honeywell technologies": "HON", "mondel z": "MDLZ", "d r horton": "DHI", "kkr": "KKR", "aig": "AIG", "est e lauder": "EL", "moody s": "MCO", "vf": "VFC", "j b hunt transport services": "JBHT", "casey s general stores": "CASY", "w r berkley": "WRB", "taylor morrison home": "TMHC", "erie insurance": "ERIE", "state street": "STT", "northern trust": "NTRS",
};

interface Row { id: number; name: string; ticker: string | null; cik: string | null }

async function main() {
  const started = nowIso();
  const d = db();
  const cache = path.join(RAW, "company_tickers.json");
  if (!fs.existsSync(cache)) {
    const r = await fetchJson<Record<string, { cik_str: number; ticker: string; title: string }>>("https://www.sec.gov/files/company_tickers.json", { headers: { "User-Agent": UA }, timeoutMs: 30000 });
    if (!r.ok || !r.data) throw new Error("company_tickers " + r.status);
    fs.writeFileSync(cache, r.raw);
  }
  const tickers = Object.values(JSON.parse(fs.readFileSync(cache, "utf8")) as Record<string, { cik_str: number; ticker: string; title: string }>);
  const byTicker = new Map(tickers.map((t) => [t.ticker.toUpperCase(), t]));
  const byName = new Map<string, typeof tickers[number]>();
  for (const t of tickers) { const k = normName(t.title); if (!byName.has(k)) byName.set(k, t); }
  const rows = d.prepare("SELECT id,name,ticker,cik FROM companies ORDER BY rank").all() as Row[];
  let matched = 0;
  for (const c of rows) {
    const nn = normName(c.name);
    let t = OVERRIDES[nn] ? byTicker.get(OVERRIDES[nn]) : undefined;
    if (!t) t = byName.get(nn);
    if (!t) {
      // startsWith / contains match on normalized titles, prefer shortest title
      const cands = tickers.filter((x) => { const k = normName(x.title); return k === nn || (nn.length >= 5 && (k.startsWith(nn + " ") || k === nn)) || (nn.length >= 8 && k.includes(nn)); });
      cands.sort((a, b) => a.title.length - b.title.length);
      t = cands[0];
    }
    if (t) { matched++; d.prepare("UPDATE companies SET cik=?, ticker=? WHERE id=?").run(String(t.cik_str).padStart(10, "0"), t.ticker, c.id); }
  }
  console.log(`CIK matched ${matched}/${rows.length}`);

  const withCik = d.prepare("SELECT id,name,cik FROM companies WHERE cik IS NOT NULL ORDER BY rank").all() as { id: number; name: string; cik: string }[];
  const insF = d.prepare("INSERT OR IGNORE INTO sec_filings (company_id, form, filed_at, items, accession, primary_doc, url) VALUES (?,?,?,?,?,?,?)");
  const limit = pLimit(3);
  const cutoff = new Date(Date.now() - DAYS * 86400000).toISOString().slice(0, 10);
  let pulled = 0, filings = 0, errors = 0;
  await Promise.all(withCik.map((c) => limit(async () => {
    await sleep(120);
    const r = await fetchJson<{ filings: { recent: { form: string[]; filingDate: string[]; items: string[]; accessionNumber: string[]; primaryDocument: string[] } } }>(`https://data.sec.gov/submissions/CIK${c.cik}.json`, { headers: { "User-Agent": UA }, timeoutMs: 30000 });
    if (!r.ok || !r.data) { errors++; return; }
    pulled++;
    const rec = r.data.filings.recent;
    const cikNum = String(Number(c.cik));
    for (let i = 0; i < rec.form.length; i++) {
      if (!/^8-K/.test(rec.form[i])) continue;
      if (rec.filingDate[i] < cutoff) continue;
      const acc = rec.accessionNumber[i];
      const url = `https://www.sec.gov/Archives/edgar/data/${cikNum}/${acc.replace(/-/g, "")}/${rec.primaryDocument[i]}`;
      const res = insF.run(c.id, rec.form[i], rec.filingDate[i], rec.items[i] || "", acc, rec.primaryDocument[i], url);
      if (res.changes) filings++;
    }
  })));
  const note = `cik_matched=${matched} submissions_ok=${pulled} errors=${errors} new_8k=${filings}`;
  console.log("DONE", note);
  logRun("04-sec", started, true, note);
}
main().catch((e) => { console.error(e); process.exit(1); });

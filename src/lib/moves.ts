/**
 * People movement: parse leadership moves out of text (8-K item 5.02 bodies, headlines).
 * Pure functions so they can be unit-tested and reused.
 */
export const HR_ROLE_RE = /\b(chief (people|human resources?|talent|hr|diversity|learning|culture|administrative) officer|chief people|chief human|chro\b|head of (people|talent|hr|human resources|talent acquisition|recruiting|payroll|total rewards|global mobility)|(senior |executive |group )?vice president(,| of| -| for)? (global |corporate )?(people|human resources|hr|talent|talent acquisition|total rewards|compensation|benefits|learning)|(evp|svp|vp)(,| of)? (global )?(people|hr|human resources|talent|talent acquisition|total rewards)|chief talent|people officer|human resources officer|labor relations officer|chief learning officer)\b/i;
const TITLE_CORE = "(?:[Cc]hief|[Pp]resident|[Ee]xecutive [Vv]ice [Pp]resident|[Ss]enior [Vv]ice [Pp]resident|[Vv]ice [Pp]resident|EVP|SVP|VP|[Hh]ead|[Gg]eneral [Cc]ounsel|[Tt]reasurer|[Cc]ontroller|[Ss]ecretary|[Dd]irector|[Oo]fficer|[Cc]hairman|[Cc]hair)";
const NAME = "([A-Z][A-Za-z'’.-]+(?: [A-Z]\\.?)?(?: [A-Z][A-Za-z'’.-]+){1,3})";

export interface Move { kind: "arrival" | "departure"; person: string; role: string; date: string | null; hr: boolean; text: string }

const MONTHS: Record<string, number> = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };
export function parseLongDate(s: string): string | null {
  const m = s.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})\b/i);
  if (!m) return null;
  return `${m[3]}-${String(MONTHS[m[1].toLowerCase()]).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
}
function cleanRole(r: string): string { return r.replace(/\s+/g, " ").replace(/^(the |its |as |a |an )+/i, "").replace(/\s+(of|for) (the )?(Company|Corporation|Registrant|Board of Directors|Board)\b.*$/i, "").replace(/,?\s+(has|had|who|will|is|was|and will|effective)\b.*$/i, "").replace(/[,.;]+$/, "").trim(); }
/** Canonical key for an HR/officer role so "CHRO", "Chief HR Officer" and "Chief Human Resources Officer" merge. */
export function roleKey(role: string): string {
  const r = role.toLowerCase();
  if (/chro|chief (human resources?|hr) officer|chief people|people officer|chief talent/.test(r)) return "chro";
  if (/total rewards|compensation and benefits|comp(ensation)? & benefits/.test(r)) return "rewards";
  if (/talent acquisition|recruiting|head of talent\b/.test(r)) return "ta";
  if (/head of people|vp,? (of )?people|vice president,? (of )?people|people & capability/.test(r)) return "vp-people";
  if (/human resources|\bhr\b/.test(r)) return "hr";
  if (/chief executive|\bceo\b/.test(r)) return "ceo";
  if (/chief financial|\bcfo\b/.test(r)) return "cfo";
  if (/chief operating|\bcoo\b/.test(r)) return "coo";
  return r.replace(/[^a-z]+/g, " ").trim().slice(0, 40);
}
function cleanName(n: string): string { return n.replace(/\s+/g, " ").replace(/^(Mr|Ms|Mrs|Dr)\.?\s+/, "").trim(); }
const BAD_NAME = /\b(the|company|board|committee|effective|item|chief|executive|senior|vice|president|director|officer|inc|corp|general|counsel|treasurer|secretary|chairman|chair|interim|group|global|division|operating|financial|human|resources|people|talent)\b/i;

/** Extract moves from an 8-K Item 5.02 body (plain text). */
export function parse8K(text: string, filedAt: string): Move[] {
  const t = text.replace(/\s+/g, " ");
  const out: Move[] = [];
  const seen = new Set<string>();
  const push = (m: Move) => { const k = m.kind + "|" + m.person.toLowerCase() + "|" + m.role.toLowerCase().slice(0, 40); if (seen.has(k) || BAD_NAME.test(m.person) || m.person.split(" ").length < 2) return; seen.add(k); out.push(m); };
  const sentences = t.split(/(?<!\b(?:Mr|Ms|Mrs|Dr|Jr|Sr|Inc|Co|No|St|vs|U\.S|L\.P|N\.A)\.)(?<!\b[A-Z]\.)(?<=[.;])\s+(?=[A-Z(])/);
  for (const s of sentences) {
    const eff = parseLongDate((s.match(/effective\s+(?:as of\s+)?([A-Z][a-z]+ \d{1,2}, \d{4})/) || [])[1] || "") || parseLongDate(s) || filedAt;
    // appointed/named/elected/promoted X [, age,] as/to [the position of] TITLE
    let re = new RegExp(`\\b(?:appointed|named|elected|promoted|designated|hired)\\s+${NAME}(?:,\\s*(?:age\\s+)?\\d{2},?)?\\s+(?:as|to serve as|to the position of|to|as the Company['’]s|as its)\\s+(?:the |its |the Company['’]s )?((?:[A-Z][A-Za-z&/,-]*\\s?){0,12}?${TITLE_CORE}[A-Za-z ,&/-]{0,80}?)(?=[,.;(]| effective| with | reporting| beginning| commencing| who | to succeed| succeeding| replacing)`, "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(s))) push({ kind: "arrival", person: cleanName(m[1]), role: cleanRole(m[2]), date: eff, hr: HR_ROLE_RE.test(m[2]), text: s.slice(0, 220) });
    // appointment of X[, age,] as [the Company's] TITLE
    re = new RegExp(`\\b(?:[Aa]ppointment|[Ee]lection|[Pp]romotion|[Hh]iring) of (?:Dr\\.|Mr\\.|Ms\\.|Mrs\\.)?\\s*${NAME}(?:,\\s*(?:age\\s+)?\\d{2},?)?\\s+(?:as|to)\\s+(?:the Company['’]s |the |its )?((?:[A-Z][A-Za-z&/,-]*\\s?){0,12}?${TITLE_CORE}[A-Za-z ,&/-]{0,80}?)(?=[,.;(]| effective| with | reporting| beginning| commencing| who | to succeed| succeeding| replacing)`, "g");
    while ((m = re.exec(s))) push({ kind: "arrival", person: cleanName(m[1]), role: cleanRole(m[2]), date: eff, hr: HR_ROLE_RE.test(m[2]), text: s.slice(0, 220) });
    // X, who has served as TITLE ..., will retire / step down / resign
    re = new RegExp(`${NAME},?\\s+who (?:has|had|currently) (?:served|serves) as (?:the Company['’]s |the |its |our )?((?:[A-Z][A-Za-z&/,-]*\\s?){0,12}?${TITLE_CORE}[A-Za-z ,&/-]{0,80}?)(?=[,.;(]| since| effective)[\\s\\S]{0,200}?\\b(?:retire|retiring|resign|resigning|step down|stepping down|leave|leaving|depart|departing|transition|no longer serve|cease)`, "g");
    while ((m = re.exec(s))) push({ kind: "departure", person: cleanName(m[1]), role: cleanRole(m[2]), date: eff, hr: HR_ROLE_RE.test(m[2]), text: s.slice(0, 220) });
    // X will (join|serve|succeed) ... as TITLE ; X has been appointed TITLE
    re = new RegExp(`${NAME}(?:,\\s*(?:age\\s+)?\\d{2},?)?\\s+(?:will (?:join|serve|succeed|assume|become)|has been (?:appointed|named|elected|promoted)|was (?:appointed|named|elected|promoted)|is (?:appointed|named|joining))\\s+(?:[^.;]{0,60}?\\b(?:as|to|the role of|the position of)\\s+)?(?:the |its |the Company['’]s )?((?:[A-Z][A-Za-z&/,-]*\\s?){0,12}?${TITLE_CORE}[A-Za-z ,&/-]{0,80}?)(?=[,.;(]| effective| with | reporting| beginning| commencing| who | to succeed| succeeding| replacing)`, "g");
    while ((m = re.exec(s))) push({ kind: "arrival", person: cleanName(m[1]), role: cleanRole(m[2]), date: eff, hr: HR_ROLE_RE.test(m[2]), text: s.slice(0, 220) });
    // departures: X, TITLE, (notified|resigned|will retire|will step down|departed|was terminated)
    re = new RegExp(`${NAME},?\\s+(?:the Company['’]s |the |its )?((?:[A-Z][A-Za-z&/,-]*\\s?){0,12}?${TITLE_CORE}[A-Za-z ,&/-]{0,80}?),?\\s+(?:notified|informed|resigned|will resign|has resigned|retired|will retire|is retiring|will step down|stepped down|will be leaving|is leaving|departed|will depart|was terminated|ceased|will cease|will no longer serve|tendered)`, "g");
    while ((m = re.exec(s))) push({ kind: "departure", person: cleanName(m[1]), role: cleanRole(m[2]), date: eff, hr: HR_ROLE_RE.test(m[2]), text: s.slice(0, 220) });
    // (resignation|retirement|departure) of X (as|,) TITLE
    re = new RegExp(`\\b(?:resignation|retirement|departure|termination)\\s+of\\s+${NAME}(?:,\\s*(?:age\\s+)?\\d{2},?)?\\s*(?:,|as|from (?:his|her|their) (?:position|role) as|from the position of)\\s*(?:the |its |the Company['’]s )?((?:[A-Z][A-Za-z&/,-]*\\s?){0,12}?${TITLE_CORE}[A-Za-z ,&/-]{0,80}?)(?=[,.;(]| effective)`, "g");
    while ((m = re.exec(s))) push({ kind: "departure", person: cleanName(m[1]), role: cleanRole(m[2]), date: eff, hr: HR_ROLE_RE.test(m[2]), text: s.slice(0, 220) });
    // succeeding / replacing X (who is retiring) => departure of X
    re = new RegExp(`\\b(?:succeed(?:s|ing)?|replac(?:es|ing)|following the (?:retirement|resignation|departure) of)\\s+${NAME}(?:,\\s+who)?`, "g");
    while ((m = re.exec(s))) { const role = (s.match(HR_ROLE_RE) || [""])[0]; push({ kind: "departure", person: cleanName(m[1]), role: role || "officer", date: eff, hr: !!role, text: s.slice(0, 220) }); }
  }
  return out;
}

/** Strip an 8-K HTML document to the Item 5.02 section text. */
export function item502Text(html: string): string {
  const t = html.replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g, "&").replace(/&#8217;|&rsquo;/g, "’").replace(/&#8220;|&#8221;|&ldquo;|&rdquo;/g, '"').replace(/&[a-z#0-9]+;/g, " ").replace(/\s+/g, " ");
  const i = t.search(/Item\s*5\.02/i);
  if (i < 0) return t.slice(0, 6000);
  const rest = t.slice(i);
  const j = rest.search(/Item\s*(5\.0[3-8]|[6-9]\.\d\d)/i);
  return (j > 0 ? rest.slice(0, j) : rest).slice(0, 12000);
}

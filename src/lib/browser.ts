/** Browser bundle for the published artifacts: pure template/scoring code, no DB. */
import { PROFILES, PROFILE_BY_KEY, scoreSignal, SIGNAL_LABEL, SIGNAL_GROUP } from "./profiles";
import { whyNow } from "./whynow";
import { buildBattlecard } from "./battlecard";
import { buyerTitles, incumbentAngle, DISCOVERY_QUESTIONS, FAMILY_PITCH, parsePostedText } from "./playbook";
import { VENDOR_BY_KEY, JD_TOOLS } from "./vendors";
import { execDomain, stateCode, stateName, BUCKET_LABEL } from "./classify";
import { COUNTRY_LATLNG } from "./geo";
import { detectSituations, situationStory, SITUATIONS, SITUATION_BY_KEY, shortLoc } from "./situations";

const lib = { detectSituations, situationStory, SITUATIONS, SITUATION_BY_KEY, shortLoc, PROFILES, PROFILE_BY_KEY, scoreSignal, SIGNAL_LABEL, SIGNAL_GROUP, whyNow, buildBattlecard, buyerTitles, incumbentAngle, DISCOVERY_QUESTIONS, FAMILY_PITCH, parsePostedText, VENDOR_BY_KEY, JD_TOOLS, execDomain, stateCode, stateName, BUCKET_LABEL, COUNTRY_LATLNG };
(globalThis as unknown as { HRTLIB: typeof lib }).HRTLIB = lib;
export default lib;

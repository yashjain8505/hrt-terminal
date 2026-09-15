import type { Profile } from "./profiles";
import { FAMILY_PITCH } from "./playbook";

/** Three-touch sequence template with merge fields, per offer family. */
export function sequenceTemplate(profile: Profile): { step: string; subject: string; body: string }[] {
  const pitch = FAMILY_PITCH[profile.family];
  const sells = profile.sells.split(",")[0].trim();
  return [
    {
      step: "Day 0 · email",
      subject: "{{trigger_subject}}",
      body: `{{opening_line}}\n\nProof: {{proof_url}}\n\nWe help {{buyer_title}}s at companies like {{company}} with ${pitch}. Worth 15 minutes next week?\n\n{{sender_name}}`,
    },
    {
      step: "Day 3 · LinkedIn connect + note",
      subject: "",
      body: `Hi {{first_name}}, saw {{trigger_short}} at {{company}}. I work with ${profile.buyer.toLowerCase()}s on ${sells}. Would value connecting.`,
    },
    {
      step: "Day 7 · email bump",
      subject: "Re: {{trigger_subject}}",
      body: `{{first_name}}, one more angle. You run {{incumbent}} today. {{incumbent_angle}}\n\nIf that is not a priority this quarter, tell me and I will stop. If it is, 15 minutes is enough to see whether it is worth a deeper look.\n\n{{sender_name}}`,
    },
  ];
}

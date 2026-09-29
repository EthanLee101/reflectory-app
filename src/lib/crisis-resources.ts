/**
 * Crisis resources shown when distress is detected.
 *
 * Last verified against each organization's own site on 2026-09-29 (988: call/text
 * 24/7; Crisis Text Line: text HOME to 741741; IASP directory moved to the URL below).
 * Re-check periodically: these are safety-critical and go stale. US/international
 * defaults; localize as needed.
 */
export interface CrisisResource {
  name: string;
  description: string;
  contact: string;
  href?: string;
}

export const CRISIS_RESOURCES: CrisisResource[] = [
  {
    name: "988 Suicide & Crisis Lifeline (US)",
    description: "24/7 free, confidential support — call or text.",
    contact: "Call or text 988",
    href: "https://988lifeline.org",
  },
  {
    name: "Crisis Text Line (US)",
    description: "Text with a trained crisis counselor, 24/7.",
    contact: "Text HOME to 741741",
    href: "https://www.crisistextline.org",
  },
  {
    name: "International Association for Suicide Prevention",
    description: "Directory of crisis centers around the world.",
    contact: "Find a center near you",
    href: "https://www.iasp.info/crisis-centres-helplines/",
  },
];

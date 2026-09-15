/**
 * Crisis resources shown when distress is detected.
 *
 * ⚠️  VERIFY THESE ARE CURRENT before any real user touches the app.
 * These default to US/international resources; localize as needed.
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
    href: "https://www.iasp.info/resources/Crisis_Centres/",
  },
];

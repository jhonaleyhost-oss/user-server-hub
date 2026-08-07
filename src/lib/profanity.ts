// Client-side profanity filter. Keep the word list in sync with the
// database function public.contains_profanity (server-side enforcement).

const WORDS = [
  "anjing","anjg","anjay","anjir","asu","babi","bangsat","bangke","bajingan",
  "kontol","kntl","memek","mmk","pepek","ngentot","ngentod","entot","jancok","jancuk","cok",
  "kimak","kimax","pukimak","pantek","lonte","pelacur","sundal","jablay",
  "tolol","goblok","goblog","bego","idiot","kampret","keparat",
  "bacot","bct","ngewe","coli","colmek","peju","pejuh","sange","sangean",
  "tetek","toket","itil","vagina","penis","kelamin","porno","bokep","bugil","telanjang",
  "laknat","bangsad","tai","taik","sialan",
  "fuck","fucking","fucker","shit","bitch","bastard","asshole","dick","pussy","cunt",
  "whore","slut","motherfucker","nigga","nigger","retard","faggot","porn","nude","sex","xxx",
];

const LEET: Record<string, string> = {
  "4": "a", "3": "e", "1": "i", "0": "o", "$": "s", "5": "s", "7": "t", "@": "a", "!": "i",
};

export function normalizeText(input: string): string {
  return (input || "")
    .toLowerCase()
    .replace(/[43105$7@!]/g, (c) => LEET[c] ?? c)
    .replace(/[^a-z0-9 ]+/g, " ");
}

/** Returns the first matched bad word, or null when the text is clean. */
export function findProfanity(input: string): string | null {
  const t = normalizeText(input);
  if (!t.trim()) return null;
  const compact = t.replace(/\s+/g, "");
  for (const w of WORDS) {
    const rx = new RegExp(`(^| )${w}(s|es)?( |$)`);
    if (rx.test(t)) return w;
    if (w.length >= 5 && compact.includes(w)) return w;
  }
  return null;
}

export function containsProfanity(input: string): boolean {
  return findProfanity(input) !== null;
}

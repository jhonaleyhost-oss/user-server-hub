// Keep in sync with src/lib/nameValidation.ts
const RESERVED_WORDS = [
  "admin", "administrator", "administrasi",
  "superadmin", "super admin", "super-admin",
  "owner", "root", "staff", "system", "sistem",
  "moderator", "mod", "support", "cs", "customer service",
  "official", "resmi",
  "jhonaley", "jhonaleystore", "jhonaley store", "jhonaleyhost",
];

const LINK_PATTERNS: RegExp[] = [
  /https?:\/\//i,
  /www\./i,
  /t\.me/i,
  /telegram\.me/i,
  /wa\.me/i,
  /\bchat\.whatsapp\b/i,
  /\b[a-z0-9-]+\.(com|net|org|id|uk|xyz|io|co|me|link|shop|store|site|online|info|biz|tk|ml|ga|cf|gq|ru|cn|top|club|live|app|dev)\b/i,
];

export function validateDisplayName(rawName: string): { ok: boolean; error?: string } {
  const name = (rawName || "").trim();
  if (name.length < 3) return { ok: false, error: "Nama minimal 3 karakter." };
  if (name.length > 24) return { ok: false, error: "Nama maksimal 24 karakter." };
  if (!/^[A-Za-z0-9 ._-]+$/.test(name)) {
    return { ok: false, error: "Nama hanya boleh huruf, angka, spasi, titik, garis bawah, dan strip." };
  }
  if (/^[.\-_ ]|[.\-_ ]$/.test(name)) {
    return { ok: false, error: "Nama tidak boleh diawali/diakhiri spasi atau tanda baca." };
  }
  if (/\s{2,}/.test(name)) {
    return { ok: false, error: "Nama tidak boleh mengandung spasi ganda." };
  }
  for (const rx of LINK_PATTERNS) {
    if (rx.test(name)) {
      return { ok: false, error: "Nama tidak boleh mengandung link, URL, atau alamat domain." };
    }
  }
  if (name.includes("@")) {
    return { ok: false, error: "Nama tidak boleh mengandung karakter '@'." };
  }
  const lower = name.toLowerCase();
  const tokens = lower.split(/[\s._-]+/).filter(Boolean);
  for (const word of RESERVED_WORDS) {
    if (lower === word || tokens.includes(word)) {
      return { ok: false, error: `Nama tidak boleh menggunakan kata "${word}".` };
    }
  }
  return { ok: true };
}
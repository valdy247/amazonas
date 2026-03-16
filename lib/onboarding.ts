import type { AppLanguage } from "@/lib/i18n";

export type UserRole = "reviewer" | "provider";
export type StoredUserRole = UserRole | "tester";

export type ExperienceLevel = "new" | "growing" | "advanced";

export const INTEREST_KEYS = [
  "beauty",
  "tech",
  "home",
  "fashion",
  "pets",
  "babies",
  "cooking",
  "fitness",
  "books",
  "gaming",
  "travel",
  "health",
] as const;

export type InterestKey = (typeof INTEREST_KEYS)[number];

export const INTEREST_LABELS: Record<InterestKey, Record<AppLanguage, string>> = {
  beauty: { es: "Belleza", en: "Beauty" },
  tech: { es: "Tecnologia", en: "Technology" },
  home: { es: "Hogar", en: "Home" },
  fashion: { es: "Moda", en: "Fashion" },
  pets: { es: "Mascotas", en: "Pets" },
  babies: { es: "Bebes", en: "Babies" },
  cooking: { es: "Cocina", en: "Cooking" },
  fitness: { es: "Fitness", en: "Fitness" },
  books: { es: "Libros", en: "Books" },
  gaming: { es: "Videojuegos", en: "Gaming" },
  travel: { es: "Viajes", en: "Travel" },
  health: { es: "Salud", en: "Health" },
};

const LEGACY_INTEREST_MAP: Record<string, InterestKey> = {
  belleza: "beauty",
  beauty: "beauty",
  tecnologia: "tech",
  technology: "tech",
  tech: "tech",
  hogar: "home",
  home: "home",
  moda: "fashion",
  fashion: "fashion",
  mascotas: "pets",
  pets: "pets",
  bebes: "babies",
  babies: "babies",
  cocina: "cooking",
  cooking: "cooking",
  fitness: "fitness",
  libros: "books",
  books: "books",
  videojuegos: "gaming",
  gaming: "gaming",
  viajes: "travel",
  travel: "travel",
  salud: "health",
  health: "health",
};

export const INTEREST_OPTIONS = INTEREST_KEYS;

export const COUNTRY_OPTIONS = [
  "Estados Unidos",
  "Mexico",
  "Colombia",
  "Peru",
  "Argentina",
  "Chile",
  "Republica Dominicana",
] as const;

export const EXPERIENCE_LABELS: Record<ExperienceLevel, string> = {
  new: "Voy empezando",
  growing: "Ya tengo experiencia",
  advanced: "Busco oportunidades avanzadas",
};

function normalizeText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function normalizeInterestKey(value: unknown): InterestKey | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = normalizeText(value);
  if ((INTEREST_KEYS as readonly string[]).includes(normalized)) {
    return normalized as InterestKey;
  }

  return LEGACY_INTEREST_MAP[normalized] || null;
}

export function normalizeInterestKeys(values: unknown): InterestKey[] {
  if (!Array.isArray(values)) {
    return [];
  }

  const normalized = values
    .map((value) => normalizeInterestKey(value))
    .filter((value): value is InterestKey => Boolean(value));

  return Array.from(new Set(normalized));
}

export function getInterestLabel(value: string, language: AppLanguage) {
  const key = normalizeInterestKey(value);
  return key ? INTEREST_LABELS[key][language] : value;
}

export function getInterestOptions(language: AppLanguage) {
  return INTEREST_KEYS.map((key) => ({
    value: key,
    label: INTEREST_LABELS[key][language],
  }));
}

export function normalizeUserRole(role?: string | null): UserRole {
  if (role === "provider") return "provider";
  return "reviewer";
}

export function getRoleLabel(role?: string | null) {
  return normalizeUserRole(role) === "provider" ? "provider" : "reviewer";
}

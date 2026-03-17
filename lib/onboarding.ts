import type { AppLanguage } from "@/lib/i18n";

export type UserRole = "reviewer" | "provider";
export type StoredUserRole = UserRole | "tester";

export type ExperienceLevel = "new" | "growing" | "advanced";

export const INTEREST_KEYS = [
  "beauty",
  "electronics",
  "home_kitchen",
  "fashion",
  "baby",
  "pet_supplies",
  "books",
  "video_games",
  "health_household",
  "grocery",
  "office_products",
  "tools_home_improvement",
  "sports_outdoors",
  "automotive",
  "toys_games",
  "arts_crafts",
] as const;

export type InterestKey = (typeof INTEREST_KEYS)[number];

export const INTEREST_LABELS: Record<InterestKey, Record<AppLanguage, string>> = {
  beauty: { es: "Belleza", en: "Beauty" },
  electronics: { es: "Electronica", en: "Electronics" },
  home_kitchen: { es: "Hogar y cocina", en: "Home & Kitchen" },
  fashion: { es: "Moda", en: "Fashion" },
  baby: { es: "Bebe", en: "Baby" },
  pet_supplies: { es: "Mascotas", en: "Pet Supplies" },
  books: { es: "Libros", en: "Books" },
  video_games: { es: "Videojuegos", en: "Video Games" },
  health_household: { es: "Salud y hogar", en: "Health & Household" },
  grocery: { es: "Supermercado", en: "Grocery" },
  office_products: { es: "Oficina", en: "Office Products" },
  tools_home_improvement: { es: "Herramientas y mejoras del hogar", en: "Tools & Home Improvement" },
  sports_outdoors: { es: "Deportes y aire libre", en: "Sports & Outdoors" },
  automotive: { es: "Automotriz", en: "Automotive" },
  toys_games: { es: "Juguetes y juegos", en: "Toys & Games" },
  arts_crafts: { es: "Arte, manualidades y costura", en: "Arts, Crafts & Sewing" },
};

const LEGACY_INTEREST_MAP: Record<string, InterestKey> = {
  belleza: "beauty",
  beauty: "beauty",
  tecnologia: "electronics",
  technology: "electronics",
  tech: "electronics",
  electronics: "electronics",
  electronica: "electronics",
  hogar: "home_kitchen",
  home: "home_kitchen",
  "home kitchen": "home_kitchen",
  cocina: "home_kitchen",
  cooking: "home_kitchen",
  moda: "fashion",
  fashion: "fashion",
  bebe: "baby",
  bebes: "baby",
  baby: "baby",
  babies: "baby",
  mascotas: "pet_supplies",
  pets: "pet_supplies",
  "pet supplies": "pet_supplies",
  libros: "books",
  books: "books",
  videojuegos: "video_games",
  gaming: "video_games",
  "video games": "video_games",
  salud: "health_household",
  health: "health_household",
  household: "health_household",
  supermercado: "grocery",
  grocery: "grocery",
  oficina: "office_products",
  "office products": "office_products",
  herramientas: "tools_home_improvement",
  tools: "tools_home_improvement",
  "home improvement": "tools_home_improvement",
  fitness: "sports_outdoors",
  deportes: "sports_outdoors",
  sports: "sports_outdoors",
  outdoors: "sports_outdoors",
  automotriz: "automotive",
  automotive: "automotive",
  juguetes: "toys_games",
  toys: "toys_games",
  games: "toys_games",
  arte: "arts_crafts",
  manualidades: "arts_crafts",
  crafts: "arts_crafts",
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

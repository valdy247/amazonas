export type UserRole = "reviewer" | "provider";
export type StoredUserRole = UserRole | "tester";

export type ExperienceLevel = "new" | "growing" | "advanced";

export const INTEREST_OPTIONS = [
  "Belleza",
  "Tecnologia",
  "Hogar",
  "Moda",
  "Mascotas",
  "Bebes",
  "Cocina",
  "Fitness",
  "Libros",
  "Videojuegos",
  "Viajes",
  "Salud",
] as const;

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

export function normalizeUserRole(role?: string | null): UserRole {
  if (role === "provider") return "provider";
  return "reviewer";
}

export function getRoleLabel(role?: string | null) {
  return normalizeUserRole(role) === "provider" ? "provider" : "reviewer";
}

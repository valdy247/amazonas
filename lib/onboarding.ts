export type UserRole = "tester" | "provider";

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

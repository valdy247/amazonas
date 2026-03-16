export const APP_LANGUAGES = ["es", "en"] as const;

export type AppLanguage = (typeof APP_LANGUAGES)[number];

export const LANGUAGE_OPTIONS: Array<{ value: AppLanguage; label: string }> = [
  { value: "es", label: "Espanol" },
  { value: "en", label: "English" },
];

export function normalizeLanguage(value: unknown): AppLanguage {
  return value === "en" ? "en" : "es";
}

export function languageToLocale(language: AppLanguage) {
  return language === "en" ? "en-US" : "es-ES";
}

export function getLanguageLabel(language: AppLanguage) {
  return language === "en" ? "English" : "Espanol";
}

export const authCopy = {
  es: {
    signupTitle: "Crear cuenta",
    signinTitle: "Iniciar sesion",
    createdOk: "Tu cuenta se ha creado satisfactoriamente. Ahora inicia sesion.",
    identityTitle: "Revisa bien tu informacion antes de continuar",
    identityBody:
      "Tu identidad sera validada mas adelante con un documento oficial. Es importante que escribas tu nombre y apellidos tal como aparecen en tu documento para evitar retrasos en la verificacion.",
    firstName: "Nombre",
    lastName: "Apellidos",
    phone: "Telefono",
    email: "Correo",
    password: "Contrasena",
    confirmPassword: "Confirmar contrasena",
    language: "Idioma",
    identityConfirmation:
      "Confirmo que mi nombre y apellidos estan escritos correctamente y coinciden con mi documento oficial.",
    createAccount: "Crear cuenta",
    enter: "Entrar",
    processing: "Procesando...",
  },
  en: {
    signupTitle: "Create account",
    signinTitle: "Sign in",
    createdOk: "Your account has been created successfully. Now sign in.",
    identityTitle: "Review your information carefully before continuing",
    identityBody:
      "Your identity will be verified later with an official document. It is important to enter your first and last name exactly as they appear on your document to avoid delays.",
    firstName: "First name",
    lastName: "Last name",
    phone: "Phone",
    email: "Email",
    password: "Password",
    confirmPassword: "Confirm password",
    language: "Language",
    identityConfirmation:
      "I confirm that my first and last name are correct and match my official document.",
    createAccount: "Create account",
    enter: "Enter",
    processing: "Processing...",
  },
} as const;

export const profileCopy = {
  es: {
    language: "Idioma principal",
    languageHelp: "Este idioma se usara para mostrar mensajes traducidos cuando hables con usuarios que usan otro idioma.",
  },
  en: {
    language: "Primary language",
    languageHelp: "This language will be used to show translated messages when you chat with users who use a different language.",
  },
} as const;

export const chatCopy = {
  es: {
    translatedFromEnglish: "Traducido del ingles",
    translatedFromSpanish: "Traducido del espanol",
    viewOriginal: "Ver original",
    hideOriginal: "Ocultar original",
    copyOriginal: "Copiar original",
    copied: "Original copiado",
    imageReceived: "Te enviaron una imagen",
    tapToOpen: "Toca para abrir el chat",
    noMessages: "Aun no hay mensajes. Escribe el primero.",
    writeMessage: "Escribe un mensaje...",
  },
  en: {
    translatedFromEnglish: "Translated from English",
    translatedFromSpanish: "Translated from Spanish",
    viewOriginal: "View original",
    hideOriginal: "Hide original",
    copyOriginal: "Copy original",
    copied: "Original copied",
    imageReceived: "You received an image",
    tapToOpen: "Tap to open the chat",
    noMessages: "There are no messages yet. Write the first one.",
    writeMessage: "Write a message...",
  },
} as const;

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

export const navigationCopy = {
  es: {
    openMessages: "Abrir mensajes",
    closeMenu: "Cerrar menu",
    openMenu: "Abrir menu",
    goToDashboard: "Ir al panel",
    editProfile: "Editar perfil",
    createAccount: "Crear cuenta",
    signIn: "Iniciar sesion",
    adminPanel: "Panel admin",
    signOut: "Cerrar sesion",
  },
  en: {
    openMessages: "Open messages",
    closeMenu: "Close menu",
    openMenu: "Open menu",
    goToDashboard: "Go to dashboard",
    editProfile: "Edit profile",
    createAccount: "Create account",
    signIn: "Sign in",
    adminPanel: "Admin panel",
    signOut: "Sign out",
  },
} as const;

export const dashboardCopy = {
  es: {
    greeting: "Hola",
    home: "Inicio",
    providerContacts: "Contactos de proveedores",
    messages: "Mensajes",
    welcomeBadge: "Bienvenido",
    welcomeTitle: "Ya eres parte de la familia Amazona Review",
    welcomeBody:
      "Felicidades por activar tu acceso. Desde ahora compartiremos contigo proveedores confiables y tu perfil quedara visible para que proveedores compatibles puedan encontrarte y contactarte.",
    trustedProvidersTitle: "Proveedores confiables",
    trustedProvidersBody:
      "Estaremos agregando proveedores nuevos constantemente y podras ver con claridad cuando un proveedor este verificado.",
    visibleProfileTitle: "Tu perfil ya esta visible",
    visibleProfileBody:
      "Tu perfil verificado ayudara a que los proveedores confien mas rapido en ti y puedan avanzar contigo sin tanta friccion en la colaboracion.",
    safeContactTitle: "Contacto mas seguro",
    safeContactBody:
      "Puedes hablar con proveedores desde la pagina sin compartir tus datos personales y decidir con calma como quieres que te contacten.",
    activateMembershipTitle: "Activar membresia",
    stepOne: "Paso 1 del recorrido",
    squareTestingBody:
      "Square esta deshabilitado durante pruebas. Puedes marcar manualmente tu acceso para seguir validando el flujo.",
    squareBody:
      "Usa Square para pagar tu acceso. Cuando Square confirme el pago, tu membresia se activara automaticamente.",
    squareProcessing:
      "Regresaste desde Square. Estamos validando tu pago y activaremos tu membresia en cuanto llegue el webhook.",
    payWithSquare: "Pagar con Square",
    idVerificationTitle: "Verificacion de ID",
    stepTwo: "Paso 2 del recorrido",
    kycTestingBody:
      "La verificacion de ID real tambien esta pausada en pruebas. Puedes aprobarla o reiniciarla manualmente para validar el recorrido.",
    nameReviewBody:
      "Detectamos una diferencia entre el nombre de tu perfil y el nombre validado con tu documento. Nuestro equipo va a revisar tu informacion con cuidado y te informara en breve.",
    veriffBody:
      "Tu membresia ya esta activa. Ahora completa tu verificacion de identidad con Veriff para desbloquear contactos y dejar tu perfil listo para colaborar.",
    veriffProcessing:
      "Regresaste desde Veriff. Estamos validando tu verificacion y activaremos el acceso completo en cuanto llegue la confirmacion.",
    manualReviewNotice:
      "Gracias por completar tu verificacion. Como algunos datos no coinciden del todo, nuestro equipo hara una revision manual y te avisara muy pronto.",
    verifyWithVeriff: "Verificar con Veriff",
    exploreProviders: "Explorar proveedores",
    contactsTitle: "Contactos de proveedores",
    contactsBody: "Toca un proveedor para elegir la via de contacto disponible.",
    accessOpen: "Acceso abierto",
    accessBlocked: "Acceso bloqueado",
    blockedTitle: "Debes activar tu acceso antes de ver contactos",
    blockedBody:
      "Completa el pago con Square y tu verificacion de ID con Veriff para desbloquear los contactos de proveedores confiables.",
    paymentActive: "1. Pago activo",
    idStatus: "2. Verificacion de ID",
    currentStatus: "Estado actual",
    backHome: "Volver al inicio",
    activeConversations: "Conversaciones activas",
    providerMessagesDescription:
      "Selecciona categoria, agrega el nombre del producto y habla con el resenador desde un solo lugar.",
    reviewerMessagesDescription: "Habla con proveedores desde aqui y comparte imagenes cuando lo necesites.",
    emptyConversationsTitle: "Todavia no tienes conversaciones activas",
    providerEmptyConversationsBody:
      "Contacta a un resenador desde la pagina y la conversacion aparecera aqui al instante.",
    reviewerEmptyConversationsBody:
      "Cuando un proveedor te escriba dentro de la plataforma, la conversacion aparecera aqui.",
    providerOpenChats: "Chats abiertos",
    providerNewMessages: "Mensajes nuevos",
    providerConversations: "Conversaciones",
  },
  en: {
    greeting: "Hello",
    home: "Home",
    providerContacts: "Provider contacts",
    messages: "Messages",
    welcomeBadge: "Welcome",
    welcomeTitle: "You are now part of the Amazona Review family",
    welcomeBody:
      "Congratulations on activating your access. From now on, we will share trusted providers with you and your profile will stay visible so compatible providers can find and contact you.",
    trustedProvidersTitle: "Trusted providers",
    trustedProvidersBody:
      "We will keep adding new providers constantly, and you will be able to clearly see when a provider is verified.",
    visibleProfileTitle: "Your profile is now visible",
    visibleProfileBody:
      "Your verified profile will help providers trust you faster and move forward with you with less friction in the collaboration.",
    safeContactTitle: "Safer contact",
    safeContactBody:
      "You can talk to providers through the platform without sharing personal details and decide calmly how you want to be contacted.",
    activateMembershipTitle: "Activate membership",
    stepOne: "Step 1 of the journey",
    squareTestingBody:
      "Square is disabled during testing. You can mark your access manually to keep validating the flow.",
    squareBody:
      "Use Square to pay for your access. As soon as Square confirms the payment, your membership will activate automatically.",
    squareProcessing:
      "You returned from Square. We are validating your payment and will activate your membership as soon as the webhook arrives.",
    payWithSquare: "Pay with Square",
    idVerificationTitle: "ID verification",
    stepTwo: "Step 2 of the journey",
    kycTestingBody:
      "Real ID verification is also paused in testing. You can approve or reset it manually to validate the journey.",
    nameReviewBody:
      "We detected a difference between your profile name and the name validated from your document. Our team will review your information carefully and get back to you shortly.",
    veriffBody:
      "Your membership is already active. Now complete your identity verification with Veriff to unlock contacts and leave your profile ready to collaborate.",
    veriffProcessing:
      "You returned from Veriff. We are validating your verification and will activate full access as soon as confirmation arrives.",
    manualReviewNotice:
      "Thank you for completing your verification. Since some details do not fully match, our team will do a manual review and get back to you very soon.",
    verifyWithVeriff: "Verify with Veriff",
    exploreProviders: "Explore providers",
    contactsTitle: "Provider contacts",
    contactsBody: "Tap a provider to choose an available contact method.",
    accessOpen: "Access open",
    accessBlocked: "Access locked",
    blockedTitle: "You need to activate your access before viewing contacts",
    blockedBody:
      "Complete your Square payment and your ID verification with Veriff to unlock trusted provider contacts.",
    paymentActive: "1. Active payment",
    idStatus: "2. ID verification",
    currentStatus: "Current status",
    backHome: "Back to home",
    activeConversations: "Active conversations",
    providerMessagesDescription:
      "Choose a category, add the product name and speak with the reviewer from one place.",
    reviewerMessagesDescription: "Talk to providers from here and share images whenever you need.",
    emptyConversationsTitle: "You do not have active conversations yet",
    providerEmptyConversationsBody:
      "Contact a reviewer through the platform and the conversation will appear here instantly.",
    reviewerEmptyConversationsBody:
      "When a provider writes to you inside the platform, the conversation will appear here.",
    providerOpenChats: "Open chats",
    providerNewMessages: "New messages",
    providerConversations: "Conversations",
  },
} as const;

export type ContactRequestIntent = "test" | "launch" | "ongoing";
export type ContactRequestTimeline = "this_week" | "this_month" | "flexible";
export type ContactRequestChannel = "platform" | "whatsapp" | "instagram";

export type ContactRequestData = {
  productName: string;
  category: string;
  intent: ContactRequestIntent;
  timeline: ContactRequestTimeline;
  preferredChannel: ContactRequestChannel;
  note: string;
};

export const CONTACT_REQUEST_INTENT_OPTIONS: Array<{ value: ContactRequestIntent; label: string }> = [
  { value: "test", label: "Prueba puntual" },
  { value: "launch", label: "Lanzamiento" },
  { value: "ongoing", label: "Colaboracion recurrente" },
];

export const CONTACT_REQUEST_TIMELINE_OPTIONS: Array<{ value: ContactRequestTimeline; label: string }> = [
  { value: "this_week", label: "Esta semana" },
  { value: "this_month", label: "Este mes" },
  { value: "flexible", label: "Flexible" },
];

export const CONTACT_REQUEST_CHANNEL_OPTIONS: Array<{ value: ContactRequestChannel; label: string }> = [
  { value: "platform", label: "Dentro de la plataforma" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "instagram", label: "Instagram" },
];

export const DEFAULT_CONTACT_REQUEST_DATA: ContactRequestData = {
  productName: "",
  category: "",
  intent: "test",
  timeline: "this_week",
  preferredChannel: "platform",
  note: "",
};

function safeString(value: unknown) {
  return typeof value === "string" ? value : "";
}

export function normalizeContactRequestData(value: unknown): ContactRequestData {
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const intent = source.intent;
  const timeline = source.timeline;
  const preferredChannel = source.preferredChannel;

  return {
    productName: safeString(source.productName),
    category: safeString(source.category),
    intent: intent === "launch" || intent === "ongoing" ? intent : "test",
    timeline: timeline === "this_month" || timeline === "flexible" ? timeline : "this_week",
    preferredChannel: preferredChannel === "whatsapp" || preferredChannel === "instagram" ? preferredChannel : "platform",
    note: safeString(source.note),
  };
}

export function buildContactRequestMessage(data: ContactRequestData) {
  const intentLabel = CONTACT_REQUEST_INTENT_OPTIONS.find((item) => item.value === data.intent)?.label || data.intent;
  const timelineLabel = CONTACT_REQUEST_TIMELINE_OPTIONS.find((item) => item.value === data.timeline)?.label || data.timeline;
  const channelLabel = CONTACT_REQUEST_CHANNEL_OPTIONS.find((item) => item.value === data.preferredChannel)?.label || data.preferredChannel;

  return [
    data.productName ? `Producto: ${data.productName}` : null,
    data.category ? `Categoria: ${data.category}` : null,
    `Objetivo: ${intentLabel}`,
    `Tiempo: ${timelineLabel}`,
    `Canal preferido: ${channelLabel}`,
    data.note ? `Nota: ${data.note}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export function getRequestStatusLabel(status: string) {
  switch (status) {
    case "sent":
      return "Enviada";
    case "read":
      return "Vista";
    case "accepted":
      return "Aceptada";
    case "declined":
      return "No ahora";
    default:
      return status;
  }
}

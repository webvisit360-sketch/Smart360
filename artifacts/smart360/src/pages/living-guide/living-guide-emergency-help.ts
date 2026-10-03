import { isGuideLanguage, type GuideLanguage } from "@workspace/guide-languages";
import { extendCatalog } from "../../lib/guest-catalogs";
export type EmergencyHelpLanguage = GuideLanguage;

type EmergencyHelpCopy = {
  title: string;
  emergencyDescription: string;
  police: string;
};

const EMERGENCY_HELP_COPY = extendCatalog<EmergencyHelpCopy>({
  sl: {
    title: "Pomoč in nujni primeri",
    emergencyDescription:
      "Klic v sili — reševalci, gasilci, nesreče in poškodbe",
    police: "Policija",
  },
  en: {
    title: "Help and emergencies",
    emergencyDescription:
      "Emergency — ambulance, fire brigade, accidents and injuries",
    police: "Police",
  },
  de: {
    title: "Hilfe und Notfälle",
    emergencyDescription:
      "Notruf — Rettungsdienst, Feuerwehr, Unfälle und Verletzungen",
    police: "Polizei",
  },
  it: {
    title: "Aiuto ed emergenze",
    emergencyDescription:
      "Emergenza — soccorso sanitario, vigili del fuoco, incidenti e ferite",
    police: "Polizia",
  },
});

export type EmergencyHelpContact = {
  id: string;
  title: string;
  phone: string;
  description?: string;
  fixed: boolean;
};

function visible(rows: any[] | null | undefined): any[] {
  return (rows ?? []).filter((row) => row?.isVisible !== false);
}

export function emergencyHelpLanguage(language: string): EmergencyHelpLanguage {
  const normalized = language.toLowerCase().split("-")[0];
  return isGuideLanguage(normalized) ? normalized : "en";
}

export function sanitizeEmergencyPhone(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  const hasInternationalPrefix = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 6 || digits.length > 15) return null;
  return `${hasInternationalPrefix ? "+" : ""}${digits}`;
}

export function buildEmergencyHelpCategory(
  sections: any[] | null | undefined,
  language: string,
) {
  const copy = EMERGENCY_HELP_COPY[emergencyHelpLanguage(language)];
  const operatorCategory = visible(sections)
    .flatMap((section) => visible(section?.categories))
    .find(
      (category) =>
        category?.key === "operator-emergency-help" &&
        category?.layout === "help",
    );
  const operatorContacts: EmergencyHelpContact[] = visible(
    operatorCategory?.items,
  ).flatMap((item) => {
    const phone = sanitizeEmergencyPhone(item?.phone);
    const title =
      typeof item?.title === "string" ? item.title.trim() : "";
    return phone && title
      ? [
          {
            id: String(item.id ?? `${title}-${phone}`),
            title,
            phone,
            fixed: false,
          },
        ]
      : [];
  });

  return {
    id: "__emergency-help",
    key: "operator-emergency-help",
    layout: "help",
    label: copy.title,
    isVisible: true,
    items: [
      {
        id: "__emergency-112",
        title: "112",
        phone: "112",
        description: copy.emergencyDescription,
        fixed: true,
      },
      {
        id: "__emergency-113",
        title: "113",
        phone: "113",
        description: copy.police,
        fixed: true,
      },
      ...operatorContacts,
    ] satisfies EmergencyHelpContact[],
  };
}
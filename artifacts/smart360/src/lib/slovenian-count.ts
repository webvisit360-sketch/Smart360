const slovenePluralRules = new Intl.PluralRules("sl");

type SloveneForms = {
  one: string;
  two: string;
  few: string;
  other: string;
} & Partial<Record<Intl.LDMLPluralRule, string>>;

export function formatSlovenianCount(count: number, forms: SloveneForms): string {
  return `${count} ${forms[slovenePluralRules.select(count)] ?? forms.other}`;
}

export const ORDER_COUNT_FORMS: SloveneForms = {
  one: "naročilo",
  two: "naročili",
  few: "naročila",
  other: "naročil",
};

export const MESSAGE_COUNT_FORMS: SloveneForms = {
  one: "sporočilo",
  two: "sporočili",
  few: "sporočila",
  other: "sporočil",
};
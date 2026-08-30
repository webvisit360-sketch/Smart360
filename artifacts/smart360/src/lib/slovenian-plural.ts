export type SlovenianCountForms = Readonly<{
  one: string;
  two: string;
  few: string;
  other: string;
}>;

export function slovenianCountForm(
  count: number,
  forms: SlovenianCountForms,
): string {
  const normalizedCount = Math.max(0, Math.trunc(count));
  const lastTwoDigits = normalizedCount % 100;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return forms.other;

  switch (normalizedCount % 10) {
    case 1:
      return forms.one;
    case 2:
      return forms.two;
    case 3:
    case 4:
      return forms.few;
    default:
      return forms.other;
  }
}

export function formatSlovenianCount(
  count: number,
  forms: SlovenianCountForms,
): string {
  const normalizedCount = Math.max(0, Math.trunc(count));
  return `${normalizedCount} ${slovenianCountForm(normalizedCount, forms)}`;
}
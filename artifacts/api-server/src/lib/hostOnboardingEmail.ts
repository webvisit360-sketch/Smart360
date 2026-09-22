import { deliverResend } from "./resendDelivery";
import { p as par, renderEmail, rows } from "./emailTemplate";

const FROM_EMAIL = "info@webvisit360.com";
export const HOST_ONBOARDING_OPERATOR_EMAIL = "info@webvisit360.com";

export type HostOnboardingEmailResult =
  | { ok: true; providerMessageId: string | null }
  | { ok: false; error: string };

type Delivery = (
  body: ReturnType<typeof buildHostOnboardingEmail>,
  idempotencyKey: string,
) => Promise<HostOnboardingEmailResult>;

let deliveryOverride: Delivery | null = null;

/** Tests must install an override; focused onboarding tests never call Resend. */
export function _setHostOnboardingDeliveryOverride(delivery: Delivery | null): void {
  deliveryOverride = delivery;
}

export function buildHostOnboardingEmail(propertyName: string, tenantId: string, round: number) {
  const subject = `Oddan obrazec gostitelja · ${propertyName}`;
  const { html, text } = renderEmail({
    theme: "welcome-cgp",
    subject,
    preheader: "Gostitelj je oddal obrazec za pripravo vodnika",
    brand: "Smart360",
    title: "Oddan obrazec gostitelja",
    blocks: [
      par("Gostitelj je oddal obrazec za pripravo vodnika."),
      rows([
        { label: "Nastanitev", value: propertyName },
        { label: "Krog", value: String(round) },
        { label: "Nastanitev ID", value: tenantId },
      ]),
      par(
        "Preglejte predloge in fotografije v upravljanju Smart360. Nič ni bilo objavljeno.",
      ),
    ],
    footerLines: [
      "Smart360 · Agencija Sinhron d.o.o.",
      "Tomšičeva ulica 12, SI-2310 Slovenska Bistrica · info@webvisit360.com",
    ],
  });
  return {
    from: `Smart360 <${FROM_EMAIL}>`,
    to: [HOST_ONBOARDING_OPERATOR_EMAIL],
    subject,
    text,
    html,
  };
}

export async function sendHostOnboardingEmail(
  propertyName: string,
  tenantId: string,
  round: number,
  submissionId: string,
): Promise<HostOnboardingEmailResult> {
  const body = buildHostOnboardingEmail(propertyName, tenantId, round);
  const idempotencyKey = `host-onboarding-${submissionId}`;
  if (deliveryOverride) return deliveryOverride(body, idempotencyKey);
  const result = await deliverResend(body, { idempotencyKey });
  return result.ok
    ? { ok: true, providerMessageId: result.providerMessageId }
    : { ok: false, error: result.error.message };
}

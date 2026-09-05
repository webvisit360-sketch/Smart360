import assert from "node:assert/strict";
import { test } from "node:test";
import {
  notificationWhatsappPhoneForSave,
  selectNotificationChannel,
} from "../lib/notification-channel";

test("WhatsApp never appears committed while configuration is locked", () => {
  assert.deepEqual(
    selectNotificationChannel("email", "whatsapp", false, "+38640123456"),
    { channel: "email", error: "WhatsApp še ni nastavljen" },
  );
});

test("WhatsApp never appears committed before the phone is valid E.164", () => {
  assert.equal(
    selectNotificationChannel("email", "whatsapp", true, "040 123 456").channel,
    "email",
  );
  assert.equal(
    selectNotificationChannel("email", "whatsapp", true, "+38640123456").channel,
    "whatsapp",
  );
});

test("blank or partial phone input is omitted and cannot delete the saved value", () => {
  assert.equal(notificationWhatsappPhoneForSave(""), undefined);
  assert.equal(notificationWhatsappPhoneForSave("+38640"), undefined);
  assert.equal(
    notificationWhatsappPhoneForSave("  +38640123456  "),
    "+38640123456",
  );
});
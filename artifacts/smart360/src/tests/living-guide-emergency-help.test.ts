import assert from "node:assert/strict";
import test from "node:test";
import {
  buildEmergencyHelpCategory,
  sanitizeEmergencyPhone,
} from "../pages/living-guide/living-guide-emergency-help";

const expectedCopy = {
  sl: [
    "Pomoč in nujni primeri",
    "Klic v sili — reševalci, gasilci, nesreče in poškodbe",
    "Policija",
  ],
  en: [
    "Help and emergencies",
    "Emergency — ambulance, fire brigade, accidents and injuries",
    "Police",
  ],
  de: [
    "Hilfe und Notfälle",
    "Notruf — Rettungsdienst, Feuerwehr, Unfälle und Verletzungen",
    "Polizei",
  ],
  it: [
    "Aiuto ed emergenze",
    "Emergenza — soccorso sanitario, vigili del fuoco, incidenti e ferite",
    "Polizia",
  ],
};

test("emergency help always contains immutable localized 112 and 113 contacts", () => {
  for (const [language, [title, description112, description113]] of Object.entries(
    expectedCopy,
  )) {
    const category = buildEmergencyHelpCategory([], language);
    assert.equal(category.label, title);
    assert.deepEqual(
      category.items.map((item) => ({
        phone: item.phone,
        description: item.description,
      })),
      [
        { phone: "112", description: description112 },
        { phone: "113", description: description113 },
      ],
    );
  }
});

test("emergency help uses only visible operator category contacts and valid sanitized phones", () => {
  const category = buildEmergencyHelpCategory(
    [
      {
        isVisible: true,
        categories: [
          {
            key: "operator-emergency-help",
            layout: "help",
            isVisible: true,
            items: [
              {
                id: "host",
                title: "Translated host",
                phone: "+386 (40) 123-456",
                isVisible: true,
              },
              {
                id: "hidden",
                title: "Hidden",
                phone: "040 000 000",
                isVisible: false,
              },
              { id: "invalid", title: "Invalid", phone: "123" },
            ],
          },
          {
            key: "some-other-help",
            items: [{ id: "wrong", title: "Wrong", phone: "040 999 999" }],
          },
        ],
      },
    ],
    "en",
  );

  assert.deepEqual(category.items.slice(2), [
    {
      id: "host",
      title: "Translated host",
      phone: "+38640123456",
      fixed: false,
    },
  ]);
  assert.equal(sanitizeEmergencyPhone("01 234 56 78"), "012345678");
  assert.equal(sanitizeEmergencyPhone("not a phone"), null);
});

test("guest shell routes every help footer to the shared draggable DetailView", async () => {
  const source = await import("node:fs/promises").then(({ readFile }) =>
    readFile(
      new URL("../pages/living-guide/LivingGuideGuestShell.tsx", import.meta.url),
      "utf8",
    ),
  );
  assert.match(source, /navigateDetail\(`\/\$\{slug\}\/help`\)/);
  assert.match(source, /layout === "help"[\s\S]*?<EmergencyHelpTemplate/);
  assert.match(source, /useDraggableDetailSheet\(detailViewRef, onBack\)/);
  assert.doesNotMatch(source, /disabled=\{!helpCategory\}/);
});
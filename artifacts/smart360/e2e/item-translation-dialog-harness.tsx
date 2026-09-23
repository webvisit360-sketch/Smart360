import { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { upsertTranslation } from "@workspace/api-client-react";
import { ItemDialog } from "../src/components/admin/content-editor";
import "../src/index.css";

type FixtureIndex = {
  tenantId: string;
  itemIds: { house: string };
};

type FixtureItem = {
  tenantId: string;
  item: {
    id: string;
    categoryId: string;
    title?: string | null;
    body?: string | null;
    media: Array<{ id: string; url: string; alt?: string | null; position: number }>;
    [key: string]: unknown;
  };
};

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

async function json<T>(path: string): Promise<T> {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return response.json() as Promise<T>;
}

async function seedPopulatedTranslations(itemId: string) {
  for (const [lang, title, body] of [
    ["en", "Existing English title", "<p>Existing English description.</p>"],
    ["de", "Bestehender deutscher Titel", "<p>Bestehende deutsche Beschreibung.</p>"],
    ["it", "Titolo italiano esistente", "<p>Descrizione italiana esistente.</p>"],
  ] as const) {
    await upsertTranslation({ model: "item", recordId: itemId, field: "title", lang, value: title });
    await upsertTranslation({ model: "item", recordId: itemId, field: "body", lang, value: body });
  }
}

function Harness() {
  const [open, setOpen] = useState(false);
  const [fixture, setFixture] = useState<FixtureItem | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async (seed = false) => {
    setError("");
    try {
      const index = await json<FixtureIndex>("/__translation-fixture/fixture");
      if (seed) await seedPopulatedTranslations(index.itemIds.house);
      setFixture(await json<FixtureItem>(
        `/__translation-fixture/items/${encodeURIComponent(index.itemIds.house)}`,
      ));
      setOpen(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Fixture load failed");
    }
  }, []);

  useEffect(() => {
    void load(new URLSearchParams(location.search).get("seed") === "1");
  }, [load]);

  return (
    <main className="min-h-screen bg-[#F4F6F2] p-6">
      <div className="mx-auto max-w-5xl rounded-2xl bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[#157347]">
              Disposable real-route fixture
            </p>
            <h1 className="text-xl font-extrabold">Prevodi vnosa</h1>
          </div>
          <button
            type="button"
            className="rounded-full bg-[#157347] px-4 py-2 font-bold text-white"
            onClick={() => {
              setOpen(false);
              void load(false);
            }}
          >
            Zapri in ponovno odpri
          </button>
        </div>
        {error && <p role="alert" className="text-red-700">{error}</p>}
        {open && fixture && (
          <ItemDialog
            mode="edit"
            tenantId={fixture.tenantId}
            categoryId={fixture.item.categoryId}
            item={fixture.item as never}
            onDone={() => setOpen(false)}
          />
        )}
        {!open && fixture && (
          <button type="button" onClick={() => void load(false)}>Ponovno odpri</button>
        )}
      </div>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <Harness />
  </QueryClientProvider>,
);
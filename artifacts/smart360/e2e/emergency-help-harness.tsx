import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  previewTenantPublication,
  updateTenant,
  type TenantPublicationPreview,
} from "@workspace/api-client-react";
import { EmergencyContactsEditor } from "../src/components/admin/emergency-contacts-editor";
import { PublishConfirmationDialog } from "../src/components/admin/publish-confirmation-dialog";
import { AdminButton as Button } from "../src/components/ui/button";
import { Toaster } from "../src/components/ui/toaster";
import "../src/index.css";

type Fixture = { tenantId: string; tenantSlug: string };

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

async function fixtureJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { cache: "no-store", ...init });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error || `${path}: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

function Harness() {
  const [fixture, setFixture] = useState<Fixture | null>(null);
  const [preview, setPreview] = useState<TenantPublicationPreview | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [published, setPublished] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const initialize = await fetch("/__emergency-fixture/emergency-initialize", {
          method: "POST",
          cache: "no-store",
        });
        // A 409 means this same disposable fixture already has browser edits.
        // Resume it without reinitializing or touching its baseline snapshot.
        if (!initialize.ok && initialize.status !== 409) {
          const body = await initialize.json().catch(() => ({})) as { error?: string };
          throw new Error(body.error || `Fixture initialization: ${initialize.status}`);
        }
        setFixture(await fixtureJson<Fixture>("/__emergency-fixture/fixture"));
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Fixture initialization failed");
      }
    })();
  }, []);

  const prepare = async () => {
    if (!fixture) return;
    setDialogOpen(true);
    setLoadingPreview(true);
    setError("");
    try {
      setPreview(await previewTenantPublication(fixture.tenantId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Publication preview failed");
    } finally {
      setLoadingPreview(false);
    }
  };

  const publish = async () => {
    if (!fixture || !preview) return;
    setPublishing(true);
    setError("");
    try {
      await updateTenant(fixture.tenantId, {
        isPublished: true,
        publishNow: true,
        publishToken: preview.token,
      });
      setPublished(true);
      setDialogOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Publication failed");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#F4F6F2] p-6">
      <div className="mx-auto max-w-4xl rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-widest text-[#157347]">
          Disposable real-route fixture
        </p>
        <h1 className="mt-1 text-2xl font-extrabold">Pomoč in nujni primeri</h1>
        {error && <p role="alert" className="my-4 rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}
        {!fixture && !error && <p className="mt-4">Pripravljam fixture …</p>}
        {fixture && (
          <>
            <section className="mt-6">
              <EmergencyContactsEditor tenantId={fixture.tenantId} />
            </section>
            <div className="mt-6 flex items-center gap-3 border-t pt-5">
              <Button type="button" onClick={() => void prepare()}>
                Objavi spremembe
              </Button>
              {published && (
                <a
                  data-testid="emergency-fixture-guest-link"
                  className="font-semibold text-[#157347] underline"
                  href={`/${fixture.tenantSlug}?lang=de`}
                >
                  Odpri dejanski Living Guide (DE)
                </a>
              )}
            </div>
          </>
        )}
      </div>
      <PublishConfirmationDialog
        open={dialogOpen}
        preview={preview}
        loading={loadingPreview}
        publishing={publishing}
        error={error || null}
        onOpenChange={setDialogOpen}
        onConfirm={() => void publish()}
        onRetry={() => void prepare()}
      />
      <Toaster />
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <Harness />
  </QueryClientProvider>,
);
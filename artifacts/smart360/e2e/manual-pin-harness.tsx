import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { KreatorProposalQueue } from "../src/components/admin/kreator-proposal-queue";
import { ContentEditor, EditDialog, ItemDialog } from "../src/components/admin/content-editor";
import { KreatorOriginConfirmation } from "../src/components/admin/kreator-origin-confirmation";
import { adminPlaceTargetTab } from "../src/lib/manual-pin-feedback";
import "../src/index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

const exploreCategory = {
  id: "manual-pin-explore",
  name: "Izleti in znamenitosti",
  label: "Izleti in znamenitosti",
  key: "trips",
  sectionKey: "explore",
};

function Harness() {
  const [placeDialogOpen, setPlaceDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"content" | "distances" | "kreator">(
    () => adminPlaceTargetTab(window.location.search) ?? "kreator",
  );
  React.useEffect(() => {
    const navigate = (event: Event) => {
      const tab = (event as CustomEvent<{ tab: string }>).detail?.tab;
      if (tab === "content" || tab === "kreator") setActiveTab(tab);
    };
    window.addEventListener("admin-place-navigate", navigate);
    return () => window.removeEventListener("admin-place-navigate", navigate);
  }, []);

  return (
    <main className="mx-auto max-w-[960px] p-6">
      <div data-testid="active-admin-tab">{activeTab}</div>
      <div className="mb-6 flex justify-end">
        <button
          type="button"
          className="rounded-lg bg-[#157347] px-4 py-2 font-bold text-white"
          onClick={() => setPlaceDialogOpen(true)}
        >
          Dodaj kraj
        </button>
      </div>
      {activeTab === "kreator" && <KreatorProposalQueue
        tenantId="manual-pin-test"
        tenantName="Testna namestitev"
        origin={{ latitude: 46.31, longitude: 14.91 }}
      />}
      {activeTab === "distances" && <section data-testid="distance-review-fixture">Razdalje — brez urejevalnika vsebine</section>}
      {activeTab === "content" && new URLSearchParams(window.location.search).has("existingPlace") && <section data-testid="existing-place-fixture">
        <ContentEditor tenantId="manual-pin-test" sections={[{
          id: "existing-section", key: "explore", title: "Okolica", icon: "map-pin",
          isVisible: true, position: 0,
          categories: [{
            id: "hidden-category", label: "Naravna dediščina", icon: "map-pin",
            layout: "default", exploreGroup: "trips", isVisible: true, position: 0,
            items: [{
              id: "existing-hidden-item", title: "Krajinski park Logarska dolina",
              isVisible: false, position: 0, media: [],
            }],
          }],
        }]} />
      </section>}
      <section data-testid="origin-confirmation-harness" className="mt-8">
        <KreatorOriginConfirmation
          tenant={{ id: "manual-pin-test", name: "Testna namestitev" }}
        />
      </section>
      <EditDialog
        open={placeDialogOpen}
        onOpenChange={setPlaceDialogOpen}
        title="Dodaj kraj"
      >
        <ItemDialog
          mode="create"
          tenantId="manual-pin-test"
          categoryId={exploreCategory.id}
          sectionKey="explore"
          sectionCategories={[exploreCategory] as any}
          allCategories={[exploreCategory] as any}
          onDone={() => setPlaceDialogOpen(false)}
        />
      </EditDialog>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <Harness />
    </QueryClientProvider>
  </React.StrictMode>,
);
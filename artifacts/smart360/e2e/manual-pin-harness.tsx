import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { KreatorProposalQueue } from "../src/components/admin/kreator-proposal-queue";
import { EditDialog, ItemDialog } from "../src/components/admin/content-editor";
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

  return (
    <main className="mx-auto max-w-[960px] p-6">
      <div className="mb-6 flex justify-end">
        <button
          type="button"
          className="rounded-lg bg-[#157347] px-4 py-2 font-bold text-white"
          onClick={() => setPlaceDialogOpen(true)}
        >
          Dodaj kraj
        </button>
      </div>
      <KreatorProposalQueue
        tenantId="manual-pin-test"
        tenantName="Testna namestitev"
        origin={{ latitude: 46.31, longitude: 14.91 }}
      />
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
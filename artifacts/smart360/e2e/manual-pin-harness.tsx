import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { KreatorProposalQueue } from "../src/components/admin/kreator-proposal-queue";
import "../src/index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <KreatorProposalQueue
        tenantId="manual-pin-test"
        tenantName="Testna namestitev"
        origin={{ latitude: 46.31, longitude: 14.91 }}
      />
    </QueryClientProvider>
  </React.StrictMode>,
);
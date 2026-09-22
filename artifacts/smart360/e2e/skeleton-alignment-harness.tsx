import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import { SkeletonAlignmentAction } from "../src/components/admin/skeleton-alignment-action";
import "../src/index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

function Harness() {
  return (
    <QueryClientProvider client={queryClient}>
      <main className="min-h-screen bg-white px-4 py-8 sm:px-8">
        <div className="mx-auto max-w-[1040px]">
          <SkeletonAlignmentAction tenantId="11111111-1111-4111-8111-111111111111" />
        </div>
      </main>
    </QueryClientProvider>
  );
}

createRoot(document.getElementById("root")!).render(<Harness />);
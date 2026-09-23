import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import {
  CategoryDialog,
  EditDialog,
} from "../src/components/admin/content-editor";
import { IconSprite } from "../src/pages/guest/IconSprite";
import "../src/index.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

function CategoryIconDialogFixture() {
  return (
    <QueryClientProvider client={queryClient}>
      <IconSprite />
      <EditDialog open onOpenChange={() => undefined} title="Nova kategorija">
        <CategoryDialog
          mode="create"
          tenantId="00000000-0000-4000-8000-000000000001"
          sectionId="00000000-0000-4000-8000-000000000002"
          sectionKey="offer"
          onDone={() => undefined}
        />
      </EditDialog>
    </QueryClientProvider>
  );
}

createRoot(document.getElementById("root")!).render(<CategoryIconDialogFixture />);
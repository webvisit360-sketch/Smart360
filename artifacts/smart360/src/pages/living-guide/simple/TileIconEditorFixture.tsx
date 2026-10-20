// DEV-only: real editor, no privileged session and no writes unless intercepted
// by the evidence runner. Synthetic identifiers cannot address tenant records.
import { useState } from "react";
import { CategoryDialog, EditDialog } from "@/components/admin/content-editor";

export default function TileIconEditorFixture() {
  const [open, setOpen] = useState(true);
  const [version, setVersion] = useState(0);
  const [icon, setIcon] = useState("catalog:auto");
  const load = async () => {
    const response = await fetch(`${import.meta.env.BASE_URL}verification-only/icon-editor-fixture.json`);
    if (response.ok) setIcon((await response.json()).icon);
    setVersion(v => v + 1);
    setOpen(true);
  };
  return <main className="p-4">
    <p>Preverjanje urejevalnika — sintetična kategorija, brez prijave.</p>
    <button onClick={load}>Ponovno odpri kategorijo</button>
    <EditDialog open={open} onOpenChange={setOpen} title="Uredi kategorijo">
      <CategoryDialog key={version} mode="edit" tenantId="icon-fixture-tenant"
        sectionId="icon-fixture-section" sectionKey="explore"
        category={{ id: "icon-fixture-category",
          label: "Breakfast", icon, layout: "poi", position: 0,
          exploreGroup: "experiences", isVisible: true, items: [] }}
        onDone={() => setOpen(false)} />
    </EditDialog>
  </main>;
}

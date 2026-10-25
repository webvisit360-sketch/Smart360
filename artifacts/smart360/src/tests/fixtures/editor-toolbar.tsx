import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { EditDialog, CategoryDialog, SectionDialog, ItemDialog, ContentDraftAccess } from "../../components/admin/content-editor";
import "../../index.css";

// Isolated real-component fixture: no accounts, writes, or tenant records.
const category = { id: "fixture-category", label: "Hišni red", icon: "catalog:auto", layout: "text", exploreGroup: "other", isVisible: true, items: [] } as any;
const section = { id: "fixture-section", title: "Nastanitev", key: "stay", icon: "House", subtitle: "", isVisible: true, categories: [category] } as any;
const item = { id: "fixture-item", title: "Pravila bivanja", body: "<p>Preizkus</p>", bullets: [], media: [], isVisible: true } as any;
const kind = new URLSearchParams(location.search).get("kind") ?? "category";
const done = () => {};
function Fixture() {
  return <QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}>
    <main data-surface="admin" style={{padding:24, background:"#F4F6F2", minHeight:"180vh"}}>
      <h1>Izoliran preizkus · dejanski obrazci</h1>
      <div style={{height:320}}>Vrstice nad izbrano kategorijo</div>
      <div style={{width:"min(560px, 100%)"}}>
        <h2>Hišni red</h2>
        <EditDialog inline open title={kind === "category" ? "Uredi kategorijo" : kind === "section" ? "Uredi sekcijo" : "Uredi vnos"} onOpenChange={done}>
          {kind === "item" ? <ItemDialog mode="edit" tenantId="fixture" categoryId={category.id} category={category} item={item} onDone={done}/> :
            <ContentDraftAccess allowed={!new URLSearchParams(location.search).has("restricted")}>
              {kind === "category" ? <CategoryDialog mode="edit" tenantId="fixture" sectionId={section.id} sectionKey="stay" category={category} onDone={done}/> :
                <SectionDialog mode="edit" tenantId="fixture" section={section} onDone={done}/>}
            </ContentDraftAccess>}
        </EditDialog>
        {Array.from({length:8}, (_,i)=><div data-following-row key={i} style={{padding:24,marginTop:12,border:"1px solid #bbb",background:"white"}}>{i ? `Naslednja kategorija ${i}` : "Prostor za druženje"}</div>)}
      </div>
    </main>
  </QueryClientProvider>;
}
if (import.meta.env.DEV) createRoot(document.getElementById("root")!).render(<Fixture/>);

import { useState } from "react";
import { createRoot } from "react-dom/client";
import { Building2, MapPin, Package, Plus, Trash2 } from "lucide-react";
import { EmptyCategoryRow } from "../src/components/admin/empty-category-row";
import "../src/index.css";

function FixtureSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[16px] border border-[#E8EBE6] bg-[#F4F6F2] p-5">
      <h2 className="mb-4 text-[18px] font-extrabold text-[#1a1a1a]">{title}</h2>
      {children}
    </section>
  );
}

function InteractiveHostCategory() {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [items, setItems] = useState<string[]>([]);

  if (items.length === 0 && !adding) {
    return (
      <EmptyCategoryRow
        id="fixture-explore"
        icon={<MapPin className="h-3.5 w-3.5" />}
        name="Izleti in znamenitosti"
        addLabel="Dodaj kraj"
        onEdit={() => undefined}
        onAdd={() => setAdding(true)}
      />
    );
  }

  const commit = () => {
    if (!draft.trim()) return;
    setItems(current => [...current, draft.trim()]);
    setDraft("");
    setAdding(false);
  };

  return (
    <div data-testid="fixture-populated-category">
      <h3 className="mb-3 flex items-center gap-2 px-1 text-[14px] font-bold text-[#66716A]">
        <span className="flex h-6 w-6 items-center justify-center rounded bg-[#F4F6F2] text-[#157347]">
          <MapPin className="h-3.5 w-3.5" />
        </span>
        Izleti in znamenitosti
        <span data-testid="fixture-count" className="font-normal text-[#9AA39D]">· {items.length} krajev</span>
      </h3>
      <div className="space-y-1.5">
        {items.map(item => (
          <div
            key={item}
            data-testid="fixture-item"
            className="flex min-h-[46px] items-center gap-3 rounded-[10px] border border-[#E8EBE6] bg-white p-2 pr-3"
          >
            <MapPin className="h-4 w-4 text-[#157347]" />
            <span className="flex-1 text-[15.5px] font-semibold">{item}</span>
            <Trash2 className="h-4 w-4 text-[#9AA39D]" />
          </div>
        ))}
        {adding && (
          <input
            data-testid="fixture-input"
            aria-label="Ime lokacije"
            autoFocus
            value={draft}
            onChange={event => setDraft(event.target.value)}
            className="h-[46px] w-full rounded-[10px] border border-[#E8EBE6] bg-white px-3 outline-none focus:border-[#157347]"
          />
        )}
        <button
          data-testid="fixture-dashed-add"
          type="button"
          onClick={adding ? commit : () => setAdding(true)}
          className="flex h-[46px] w-full items-center justify-center gap-2 rounded-[10px] border border-dashed border-[#C9D2CB] text-[14px] font-bold text-[#157347]"
        >
          <Plus className="h-4 w-4" /> Dodaj kraj
        </button>
      </div>
    </div>
  );
}

function Harness() {
  return (
    <main className="min-h-screen bg-white p-8 font-['Archivo'] text-[#1a1a1a]">
      <div className="mx-auto max-w-[840px] space-y-6">
        <header>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#157347]">Izolirana komponentna fixture</p>
          <h1 className="mt-1 text-2xl font-extrabold">Prazne kategorije in prehod</h1>
          <p className="mt-1 text-sm text-[#66716A]">Brez prijave, API-ja ali podatkov najemnikov.</p>
        </header>
        <FixtureSection title="Vaša destinacija">
          <EmptyCategoryRow
            id="fixture-house"
            icon={<Building2 className="h-3.5 w-3.5" />}
            name="Hišni red"
            addLabel="Dodaj vnos"
            onEdit={() => undefined}
            onAdd={() => undefined}
          />
        </FixtureSection>
        <FixtureSection title="Naša ponudba">
          <EmptyCategoryRow
            id="fixture-offer"
            icon={<Package className="h-3.5 w-3.5" />}
            name="Dodatne storitve"
            addLabel="Dodaj ponudbo"
            onEdit={() => undefined}
            onAdd={() => undefined}
          />
        </FixtureSection>
        <FixtureSection title="Odkrijte okolico">
          <InteractiveHostCategory />
        </FixtureSection>
      </div>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<Harness />);
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListCreatorProposalsQueryKey,
  useApproveCreatorProposal,
  useApproveCreatorProposalsBulk,
  useConfirmCreatorProposalCoordinates,
  useEditCreatorProposal,
  useListCreatorCategoryOptions,
  useListCreatorProposals,
  useRejectCreatorProposal,
} from "@workspace/api-client-react";
import { AlertTriangle, CheckCircle2, Loader2, MapPin, Pencil, ShieldAlert, XCircle } from "lucide-react";
import { AdminButton as Button } from "@/components/ui/button";
import { AdminCard as Card, AdminCardContent as CardContent } from "@/components/ui/card";
import { formatSlovenianCount } from "@/lib/slovenian-plural";

const locationForms = {
  one: "lokacijo",
  two: "lokaciji",
  few: "lokacije",
  other: "lokacij",
} as const;

function PinPlacementMap({
  latitude,
  longitude,
  origin,
  onPlace,
}: {
  latitude: string;
  longitude: string;
  origin?: { latitude: number; longitude: number };
  onPlace: (latitude: number, longitude: number) => void;
}) {
  const initialLat = Number(latitude) || origin?.latitude || 46.25;
  const initialLng = Number(longitude) || origin?.longitude || 14.9;
  const zoom = 15;
  const tileSize = 256;
  const scale = 2 ** zoom;
  const latitudeRadians = (initialLat * Math.PI) / 180;
  const worldX = ((initialLng + 180) / 360) * scale;
  const worldY = ((1 - Math.log(Math.tan(latitudeRadians) + 1 / Math.cos(latitudeRadians)) / Math.PI) / 2) * scale;
  const firstX = Math.floor(worldX) - 1;
  const firstY = Math.floor(worldY) - 1;
  const offsetX = (worldX - firstX) * tileSize;
  const offsetY = (worldY - firstY) * tileSize;
  const placeFromPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const pixelX = worldX * tileSize + event.clientX - bounds.left - bounds.width / 2;
    const pixelY = worldY * tileSize + event.clientY - bounds.top - bounds.height / 2;
    const nextLng = pixelX / (tileSize * scale) * 360 - 180;
    const mercator = Math.PI * (1 - 2 * pixelY / (tileSize * scale));
    const nextLat = Math.atan(Math.sinh(mercator)) * 180 / Math.PI;
    onPlace(nextLat, nextLng);
  };
  return (
    <div className="overflow-hidden rounded-lg border border-amber-300 bg-slate-100">
      <div
        role="application"
        aria-label="Zemljevid za ročno postavitev pina; kliknite ali povlecite oznako"
        tabIndex={0}
        className="relative h-56 w-full touch-none cursor-crosshair overflow-hidden bg-[#d9ddd5]"
        onPointerDown={placeFromPointer}
        onPointerMove={(event) => { if (event.buttons === 1) placeFromPointer(event); }}
      >
        <div
          className="absolute grid grid-cols-3 grid-rows-3"
          style={{
            width: tileSize * 3,
            height: tileSize * 3,
            left: `calc(50% - ${offsetX}px)`,
            top: `calc(50% - ${offsetY}px)`,
          }}
        >
          {Array.from({ length: 9 }, (_, index) => {
            const x = firstX + (index % 3);
            const y = firstY + Math.floor(index / 3);
            return (
              <img
                key={`${x}-${y}`}
                src={`https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`}
                alt=""
                width={tileSize}
                height={tileSize}
                draggable={false}
                className="block h-64 w-64 max-w-none select-none"
              />
            );
          })}
        </div>
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full drop-shadow-md">
          <MapPin className="h-10 w-10 fill-[#157347] text-white" strokeWidth={1.7} />
        </div>
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
          className="absolute bottom-1 right-1 rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600"
          onPointerDown={(event) => event.stopPropagation()}
        >
          © OpenStreetMap
        </a>
      </div>
      <p className="border-t bg-white px-3 py-2 text-xs text-slate-700">
        Kliknite ali povlecite pin. Natančno vrednost lahko popravite tudi v dostopnih poljih koordinat spodaj.
      </p>
    </div>
  );
}

export function KreatorProposalQueue({
  tenantId,
  tenantName,
  origin,
}: {
  tenantId: string;
  tenantName: string;
  origin?: { latitude: number; longitude: number };
}) {
  const queryClient = useQueryClient();
  const queue = useListCreatorProposals(tenantId);
  const categoryOptions = useListCreatorCategoryOptions(tenantId);
  const [selected, setSelected] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCategoryId, setEditCategoryId] = useState<string>("");
  const [editTranslations, setEditTranslations] = useState<Array<{ language: "sl" | "en" | "de" | "it"; name: string; description: string }>>([]);
  const [positioningId, setPositioningId] = useState<string | null>(null);
  const [manualLatitude, setManualLatitude] = useState("");
  const [manualLongitude, setManualLongitude] = useState("");
  useEffect(() => {
    setSelected([]);
    setEditingId(null);
  }, [tenantId]);
  const queryKey = getListCreatorProposalsQueryKey(tenantId);
  const refresh = async () => {
    setSelected([]);
    await queryClient.invalidateQueries({ queryKey });
  };
  const approveOne = useApproveCreatorProposal({
    mutation: { onSuccess: refresh },
  });
  const approveBulk = useApproveCreatorProposalsBulk({
    mutation: { onSuccess: refresh },
  });
  const editOne = useEditCreatorProposal({
    mutation: {
      onSuccess: async () => {
        setEditingId(null);
        await refresh();
      },
    },
  });
  const rejectOne = useRejectCreatorProposal({
    mutation: { onSuccess: refresh },
  });
  const confirmCoordinates = useConfirmCreatorProposalCoordinates({
    mutation: {
      onSuccess: async () => {
        setPositioningId(null);
        await refresh();
      },
    },
  });
  const rows = queue.data ?? [];
  const eligible = useMemo(
    () => rows.filter((row) => row.status === "pending" && !row.requiresIndividualReview),
    [rows],
  );
  const pendingCount = rows.filter((row) => row.status === "pending").length;
  const unresolvedCount = rows.filter((row) => row.status === "unresolved").length;
  const selectedLocationCount = formatSlovenianCount(selected.length, locationForms);
  const error = (approveOne.error as any)?.data?.error
    ?? (approveBulk.error as any)?.data?.error
    ?? (editOne.error as any)?.data?.error
    ?? (rejectOne.error as any)?.data?.error
    ?? (confirmCoordinates.error as any)?.data?.error
    ?? null;

  if (queue.isLoading) {
    return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Nalagam vrsto za potrditev …</div>;
  }

  return (
    <section className="mt-8 max-w-[880px] space-y-4" data-testid="creator-proposal-queue">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[22px] font-[800] tracking-tight">Kandidati za okolico</h2>
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            {pendingCount} čaka · Ni bilo mogoče potrditi: {unresolvedCount}
          </p>
        </div>
        <Button
          type="button"
          disabled={selected.length === 0 || approveBulk.isPending}
          onClick={() => {
            if (!confirm(`Potrdi ${selectedLocationCount} za ${tenantName}?`)) return;
            approveBulk.mutate({ id: tenantId, data: { proposalIds: selected } });
          }}
          className="rounded-[12px]"
        >
          {approveBulk.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Potrdi {selectedLocationCount} za {tenantName}
        </Button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm font-semibold text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {rows.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm font-medium text-muted-foreground">
            V tej izvedbi Kreatorja še ni predlogov.
          </CardContent>
        </Card>
      ) : rows.map((row) => {
        const selectable = row.status === "pending" && !row.requiresIndividualReview;
        const checked = selected.includes(row.id);
        return (
          <Card key={row.id} className="overflow-hidden">
            <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-start">
              <label className="mt-1 flex shrink-0 items-center">
                <input
                  type="checkbox"
                  aria-label={`Izberi ${row.proposedName}`}
                  checked={checked}
                  disabled={!selectable}
                  onChange={(event) => setSelected((current) =>
                    event.target.checked
                      ? [...current, row.id]
                      : current.filter((id) => id !== row.id))}
                  className="h-4 w-4 accent-primary"
                />
              </label>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-[17px] font-[800]">{row.resolvedName ?? row.proposedName}</h3>
                  <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-[800] uppercase tracking-wide text-muted-foreground">
                    {row.status}
                  </span>
                </div>

                {row.resolvedAddress && (
                  <p className="mt-1 text-sm font-medium text-muted-foreground">{row.resolvedAddress}</p>
                )}

                {row.requiresIndividualReview && (
                  <div
                    className="mt-3 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-[13px] font-[700] leading-relaxed text-amber-950"
                    data-testid={`shortened-query-badge-${row.id}`}
                  >
                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                    <span>
                      potrjeno s skrajšano poizvedbo:
                      <span className="mt-0.5 block font-[800]">
                        {row.originalQuery} → {row.confirmedQuery}
                      </span>
                      <span className="mt-1 block text-[11px] font-[650] text-amber-800">
                        Množična potrditev ni dovoljena.
                      </span>
                    </span>
                  </div>
                )}

                {row.status === "unresolved" && (
                  <p className="mt-3 rounded-xl bg-slate-100 p-3 text-sm font-semibold text-slate-700">
                    Ni bilo mogoče potrditi · {row.refusalReason}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-muted-foreground">
                  {row.categoryLabel && <span>Kategorija: {row.categoryLabel}</span>}
                  {row.range && <span>Obseg: {row.range}</span>}
                  {row.straightLineDistanceM !== null && <span>Zračna razdalja {(row.straightLineDistanceM / 1000).toFixed(1)} km</span>}
                  {row.roadDistanceM !== null && <span>Cestna razdalja {(row.roadDistanceM / 1000).toFixed(1)} km</span>}
                  {row.travelDurationS !== null && <span>{Math.round(row.travelDurationS / 60)} min vožnje</span>}
                </div>
                {row.translations.find((translation) => translation.language === "sl")?.description && (
                  <p className="mt-3 text-sm leading-relaxed">
                    {row.translations.find((translation) => translation.language === "sl")?.description}
                  </p>
                )}
                {row.inclusionReason && (
                  <p className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm font-semibold text-blue-950">
                    Zakaj je tukaj: {row.inclusionReason}
                  </p>
                )}
                {row.lostSameCategoryCount > 0 && (
                  <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                    Izgubljeni predlogi v isti kategoriji: <strong>{row.lostSameCategoryCount}</strong>
                  </div>
                )}
                {row.confirmationMethod === "operator_coordinates" && (
                  <div className="mt-3 flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-bold text-amber-950">
                    <MapPin className="h-4 w-4" />
                    Koordinate je ročno potrdil {row.coordinateConfirmedByLabel ?? "operater"}
                    {row.coordinateConfirmedAt ? ` · ${new Date(row.coordinateConfirmedAt).toLocaleString("sl-SI")}` : ""}
                    {" · obvezen posamični pregled"}
                  </div>
                )}
                {positioningId === row.id && (
                  <div className="mt-4 space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4">
                    <strong className="block">Ročno postavite točko</strong>
                    <p className="text-xs text-muted-foreground">Kliknite ali povlecite pin na zemljevidu. Vir bo trajno označen kot operaterjev in ga pozneje ni mogoče prepisati.</p>
                    <PinPlacementMap
                      latitude={manualLatitude}
                      longitude={manualLongitude}
                      origin={origin}
                      onPlace={(latitude, longitude) => {
                        setManualLatitude(latitude.toFixed(6));
                        setManualLongitude(longitude.toFixed(6));
                      }}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input aria-label="Zemljepisna širina" type="number" step="any" min="-90" max="90" value={manualLatitude} onChange={(event) => setManualLatitude(event.target.value)} placeholder="46.123456" className="h-10 rounded-md border bg-white px-3 text-sm" />
                      <input aria-label="Zemljepisna dolžina" type="number" step="any" min="-180" max="180" value={manualLongitude} onChange={(event) => setManualLongitude(event.target.value)} placeholder="14.123456" className="h-10 rounded-md border bg-white px-3 text-sm" />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="ghost" onClick={() => setPositioningId(null)}>Prekliči</Button>
                      <Button
                        type="button"
                        disabled={!manualLatitude || !manualLongitude || confirmCoordinates.isPending}
                        onClick={() => confirmCoordinates.mutate({
                          id: tenantId,
                          proposalId: row.id,
                          data: { latitude: Number(manualLatitude), longitude: Number(manualLongitude) },
                        })}
                      >
                        {confirmCoordinates.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Shrani ročno točko
                      </Button>
                    </div>
                  </div>
                )}
                {row.geocodingLookupHint && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Iskalni namig: {row.geocodingLookupHint}
                  </p>
                )}
                {editingId === row.id && (
                  <div className="mt-4 space-y-3 rounded-xl border bg-muted/30 p-4">
                    <label className="block text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      Kategorija
                      <select
                        value={editCategoryId}
                        onChange={(event) => setEditCategoryId(event.target.value)}
                        className="mt-1 h-10 w-full rounded-md border bg-white px-3 text-sm normal-case tracking-normal text-foreground"
                      >
                        <option value="">Brez ustrezne kategorije</option>
                        {(categoryOptions.data ?? []).map((category) => (
                          <option key={category.id} value={category.id}>{category.label}</option>
                        ))}
                      </select>
                    </label>
                    {editTranslations.map((translation, index) => (
                      <div key={translation.language} className="grid gap-2 md:grid-cols-[90px_1fr_2fr]">
                        <strong className="pt-2 text-xs uppercase">{translation.language}</strong>
                        <input
                          aria-label={`Ime ${translation.language}`}
                          value={translation.name}
                          onChange={(event) => setEditTranslations((current) => current.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, name: event.target.value } : item))}
                          className="h-10 rounded-md border bg-white px-3 text-sm"
                        />
                        <textarea
                          aria-label={`Opis ${translation.language}`}
                          value={translation.description}
                          onChange={(event) => setEditTranslations((current) => current.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, description: event.target.value } : item))}
                          className="min-h-20 rounded-md border bg-white px-3 py-2 text-sm"
                        />
                      </div>
                    ))}
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button type="button" variant="ghost" onClick={() => setEditingId(null)}>Prekliči</Button>
                      <Button
                        type="button"
                        disabled={editOne.isPending || editTranslations.some((translation) => !translation.name.trim())}
                        onClick={() => editOne.mutate({
                          id: tenantId,
                          proposalId: row.id,
                          data: { categoryId: editCategoryId || null, translations: editTranslations },
                        })}
                      >
                        {editOne.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Shrani ureditev
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {(row.status === "pending" || row.status === "unresolved") && (
                <div className="flex shrink-0 flex-row flex-wrap gap-2 md:flex-col">
                  {row.status === "pending" && (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={approveOne.isPending}
                      onClick={() => {
                        if (!confirm(`Potrdi lokacijo "${row.resolvedName ?? row.proposedName}" za ${tenantName}?`)) return;
                        approveOne.mutate({ id: tenantId, proposalId: row.id });
                      }}
                      className="rounded-[12px]"
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Potrdi
                    </Button>
                  )}
                  {row.status === "unresolved" && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setPositioningId(row.id);
                        setManualLatitude(row.latitude === null ? "" : String(row.latitude));
                        setManualLongitude(row.longitude === null ? "" : String(row.longitude));
                      }}
                      className="rounded-[12px]"
                    >
                      <MapPin className="mr-2 h-4 w-4" />
                      Ročno določi
                    </Button>
                  )}
                  {row.status === "pending" && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setEditingId(row.id);
                        setEditCategoryId(row.categoryId ?? "");
                        setEditTranslations(["sl", "en", "de", "it"].map((language) => {
                          const existing = row.translations.find((translation) => translation.language === language);
                          return {
                            language: language as "sl" | "en" | "de" | "it",
                            name: existing?.name ?? row.proposedName,
                            description: existing?.description ?? "",
                          };
                        }));
                      }}
                      className="rounded-[12px]"
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      Uredi
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    disabled={rejectOne.isPending}
                    onClick={() => {
                      if (!confirm(`Zavrni lokacijo "${row.resolvedName ?? row.proposedName}"? Ime bo trajno ostalo na seznamu zavrnjenih.`)) return;
                      rejectOne.mutate({ id: tenantId, proposalId: row.id });
                    }}
                    className="rounded-[12px] text-destructive"
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Zavrni
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {eligible.length > 0 && selected.length === 0 && (
        <p className="text-xs font-medium text-muted-foreground">
          Za množično potrditev izberite običajno potrjene predloge. Oslabljene potrditve ostanejo izključene.
        </p>
      )}
    </section>
  );
}
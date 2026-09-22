import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCcw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetTenantQueryKey,
  getListCreatorCategoryOptionsQueryKey,
  getListCreatorProposalsQueryKey,
  getListTenantChangelogQueryKey,
  getListTenantOverviewQueryKey,
  useAlignTenantSkeleton,
} from "@workspace/api-client-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { AdminButton as Button } from "@/components/ui/button";
import {
  AdminCard as Card,
  AdminCardContent as CardContent,
  AdminCardHeader as CardHeader,
  CardTitle,
} from "@/components/ui/card";

type AlignmentResult = {
  summary: string;
  counts: {
    sectionsUpdated: number;
    categoriesUpdated: number;
    translationsUpdated: number;
    categoriesRetired: number;
    proposalsRekeyed: number;
    itemMoves: number;
  };
  titleChanges: Array<{ key: string; oldTitle: string; newTitle: string }>;
  categoryMerges: Array<{
    sectionKey: string;
    key: string;
    keptCategoryId: string;
    removedCategoryId: string;
    summary: string;
  }>;
  stayTitleNormalization: {
    status: "changed" | "no_changes" | "skipped";
    summary: string;
    titleChanged: boolean;
    translationsUpdated: number;
  };
  skipped: Array<{ key: string; reason: string }>;
  changed: boolean;
};

export function stayTitleNormalizationText(
  result: Pick<AlignmentResult, "stayTitleNormalization">,
): string {
  return result.stayTitleNormalization.summary;
}

function errorMessage(error: unknown): string {
  const value = error as {
    data?: { error?: string; message?: string };
    message?: string;
  } | null;
  return value?.data?.error
    || value?.data?.message
    || value?.message
    || "Uskladitve ni bilo mogoče izvesti. Preverite stanje in poskusite znova.";
}

export function SkeletonAlignmentAction({ tenantId }: { tenantId: string }) {
  const queryClient = useQueryClient();
  const [result, setResult] = useState<AlignmentResult | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const alignment = useAlignTenantSkeleton();

  useEffect(() => {
    setResult(null);
    setFailure(null);
  }, [tenantId]);

  const runAlignment = () => {
    setFailure(null);
    alignment.mutate(
      { id: tenantId },
      {
        onSuccess: async (data) => {
          const nextResult = data as AlignmentResult;
          setResult(nextResult);
          if (!nextResult.changed) return;
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: getGetTenantQueryKey(tenantId) }),
            queryClient.invalidateQueries({ queryKey: getListTenantOverviewQueryKey() }),
            queryClient.invalidateQueries({ queryKey: getListTenantChangelogQueryKey(tenantId) }),
            queryClient.invalidateQueries({ queryKey: getListCreatorProposalsQueryKey(tenantId) }),
            queryClient.invalidateQueries({ queryKey: getListCreatorCategoryOptionsQueryKey(tenantId) }),
            queryClient.invalidateQueries({ queryKey: ["portalPreviewTenant"] }),
          ]);
        },
        onError: (error) => setFailure(errorMessage(error)),
      },
    );
  };

  return (
    <Card data-testid="card-skeleton-alignment" className="mb-6 border-amber-200 bg-amber-50/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <RefreshCcw className="h-4 w-4 text-amber-700" aria-hidden="true" />
          Uskladitev strukture
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-6 text-muted-foreground">
          Enkratno operatersko orodje uskladi oznake, vrstni red in prevode s skupnim
          skeletom, umakne samo varno prazne stare kategorije ter prenese odobrene
          predloge Kreatorja. Za Gril vključuje odobreno razdelitev Znamenitosti.
          Sprememb ne objavi samodejno.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="outline"
                disabled={alignment.isPending}
                data-testid="button-open-skeleton-alignment"
              >
                {alignment.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Uskladi strukturo s skeletom
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent data-testid="dialog-skeleton-alignment">
              <AlertDialogHeader>
                <AlertDialogTitle>Uskladim strukturo te nastanitve?</AlertDialogTitle>
                <AlertDialogDescription className="space-y-3 text-left">
                  <span className="block">
                    Orodje bo izvedlo samo odobrene spremembe oznak, vrstnega reda,
                    prevodov, praznih starih kategorij in povezav predlogov.
                  </span>
                  <span className="block font-medium text-foreground">
                    Za Gril bo izvedena odobrena razvrstitev 14 vnosov in 63 predlogov
                    iz Znamenitosti. Pri drugih nastanitvah se ta razdelitev ne izvaja.
                    Spremembe ne bodo objavljene.
                  </span>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel data-testid="button-cancel-skeleton-alignment">
                  Prekliči
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={runAlignment}
                  disabled={alignment.isPending}
                  data-testid="button-confirm-skeleton-alignment"
                >
                  Potrdi uskladitev
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <span className="text-xs text-muted-foreground">Samo za operaterja Smart360</span>
        </div>

        {failure ? (
          <Alert variant="destructive" data-testid="status-skeleton-alignment-error">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Uskladitev ni uspela</AlertTitle>
            <AlertDescription>
              <p>{failure}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3"
                disabled={alignment.isPending}
                onClick={runAlignment}
                data-testid="button-retry-skeleton-alignment"
              >
                Poskusi znova
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        {result ? (
          <Alert data-testid="status-skeleton-alignment-result">
            <CheckCircle2 className="h-4 w-4 text-emerald-700" />
            <AlertTitle>
              {result.changed
                ? "Odobrene spremembe so izvedene"
                : "Ni novih odobrenih sprememb"}
            </AlertTitle>
            <AlertDescription className="space-y-3">
              <p data-testid="text-skeleton-alignment-summary">{result.summary}</p>
              <p
                className="font-medium text-foreground"
                data-testid="text-skeleton-title-normalization"
              >
                {stayTitleNormalizationText(result)}
              </p>
              {result.categoryMerges.length ? (
                <ul className="space-y-1" data-testid="list-skeleton-category-merges">
                  {result.categoryMerges.map((merge) => (
                    <li key={merge.removedCategoryId}>{merge.summary}</li>
                  ))}
                </ul>
              ) : null}
              <dl className="grid grid-cols-2 gap-x-5 gap-y-2 sm:grid-cols-6">
                <div><dt className="text-xs text-muted-foreground">Razdelki</dt><dd className="font-semibold" data-testid="count-skeleton-sections-updated">{result.counts.sectionsUpdated}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Kategorije</dt><dd className="font-semibold" data-testid="count-skeleton-categories-updated">{result.counts.categoriesUpdated}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Prevodi</dt><dd className="font-semibold" data-testid="count-skeleton-translations-updated">{result.counts.translationsUpdated}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Umaknjene</dt><dd className="font-semibold" data-testid="count-skeleton-categories-retired">{result.counts.categoriesRetired}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Predlogi</dt><dd className="font-semibold" data-testid="count-skeleton-proposals-rekeyed">{result.counts.proposalsRekeyed}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Premiki vnosov</dt><dd className="font-semibold" data-testid="count-skeleton-item-moves">{result.counts.itemMoves}</dd></div>
              </dl>
              {result.skipped.length ? (
                <div data-testid="list-skeleton-alignment-skipped">
                  <p className="font-medium text-amber-800">Ni bilo spremenjeno:</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5">
                    {result.skipped.map((entry, index) => (
                      <li key={`${entry.key}-${index}`}>
                        <span className="font-medium">{entry.key}</span>: {entry.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}
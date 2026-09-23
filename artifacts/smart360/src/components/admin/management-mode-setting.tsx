import { useEffect, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useUpdateTenantManagementMode } from "@workspace/api-client-react";
import { AdminButton as Button } from "@/components/ui/button";
import {
  AdminCard as Card,
  AdminCardContent as CardContent,
  AdminCardHeader as CardHeader,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export type ManagementMode = "self_service" | "concierge";

type ManagementModeSettingProps = {
  tenantId: string;
  value: ManagementMode;
  onSaved: (managementMode: ManagementMode) => void;
};

export function ManagementModeSetting({
  tenantId,
  value,
  onSaved,
}: ManagementModeSettingProps) {
  const [savedMode, setSavedMode] = useState(value);
  const [draftMode, setDraftMode] = useState(value);
  const [confirmConcierge, setConfirmConcierge] = useState(false);
  const [error, setError] = useState("");
  const updateMode = useUpdateTenantManagementMode();
  const pending = updateMode.isPending;

  useEffect(() => {
    setSavedMode(value);
    setDraftMode(value);
    setError("");
  }, [tenantId, value]);

  const selectMode = (mode: ManagementMode) => {
    setError("");
    if (mode === draftMode) return;
    if (mode === "concierge") {
      setConfirmConcierge(true);
      return;
    }
    setDraftMode(mode);
  };

  const save = async () => {
    const requestedMode = draftMode;
    setError("");
    try {
      const data = await updateMode.mutateAsync({
        tenantId,
        data: { managementMode: requestedMode },
      });
      if (data.managementMode !== "self_service" && data.managementMode !== "concierge") {
        throw new Error("Strežnik je vrnil neveljaven način upravljanja.");
      }
      setSavedMode(data.managementMode);
      setDraftMode(data.managementMode);
      onSaved(data.managementMode);
    } catch (reason) {
      setDraftMode(savedMode);
      const apiReason = reason as {
        data?: { error?: string; message?: string };
        message?: string;
      };
      setError(
        apiReason.data?.error
        || apiReason.data?.message
        || apiReason.message
        || "Načina upravljanja ni bilo mogoče shraniti.",
      );
    }
  };

  const options: Array<{
    value: ManagementMode;
    label: string;
    description: string;
    testId: string;
  }> = [
    {
      value: "self_service",
      label: "Gostitelj ureja sam",
      description: "Gostitelj dobi račun, nastavi geslo in sam ureja vsebino.",
      testId: "management-mode-self-service",
    },
    {
      value: "concierge",
      label: "Ureja Smart360",
      description: "Smart360 ureja vsebino; gostitelj nima dostopa do administracije.",
      testId: "management-mode-concierge",
    },
  ];

  return (
    <>
      <Card data-testid="section-management-mode">
        <CardHeader>
          <CardTitle>Način upravljanja</CardTitle>
          <CardDescription>
            Določa dostop gostitelja. Sprememba ne vpliva na vsebino ali objavljeno različico vodnika.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className="grid gap-3 sm:grid-cols-2"
            role="radiogroup"
            aria-label="Način upravljanja"
          >
            {options.map((option) => {
              const selected = draftMode === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  data-testid={option.testId}
                  disabled={pending}
                  onClick={() => selectMode(option.value)}
                  className={`rounded-xl border p-4 text-left transition ${
                    selected
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border hover:border-primary/45 hover:bg-muted/30"
                  } disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  <span className="flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                        selected ? "border-primary" : "border-muted-foreground"
                      }`}
                    >
                      {selected && <span className="h-2 w-2 rounded-full bg-primary" />}
                    </span>
                    <span className="font-semibold">{option.label}</span>
                  </span>
                  <span className="mt-2 block pl-7 text-sm text-muted-foreground">
                    {option.description}
                  </span>
                </button>
              );
            })}
          </div>

          {error && (
            <p
              role="alert"
              data-testid="management-mode-error"
              className="flex items-start gap-2 text-sm text-destructive"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error} Prikazana je zadnja shranjena nastavitev.</span>
            </p>
          )}

          <div className="flex justify-end">
            <Button
              type="button"
              data-testid="save-management-mode"
              disabled={pending || draftMode === savedMode}
              onClick={() => void save()}
            >
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {pending ? "Shranjujem …" : "Shrani način upravljanja"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={confirmConcierge} onOpenChange={setConfirmConcierge}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Preklop na »Ureja Smart360«?</AlertDialogTitle>
            <AlertDialogDescription>
              Po shranjevanju bo prijava gostitelja onemogočena in vse njegove aktivne seje bodo končane.
              Vsebina vodnika ostane nespremenjena.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Prekliči</AlertDialogCancel>
            <AlertDialogAction
              data-testid="confirm-management-mode-concierge"
              onClick={() => {
                setDraftMode("concierge");
                setConfirmConcierge(false);
              }}
            >
              Nadaljuj
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
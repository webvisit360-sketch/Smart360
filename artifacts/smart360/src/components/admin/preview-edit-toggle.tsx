import { useRef, type KeyboardEvent } from "react";
import { Eye, MousePointerClick, X } from "lucide-react";

/** Segmented, keyboard-accessible switch above the live preview. */
export function PreviewEditToggle({
  editMode,
  onChange,
  selectionLabel,
  notice,
  onClearSelection,
}: {
  editMode: boolean;
  onChange: (editMode: boolean) => void;
  selectionLabel: string | null;
  notice: string | null;
  onClearSelection: () => void;
}) {
  const refs = [useRef<HTMLButtonElement>(null), useRef<HTMLButtonElement>(null)];
  const options = [
    { value: false, label: "Predogled", icon: Eye, testId: "toggle-preview-mode-view" },
    { value: true, label: "Klikni in uredi", icon: MousePointerClick, testId: "toggle-preview-mode-edit" },
  ];
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "Home" ? false : event.key === "End" ? true : !editMode;
    onChange(next);
    refs[next ? 1 : 0]!.current?.focus();
  };
  return (
    <div className="mb-4 flex w-[289px] flex-col items-stretch gap-2">
      <div
        role="radiogroup"
        aria-label="Način predogleda"
        onKeyDown={onKeyDown}
        className="grid grid-cols-2 rounded-full border border-black/10 bg-white p-1 shadow-sm"
      >
        {options.map((option, index) => {
          const active = editMode === option.value;
          const Icon = option.icon;
          return (
            <button
              key={option.testId}
              ref={refs[index]}
              type="button"
              role="radio"
              aria-checked={active}
              tabIndex={active ? 0 : -1}
              data-testid={option.testId}
              onClick={() => onChange(option.value)}
              className={`flex h-8 items-center justify-center gap-1.5 rounded-full text-[13px] font-[650] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#157347] ${active ? "bg-[#157347] text-white" : "text-[#14201F] hover:bg-[#F4F6F2]"}`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {option.label}
            </button>
          );
        })}
      </div>
      {editMode && !selectionLabel && !notice && (
        <p className="text-center text-[12px] leading-snug text-[#66716A]" data-testid="text-preview-edit-hint">
          Premaknite kazalec nad element in kliknite — urejevalnik se odpre na levi.
        </p>
      )}
      {selectionLabel && (
        <div className="flex items-center gap-2 rounded-[10px] border border-[#157347]/30 bg-white px-3 py-1.5" data-testid="status-preview-selection">
          <span className="h-2 w-2 shrink-0 rounded-full bg-[#157347]" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-[#14201F]">Urejate: {selectionLabel}</span>
          <button type="button" onClick={onClearSelection} aria-label="Počisti izbor" data-testid="button-preview-selection-clear" className="rounded p-0.5 text-[#66716A] hover:text-[#14201F]">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      {notice && (
        <p role="status" className="rounded-[10px] border border-[#DD9A2B]/40 bg-[#DD9A2B]/10 px-3 py-1.5 text-[12px] leading-snug text-[#68460A]" data-testid="status-preview-edit-notice">
          {notice}
        </p>
      )}
    </div>
  );
}

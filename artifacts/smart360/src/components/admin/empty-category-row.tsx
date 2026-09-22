import type { ReactNode } from "react";
import { EyeOff, Pencil, Plus } from "lucide-react";

type EmptyCategoryRowProps = {
  id: string;
  icon: ReactNode;
  name: string;
  isVisible?: boolean;
  extraLabel?: ReactNode;
  addLabel: string;
  onEdit?: () => void;
  onAdd: () => void;
};

export function EmptyCategoryRow({
  id,
  icon,
  name,
  isVisible = true,
  extraLabel,
  addLabel,
  onEdit,
  onAdd,
}: EmptyCategoryRowProps) {
  return (
    <div
      data-testid={`row-empty-category-${id}`}
      className={`flex min-h-[46px] items-center justify-between rounded-[10px] border border-[#E8EBE6] bg-white p-2 pr-3 ${!isVisible ? "opacity-70" : ""}`}
    >
      <div className="flex items-center gap-3 overflow-hidden">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-[#F4F6F2] text-[#157347]">
          {icon}
        </div>
        <span className="truncate text-[15.5px] font-semibold text-[#1a1a1a]">
          {name}
          {!isVisible && (
            <span className="ml-2 inline-flex items-center gap-1 rounded bg-[#F4F6F2] px-1.5 py-0.5 align-middle text-[10px] font-medium text-[#66716A]">
              <EyeOff className="h-3 w-3" /> Skrito
            </span>
          )}
        </span>
        {extraLabel}
        <span className="shrink-0 text-xs text-[#9AA39D]">· prazno</span>
      </div>
      <div className="ml-2 flex shrink-0 items-center gap-3">
        {onEdit && (
          <button
            data-testid={`button-edit-empty-category-${id}`}
            type="button"
            aria-label={`Uredi kategorijo ${name}`}
            onClick={onEdit}
            className="hidden text-[#9AA39D] hover:text-[#157347] sm:block"
          >
            <Pencil className="h-4 w-4" />
          </button>
        )}
        <button
          data-testid={`button-add-empty-category-${id}`}
          type="button"
          onClick={onAdd}
          className="flex items-center gap-1 whitespace-nowrap text-sm font-bold text-[#157347] hover:underline"
        >
          <Plus className="h-4 w-4" /> {addLabel}
        </button>
      </div>
    </div>
  );
}
const PRESSABLE = 'button,a[href],[role="button"],[data-click]';

function vibrateTap(): void {
  if (!navigator.vibrate) return;
  try {
    navigator.vibrate(6);
  } catch {
    // Haptics are optional and must never block navigation.
  }
}

export function installTapFeedback(): () => void {
  const onPointerDown = (event: PointerEvent) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest(PRESSABLE)) vibrateTap();
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.repeat || (event.key !== "Enter" && event.key !== " ")) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest(PRESSABLE)) vibrateTap();
  };

  document.addEventListener("pointerdown", onPointerDown, { passive: true });
  document.addEventListener("keydown", onKeyDown);
  return () => {
    document.removeEventListener("pointerdown", onPointerDown);
    document.removeEventListener("keydown", onKeyDown);
  };
}
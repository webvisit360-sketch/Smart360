export function vibrate(duration = 10): void {
  if (
    typeof window === "undefined" ||
    !("navigator" in window) ||
    !navigator.vibrate
  ) {
    return;
  }

  try {
    navigator.vibrate(duration);
  } catch {
    // Haptics are optional.
  }
}
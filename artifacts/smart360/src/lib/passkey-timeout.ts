export async function withAbortTimeout<T>(
  work: Promise<T>,
  controller: AbortController,
  timeoutMs: number,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let removeAbortListener = () => {};
  const aborted = new Promise<never>((_, reject) => {
    const onAbort = () => {
      reject(
        controller.signal.reason instanceof Error
          ? controller.signal.reason
          : new DOMException("Passkey login was cancelled", "AbortError"),
      );
    };
    controller.signal.addEventListener("abort", onAbort, { once: true });
    removeAbortListener = () => controller.signal.removeEventListener("abort", onAbort);
    timeoutId = setTimeout(() => {
      controller.abort(new DOMException("Passkey login timed out", "TimeoutError"));
    }, timeoutMs);
  });

  try {
    return await Promise.race([work, aborted]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
    removeAbortListener();
  }
}
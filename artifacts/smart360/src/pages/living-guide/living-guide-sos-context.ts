import { createContext } from "react";

/** Presentation only. Never carries a GPS fix or modifies the tour lifecycle. */
export const SosEntryContext = createContext<{ lang: string; onOpen: () => void; isOpen: boolean } | null>(null);
// Pictograms copied verbatim from the binding Enostaven references.
import type { ReactElement } from "react";

export type SimpleIconKey =
  | "bell" | "weather" | "sos" | "phone" | "install" | "info" | "house" | "building" | "bed"
  | "wifi" | "doc" | "gear" | "clock" | "parking" | "door" | "ac" | "cart" | "bag"
  | "order" | "beach" | "mountain" | "hike" | "bike" | "trips" | "record" | "calendar"
  | "pin" | "chat";

const E = { fillRule: "evenodd" as const };
const ICONS: Record<SimpleIconKey, ReactElement> = {
  bell: <path d="M12 3a5.8 5.8 0 0 0-5.8 5.8c0 4.5-1.7 5.8-1.7 5.8h15s-1.7-1.3-1.7-5.8A5.8 5.8 0 0 0 12 3zm-2 13.5a2 2 0 0 0 4 0z" />,
  weather: <path d="M8.5 5.5a4.5 4.5 0 0 1 4.3 3.2 4.9 4.9 0 0 1 .9-.2 5.6 5.6 0 0 0-10-2A4 4 0 0 0 4.9 9a4.6 4.6 0 0 1 3.6-3.5zM12 2.2l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9zM17.3 9.5a4.2 4.2 0 0 0-4.1 3.3 3.4 3.4 0 0 0-3.9 1 2.9 2.9 0 0 0-5 2A2.9 2.9 0 0 0 7.2 21h10a4.2 4.2 0 0 0 4.3-4.2 4.2 4.2 0 0 0-4.2-7.3z" />,
  sos: <path {...E} d="M12 2.8 22 20.5H2zM11 9.5h2v5h-2zm0 6.5h2v2h-2z" />,
  phone: <path d="M5.5 3.5h4.2l1.6 4.8-2.4 1.7a13.6 13.6 0 0 0 4.6 4.6l1.7-2.4 4.8 1.6v4.2a1.9 1.9 0 0 1-2.1 1.9C9.6 19.3 4.2 13.9 3.6 5.6a1.9 1.9 0 0 1 1.9-2.1z" />,
  install: <path {...E} d="M8 1.8h8a2 2 0 0 1 2 2v16.4a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V3.8a2 2 0 0 1 2-2zm2 2.1h4v1.3h-4zM11 9.6h2v2.9h2.9v2H13v2.9h-2v-2.9H8.1v-2H11z" />,
  info: <path {...E} d="M12 2.5A9.5 9.5 0 1 0 21.5 12 9.5 9.5 0 0 0 12 2.5zM11 10h2v7h-2zm0-3.5h2v2h-2z" />,
  house: <path d="M12 3 2.5 11h2.6v9h5.4v-5.6h3v5.6h5.4v-9h2.6z" />,
  building: <path {...E} d="M4 3h16v18h-5.2v-4.4H9.2V21H4zM7 6.4h3v2.8H7zm7 0h3v2.8h-3zM7 11h3v2.8H7zm7 0h3v2.8h-3z" />,
  bed: <path d="M7.2 13.1a2.9 2.9 0 1 0 0-5.8 2.9 2.9 0 0 0 0 5.8zM18.6 7.5h-7.2v6.7H3.5V4.8H1.6v14.4h1.9v-2.6h17v2.6h1.9v-7.8a3.9 3.9 0 0 0-3.8-3.9z" />,
  wifi: <><path d="M3.8 10C8.3 5.8 15.7 5.8 20.2 10M6.6 13.2c3.1-2.8 7.7-2.8 10.8 0M9.5 16.3c1.5-1.3 3.5-1.3 5 0" /><circle cx="12" cy="19.2" r="1.5" fill="currentColor" stroke="none" /></>,
  doc: <path {...E} d="M6 2.5h9.5L19.5 7v14.5H6zM14.5 3.8V8h4.2zM8.5 11.5h7v1.7h-7zm0 3.6h7v1.7h-7z" />,
  gear: <path d="M12 7.5a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6zm9 6-2.2-.3a7 7 0 0 1-.7 1.7l1.4 1.8-2.1 2.1-1.8-1.4a7 7 0 0 1-1.7.7l-.3 2.2h-3l-.3-2.2a7 7 0 0 1-1.7-.7l-1.8 1.4-2.1-2.1 1.4-1.8a7 7 0 0 1-.7-1.7L3 13.5v-3l2.2-.3a7 7 0 0 1 .7-1.7L4.5 6.7l2.1-2.1 1.8 1.4a7 7 0 0 1 1.7-.7l.3-2.2h3l.3 2.2a7 7 0 0 1 1.7.7l1.8-1.4 2.1 2.1-1.4 1.8a7 7 0 0 1 .7 1.7l2.2.3z" />,
  clock: <path {...E} d="M12 2.5A9.5 9.5 0 1 0 21.5 12 9.5 9.5 0 0 0 12 2.5zm.9 10.1-4 2.3-.9-1.5 3.1-1.8V6h1.8z" />,
  parking: <path {...E} d="M6.5 3h11A3.5 3.5 0 0 1 21 6.5v11a3.5 3.5 0 0 1-3.5 3.5h-11A3.5 3.5 0 0 1 3 17.5v-11A3.5 3.5 0 0 1 6.5 3zM9.4 6.8v10.4h2.4v-3.4h1.9a3.5 3.5 0 0 0 0-7zm2.4 2.2h1.7a1.3 1.3 0 0 1 0 2.6h-1.7z" />,
  door: <path {...E} d="M19.5 2.6v19.9h-5V20h3.1V4.5h-3.1V2.6zM13 2.9 4.5 4.8v15.7L13 22.4zm-2.1 9a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2z" />,
  ac: <><path {...E} d="M3.5 4h17a1.4 1.4 0 0 1 1.4 1.4v4.7a1.4 1.4 0 0 1-1.4 1.4h-17a1.4 1.4 0 0 1-1.4-1.4V5.4A1.4 1.4 0 0 1 3.5 4zm2 4.3h13v1.3h-13z" /><path d="M6.3 14.5c-.9 1.4.9 2.1.2 3.8M12 14.5c-.9 1.4.9 2.1.2 3.8M17.7 14.5c-.9 1.4.9 2.1.2 3.8" stroke="currentColor" strokeWidth="2.1" fill="none" strokeLinecap="round" /></>,
  cart: <path d="M3 4.6h2.4l.8 2.4H21l-1.9 9H7.2L4.6 6.3zM9.3 20.4a1.7 1.7 0 1 1-3.4 0 1.7 1.7 0 0 1 3.4 0zm9.4 0a1.7 1.7 0 1 1-3.4 0 1.7 1.7 0 0 1 3.4 0z" />,
  bag: <path {...E} d="M7.5 2.2h9v3h-9zM6 6.4h12a2 2 0 0 1 2 2V19a2.6 2.6 0 0 1-2.6 2.6H6.6A2.6 2.6 0 0 1 4 19V8.4a2 2 0 0 1 2-2zm1.5 5.1h9v4.4h-9z" />,
  order: <path {...E} d="M9 2.2h6v1.6h4v18H5v-18h4zM8.3 12l1.3-1.3 1.9 1.9 3.9-3.9 1.3 1.3-5.2 5.2zM8 16.6h8v1.6H8z" />,
  beach: <><path d="M12 2.6a8.4 8.4 0 0 0-8.4 7.2h16.8A8.4 8.4 0 0 0 12 2.6zm-.9 8.6h1.8v6.4h-1.8z" /><path d="M2.8 20.2c1.5-1.5 3.1-1.5 4.6 0s3.1 1.5 4.6 0 3.1-1.5 4.6 0 3.1 1.5 4.6 0" stroke="currentColor" strokeWidth="2.1" fill="none" strokeLinecap="round" /></>,
  mountain: <><path d="m3 20 5.5-12 4.3 7.6L15.5 11 21 20z" /><circle cx="17" cy="6" r="2" /></>,
  hike: <><circle cx="14.6" cy="4" r="1.9" /><path d="m13.2 6.6-3.4 3 2.6 2.7-4 7.9 2.3 1.1 3.6-7.1 2.9 1.9 1.7 5.1 2.2-.7-1.9-5.9-3.2-2.1 1.9-1.7 2.9 1.5.9-1.8-3.6-1.9z" /></>,
  bike: <><path d="M6.3 13.2a4.2 4.2 0 1 0 0 8.4 4.2 4.2 0 0 0 0-8.4zm0 6.7a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5zm11.4-6.7a4.2 4.2 0 1 0 0 8.4 4.2 4.2 0 0 0 0-8.4zm0 6.7a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5zM10.7 8.3 13 12l-1 1.8-2.9-4.6zm3.8-3.6 1.6 3h2.4v1.8h-3.4l-2-3.6z" /><path d="M9.3 6.5h3.2L16 12.9l-1.5.9-3.6-5.6H9.3z" /></>,
  trips: <path d="M11.1 2h1.8v2.2H18l2.7 2.5L18 9.2h-5.1v1.6H18.9l-2.7 2.5 2.7 2.5h-6V22h-1.8v-6.2H6l-2.7-2.5L6 10.8h5.1V9.2H6.1L3.4 6.7 6.1 4.2h5z" />,
  record: <><path d="M4.5 20.5c6.5 0 3-8 8.5-9.3" /><circle cx="4.5" cy="20.5" r="1.4" fill="currentColor" stroke="none" /><circle cx="16.5" cy="8" r="6.2" /><circle cx="16.5" cy="8" r="3.4" fill="currentColor" stroke="none" /></>,
  calendar: <><path d="M4 5.5h16V21H4zM8 3v4m8-4v4" stroke="currentColor" strokeWidth="2.6" fill="none" /><path d="M4 9.5h16v1.6H4z" /><circle cx="9" cy="14.5" r="1.3" /><circle cx="15" cy="14.5" r="1.3" /><circle cx="9" cy="18" r="1.3" /></>,
  pin: <path {...E} d="M12 2.5c-3.6 0-6.5 2.9-6.5 6.5 0 4.9 6.5 12.5 6.5 12.5s6.5-7.6 6.5-12.5c0-3.6-2.9-6.5-6.5-6.5zm0 8.8a2.3 2.3 0 1 1 0-4.6 2.3 2.3 0 0 1 0 4.6z" />,
  chat: <path d="M3.5 4.5h17v12h-11l-6 4.5z" />,
};
const LINE = new Set<SimpleIconKey>(["wifi", "record"]);

export function SimpleIcon({ icon }: { icon: SimpleIconKey }) {
  return (
    <svg className={LINE.has(icon) ? "ln" : undefined} viewBox="0 0 24 24" aria-hidden="true">
      {ICONS[icon]}
    </svg>
  );
}

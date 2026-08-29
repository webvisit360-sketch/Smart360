import SMART360_LOCKUP_SVG from "virtual:admin-sidebar-lockup";

export type AdminSidebarIconName =
  | "dashboard"
  | "enquiries"
  | "keys"
  | "overview"
  | "creator"
  | "orders"
  | "messages"
  | "events"
  | "notices"
  | "offers"
  | "area"
  | "accommodation"
  | "settings";

export function AdminSidebarLockup({ className = "" }: { className?: string }) {
  return (
    <div
      className={`admin-sidebar__lockup ${className}`.trim()}
      role="img"
      aria-label="Smart360"
      dangerouslySetInnerHTML={{ __html: SMART360_LOCKUP_SVG }}
    />
  );
}

export function AdminSidebarIcon({ name }: { name: AdminSidebarIconName }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {name === "dashboard" && (
        <>
          <rect x="3" y="3" width="7" height="7" rx="2" />
          <rect x="14" y="3" width="7" height="7" rx="2" />
          <rect x="3" y="14" width="7" height="7" rx="2" />
          <rect x="14" y="14" width="7" height="7" rx="2" />
        </>
      )}
      {name === "keys" && (
        <>
          <circle cx="8" cy="12" r="4" />
          <path d="M12 12h9M18 12v4" />
        </>
      )}
      {(name === "enquiries" || name === "messages") && (
        <path d="M21 12a8 8 0 01-11.6 7.1L3 21l1.9-6.4A8 8 0 1121 12z" />
      )}
      {name === "overview" && <path d="M3 11l9-8 9 8v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z" />}
      {name === "creator" && <path d="M4 6h16M4 12h16M4 18h10" />}
      {name === "orders" && <path d="M6 2h12v20l-6-3-6 3z" />}
      {name === "events" && (
        <>
          <rect x="3" y="5" width="18" height="16" rx="3" />
          <path d="M8 3v4M16 3v4M3 11h18" />
        </>
      )}
      {name === "notices" && <path d="M18 8a6 6 0 10-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9z" />}
      {name === "offers" && (
        <>
          <path d="M6 2h9l5 5v15H6z" />
          <path d="M9 13h7M9 17h5" />
        </>
      )}
      {name === "area" && (
        <>
          <circle cx="12" cy="10" r="3" />
          <path d="M12 22s7-6.2 7-12a7 7 0 10-14 0c0 5.8 7 12 7 12z" />
        </>
      )}
      {name === "accommodation" && (
        <>
          <path d="M4 21V9l8-6 8 6v12" />
          <path d="M10 21v-6h4v6" />
        </>
      )}
      {name === "settings" && (
        <>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-2.7 1.1V21a2 2 0 11-4 0v-.1A1.6 1.6 0 006.6 19l-.1.1a2 2 0 11-2.8-2.8l.1-.1A1.6 1.6 0 003 15H3a2 2 0 110-4h.1A1.6 1.6 0 005 8.6l-.1-.1a2 2 0 112.8-2.8l.1.1A1.6 1.6 0 0010.5 5V5a2 2 0 114 0v.1A1.6 1.6 0 0017.4 6l.1-.1a2 2 0 112.8 2.8l-.1.1A1.6 1.6 0 0019 11.5H21a2 2 0 110 4h-.1a1.6 1.6 0 00-1.5 1z" />
        </>
      )}
    </svg>
  );
}
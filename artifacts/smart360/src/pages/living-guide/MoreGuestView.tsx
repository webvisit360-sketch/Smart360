import {
  findDatedEventDestination,
  type NavItem,
} from "./living-guide-nav-resolver";

export function MoreGuestView({
  omitted,
  t,
  onBack,
  onNavigate,
  sections,
  slug,
}: {
  omitted: NavItem[];
  t: any;
  onBack: () => void;
  onNavigate: (path: string) => void;
  sections: any[];
  slug: string;
}) {
  const handleSelect = (item: NavItem) => {
    switch (item) {
      case "stay":
        onNavigate(`/${slug}/s/stay`);
        break;
      case "offer":
        onNavigate(`/${slug}/s/offer`);
        break;
      case "explore":
        if (sections.some((s: any) => s.key === "explore" && s.isVisible !== false)) {
          onNavigate(`/${slug}/s/explore`);
        } else {
          onNavigate(`/${slug}/s/services`);
        }
        break;
      case "program":
        const destination = findDatedEventDestination(sections);
        onNavigate(
          destination
            ? `/${slug}/c/${destination.category.id}`
            : `/${slug}/home`,
        );
        break;
      case "messages":
        onNavigate(`/${slug}/messages`);
        break;
      case "home":
        onNavigate(`/${slug}/home`);
        break;
    }
  };

  const getIcon = (item: NavItem) => {
    switch (item) {
      case "home": return "home";
      case "stay": return "tent";
      case "offer": return "bag";
      case "explore": return "comp";
      case "program": return "cal";
      case "messages": return "msg";
      default: return "doc";
    }
  };

  const getLabelKey = (item: NavItem) => {
    switch (item) {
      case "explore": return "UI.lg.nav.area";
      default: return `UI.lg.nav.${item}`;
    }
  };

  return (
    <div className="lg2-view z-40">
      <div className="flex-none flex items-center h-14 px-4 border-b">
        <button onClick={onBack} className="p-2 -ml-2 rounded-full bg-muted/50 text-foreground">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <h1 className="ml-4 font-bold text-lg">{t("UI.lg.more", "Več")}</h1>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 pb-24 space-y-2" style={{ background: 'var(--bg)' }}>
        {omitted.map(item => (
          <button
            key={item}
            onClick={() => handleSelect(item)}
            className="w-full flex items-center gap-4 p-4 rounded-2xl text-left transition-transform active:scale-95"
            style={{ background: 'var(--card2)', border: '1px solid var(--line)', color: 'var(--tx)' }}
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--card)', color: 'var(--acc)' }}>
              <svg className="w-5 h-5"><use href={`#lg-i-${getIcon(item)}`} /></svg>
            </div>
            <span className="font-bold text-lg">{t(getLabelKey(item), item)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
import { Link } from "wouter";
import { buildGuestPath } from "./guest-url";
import { makeT } from "./i18n";

export function Tabbar({ slug, tenant, lang = "sl", currentTab, onContactClick }: { slug: string, tenant: any, lang?: string, currentTab: string, onContactClick: () => void }) {
  const t = makeT(tenant, lang);
  let odkrijId = "";
  let ponudbaId = "";
  let storitveId = "";
  
  tenant?.sections?.forEach((sec: any) => {
    sec.categories?.forEach((cat: any) => {
      if (!odkrijId && (cat.layout === 'poi' || cat.layout === 'routes')) odkrijId = cat.id;
      if (!ponudbaId && cat.layout === 'products') ponudbaId = cat.id;
      if (!storitveId && (cat.icon === 'cart' || cat.layout === 'svcs' || cat.layout === 'tabs')) storitveId = cat.id;
    });
  });

  return (
    <nav className="tabbar" id="tabbar">
      <Link href={buildGuestPath(`/${slug}`)} className={`tab ${currentTab === 'home' ? 'is-on' : ''}`}>
        <svg className="ic" viewBox="0 0 24 24"><use href="#i-home" /></svg><span>{t("UI.tab.home")}</span>
      </Link>
      
      {odkrijId ? (
        <Link href={buildGuestPath(`/${slug}/c/${odkrijId}`)} className={`tab ${currentTab === odkrijId ? 'is-on' : ''}`}>
          <svg className="ic" viewBox="0 0 24 24"><use href="#i-compass" /></svg><span>{t("UI.tab.discover")}</span>
        </Link>
      ) : (
        <button className="tab disabled" style={{opacity: 0.5}}><svg className="ic" viewBox="0 0 24 24"><use href="#i-compass" /></svg><span>{t("UI.tab.discover")}</span></button>
      )}
      
      {ponudbaId ? (
        <Link href={buildGuestPath(`/${slug}/c/${ponudbaId}`)} className={`tab ${currentTab === ponudbaId ? 'is-on' : ''}`}>
          <svg className="ic" viewBox="0 0 24 24"><use href="#i-bag" /></svg><span>{t("UI.tab.offer")}</span>
        </Link>
      ) : (
        <button className="tab disabled" style={{opacity: 0.5}}><svg className="ic" viewBox="0 0 24 24"><use href="#i-bag" /></svg><span>{t("UI.tab.offer")}</span></button>
      )}
      
      {storitveId ? (
        <Link href={buildGuestPath(`/${slug}/c/${storitveId}`)} className={`tab ${currentTab === storitveId ? 'is-on' : ''}`}>
          <svg className="ic" viewBox="0 0 24 24"><use href="#i-cart" /></svg><span>{t("UI.tab.services")}</span>
        </Link>
      ) : (
        <button className="tab disabled" style={{opacity: 0.5}}><svg className="ic" viewBox="0 0 24 24"><use href="#i-cart" /></svg><span>{t("UI.tab.services")}</span></button>
      )}
      
      <button className={`tab ${currentTab === 'kontakt' ? 'is-on' : ''}`} onClick={onContactClick}>
        <svg className="ic" viewBox="0 0 24 24"><use href="#i-chat" /></svg><span>{t("UI.tab.contact")}</span>
      </button>
    </nav>
  );
}

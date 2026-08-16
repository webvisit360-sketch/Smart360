import { SheetTop } from "./SheetTop";
import { makeT } from "./i18n";
export function ContactSheet({ tenant, lang = "sl", isOpen, onClose }: { tenant: any, lang?: string, isOpen: boolean, onClose: () => void }) {
  const t = makeT(tenant, lang);
  return (
    <>
      <div className={`mask ${isOpen ? 'on' : ''}`} onClick={onClose}></div>
      <div className={`sheet ${isOpen ? 'on' : ''}`}>
        <SheetTop isOpen={isOpen} onClose={onClose} />
        <h3>{t("UI.tab.contact")}</h3>
        <div className="sub">{t("UI.contact.how")}</div>
        
        {tenant?.phone && (
          <a href={`tel:${tenant.phone}`} className="srow">
            <svg className="ic" viewBox="0 0 24 24"><use href="#i-phone" /></svg>
            <div className="t"><b>{t("UI.contact.call")}</b><span>{tenant.phone}</span></div>
            <svg className="ic chev" viewBox="0 0 24 24"><use href="#i-chev" /></svg>
          </a>
        )}
        
        {tenant?.whatsapp && (
          <a href={`https://wa.me/${tenant.whatsapp.replace(/\+/g, '')}`} target="_blank" rel="noopener noreferrer" className="srow">
            <svg className="ic" viewBox="0 0 24 24"><use href="#i-chat" /></svg>
            <div className="t"><b>WhatsApp</b><span>{t("UI.contact.sub")}</span></div>
            <svg className="ic chev" viewBox="0 0 24 24"><use href="#i-chev" /></svg>
          </a>
        )}
        
        {tenant?.viber && (
          <a href={`viber://chat?number=${tenant.viber.replace(/\+/g, '')}`} className="srow">
            <svg className="ic" viewBox="0 0 24 24"><use href="#i-chat" /></svg>
            <div className="t"><b>Viber</b><span>{t("UI.contact.message")}</span></div>
            <svg className="ic chev" viewBox="0 0 24 24"><use href="#i-chev" /></svg>
          </a>
        )}
        
        {tenant?.address && (
          <div className="srow" style={{pointerEvents: 'none'}}>
            <svg className="ic" viewBox="0 0 24 24"><use href="#i-pin" /></svg>
            <div className="t"><b>{t("UI.contact.address")}</b><span>{tenant.address}</span></div>
          </div>
        )}
        {tenant?.mapQuery && (
          <a className="srow" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(tenant.mapQuery)}`} target="_blank" rel="noopener noreferrer">
            <svg className="ic" viewBox="0 0 24 24"><use href="#i-nav" /></svg>
            <div className="t"><b>{t("UI.contact.directions")}</b><span>{t("UI.maps.open")}</span></div>
          </a>
        )}
      </div>
    </>
  );
}

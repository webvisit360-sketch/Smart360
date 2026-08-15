import { ReactNode } from "react";
import { IconSprite } from "./IconSprite";
import { useRoute, useSearch } from "wouter";
import { useGetPublicTenant } from "@workspace/api-client-react";

import cssMediterranUrl from "../../styles/tema-sredozemska.css?url";
import cssSwipeUrl from "../../styles/tema-poteg.css?url";

export default function GuestLayout({ children }: { children: ReactNode }) {
  const [match1, params1] = useRoute("/g/:slug");
  const [match2, params2] = useRoute("/g/:slug/c/:categoryId");
  const slug = match1 ? params1?.slug : (match2 ? params2?.slug : "");

  const searchStr = useSearch();
  const searchParams = new URLSearchParams(searchStr);
  const lang = searchParams.get("lang") || "sl";
  const isPreview = searchParams.get("preview") === "1";

  const { data: tenant } = useGetPublicTenant(
    slug || "", 
    { lang, preview: isPreview },
    { query: { enabled: !!slug, queryKey: ['getPublicTenant', slug, lang, isPreview] } }
  );

  return (
    <>
      <IconSprite />
      {tenant ? (
        <>
          <link rel="stylesheet" href={tenant.theme === 'swipe' ? cssSwipeUrl : cssMediterranUrl} />
          {isPreview && (
            <>
              <style>{`
                .preview-back{position:fixed;top:calc(12px + env(safe-area-inset-top,0px));left:12px;z-index:9999;height:40px;display:inline-flex;align-items:center;gap:8px;padding:0 16px;border-radius:999px;background:#14201F;color:#fff;font:700 13px/1 Jost,system-ui,sans-serif;text-decoration:none;box-shadow:0 4px 0 #0A1211;}
                .preview-back:active{transform:translateY(4px);box-shadow:0 0 0 #0A1211;}
              `}</style>
              <a href="/admin" className="preview-back">← Administracija</a>
            </>
          )}
          {children}
        </>
      ) : null}
    </>
  );
}

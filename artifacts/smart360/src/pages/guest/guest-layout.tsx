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
          {children}
        </>
      ) : null}
    </>
  );
}

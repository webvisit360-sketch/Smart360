import { useCallback, useEffect, useRef } from "react";
import rawTermsHtml from "@assets/pogoji_1_1787975884194.html?raw";

const termsHtml = rawTermsHtml.replace(
  "</head>",
  '<style>@import url("https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,100..900&display=swap");</style></head>',
);

export default function TermsPage() {
  const frameRef = useRef<HTMLIFrameElement>(null);

  const scrollToFragment = useCallback(() => {
    const rawFragment = window.location.hash.slice(1);
    if (!rawFragment) return;

    let fragment = rawFragment;
    try {
      fragment = decodeURIComponent(rawFragment);
    } catch {
      // A malformed fragment cannot name a valid element, so keep it unchanged.
    }

    frameRef.current?.contentDocument?.getElementById(fragment)?.scrollIntoView();
  }, []);

  useEffect(() => {
    window.addEventListener("hashchange", scrollToFragment);
    return () => window.removeEventListener("hashchange", scrollToFragment);
  }, [scrollToFragment]);

  return (
    <iframe
      ref={frameRef}
      title="Pogoji uporabe Smart360"
      srcDoc={termsHtml}
      onLoad={scrollToFragment}
      className="block w-full h-[100dvh] border-0 bg-[#F4F6F2]"
    />
  );
}
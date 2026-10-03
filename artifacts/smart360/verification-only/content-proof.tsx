// Standalone DEV evidence entry. Not imported by the application or production
// build. Reads the real guest projection of an approved unpublished DEV copy.
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import LivingGuideGuestShell from "../src/pages/living-guide/LivingGuideGuestShell";
import "../src/index.css";
import "../src/pages/living-guide/living-guide-tokens.css";
import "../src/pages/living-guide/living-guide-guest.css";

const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
function Proof() {
  const language=new URLSearchParams(window.location.search).get("lang")??"fr";
  const [tenant,setTenant]=useState<any>(null);
  const [error,setError]=useState("");
  useEffect(()=>{
    if(!import.meta.env.DEV)throw Error("DEV only");
    if(!["fr","nl","hr"].includes(language))throw Error("Unsupported proof language");
    document.documentElement.lang=language;
    fetch(`./verification-only/drobez-${language}.json`).then(r=>{if(!r.ok)throw Error("Proof data unavailable");return r.json();}).then(setTenant).catch(e=>setError(String(e)));
  },[language]);
  if(error)return <p role="alert">{error}</p>;
  if(!tenant)return <p>Loading DEV evidence…</p>;
  return <LivingGuideGuestShell tenant={tenant} slug={tenant.slug} lang={language}
    devWeather={null} onLanguageChange={lang=>{
      const url=new URL(window.location.href);url.searchParams.set("lang",lang);window.location.href=url.href;
    }}/>;
}
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={client}><Router hook={useHashLocation}><Proof/></Router></QueryClientProvider>
);
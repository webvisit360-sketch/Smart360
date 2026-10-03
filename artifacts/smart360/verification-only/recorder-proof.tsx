// DEV-only synthetic recording, real guide/recorder components, no DB writes.
import React from "react";
import {createRoot} from "react-dom/client";
import {QueryClient,QueryClientProvider} from "@tanstack/react-query";
import {Router} from "wouter";
import {useHashLocation} from "wouter/use-hash-location";
import LivingGuideGuestShell from "../src/pages/living-guide/LivingGuideGuestShell";
import {startTour,finishTour,saveTour,loadTour} from "../src/lib/live-tour";
import {purgeFinishedGuidedTours} from "../src/lib/guided-tour-persistence";
import tenantFixture from "./drobez-hr.json";
import "../src/index.css";

if(!import.meta.env.DEV)throw Error("DEV only");
const slug="recorder-evidence";
const tenant={...tenantFixture,slug,tourRecordingEnabled:true};
const lang=new URLSearchParams(location.search).get("lang")??"hr";
document.documentElement.lang=lang;
purgeFinishedGuidedTours();
(window as any).recorderProof={
 seed(status:"moving"|"finished"|"manual-paused",distanceM=120){
  const now=Date.now();
  const state={...startTour(now-120000,"hiking"),updatedAt:now-1000,movingMs:119000,distanceM,
   points:[{lat:46.34,lon:14.83,accuracy:5,altitude:400,timestamp:now-120000},{lat:46.341,lon:14.83,accuracy:5,altitude:401,timestamp:now-1000}]};
  saveTour(`${slug}/free-tour`,status==="finished"?finishTour(state,now):{...state,status});
  if(!loadTour(`${slug}/free-tour`))throw Error("Invalid synthetic fixture");
 },
};
createRoot(document.getElementById("root")!).render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}>
 <Router hook={useHashLocation}><LivingGuideGuestShell tenant={tenant} slug={slug} lang={lang} devWeather={null}
 onLanguageChange={next=>{const u=new URL(location.href);u.searchParams.set("lang",next);location.href=u.href;}}/></Router>
</QueryClientProvider>);
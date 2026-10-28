import { useEffect, useRef, useState } from "react";
import "pannellum";
import "pannellum/build/pannellum.css";
import license from "pannellum/COPYING?raw";
import { panoramaLabel } from "@/lib/panorama-media";

// Pannellum's distribution is a locally bundled browser side-effect module.
const library = () => (window as unknown as {
  pannellum: { viewer: (element: HTMLElement, options: Omit<Pannellum.ConfigOptions, "panorama"> & { panorama: string | HTMLImageElement }) => Pannellum.Viewer };
}).pannellum;

export default function SphericalPanorama({ src, preview, lang }: { src: string; preview: string; lang: string }) {
  const container = useRef<HTMLDivElement>(null);
  const [state, setState] = useState("loading");
  useEffect(() => {
    if (!container.current) return;
    let viewer: Pannellum.Viewer | undefined;
    let disposed = false;
    const error = panoramaLabel("error", lang);
    // Load as a real image, not Pannellum's default XHR. The guest worker
    // deliberately caches image requests, not arbitrary API fetches.
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
    if (disposed || !container.current) return;
    try {
      viewer = library().viewer(container.current, {
        type: "equirectangular", panorama: image, preview,
        dynamic: true, dynamicUpdate: true,
        autoLoad: true, showControls: false, showFullscreenCtrl: false,
        orientationOnByDefault: false, compass: false,
        haov: 360, vaov: 180, vOffset: 0, ignoreGPanoXMP: true,
        // Leave pitch bounds unset: Pannellum then permits the view CENTRE
        // at ±90°. Explicit bounds reserve half the viewport and hide poles.
        pitch: 0, yaw: 0,
        hfov: 90, minHfov: 30, maxHfov: 110, friction: 0.15,
        mouseZoom: true, keyboardZoom: false,
        capturedKeyNumbers: [],
        strings: {
          loadingLabel: panoramaLabel("loading", lang),
          noPanoramaError: error, fileAccessError: error, malformedURLError: error,
          iOS8WebGLError: error, genericWebGLError: error, textureSizeError: error, unknownError: error,
        },
      });
      const ready = () => { viewer?.setUpdate(false); if (!disposed) setState("ready"); };
      viewer.on("load", ready);
      viewer.on("error", () => { if (!disposed) setState("error"); });
      if (viewer.isLoaded()) ready();
    } catch { setState("error"); }
    };
    image.onerror = () => { if (!disposed) setState("error"); };
    image.src = src;
    const observer = new ResizeObserver(() => viewer?.resize());
    observer.observe(container.current);
    return () => {
      disposed = true;
      image.onload = image.onerror = null;
      image.src = "";
      observer.disconnect();
      viewer?.destroy();
    };
  }, [src, preview, lang]);
  return <>
    <div ref={container} className="lg2-pano-sphere" data-testid="panorama-sphere" data-state={state}
      aria-label={panoramaLabel("lookAround", lang)} />
    {state === "loading" && <div className="lg2-pano-status" role="status"
      style={{ backgroundImage: `linear-gradient(#10131788,#10131788), url(${JSON.stringify(preview)})`, backgroundSize: "cover", backgroundPosition: "center" }}>{panoramaLabel("loading", lang)}</div>}
    {state === "error" && <div className="lg2-pano-status" role="alert">{panoramaLabel("error", lang)}</div>}
    <details className="lg2-pano-license">
      <summary>Pannellum · MIT</summary>
      <pre>{license}</pre>
    </details>
  </>;
}

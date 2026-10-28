import { useState } from "react";
import { createRoot } from "react-dom/client";
import { PanoramaViewer } from "../../pages/living-guide/living-guide-panorama";
import "../../pages/living-guide/living-guide-guest.css";
import "../../pages/living-guide/simple/living-guide-simple.css";

const params = new URLSearchParams(location.search);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="1024"><defs><linearGradient id="g" x2="0" y2="1"><stop stop-color="#60aaff"/><stop offset=".5" stop-color="#46843b"/><stop offset="1" stop-color="#947340"/></linearGradient></defs><path fill="url(#g)" d="M0 0h2048v1024H0z"/><text x="100" y="500" font-size="100" fill="white">NORTH</text><text x="1124" y="500" font-size="100" fill="white">SOUTH</text></svg>`;
const source = params.get("image") || `data:image/svg+xml,${encodeURIComponent(svg)}`;
const media = [
  { id: "sphere", url: source, kind: "image", isPanorama: true, width: 4096, height: 2048 },
  { id: "flat", url: `data:image/svg+xml,${encodeURIComponent(svg.replace('height="1024"', 'height="600"'))}`, kind: "image", isPanorama: true, width: 2048, height: 600 },
];
function Fixture() {
  const [open, setOpen] = useState(true);
  return <div className={`lg2-app ${params.get("design") === "trend" ? "" : "lgs-root"}`}
    style={{ "--s-tile1": "#752355", "--s-outline": "#dce8f2", "--s-stroke": "#dce8f2", "--s-ink": "#fff" } as React.CSSProperties}>
    <button onClick={() => setOpen(true)}>Open panorama</button>
    {open && <PanoramaViewer media={media} initialIndex={0} lang="en" onClose={() => setOpen(false)} />}
  </div>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);

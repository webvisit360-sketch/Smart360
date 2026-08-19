import prototypeHtml from "@assets/prototip-2030_18_1787174221045.html?raw";

const match = prototypeHtml.match(
  /src:url\((data:font\/woff2;base64,[^)]+)\)/,
);

if (!match) {
  throw new Error("Inter WOFF2 was not found in the binding Living Guide prototype.");
}

/**
 * Exact self-hosted variable Inter WOFF2 embedded in the binding prototype.
 * Bundled with the app: no Google Fonts or other runtime request.
 */
export const livingGuideInterWoff2 = match[1];

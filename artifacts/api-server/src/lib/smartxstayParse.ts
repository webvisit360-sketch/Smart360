import { load, type CheerioAPI } from "cheerio";
import sanitizeHtml from "sanitize-html";

export type SourceEntry = {
  identity: string; pageId: string; category: string; section: string;
  title: string; body: string; bullets: string[]; images: string[];
  phone: string | null; website: string | null; mapQuery: string | null;
};
export type SourcePage = { guideId: string; lang: string; languages: string[]; entries: SourceEntry[]; skipped: string[] };
export const normalizedName = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
const clean = (html: string) => sanitizeHtml(html, {
  allowedTags: ["p", "br", "strong", "b", "em", "i", "u", "ul", "ol", "li", "h2", "h3", "h4", "a"],
  allowedAttributes: { a: ["href"] }, allowedSchemes: ["https", "http", "tel", "mailto"],
});
function images($: CheerioAPI, el: ReturnType<CheerioAPI>) {
  return [...new Set(el.find("img").map((_i, e) => $(e).attr("data-src") || $(e).attr("src") || "").get().filter(x => /^https:/.test(x)))];
}
function contacts($: CheerioAPI, el: ReturnType<CheerioAPI>) {
  const links = el.find("a[href]").map((_i, e) => $(e).attr("href")!).get();
  const mapQuery = links.find(x => /(?:maps\.google|google\.[^/]+\/maps|maps\.app\.goo\.gl)/.test(x)) ?? null;
  return {
    phone: links.find(x => x.startsWith("tel:"))?.slice(4) ?? null,
    website: links.find(x => /^https?:/.test(x) && x !== mapQuery) ?? null, mapQuery,
  };
}

/** Reads the rendered content only, never evaluates scripts or invents copy. */
export function parseSmartxstay(html: string, sourceUrl: string): SourcePage {
  const $ = load(html);
  const canonical = $('link[hreflang="x-default"]').attr("href");
  const guideId = new URL(canonical || sourceUrl).pathname.split("/").pop()!;
  const result: SourcePage = {
    guideId, lang: $("html").attr("lang") || "",
    languages: $('link[rel="alternate"][hreflang]').map((_i, e) => $(e).attr("hreflang")!).get().filter(x => x !== "x-default"),
    entries: [], skipped: [],
  };
  $(".section-page").each((_i, raw) => {
    const page = $(raw), pageId = page.attr("id")!;
    const nav = page.find(".section-nav-item.active span").text().trim();
    const landingLabel = $(".icon-item").filter((_j, e) =>
      ($(e).attr("onclick") || "").includes(`'${pageId.replace(/^section-/, "")}'`)).first().find(".label").text().trim();
    const category = nav || landingLabel || page.find(".section-header h1,.section-header h2,.section-title").first().text().trim();
    if (!category) throw new Error(`Vir ima stran brez naslova: ${pageId}`);
    const section = page.find(".section-nav-back span").text().trim() || category;
    const content = page.find(".section-content");
    const make = (identity: string, title: string, body: string, el: ReturnType<CheerioAPI>): SourceEntry => ({
      identity, pageId, category, section, title, body, bullets: [], images: images($, el), ...contacts($, el),
    });
    content.find(".site-place,.site-trail").each((_j, rawPlace) => {
      const place = $(rawPlace);
      const modal = place.find('[id^="place-modal-"],[id^="trail-modal-"]').first();
      const identity = modal.attr("id");
      if (!identity) throw new Error(`Vnos nima stabilne izvorne identitete: ${pageId}`);
      const copy = modal.length ? modal.clone() : place.clone();
      copy.find("script,style,button,svg,iconify-icon,img,h3").remove();
      // Preserve block boundaries while dropping source chrome/inline styling.
      copy.find("div").each((_k, node) => { $(node).append("<br>"); });
      const title = place.find("h3").first().text().trim();
      const entry = make(`${pageId}/${identity}`, title, clean(copy.html() || ""), place);
      entry.bullets = place.find("li").map((_k, e) => $(e).text().trim()).get();
      result.entries.push(entry);
    });
    const prose = content.clone();
    prose.find(".site-place,.site-trail,script,style,.image-fullscreen-overlay").remove();
    const fragments: string[] = [];
    prose.find(".component-heading,.component-text,.component-button").each((_j, e) => {
      if ($(e).parents(".component-heading,.component-text,.component-button").length) return;
      fragments.push(clean($(e).html() || ""));
    });
    const imgs = images($, prose);
    if (fragments.some(x => load(x).text().trim()) || imgs.length) {
      const entry = make(`${pageId}/content`, category, fragments.join("\n"), prose);
      entry.bullets = prose.find(".component-text li").map((_j, e) => $(e).text().trim()).get();
      result.entries.push(entry);
    }
    if (content.find(".component-form").length) result.skipped.push(`${category}: interaktivni obrazec ni prenosljiva vsebina.`);
    if (!result.entries.some(e => e.pageId === pageId)) result.skipped.push(`${category}: brez prenosljivega besedila ali fotografij.`);
  });
  if (!result.entries.length) throw new Error("Vir nima prepoznane vsebine smartxstay.");
  return result;
}

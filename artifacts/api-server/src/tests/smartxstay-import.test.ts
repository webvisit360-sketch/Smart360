import test from "node:test";
import assert from "node:assert/strict";
import { parseSmartxstay, normalizedName } from "../lib/smartxstayParse";
import { smartxstayUrl } from "../lib/smartxstayFetch";

const fixture = (lang = "sl") => `<html lang="${lang}"><head>
<link rel="alternate" hreflang="x-default" href="https://app.smartxstay.com/gen/s/stable"/>
<link rel="alternate" hreflang="sl"/><link rel="alternate" hreflang="en"/></head><body>
<div class="section-page" id="section-one"><nav class="section-nav">
<a class="section-nav-back"><span>Camp info</span></a><a class="section-nav-item active"><span>Dobrodošli</span></a></nav>
<div class="section-content"><div class="component-text"><p>Prva<br>Druga <strong>krepko</strong></p><ul><li>Ena</li></ul><script>bad()</script></div>
<div class="component-image"><img data-src="https://app.smartxstay.com/assets/1/original"></div>
<div class="image-fullscreen-overlay"><img data-src="https://app.smartxstay.com/assets/1/original"></div>
<div class="site-place"><h3>Kraj</h3><a href="tel:123">123</a><div id="place-modal-42"><p>Opis</p></div></div>
</div></div></body></html>`;

test("smartxstay preserves markup, stable identity, contacts and deduplicated images without scripts", () => {
  const result = parseSmartxstay(fixture(), "https://app.smartxstay.com/gen/s/alias?lang=sl");
  assert.equal(result.guideId, "stable");
  assert.equal(result.entries.length, 2);
  assert.equal(result.entries[0].identity, "section-one/place-modal-42");
  assert.equal(result.entries[0].phone, "123");
  assert.match(result.entries[1].body, /Prva<br \/>Druga <strong>krepko<\/strong>/);
  assert.doesNotMatch(result.entries[1].body, /bad|script/);
  assert.deepEqual(result.entries[1].images, ["https://app.smartxstay.com/assets/1/original"]);
  assert.deepEqual(result.entries[1].bullets, ["Ena"]);
  assert.equal(parseSmartxstay(fixture("en"), "https://app.smartxstay.com/gen/s/alias?lang=en").entries[0].identity, result.entries[0].identity);
});

test("smartxstay URL policy rejects non-guide, private, credentialed and deceptive destinations", () => {
  for (const url of ["http://app.smartxstay.com/gen/s/a", "https://127.0.0.1/gen/s/a",
    "https://app.smartxstay.com.evil.test/gen/s/a", "https://user@app.smartxstay.com/gen/s/a",
    "https://app.smartxstay.com:444/gen/s/a", "https://app.smartxstay.com/admin"]) {
    assert.throws(() => smartxstayUrl(url, true));
  }
  assert.equal(smartxstayUrl("https://app.smartxstay.com/gen/s/kampsavinja?lang=sl", true).hostname, "app.smartxstay.com");
  assert.equal(normalizedName("  PLAŽE  "), "plaze");
});

test("unknown source markup fails explicitly rather than importing invented text", () => {
  assert.throws(() => parseSmartxstay("<html>unsupported</html>", "https://app.smartxstay.com/gen/s/a"));
});

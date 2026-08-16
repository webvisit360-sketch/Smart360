# Prevodi: slovenščina, angleščina, nemščina, italijanščina

Priloga: `prevodi-melipu.zip` (`sl.json`, `en.json`)

Slovenščina je izvorni jezik. Angleški prevod celotne vsebine Meli Pu je pripravljen —
272 vsebinskih polj, besedila vmesnika in množinske oblike. Nemščina in italijanščina
prideta po istem kalupu.

Format ključev je **pot do polja v podatkih**, na primer
`DATA.stay.items[2].body[3]`. Tako se prevod veže na točno tisto polje in se ne izgubi,
če se besedilo v izvirniku spremeni.

---

## Navodilo za Replit (prilepi v celoti)

```
Add a translation layer for four languages: sl (source), en, de, it. The English content
for Meli Pu is attached and must import 1:1 — do not machine-translate anything that is
already in the file.

=====================================================================
1. STORAGE
=====================================================================

  table translation
    tenant_id
    lang          'en' | 'de' | 'it'          (sl lives in the content tables themselves)
    key           text   e.g. 'DATA.stay.items[2].body[3]'
    value         text
    updated_at
    PRIMARY KEY (tenant_id, lang, key)

Key = the path to the field in the tenant's content tree, built by one shared function used
by BOTH the reader and the admin. Never store translations positionally (row 3 of table X):
adding an item in the middle would silently shift every translation after it.

If a Slovene source field changes, mark its translations stale (a flag, not a delete) and
show them in the admin as "izvirnik se je spremenil" with the old translation still there.
Deleting the work because the source moved a comma is worse than showing something stale.

=====================================================================
2. WHAT IS NEVER TRANSLATED
=====================================================================

  - map queries (the `q` field) — a search for "Restavracija Pavel" must stay in Slovene,
    or Google Maps will not find the place
  - file names, URLs, icon names, difficulty codes (easy/mod/hard), distances, durations
  - phone numbers, the WiFi network name and password
  - the proper name of a business: "Gostilna Karjola" stays "Gostilna Karjola" in every
    language. Only the descriptive part is translated: "Plaža Svetilnik" -> "Svetilnik
    Beach", "Splošna bolnišnica Izola" -> "Izola General Hospital".
The attached file already follows this rule — copy its decisions, do not re-translate.

=====================================================================
3. PLURALS — THE PART THAT IS ALWAYS DONE WRONG
=====================================================================

Slovene has FOUR plural forms (1 / 2 / 3–4 / 5+): 1 ocena, 2 oceni, 3 ocene, 5 ocen.
English, German and Italian have two. A single stored string with a suffix cannot express
this, so store forms per language:

  table plural_form
    tenant_id (nullable — these are mostly system strings, shared)
    lang
    key        e.g. 'reviews'
    form       'one' | 'two' | 'few' | 'other'
    value      e.g. '{n} reviews'

Select the form with Intl.PluralRules(lang), never with your own if/else. For sl,
Intl.PluralRules returns one/two/few/other exactly as the language needs.

  new Intl.PluralRules('sl').select(2)  -> 'two'
  new Intl.PluralRules('en').select(2)  -> 'other'

The attached en.json contains the English forms for: reviews, info, experiences, places,
routes, products, rules, events.

=====================================================================
4. READING SIDE
=====================================================================

  - Language from, in order: ?lang= in the URL, the guest's saved choice
    (localStorage, keyed by slug), navigator.language, then the tenant's default.
  - Missing translation falls back to Slovene, silently for the guest. Never show a key,
    never show an empty block.
  - Set <html lang> to the active language, and hreflang alternates for the four URLs.
  - The language switcher is the existing globe button: list only the languages that the
    tenant has actually enabled, mark the current one.
  - ?lang= must survive the /g/ redirect and the alias canonicalisation.
  - The PWA manifest follows the active language for name and short_name.
  - The printed A6 label stays in the tenant's DEFAULT language — it hangs on a wall and
    cannot ask which language the reader prefers. The QR code points at the plain address
    without ?lang, so the guest's own phone decides.

=====================================================================
5. THE ADMIN SCREEN
=====================================================================

One screen, "Prevodi", per tenant:

  - Language tabs: EN · DE · IT, each with a coverage figure ("142 / 272").
  - Two columns: Slovene on the left, read-only; the translation on the right, editable in
    the same rich-text editor as the source field, so formatting cannot drift apart.
  - A filter: "vse / manjka / izvirnik se je spremenil".
  - Import and export JSON in exactly the attached format:
      {"lang":"en","content":{key:value,...},"ui":{...},"plurals":{...}}
    Import must report: how many keys were set, how many were skipped as unknown, how many
    were left unchanged. An import that silently drops half the file is the classic way to
    lose an afternoon of work.
  - Never overwrite an edited translation on import without asking.

=====================================================================
6. IMPORT THE ATTACHED FILE
=====================================================================

Import en.json for meli-pu and report the three numbers from point 5. Then open the guest
app with ?lang=en and walk all five screens: nothing may still be in Slovene except the
proper names listed in point 2.

=====================================================================
7. VERIFY
=====================================================================

  a) ?lang=en shows English; the choice survives a reload and a page change.
  b) A field with no translation shows Slovene, not a key and not an empty box.
  c) "4,95 · 128 ocen" reads "4.95 · 128 reviews" in English and uses the right Slovene
     form for 1, 2, 3 and 5.
  d) Change a Slovene source text: its English translation is marked stale, still visible.
  e) Add an item in the middle of a section: no translation jumps to the wrong item.
  f) Export EN, re-import it: zero changes reported.
  g) The A6 label prints in the tenant's default language whatever ?lang is set.
```

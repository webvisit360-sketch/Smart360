# Administracija: urejevalnik besedila namesto HTML

V administraciji so polja z besedilom prikazana kot surov HTML. Ko sva vsebino prenašala iz
prototipa, je bilo to najhitreje. Za vnašanje besedil pa je neuporabno: kdor piše, mora
gledati oznake namesto besedila, in vsaka pozabljena oznaka podre stran.

Vsa polja z besedilom dobijo urejevalnik z orodno vrstico. HTML ostane v bazi — spremeni se
samo to, kako se ureja.

---

## Navodilo za Replit (prilepi v celoti)

```
Every rich-text field in the admin must be edited in a WYSIWYG editor, not as raw HTML.
Today the editor shows tags like <p>, <b>, <ul><li> and the person writing the content has
to type around them. That is the single biggest obstacle to filling this app with content.

=====================================================================
1. WHICH FIELDS
=====================================================================

Every field whose value is rendered with dangerouslySetInnerHTML / v-html anywhere in the
guest app. Concretely: item body text, tab bodies, rules text, tip text ("Nasvet
gostitelja"), section intros, POI descriptions. Audit the render path and convert all of
them — a half-converted admin is worse than none, because the author cannot tell which
field wants plain language and which wants tags.

Short single-line fields (name, label, address, phone) stay plain text inputs. Do not put
a rich-text editor on a field that must never contain markup.

=====================================================================
2. THE EDITOR
=====================================================================

Use Tiptap (ProseMirror). It is headless, so it inherits our own styles instead of dragging
in a component library, and its schema is an allowlist by construction — content that is
not in the schema cannot be typed, pasted or imported.

Toolbar, in this order, nothing more:

  B   bold
  I   italic
  •   bullet list
  1.  numbered list
  🔗  link (URL field + "Odpri v novem oknu" checkbox)
  H   subheading   (renders as <h4>, the guest app already styles it)
  ↶ ↷ undo / redo

No font family, no font size, no colour, no alignment, no tables, no images inside text.
Typography belongs to the theme; if an author can set it per paragraph, no two
accommodations will ever look alike, which defeats the whole product.

  Schema allowlist: p, br, strong, em, ul, ol, li, a[href,target,rel], h4
  Everything else is stripped on the way in.

=====================================================================
3. PASTE IS THE HARD PART
=====================================================================

Content will arrive pasted from Word, from a website, from an e-mail. Pasted HTML carries
font tags, inline styles, spans with classes and Microsoft-specific markup, and if any of
it survives, the guest app's design is over.

  - Strip ALL attributes except href/target/rel on <a>.
  - Drop style, class, id, font, span, div, table, img, script, iframe entirely, keeping
    their text content.
  - Map <b> -> <strong>, <i> -> <em>, <h1..h3> -> <h4>.
  - Convert Word's list paragraphs into real <ul>/<ol>.
  - Collapse runs of &nbsp; into ordinary spaces.
  - Offer Ctrl/Cmd+Shift+V = paste as plain text, and say so in a hint under the toolbar.

=====================================================================
4. SANITISE ON THE SERVER TOO
=====================================================================

Client-side cleaning is a convenience, not a control: anything can POST to the API. Run the
same allowlist server-side on save (sanitize-html or equivalent), and reject rather than
silently truncate if the result differs wildly from the input — a surprised author is
better than lost text.

Store the sanitised HTML. Do not store Markdown: the guest app renders HTML today and a
second format would mean two render paths and two sets of bugs.

=====================================================================
5. MIGRATION OF WHAT IS ALREADY THERE
=====================================================================

The existing values are already valid HTML, so they load straight into the editor. Run the
sanitiser over the whole table once and log every field it changed, so we can eyeball the
diff before it goes live. Nothing needs re-typing.

=====================================================================
6. AN ESCAPE HATCH, DELIBERATELY OUT OF THE WAY
=====================================================================

Keep a "HTML" toggle in the field's overflow menu, disabled by default, for the rare case
where the markup itself is broken. It must round-trip through the same sanitiser as
everything else.

=====================================================================
7. VERIFY
=====================================================================

  a) Open any item's text field: you see formatted text, no tags.
  b) Type a bullet list and bold a word — the guest app shows exactly that.
  c) Paste three paragraphs from a Word document: no fonts, no colours, no spacing
     oddities carry over; the lists survive as lists.
  d) Paste from a random website with inline styles: same result.
  e) POST raw <script> to the API directly — it must be rejected or stripped server-side.
  f) An existing item edited and saved without changes produces no diff in the database.
```

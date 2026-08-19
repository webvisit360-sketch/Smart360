# Živi vodnik · popolna prenova gostove aplikacije

To ni popravek — to je **zamenjava celotnega videza in zgradbe gostove aplikacije** po
prototipu, ki sva ga zgradila in preizkusila. Administracija ostane, podatki ostanejo,
prevodi ostanejo; zamenja se vse, kar vidi gost, in doda se sistem naročil.

**Priloži datoteko `prototip-2030.html`** — to je zavezujoča referenca. Ni skica: je
delujoča aplikacija s 25 zasloni, štirimi barvnimi temami, prehodi, zvokom in galerijami.
Agent naj jo odpre, klika po njej in prepisuje vrednosti — ne izumlja svojih.

Razdeljeno je v pet delov; agent naj jih izvede **po vrsti in po vsakem delu poroča**,
preden nadaljuje. Tako nobena faza ne podre prejšnje.

---

## Navodilo za Replit (prilepi v celoti)

```
COMPLETE GUEST-APP REBUILD — "ŽIVI VODNIK" ("The Living Guide")

The attached file `prototip-2030.html` is a WORKING, self-contained prototype of the new
guest app: 25 screens, 4 time-of-day colour themes, transitions, swipeable galleries, a
guest sign-in sheet, an order flow, and a synthesized click sound. It is the BINDING
specification. Open it in a browser, click through every screen, and COPY its tokens,
class recipes, spacing and behaviour. Where this text and the prototype disagree, the
prototype wins. Where you are tempted to invent, don't — ask.

What survives unchanged: the admin portal, the database content (categories, items,
media, translations, WiFi fields, tenant settings), the four languages, passkey auth,
tenant URLs (smart360.info/<slug>), and the media pipeline. What is replaced: every
guest-facing screen, style and interaction. What is added: guest sign-in (unit number),
orders, and the time-of-day theme engine.

Work in five parts, IN ORDER. After each part: deploy to staging, run the part's VERIFY
list, and report with screenshots BEFORE starting the next part. Say which build/commit
each report refers to.

=====================================================================
PART 1 · DESIGN SYSTEM — TOKENS, TYPE, COMPONENTS
=====================================================================

1.1  THEMES — the guide lives with the hour of the day.
     Four token sets, applied as data-theme on <html>, chosen by the GUEST'S LOCAL clock:
       jutro  05:00–09:59   dan  10:00–16:59   vecer  17:00–20:59   noc  21:00–04:59
     Copy EVERY custom property from the prototype's body[data-t="…"] blocks verbatim.
     The key values, for your orientation (full sets are in the file):

       theme   bg       card     text     accent(acc)  acc-text(accg)  on-acc
       jutro   #FDF7E9  #FFFDF6  #2B2213  #F2AE2E      #AD6800         #2B2213
       dan     #FFFFFF  #F4F6F2  #121A14  #157347      #1D9159         #FFFFFF
       vecer   #FBF1E2  #FFF8EC  #2A2015  #B5551F      #D97A2E         #FFFFFF
       noc     #0C1322  #151D30  #EEF1F8  #E9A63A      #F2B84B         #231803

     Rules that must not be broken:
       - acc is for BUTTONS/SURFACES; accg is for COLOURED TEXT (times, "odprto",
         prices, kickers). They are calibrated per theme — never swap them.
       - on-acc is the text colour ON acc buttons. Morning and night use DARK text on
         their golden buttons (white fails contrast there); dan/vecer use white.
       - Every (text, background) pair in the prototype passes WCAG ≥ 4.0. If you add a
         new pair, verify it before shipping.
       - At night: a starfield of ~90 twinkling dots renders BEHIND the app content
         (screens are transparent to it, cards are solid). Copy #phstars + the
         body[data-t="noc"] .v{background:transparent} mechanism from the prototype.
       - Theme transitions animate (background/colour ~.9s). Respect
         prefers-reduced-motion everywhere.
       - Red (#D93A2B) exists ONLY for danger content (safety warnings, emergency
         entries). There is NO red button in any header — the prototype removed it.

1.2  TYPE. Inter variable, SELF-HOSTED woff2, latin + latin-ext subsets (č š ž in all
     four languages). No Google Fonts request at runtime. Weights via the variable axis;
     numbers use font-variant-numeric: tabular-nums wherever times/prices align.

1.3  COMPONENT RECIPES — copy from the prototype's CSS, class for class:
       .cardp  photo card: photo block + caption UNDER it (title + small line with
               live-dot / time), radius 20+, 1px line border, NO text over photos on
               grid cards.
       .ut     utility tile: card2 surface, icon in a white/card square, title+small.
       .pill / .chips   rounded chips: data, state ("odprto do" in accg), and filters.
       .facts  fact strip: 2–3 big tabular numbers with uppercase micro-labels.
       .steps  numbered circles (ink bg, bg-colour digit) + text.
       .rule / .rule--w   icon-in-square + sentence; --w = danger tint, red icon square.
       .seg    iOS segment (Prijava/Odjava).
       .wf + .cp   copy rows (WiFi) with a Kopiraj button (real clipboard write).
       .qr2    QR panel — QR is generated from the structured WiFi fields
               (WIFI:T:<enc>;S:<ssid>;P:<pass>;;), never from free text.
       .sub2   list row: 52px thumb (photo or icon), title, small, chevron.
       .nrow / .badge-n   notice row with thumb, group kickers (Danes/Včeraj), amber
               "novo" badge.
       .galtrack + .dots  swipeable gallery: horizontal scroll-snap, one dot per photo,
               dots follow scroll. Used on EVERY multi-photo context: detail heroes,
               unit pages, offer cards (.pgal small-dot variant). One photo = no dots.
       .sheet  content sheet over photo — see the LAYOUT LAW below.

1.4  THE LAYOUT LAW (the client cares about this one most):
     On every detail page: photo on top, content sheet at the bottom, and the sheet is
     EXACTLY as tall as its content — the photo stretches to absorb ALL remaining
     space (min-height ~175px; long content scrolls, photo shrinks to min). Implemented
     once, centrally (the prototype does it with
     .sc:has(.sheet){flex column} + .dhero{flex:1}). Bottom sheets (order, sign-in)
     likewise rise only to their content, bottom-anchored, dimmed page behind, and a
     TAP OUTSIDE THE SHEET CLOSES IT.
     Also central: ON EVERY NAVIGATION the target screen scrolls to TOP and all its
     galleries reset to the first photo. No screen may ever reopen mid-scroll.

1.5  SOUND + TOUCH. The IBM-style click is SYNTHESIZED with WebAudio (bandpass noise
     2600Hz + square chirp 1750→760Hz, ~45ms) + navigator.vibrate(6) — copy the click()
     function from the prototype. AudioContext is created/resumed on the FIRST user
     gesture (iOS). Every tappable element clicks. Buttons scale to .97 on press.

VERIFY 1: a tokens/demo page on staging shows all four themes side by side; theme
follows the device clock; night shows stars; fonts load offline; clipboard works;
click sound plays on first tap on a real iPhone.

=====================================================================
PART 2 · NAVIGATION + SCREENS
=====================================================================

2.1  BOTTOM BAR — five slots, THIS order:  Domov · Nastanitev · Ponudba · Okolica ·
     Program.  Labels are per-tenant (a hotel shows "Hotel", a house "Nastanitev" —
     reuse the existing tenant-type setting). Active tab: accg top-underline. The bar
     is a translucent glass surface (backdrop blur allowed here and on floating
     buttons; nowhere else).

2.2  DOMOV = the COVER. Full photo, bottom ink band with: kicker line, big tenant name
     (2 lines allowed), address, and a live row of up to three numbers ("bazen do
     20:00" with pulsing accg dot — driven by the items' opening-hours fields).
     "Odpri vodnik" button → Nastanitev. Search and language chips float top (glass).
     NO red button anywhere.

2.3  GUEST SIGN-IN SHEET — always the FIRST thing shown, rising bottom-up over the
     cover: unit/parcel/room number REQUIRED, name OPTIONAL, plus "Pozneje" skip link
     and tap-outside-to-skip. Persist in localStorage per tenant. After saving: a
     greeting strip at the top of Nastanitev ("Ana, dobrodošli · naročila gredo na:
     B-14", tap to edit), and every order form pre-fills unit+name with an
     "iz prijave" tag. Do not show the sheet again once saved (until cleared).

2.4  NASTANITEV — grid: one WIDE photo card on top (tenant chooses which item), photo
     cards for real things (Bazen, Bistro …) with live "odprto" line, then utility
     tiles: WiFi, Prijava in odjava, Vhod, Hišni red, Dobrodošli (welcome text +
     contact rows), Apartmaji/Sobe, Lokacija, Parkirišče, Navodila za opremo — mapped
     from the existing category data (items with tint set render as utility tiles;
     items with photos render as photo cards). Header: bell icon (notices, amber dot
     when unread) — no red. At the very bottom: a quiet underlined text link "Pomoč
     in nujni primeri" → the emergency page (112, urgenca, dežurna lekarna, okvare).
     Grid entrance: staggered rise (~45ms/card), first show per session only.

2.5  TEMPLATES — every content page is one of these, exactly as in the prototype:
       A  content page          (Bazen)         gallery-hero + sheet: title, fact strip,
                                                prose, ≤2 buttons, "Povezano" links
       B  list page             (Oprema, Apartmaji/Sobe, Kulinarika)  hero + sheet with
                                                .sub2 rows → children
       B2 steps page            (Bojler, Vhod)  gallery + steps + optional danger rule +
                                                Pokliči / Prijavi napako
       C  rules                 (Hišni red)     icon-rule rows, danger row red-tinted
       D  two states            (Prijava/Odjava) segment switch; Odjava offers the
                                                late-checkout order button → Ponudba
       E  copy data             (WiFi)          QR first, copy rows, note
       F  place                 (Gostilna)      gallery, chips (distance, odprto, €€),
                                                GOOGLE MAPS + Pokliči, weekly hours with
                                                today highlighted
       G  trail                 (GPX)           map, chips, elevation, "Vodenje po
                                                trasi" + GPX download, waypoints
       H  offer item + order    (see Part 4)
       I  event                 (Program rows → detail with prijava = same form as H)
     Units (Apartmaji/Sobe) are a GENERIC presentation (list → unit page with gallery,
     facts, amenity chips) — the app never claims to know WHICH unit the guest has;
     that comes only from the sign-in sheet.
     External-place buttons say "Google Maps", never "Navigacija". Our own trail
     feature is "Vodenje po trasi".

2.6  OKOLICA — title "Odkrij okolico"; ALL categories as chips at the top (Zajtrk,
     Kulinarika, Nočno življenje, Picerije, Aktivnosti, Pohodništvo, Kolesarjenje,
     Plaže, Kulturna dediščina, Naravna dediščina, Izleti, Dogodki — from the admin
     category list), then "Najbližje" rows. Chip → template-B list → template-F page.
     Distance and "odprto do" appear on every row/chip where data exists.

2.7  PROGRAM — week strip (selected day ink), legend + per-row dots: accg = V
     nastanitvi, blue #4A90D9 = Na območju; rows with time, thumb, price. Event page =
     template I. NOTICES (Obvestila) behind the bell: Danes/Včeraj groups, thumbs,
     amber "novo" badge.

2.8  TRANSITIONS: cover→content slides up like a book cover (~420ms spring
     cubic-bezier(.22,1,.36,1)); screen changes fade/slide (~550ms, prototype .v
     mechanism); sheets slide bottom-up. All honour prefers-reduced-motion.

VERIFY 2: side-by-side with the prototype at 390px — same screen, same spacing, same
radii, same type sizes, in all four themes; navigation always lands at top; galleries
swipe with dots on every multi-photo page; sign-in flows into the greeting strip.

=====================================================================
PART 3 · CONTENT MAPPING + LANGUAGES
=====================================================================

3.1  Map EXISTING data — do not migrate, do not duplicate: categories→tabs/sections,
     items→templates (declare the mapping in your report: which template each existing
     category renders as), media→galleries (first photo = cover; ratio + focal point
     fields keep working), WiFi structured fields→template E, tenant colour/logo→cover.
3.2  Every new UI string (Odpri vodnik, iz prijave, Pozneje, Naroči, Moja naročila,
     odprto do, novo, Pomoč in nujni primeri, …) goes through the existing i18n table
     in ALL FOUR languages. List the new keys in your report; the owner supplies SL
     text, translations follow the established workflow.
3.3  Delete no data. The old guest UI is removed only after VERIFY 5 passes.

VERIFY 3: Meli Pu renders completely in the new UI from existing production data with
zero content edits; language switch works on every new screen; no hardcoded strings.

=====================================================================
PART 4 · ORDERS (new functionality)
=====================================================================

4.1  Offer items get: price TEXT ("8 € / 0,5 l" — never a computed cart), optional
     multi-photo gallery, optional producer line (name, note like "400 m od vas"),
     sold-out flag (hides the button, keeps the card), and order-enabled flag.
4.2  Order sheet (template H, exactly as prototyped): quantity stepper, pickup choice,
     unit (pre-filled from sign-in, editable), name+phone (phone REQUIRED), send.
     Success overlay: drawn check animation, "Naročilo #N poslano", who will confirm.
     "Moja naročila" (device-local list) shows the guest their orders + status.
4.3  Server: orders table (tenant, item, qty, unit, name, phone, note, status
     novo→potrjeno→prevzeto / zavrnjeno, created_at). On create: e-mail to the TENANT
     with full details. No payments, no commission, money never touches us. Admin gets
     an "Naročila" tab with status buttons + "Pokliči"/"WhatsApp" links (wa.me with a
     prefilled confirmation text).
4.4  Safety: no order without phone; rate-limit per device/IP (a public QR must not
     allow 15 orders/min); orders auto-delete after 90 days (personal data), with this
     stated in the admin.
4.5  Same form serves EVENT sign-ups (template I "Prijava").

VERIFY 4: full loop on staging: sign in as guest → order 2× olje → tenant e-mail
arrives with unit B-14 → admin confirms → guest sees "potrjeno" under Moja naročila;
an order attempt without phone is blocked; 20 rapid orders are throttled.

=====================================================================
PART 5 · CUTOVER + GUARDRAILS
=====================================================================

5.1  Feature-flag the new UI per tenant; enable for Meli Pu first, walk the full
     checklist on a real iPhone and Android, then make it the default and delete the
     old guest UI code.
5.2  Standing rules (repeat offenders from past work — do not break them):
     - NO component libraries (shadcn/MUI/Bootstrap/Daisy) and NO icon libraries —
       icons come ONLY from the prototype's SVG sprite (copy it as the app sprite).
     - Photos over text, captions UNDER grid photos, no veils on grid cards.
     - Scrims on hero photos and glass surfaces (bottom bar, floating buttons) are the
       ONLY permitted gradients/blur. No decorative gradients on cards or buttons.
     - Check computed styles, not stylesheets, when a value "does not apply".
     - Every report states the build/commit and the exact staging URL it refers to.

VERIFY 5 (owner walks this): 4 themes by real clock · stars at night · first-tap
sound on iPhone · sign-in→greeting→pre-filled order · sheet heights hug content ·
tap-outside closes sheets · every navigation lands at top · galleries with dots
everywhere incl. offer cards · Google Maps naming · no red in headers · quiet help
link works · 4 languages · old URLs still resolve.
```

---

## Kaj priložiš zraven

| datoteka | zakaj |
|---|---|
| `prototip-2030.html` | zavezujoča referenca — 25 zaslonov, vse teme, vsa dinamika |

## Opombe zate

- **Fotografije v prototipu** so začasne z Wikimedie — agentu je to vseeno, ker gradi
  iz baze; v poročilih bo videl prave Meli Pu fotografije.
- **Del 4 (naročila)** je edini z novo bazo in e-pošto — zato je ločen in pride
  zadnji, ko dizajn že stoji.
- Ko bo VERIFY 5 čist, se stari dizajn pobriše — in takrat je »mir za štiri leta«
  zapisan tudi v kodi, ne le v želji.

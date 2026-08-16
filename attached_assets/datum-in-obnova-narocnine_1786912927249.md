# Datum vzpostavitve in obnova vzdrževanja

Vsaka stranka plačuje letno vzdrževanje. Da vem, koga in kdaj izstaviti, mora biti to
vidno na kartici stranke — ne v bazi.

---

## Navodilo za Replit (prilepi v celoti)

```
Every tenant pays a yearly maintenance fee. I need to see, at a glance, when each one was
set up and when their next payment is due.

=====================================================================
1. ON THE TENANT CARD
=====================================================================

  Vzpostavljeno: 14. 8. 2026
  Obnova: 14. 8. 2027  ·  čez 362 dni

  - "Vzpostavljeno" = created_at, already in the database. Show the date, not a relative
    time — "pred 3 meseci" is useless for invoicing.
  - "Obnova" = renews_at, a real editable field, NOT computed on the fly. Default it to
    created_at + 1 year when a tenant is created, but let me change it: a client who paid
    late, or who was given three free months, has a different date and I must be able to
    set it.
  - The day count next to it is derived from renews_at.

  Colour only when it matters: neutral normally, amber at 30 days or fewer, red when the
  date has passed. Never hide an expired tenant and never disable it automatically —
  payment is between me and the client, not something the software decides.

=====================================================================
2. ONE PLACE THAT ANSWERS "WHO DO I INVOICE"
=====================================================================

On the dashboard, a small card:

  Obnove v naslednjih 60 dneh
    Apartmaji Meli Pu    14. 9. 2026    čez 29 dni
    Bistro Tri Murve     02.10. 2026    čez 47 dni

  Sorted by date, soonest first, each row linking to the tenant. Include tenants whose date
  has already passed, at the top, marked. If nothing is due, say "Nobene obnove v naslednjih
  60 dneh" — an empty card with no explanation reads like a fault.

  Add "Obnova" as a sortable column in the tenant list too.

=====================================================================
3. WHEN A PAYMENT COMES IN
=====================================================================

  A button on the tenant card: "Obnovljeno za eno leto" — moves renews_at forward by
  exactly one year from its CURRENT value, not from today. A client who pays two weeks late
  must not silently gain two weeks every year.

  Keep a simple history: date, previous value, new value, who clicked. Three columns, no
  invoicing module — I only need to be able to prove when a renewal was recorded.

=====================================================================
4. WHAT THIS IS NOT
=====================================================================

No payment processing, no invoices, no reminders by e-mail, no automatic suspension. Just
two dates, a countdown and a button. If any of that is wanted later it will be its own task.

=====================================================================
5. VERIFY
=====================================================================

  a) Meli Pu shows its real created_at and a renewal date one year later.
  b) Set a renewal date 10 days out: the card turns amber and the tenant appears in the
     dashboard card.
  c) Set a date in the past: red, listed at the top, and the guest app keeps working.
  d) Press "Obnovljeno za eno leto" twice: the date moves two years from the original, not
     two years from today.
  e) A newly created tenant gets a renewal date automatically.
```

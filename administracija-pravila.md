# Smart360 — pravila administracije

Ta korenska evidenca hrani produkcijske dokaze in tehnična pravila, ki jih ni
dovoljeno sklepati iz razvojne kode ali testov.

## Dokazana dostava

- **28. 8. 2026 — prvo resnično dostavljeno sporočilo.** Oddaja ob
  22.10.48,990; ponudnikov zadnji dogodek `delivered`; prejem viden na telefonu
  ob 22.14 v mapi Nabiralnik.
- **29. 8. 2026 — povpraševanje `app444`.** ID ponudnika
  `f1ff068d-b5a8-45b2-b59e-2f4c09a0f3b5`; dogodek `email.delivered` ob
  04.32.55,752 UTC, **1,226 s** po `delivery_attempted_at`. Prvi trije poskusi
  webhooka so vrnili 500. Ponudnikov retry ob **05.09.05,469 UTC** je vrnil
  **HTTP 200** in brez ročnega posega spremenil vrstico v `delivered`.
  Produkcijski zaslon Povpraševanja je za `app444` prikazal
  **»E-pošta dostavljena«**, ID ponudnika in `email.delivered`.

Prvi poskusi so padli, ker CHECK constraint, odobren že prej, nikoli ni prišel
v produkcijo, medtem ko je Publish poročal `hasDiff: false`. Nova tabela pride
v produkcijo popolna; obstoječa tabela prejme samo nove stolpce, zato constrainti,
defaulti in preimenovanja nikoli ne pridejo sami in `hasDiff: false` ni dokaz
o njih.

Produkcijska SQL konzola zavrne eksplicitni `BEGIN`/`COMMIT` in izbrane stavke
sama ovije v en batch. Tako se v tem okolju izvaja odobreni DDL. Po izvedbi se
constraint vedno prebere nazaj iz `pg_constraint` z `pg_get_constraintdef`.
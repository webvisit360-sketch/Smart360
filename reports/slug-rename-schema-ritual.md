# Preimenovanje objavljenih naslovov: shema, meje odobritve in preverjanje

**Status:** razvojna baza ima obe odobreni spremembi sheme; v produkciji ni bila izvedena nobena sprememba. Ta dokument **ni** navodilo za samodejno izvedbo SQL v produkciji. Objavljanje aplikacije in produkcijsko migracijo vodi upravljavec; pred tem se ustavimo.

## Natančna odobrena DDL in doseg

V razvojni bazi je glavni agent po predstavitvi lastniku že izvedel **točno** naslednji dve spremembi v eni transakciji. Podatkov v obstoječih vrsticah `tenants` ni spreminjal; `draft_slug` je `NULL` za vse obstoječe vrstice. Nova tabela ob nastanku nima vrstic:

```sql
CREATE TABLE public.tenant_slug_reservations (
  slug text PRIMARY KEY,
  tenant_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tenants ADD COLUMN draft_slug text;
```

V produkciji mora Publish **najprej** uporabiti ustrezno migracijo sheme in šele potem zagnati API. API pred poslušanjem na vratih vstavi rezervacije iz dejanskih podatkov **tiste** baze; razvojnih vrstic ne kopira v produkcijo. Koda ob manjkajoči tabeli/stolpcu ne izvaja DDL in zagon odpove. Nobenega novega `FK` na rezervacijah: izbris nastanitve ne sprosti že uporabljenega naslova.

**Kaj mora nositi Publish:** definirana `tenants.draft_slug text NULL` in `public.tenant_slug_reservations` z natanko `slug text PRIMARY KEY`, `tenant_id uuid NOT NULL`, `created_at timestamptz NOT NULL DEFAULT now()` ter veljavnim/aktivnim indeksom primarnega ključa `slug`. Prenos zgolj aplikacijske kode brez te sheme ni uspešen deploy: zagonski bootstrap namensko odpove, preden API sprejme zahteve. Prikaz/odobritev shematske razlike je ločen korak operaterja; API nikoli ne izvaja nadomestnega `CREATE TABLE` ali `ALTER TABLE` ob zagonu.

Pričakovane omejitve: `tenants.slug` ima obstoječi `UNIQUE`, `tenant_aliases.slug` obstoječi `PRIMARY KEY`, nova `tenant_slug_reservations.slug` pa `PRIMARY KEY`. Obstoječih dveh omejitev ali indeksov **ne** spreminjamo. Sama obstoječa `UNIQUE` in `PRIMARY KEY` sta v različnih tabelah in zato **ne** varujeta skupnega imenskega prostora; nova rezervacijska tabela je edinstvena avtoriteta tudi za izbrisane zgodovinske naslove. `draft_slug` ni ne `UNIQUE` ne javna kanonična pot. Uporaba novega naslova v transakciji mora najprej uspešno zahtevati njegov `PRIMARY KEY`; zgodovinskega aliasa ne sme ponovno prevzeti niti isti lastnik.

### Obstoječa zagonska varnostna politika na **novi** tabeli

Že obstoječa zagonska funkcija `ensureRowLevelSecurity()` ponovno vzpostavi politike na vseh registriranih tabelah. Razširjena je **samo** za novo tabelo; z obstoječo `tenant_aliases` in njenimi `SELECT`-only privilegiji ne spreminja ničesar. Izvedba za novo tabelo sestavi naslednje stavke (upoštevati je treba tudi običajni obstoječi zagonski `REVOKE ALL ON ALL TABLES IN SCHEMA public FROM smart360_host`, ki mu sledijo dosedanji eksplicitni granti):

```sql
GRANT SELECT, INSERT ON tenant_slug_reservations TO smart360_host;
ALTER TABLE tenant_slug_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_slug_reservations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS host_scope ON tenant_slug_reservations;
CREATE POLICY host_scope ON tenant_slug_reservations FOR ALL
USING (
  (NOT (current_setting('app.role', true) = 'host'))
  OR (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
)
WITH CHECK (
  (NOT (current_setting('app.role', true) = 'host'))
  OR (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
);
```

Ti stavki so del obstoječega mehanizma varovanja dostopa in zadevajo **novo** tabelo, ne odobritve za dodatno spremembo že obstoječe `tenant_aliases`. Lastniški prehod `slug` je dovoljen upravljavcu: `actorGate` gostitelju prepove polje `slug`, strežnik pa vrne izrecni `403`, če poskuša gostitelj objaviti upravljavčev še čakajoči novi naslov. To prepreči poskus `INSERT` v `tenant_aliases`, za katerega gostitelj nima in **ne** dobi privilegija. Običajno gostiteljevo objavljanje vsebine ostane dovoljeno.

## Predlagana poizvedba za preverjanje sheme — samo branje

Preveriti je treba podatkovne tipe, `NULL` in `DEFAULT`. Za `draft_slug` se pričakuje `text`, `YES`, `NULL` (brez privzete vrednosti); za rezervacije `slug` je `text`, `NO`, `NULL`; `tenant_id` je `uuid`, `NO`, `NULL`; `created_at` je `timestamp with time zone`, `NO`, `now()`. Indeks PK mora biti veljaven in pripravljen; obstoječi indeksi se ne smejo tiho nadomestiti.

```sql
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'tenants' AND column_name IN ('slug', 'draft_slug'))
    OR (table_name = 'tenant_aliases' AND column_name IN ('slug', 'tenant_id'))
    OR (table_name = 'tenant_slug_reservations'
        AND column_name IN ('slug', 'tenant_id', 'created_at'))
  )
ORDER BY table_name, column_name;

SELECT t.relname AS table_name, c.conname, c.contype,
       pg_get_constraintdef(c.oid) AS definition,
       i.relname AS index_name, x.indisunique, x.indisvalid, x.indisready
FROM pg_constraint c
JOIN pg_class t ON t.oid = c.conrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
LEFT JOIN pg_class i ON i.oid = c.conindid
LEFT JOIN pg_index x ON x.indexrelid = c.conindid
WHERE n.nspname = 'public'
  AND t.relname IN ('tenants', 'tenant_aliases', 'tenant_slug_reservations')
  AND c.contype IN ('p', 'u')
ORDER BY t.relname, c.conname;
```

Za novo tabelo mora po zagonski nastavitvi RLS veljati `relrowsecurity = true` in `relforcerowsecurity = true`; za `host_scope` je pričakovana politika nad `tenant_id`. Te poizvedbe ne spreminjajo politike:

```sql
SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'tenant_slug_reservations';

SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'tenant_slug_reservations';
```

## Idempotentna vzpostavitev rezervacij — SAMO DML, pred poslušanjem

Prejšnja **samo bralna produkcijska** poizvedba je našla **0 vrstic** v `tenant_aliases`; to ni napoved števila nastanitev ali rezervacij ob prihodnjem Publish. Izvorne vrstice iz produkcijskih `tenants` in `tenant_aliases` se ob zagonu vstavijo v **produkcijsko** tabelo. Koda uporablja eno transakcijo s transakcijsko svetovalno ključavnico, `ON CONFLICT DO NOTHING` in nato primerjavo lastništva. Natančni stavki, enakovredni kodi (prvi zagon vpliva le na manjkajoče rezervacije, naslednji zagoni ne prepisujejo nobene vrstice):

```sql
BEGIN;
SELECT pg_advisory_xact_lock(530750783);
INSERT INTO tenant_slug_reservations (slug, tenant_id)
SELECT slug, id FROM tenants
UNION
SELECT slug, tenant_id FROM tenant_aliases
ON CONFLICT (slug) DO NOTHING;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM (
      SELECT slug, id AS tenant_id FROM tenants
      UNION
      SELECT slug, tenant_id FROM tenant_aliases
    ) AS source
    JOIN tenant_slug_reservations AS reserved USING (slug)
    WHERE reserved.tenant_id <> source.tenant_id
  ) THEN
    RAISE EXCEPTION 'Kolizija naslovov nastanitev in zgodovinskih rezervacij: zagon ustavljen.';
  END IF;
END $$;
COMMIT;
```

Ob napaki se transakcija povrne in API ne začne poslušati. To je **že odobrena** idempotentna podatkovna vzpostavitev, ne samodejna shematska migracija. Ne spreminja `tenants`, `tenant_aliases`, že obstoječih rezervacij, `draft_slug` ali podatkov iz razvoja.

### Preverjanje pokritosti — samo branje

Po vzpostavitvi morata obe spodnji poizvedbi vrniti **0 vrstic**; `LEFT JOIN` posebej razkrije manjkajoče rezervacije in napačnega lastnika. Število vrstic samo zase ni dokaz pravilnosti.

```sql
WITH source AS (
  SELECT slug, id AS tenant_id FROM public.tenants
  UNION
  SELECT slug, tenant_id FROM public.tenant_aliases
)
SELECT source.slug, source.tenant_id AS expected_owner,
       reserved.tenant_id AS reserved_owner
FROM source
LEFT JOIN public.tenant_slug_reservations reserved USING (slug)
WHERE reserved.slug IS NULL
   OR reserved.tenant_id IS DISTINCT FROM source.tenant_id
ORDER BY source.slug;

WITH source AS (
  SELECT slug, id AS tenant_id FROM public.tenants
  UNION
  SELECT slug, tenant_id FROM public.tenant_aliases
)
SELECT slug, count(DISTINCT tenant_id) AS competing_owners
FROM source
GROUP BY slug
HAVING count(DISTINCT tenant_id) > 1;
```

Kontrolna agregata brez izpisovanja osebnih podatkov:

```sql
SELECT 'tenants' AS source, count(*) FROM public.tenants
UNION ALL SELECT 'tenant_aliases', count(*) FROM public.tenant_aliases
UNION ALL SELECT 'tenant_slug_reservations', count(*) FROM public.tenant_slug_reservations;
```

## Pogojni popravek operaterja, samo ob izrecnem ponovnem dovoljenju

**NE izvajati ob zagonu. NE izvajati, če prejšnje bralne poizvedbe kažejo drugačno shemo ali če lastnik ni posebej potrdil posega.** Naslednji operatorjev predlog preveri prisotnost stolpca in tabele ter veljavnost pričakovanih tipov. Če ima **že obstoječa nova tabela** manjkajoč PK, najprej zavrne `NULL` in podvojene `slug`, šele potem doda imenovani PK. Ne odstrani nobenega indeksa ali nepričakovane omejitve, ne popravlja podatkov in se ne dotakne obstoječih omejitev `tenants`/`tenant_aliases`.

```sql
BEGIN;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tenants'
      AND column_name = 'draft_slug'
  ) THEN
    ALTER TABLE public.tenants ADD COLUMN draft_slug text;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tenants'
      AND column_name = 'draft_slug' AND data_type = 'text'
      AND is_nullable = 'YES' AND column_default IS NULL
  ) THEN
    RAISE EXCEPTION 'tenants.draft_slug ima nepricakovano definicijo';
  END IF;

  IF to_regclass('public.tenant_slug_reservations') IS NULL THEN
    CREATE TABLE public.tenant_slug_reservations (
      slug text PRIMARY KEY,
      tenant_id uuid NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'tenant_slug_reservations'
        AND column_name = 'slug' AND data_type = 'text'
    ) OR NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'tenant_slug_reservations'
        AND column_name = 'tenant_id' AND data_type = 'uuid' AND is_nullable = 'NO'
    ) OR NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'tenant_slug_reservations'
        AND column_name = 'created_at' AND data_type = 'timestamp with time zone'
          AND is_nullable = 'NO' AND column_default = 'now()'
    ) THEN
      RAISE EXCEPTION 'Tabela rezervacij ima nepricakovane stolpce; ustavi in preglej ročno';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.tenant_slug_reservations'::regclass
        AND contype = 'p'
    ) THEN
      IF EXISTS (
        SELECT 1 FROM public.tenant_slug_reservations WHERE slug IS NULL
      ) OR EXISTS (
        SELECT 1 FROM public.tenant_slug_reservations
        GROUP BY slug HAVING count(*) > 1
      ) THEN
        RAISE EXCEPTION 'Rezervacije imajo prazne ali podvojene sluge; PK ni mogoce dodati';
      END IF;
      ALTER TABLE public.tenant_slug_reservations
        ADD CONSTRAINT tenant_slug_reservations_pkey PRIMARY KEY (slug);
    END IF;
    IF EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_index i ON i.indexrelid = c.conindid
      WHERE c.conrelid = 'public.tenant_slug_reservations'::regclass
        AND c.contype = 'p'
        AND (pg_get_constraintdef(c.oid) <> 'PRIMARY KEY (slug)'
             OR NOT i.indisvalid OR NOT i.indisready)
    ) THEN
      RAISE EXCEPTION 'Nepricakovan ali neveljaven PK; ustavi in preglej ročno';
    END IF;
  END IF;
END $$;
COMMIT;
```

Če PK sicer obstaja, vendar ni na `slug`, je neveljaven ali je v tabeli drugačna omejitev, se **ne** izvaja slep popravek; rezultat bralne poizvedbe se pokaže lastniku pred vsakim novim SQL. Ta blok je rezervna, pogojna operatorska pot za odobreno strukturo, **ni** del samodejnega zagona niti dovoljenje za širšo migracijo.

## Funkcionalna meja in dokaz v razvoju

Lastniška sprememba objavljenega naslova ostane osnutek, dokler pregled objave z žetonom ne potrdi vrstice: »Stari naslov {old} bo za vedno preusmerjen na {new}. Natisnjene QR kode bodo delovale še naprej.« Šele ista transakcija doda stari alias, zadrži novega in prestavi objavljeni posnetek; stari gostujoči URL, manifest in API podpot vrnejo HTTP 301 na zadnji kanonični naslov s preostankom poti in poizvedbo. Pred prvo objavo nastanek aliasa ni dovoljen. Javna projekcija odstrani `draft_slug`; QR/PDF in e-pošta uporabljajo kanonični `slug`. Gostitelj ne sme objaviti lastnikovega osnutka URL (403).

Razvojni preizkus preko dejanskega HTTP in razvojne baze: zaporedje A→B→C, stari A→C in B→C, manifest/iskanje z ohranjeno poizvedbo, odsotnost aliasa pred objavo in ob zastarelem žetonu, neprenos osnutka v gostujoč odgovor, QR/PDF, prilagojena domena in gostiteljev 403. Paket `cp2b-cockpit.test.ts`: **13/13 uspešno**. Ločeni `slug-namespace-concurrency.test.ts`: **1/1 uspešno**; dve že objavljeni različni nastanitvi lahko predlagata isti prosti naslov, hkratno potrjeno objavljanje pripusti natanko enega zmagovalca (200), drugi prejme slovenski 409 brez delnega aliasa ali spremembe kanoničnega URL. Preverjeni so zgodovinski naslov, rezervacija, podatki v QR PNG (ne zgolj ime datoteke), novi povezavi in QR v **obeh** načinih obvestila ter izpis URL v nalepkah PDF. TypeScript API in knjižnice preverjeni. To ni dokaz izvedene produkcijske migracije ali objave. **STOP: ničesar ne objavljaj brez lastnikovega naslednjega koraka.**
# Urejevalnik naslovnice — specifikacija

Delujoč vzorec: `predogled-poteg.html` → gumb z drsniki zgoraj desno na naslovnici.
Označba urejevalnika je v `zasloni-poteg.html` na dnu.

## Polja

| Polje v bazi (`Tenant`) | Nadzor v administraciji | Meje | Privzeto |
|---|---|---|---|
| `coverTitle` | besedilno polje | prosto | ime nastanitve |
| `coverSubtitle` | besedilno polje | prosto | podnaslov nastanitve |
| `coverTitleSize` | drsnik, px | 24–84 | **56** |
| `coverTitleOpacity` | drsnik, % | 20–100 | **66** |
| `coverTextColor` | izbirnik + 6 prednastavljenih | hex | **#FFFFFF** |
| `coverSubSize` | drsnik, px | 12–40 | **22** |
| `coverSubOpacity` | drsnik, % | 20–100 | **50** |
| `coverMetaSize` | drsnik, px | 12–32 | **19.5** |
| `coverMetaOpacity` | drsnik, % | 20–100 | **60** |
| `coverVeil` | drsnik, % | 0–60 | **26** |
| `coverAlign` | dva gumba: Levo / Sredina | left \| center | **left** |
| `coverShowRating` | dva gumba: Prikaži / Skrij | bool | **true** |

Prednastavljene barve: `#FFFFFF`, `#F6F1E9`, `#FFE9B8`, `#3B78DC`, `#14201F`, `#C4552E`.

## Kako se vrednosti prenesejo na javno stran

Ne piši novih razredov. Vrednosti nastavi kot **CSS spremenljivke** na korenu dokumenta (ali na `.cover`), CSS jih že bere:

```js
const r = document.documentElement.style;
r.setProperty("--tt-txt",  t.coverTextColor);
r.setProperty("--tt-size", t.coverTitleSize + "px");
r.setProperty("--tt-op",   t.coverTitleOpacity / 100);
r.setProperty("--st-size", t.coverSubSize + "px");
r.setProperty("--st-op",   t.coverSubOpacity / 100);
r.setProperty("--mt-size", t.coverMetaSize + "px");
r.setProperty("--mt-op",   t.coverMetaOpacity / 100);
r.setProperty("--veil",    t.coverVeil / 100);
r.setProperty("--cover-align", t.coverAlign);
r.setProperty("--cover-just",  t.coverAlign === "center" ? "center" : "flex-start");
```

Pri strežniškem izrisu (SSR) enako, samo kot `style` atribut na `.cover`, da ni utripanja ob nalaganju.

## Obnašanje urejevalnika

- **Živ predogled:** ob premikanju drsnika se naslovnica spreminja sproti, brez shranjevanja
- Ob vsakem drsniku je izpisana trenutna vrednost (npr. `56px`, `66 %`)
- Gumba **Ponastavi** (vrne privzete vrednosti iz tabele) in **Shrani**
- Vrednosti se hranijo **pri posamezni nastanitvi**, ne globalno
- Če je `coverTitle` prazen, se na javni strani izpiše `name`; enako `coverSubtitle` → `subtitle`

## Pomembno

Zatemnitev fotografije (`--veil`) je **enakomerna čez celo fotografijo**, brez preliva. Prejšnja različica je pokrivala samo spodnji del in se je čez sliko vlekla vidna vodoravna črta — tega ne ponavljaj.

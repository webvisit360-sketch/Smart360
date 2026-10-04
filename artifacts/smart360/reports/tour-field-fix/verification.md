# POVZETEK ZA LASTNIKA

Popravek je v razvojnem okolju. Brez objave.

## Zemljevid: ročni pogled in celozaslonski prikaz

Skupni zemljevid za snemalnik in vodene ture ob ročnem premiku, povečavi ali
zasuku ustavi samodejno upravljanje kamere. Sled in GPS položaj se še naprej
posodabljata. Gumb za ponovno centriranje obnovi sledenje. Odhod iz pogleda
ponastavi ročni način; preklop celozaslonskega prikaza ga ne.

Na zemljevidu je nevtralen gumb za razširitev, v celozaslonskem prikazu gumb
za zmanjšanje. Isti zemljevid se prestavi med vsebnikoma; snemanje ostane živo.
Dostopna imena za razširitev, zmanjšanje in centriranje so preverjena v vseh
sedmih jezikih.

Lokalni Chromium s programskim WebGL2, pravi MapLibre in zemljevidne ploščice,
390 × 844, sintetični GPS in dejanski dvoprstni dogodki:
- Oba načina: pinch je nastavil zoom 14,106915; po treh GPS posodobitvah
  sta zoom in središče ostala povsem enaka.
- Dvoprstni premik je premaknil središče; naslednji GPS položaj ga ni vrnil.
- Ponovno centriranje je obnovilo sledenje zadnjemu položaju in zoom 15.
- Celozaslonski pravokotnik je x=0, y=0, širina=390, višina=844.
- Isti element zemljevida je preživel razširitev in zmanjšanje; ves čas en GPS opazovalec.
- Ločeni brskalniški preizkus je potrdil nadaljnje merjenje: snemalnik 44→74 m,
  vodena tura 25→50 m, časovnik in sled po izhodu ohranjena.

Meritve: camera-measurements.json. Zajemi: guided-pinch-persist.png,
free-pinch-persist.png, guided-fullscreen.png, free-fullscreen.png.

## Facebook

Web Share Level 2 pošlje samo:

    navigator.share({ files: [File("<ime ture>.png", type: "image/png")] })

Pred tem se preveri navigator.canShare z enakim files-only payloadom.
Odstranjen je bil neobvezni title; ni text, url, URL-only vsebine ali posebnih
Facebook metapodatkov. Pri nepodprtem deljenju se slika prenese. Preklic ostane preklic.
Brskalniški prestreznik je potrdil eno PNG datoteko, identično bajtom predogleda.

Izbira med običajno objavo in zgodbo se zgodi v aplikaciji Facebook.
Smart360 je prek Web Share ne more določiti. Brez obvodov ali Facebook deep-linkov.
Dejansko vedenje Facebooka na fizičnem iPhonu ni bilo preverjeno.

## Trak

Samo kartica za deljenje: 7 px pri 1x oziroma 14 px v PNG pri 2x.
Prejšnji izvoz je imel 11 oziroma 22 px. E-pošta in nalepke niso spremenjene.
Meritev na izvoženem PNG 1080 × 1612: trak zajema vrstice 210–223, zemljevid
se začne v vrstici 224. Preverjena sta pravi zemljevid in shematski rezervni izvoz,
barvni prehodi ter bajtna enakost prenosa in predogleda.
Primerjava trak-before-after.png uporablja izreza dejanskih starih/novih PNG.

## Meje dokazila

TypeScript in 18 ciljnih testov uspešnih. Oddaljeni testni brskalnik ni imel
WebGL2; dokaz geste je zato iz ločenega lokalnega Chromiuma s programskim
WebGL2, ne iz praznega zemljevida ali ponarejenega prikaza. To ni terenski
preizkus na fizičnem iPhonu. Ni sprememb podatkov v bazi ali objave.
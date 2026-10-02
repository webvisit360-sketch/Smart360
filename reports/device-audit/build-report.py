from pathlib import Path
from PIL import Image, ImageDraw
import base64, json, html

root = Path(__file__).parent
cards = [('before-390.png', 'PREJ: produkcija 390 x 844'),
         ('after-390.png', 'POTEM: razvoj 390 x 844'),
         ('before-412.png', 'PREJ: produkcija 412 x 915'),
         ('after-412.png', 'POTEM: razvoj 412 x 915')]
canvas = Image.new('RGB', (1660, 980), '#e9ece9')
draw = ImageDraw.Draw(canvas)
for i, (name, title) in enumerate(cards):
    draw.text((i*415+8, 16), title, fill='black')
    canvas.paste(Image.open(root/name).convert('RGB'), (i*415, 50))
canvas.save(root/'hero-comparison.png')

def image(name):
    data = base64.b64encode((root/name).read_bytes()).decode()
    return f'<img src="data:image/png;base64,{data}" alt="{html.escape(name)}">'

report = '''<!doctype html><html lang="sl"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>A-frame — primerjava naprav in PWA</title>
<style>body{font:16px/1.55 system-ui;max-width:1200px;margin:32px auto;padding:0 24px;color:#18251c}
h1,h2{line-height:1.2}table{border-collapse:collapse;width:100%}td,th{padding:12px;border:1px solid #ccd4ce;text-align:left}
img{max-width:100%;height:auto}pre{white-space:pre-wrap;background:#edf1ed;padding:18px;font-size:13px}
.note{padding:18px;background:#fff4da}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
@media(max-width:700px){.grid{grid-template-columns:repeat(2,1fr)}}small{color:#536158}</style>
<h1>A-frame: primerjava naprav in namestitve PWA</h1>
<p>2. oktober 2026 · Turizem Drobež · produkcija: https://smart360.info · <b>brez objave</b></p>
<p class="note">PREJ je dejanska produkcija. POTEM je razvojna koda z bralno kopijo objavljenega posnetka in resničnimi produkcijskimi fotografijami.
To so Chromium posnetki pri zahtevanih velikostih, ne posnetki fizičnih telefonov ali dokaz uspešne namestitve WebAPK.</p>
<h2>1. Fotografija in položaj lista</h2>
<p>Težava ni samo object-fit. Galerija je višino izračunavala iz mediane razmerij slik z omejitvami glede na višino okna;
list je dodatno prekrival fotografijo glede na preostalo višino okna. Brskalnikova orodna vrstica zato lahko spremeni vidni del.
Omejitve galerije in začetno razkritje slike so zdaj vezani na širino, z referenco obstoječega prikaza 390 × 844.
Poravnava slike ostaja center. Premikanje celotnega lista ostaja ohranjeno.</p>
<table><tr><th>Viewport</th><th>Slika prej → potem</th><th>Vrh lista prej → potem</th></tr>
<tr><td>390 × 844</td><td>390 × 520 → 390 × 520</td><td>406 → 406 px</td></tr>
<tr><td>412 × 915</td><td>412 × 549 → 412 × 549</td><td>477 → 428,89 px</td></tr></table>
<p>Razmerje začetno odkrite višine proti širini je po spremembi pri obeh 1,04103. Celoštevilsko zaokroževanje višine galerije pomeni manj kot 1 px razlike.
Prikaz pri 390 × 844 ostaja ohranjen. Posnetki s polno višino browser viewporta sami ne reproducirajo zmanjšanja prostora zaradi Samsungove orodne vrstice;
odpravljena je ugotovljena odvisnost od višine. V prilogah lastnika je iPhone v temni, Android pa v svetli temi; teme nismo spreminjali.</p>
'''
report += '<div class="grid">' + ''.join(f'<section><h3>{title}</h3>{image(name)}</section>' for name,title in cards) + '</div>'
report += '''<h2>2. Prazen list je vsebinsko stanje</h2>
<p>Objavljeni javni posnetek vsebuje <code>body: null</code>, <code>bullets: []</code> in <code>noteText: null</code>.
List prikazuje naslov A-frame. Z vlečenjem se ne razkrije manjkajoč opis. Vsebine nismo dodajali ali spreminjali.</p>
<h2>3. Namestljivost in ikona</h2>
<table><tr><th>Preverjanje</th><th>Produkcija pred spremembo</th><th>Po spremembi</th></tr>
<tr><td>HTTPS, manifest</td><td>HTTPS; HTTP 200; application/manifest+json; brez napak razčlenitve</td><td>Nespremenjeno</td></tr>
<tr><td>Ime, prikaz, začetni URL in scope</td><td>Turizem Drobež; standalone; /turizem-drobez/ za start_url in scope</td><td>Nespremenjeno</td></tr>
<tr><td>Ikone</td><td>192/512 any in 192/512 maskable; vse HTTP 200 image/png</td><td>Nespremenjeno</td></tr>
<tr><td>Worker scope</td><td>/turizem-drobez/; Service-Worker-Allowed se ujema</td><td>Nespremenjeno</td></tr>
<tr><td>CDP, običajni persistent Chromium</td><td>Page.getInstallabilityErrors: []</td><td>V lokalnem nadzorovanem preizkusu prav tako []</td></tr>
<tr><td>Prva aktivacija workerja ob zastoju prenosa</td><td>installing; brez controllerja</td><td>activated; controller prisoten</td></tr></table>
<p>Na produkciji je prvo nameščanje workerja čakalo več kot 113 sekund; koda pred aktivacijo zaporedno prednalaga graf datotek.
Sprememba odstrani to čakanje samo pri prvi namestitvi. Predpomnjenje sproži obstoječe sporočilo strani po aktivaciji.
Posodobitve že aktivnega workerja še vedno najprej pripravijo novo offline kopijo.</p>
<p class="note"><b>Vzrok Samsungove bližnjice ni dokazan.</b> Produkcija je v običajnem Chromium profilu že pred popravkom brez napak namestljivosti,
tudi pri še nameščajočem se workerju. Zato počasnega workerja ne označujemo kot dokazano oviro WebAPK.
Zasebni kontekst je poročal in-incognito; to je omejitev testa, ne produkcijska napaka.
Fizična namestitev na Androidu, stanje stare bližnjice in morebitna napaka Androidove storitve za izdelavo WebAPK niso bili preverjeni.</p>
<h3>Ikona, ki jo ponuja manifest</h3>
<p>Produkcijska 512px maskable ikona je RGB brez alfe, z belo podlago do roba. Znak je znotraj osrednjega 80-odstotnega varnega kroga:
0 nebelih pik zunaj njega. Vidne meje znaka so približno 87–425 px. Desno je simulirana krožna Android maska,
ne fotografija nameščene aplikacije. Chrome značka ni del datoteke ikone.</p>'''
report += image('android-icon-preview.png')
report += '<h2>4. Dokazi in omejitve</h2><p>34 ciljnih testov uspešnih; oba TypeScript pregleda uspešna. Spremembe niso objavljene. Razvojni tenant ni objavljen, zato je bil za vizualni test uporabljen samo javni produkcijski JSON; razvojni endpoint workerja za ta slug vrne 404. Dejanski generirani worker je bil zato dodatno preizkušen v izoliranem običajnem Chromium profilu na zaupanja vrednem localhost izvoru. To ni celovit test offline aplikacije.</p>'
for name in ['manifest-before.json','worker-proof.json']:
    report += f'<h3>{name}</h3><pre>{html.escape((root/name).read_text())}</pre>'
report += '<p><b>Zaključek: popravek izreza in prve aktivacije pripravljen; vzrok konkretne Samsungove WebAPK težave ostaja odprt. Brez objave.</b></p></html>'
(root/'porocilo.html').write_text(report)
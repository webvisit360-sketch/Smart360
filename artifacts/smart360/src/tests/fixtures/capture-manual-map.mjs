import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const out='reports/tour-field-fix';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:execFileSync('which',['chromium'],{encoding:'utf8'}).trim(),headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const report=[];
try {
 for(const [kind,path,start] of [['guided','/src/tests/fixtures/live-tour.html','button-tour-start'],['free','/free-tour.html?externalGps=1','button-free-tour-start']]){
  const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
  await page.addInitScript(()=>{
   const watchers=new Map();let id=0;
   Object.defineProperty(navigator,'geolocation',{value:{watchPosition:cb=>{watchers.set(++id,cb);return id;},clearWatch:i=>watchers.delete(i)}});
   window.fix=(meters=0)=>{for(const cb of watchers.values())cb({timestamp:Date.now(),coords:{latitude:45.536+meters/111195,longitude:13.66,accuracy:5,altitude:5,altitudeAccuracy:5,heading:30,speed:3}})};
   window.watchers=()=>watchers.size;
  });
  await page.goto(`http://127.0.0.1:80${path}`);
  await page.waitForTimeout(900);
  await page.evaluate(()=>window.fix());
  await page.getByTestId(start).click();
  const skip=page.getByTestId('button-tour-profile-skip');
  if(await skip.count())await skip.click();
  // Profile sheet uses an accessible localized skip label.
  const dialog=page.locator('.s360-profile-dialog');
  if(await dialog.count())await dialog.getByRole('button',{name:/Preskoči/}).click();
  await page.waitForTimeout(2000);
  await page.evaluate(()=>window.fix(5));
  const map=page.getByTestId('map-gpx');
  await map.scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  const canvas=map.locator('canvas'); await canvas.waitFor();
  await canvas.evaluate(el=>window.originalMapCanvas=el);
  const b=await canvas.boundingBox(); const x=b.x+b.width/2,y=b.y+b.height/2;
  const cdp=await page.context().newCDPSession(page);
  const touch=(type,d)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x:x-d,y,id:1},{x:x+d,y,id:2}]});
  await touch('touchStart',65);
  for(const d of [60,55,50,45,40,35]){await touch('touchMove',d);await page.waitForTimeout(70);}
  await touch('touchEnd',0);
  await page.waitForTimeout(800);
  await page.getByTestId('button-tour-recenter').waitFor();
  const read=()=>map.evaluate(el=>({zoom:Number(el.dataset.cameraZoom),center:el.dataset.cameraCenter}));
  const before=await read();
  for(const m of [15,25,35]){await page.evaluate(m=>window.fix(m),m);await page.waitForTimeout(500);}
  assert.deepEqual(await read(),before,`${kind}: pinch camera persists through GPS`);
  await page.screenshot({path:`${out}/${kind}-pinch-persist.png`});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x-30,y,id:1},{x:x+30,y,id:2}]});
  for(const dx of [10,20,30,40]){
   await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-30+dx,y,id:1},{x:x+30+dx,y,id:2}]});
   await page.waitForTimeout(70);
  }
  await touch('touchEnd',0);await page.waitForTimeout(800);
  const panned=await read();assert.notEqual(panned.center,before.center);
  await page.evaluate(()=>window.fix(40));await page.waitForTimeout(600);
  assert.deepEqual(await read(),panned,`${kind}: pan persists through GPS`);
  const watches=await page.evaluate(()=>window.watchers());
  await page.getByTestId('button-map-expand').click();
  const full=page.getByTestId('dialog-tour-fullscreen');
  await full.waitFor();await page.waitForTimeout(500);
  const rect=await full.boundingBox();assert.equal(rect.width,390);assert.equal(rect.height,844);
  assert.equal(await canvas.evaluate(el=>el===window.originalMapCanvas),true);
  await page.evaluate(()=>window.fix(45));
  assert.equal(await page.evaluate(()=>window.watchers()),watches);
  await page.screenshot({path:`${out}/${kind}-fullscreen.png`});
  await page.getByTestId('button-tour-exit-fullscreen').click();
  await page.getByTestId('button-tour-recenter').click();
  await page.waitForTimeout(600);
  const resumed=await read();assert.ok(resumed.zoom>=15);
  assert.notEqual(resumed.center,before.center);
  assert.equal(await canvas.evaluate(el=>el===window.originalMapCanvas),true);
  report.push({kind,before,panned,resumed,fullscreen:rect,watchers:watches,pinchPersists:true,panPersists:true,sameCanvas:true});
  await page.close();
 }
 await writeFile(`${out}/camera-measurements.json`,JSON.stringify(report,null,2));
 console.log(report);
}finally{await browser.close();}
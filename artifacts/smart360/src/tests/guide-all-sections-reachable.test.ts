import test from "node:test";
import assert from "node:assert/strict";
import { buildSimpleSections } from "../pages/living-guide/simple/simple-tiles";
import { homeSectionLinks } from "../pages/living-guide/living-guide-home-sections";
const rt = {hasWeather:false,hasContact:false,installAvailable:false,hasOrderable:false,recordingEnabled:false,mapHref:null};
const rows = ["stay","offer","explore","services","info","wellness"].map(key => ({
  key,label:`Title ${key}`,categories:[{id:key,label:key,items:[{id:"item"}]}],
}));
test("all six published sections have their own groups in admin order", () => {
  assert.deepEqual(buildSimpleSections(rows,"sl",rt).map(s=>s.key),["home",...rows.map(s=>s.key),"messages"]);
  assert.deepEqual(buildSimpleSections([...rows].reverse(),"sl",rt).map(s=>s.key),["home",...rows.map(s=>s.key).reverse(),"messages"]);
  assert.equal(buildSimpleSections(rows,"sl",rt).find(s=>s.key==="services")?.title,"Title services");
});
test("Trend exposes custom section links without depending on bottom-nav capacity", () => {
  assert.deepEqual(homeSectionLinks(rows).map(s=>s.key),["services","info","wellness"]);
  assert.deepEqual(homeSectionLinks([...rows].reverse()).map(s=>s.key),["wellness","info","services"]);
});
test("hidden and empty sections are omitted without hiding populated siblings", () => {
  const data=[{...rows[3],isVisible:false},{...rows[4],categories:[]},rows[5]];
  assert.deepEqual(homeSectionLinks(data).map(s=>s.key),["wellness"]);
  assert.deepEqual(buildSimpleSections(data,"sl",rt).map(s=>s.key),["home","wellness","messages"]);
});
test("runtime order and map controls survive absent content sections", () => {
  const result=buildSimpleSections([],"sl",{...rt,hasOrderable:true,mapHref:"https://example.com"});
  assert.deepEqual(result.map(s=>s.key),["home","offer","explore","messages"]);
});

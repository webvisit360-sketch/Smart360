import { File } from "@google-cloud/storage";
import { duplicateProject } from "../../lib/duplicateProject";
import { assertDev } from "./duplicate-project-fixture";

assertDev();
const [source, slug, stopAfter] = process.argv.slice(2);
const original = File.prototype.copy;
let copied = 0;
// Pause only this synthetic test worker after real storage completed a copy.
File.prototype.copy = async function (this: File, ...args: any[]) {
  const result = await (original as any).apply(this, args);
  if (++copied === Number(stopAfter)) {
    process.send?.({ paused: true, copied });
    await new Promise(() => {});
  }
  return result;
} as typeof original;
await duplicateProject(source, "TEST nedokončana kopija", slug);
throw new Error("Worker unexpectedly completed instead of pausing");
import { build } from 'esbuild';
import vm from 'node:vm';
import { createHash, webcrypto } from 'node:crypto';
import { writeFileSync } from 'node:fs';
const { outputFiles } = await build({ entryPoints: ['src/shared/storage.ts'], bundle: true, write: false, format: 'cjs' });
const code = outputFiles[0].text;
async function measure(days) {
  const store = { storageSchemaVersion: 2 };
  const counts = { reads: 0, readBytes: 0, writes: 0, writtenBytes: 0 };
  let latest;
  for (let d = 0; d < days; d++) {
    const time = new Date(2025, 0, 1 + d);
    const date = `${time.getFullYear()}-${String(time.getMonth()+1).padStart(2,'0')}-${String(time.getDate()).padStart(2,'0')}`;
    const start = Math.floor(time.getTime()/1000);
    const sessions = Object.fromEntries(Array.from({length:20},(_,i)=>[`site${i}.example`,Array.from({length:30},(_,j)=>[start+j*120+i*5,start+j*120+i*5+5])]));
    store[`dailyStats:${date}`] = { date, totalTime:3000, sites:Object.fromEntries(Object.keys(sessions).map(k=>[k,150])),visits:600,blockedAttempts:0,sessions,youtubeSessions:{} };
    latest = { domain:'site0.example',startTime:(start+20000)*1000,endTime:(start+20030)*1000,windowId:1 };
  }
  const api = { async get(keys) { counts.reads++; const value=keys==null?store:Object.fromEntries((Array.isArray(keys)?keys:[keys]).map(k=>[k,store[k]])); counts.readBytes+=Buffer.byteLength(JSON.stringify(value)); return structuredClone(value); },async set(items){counts.writes++;counts.writtenBytes+=Buffer.byteLength(JSON.stringify(items));Object.assign(store,structuredClone(items));},async remove(keys){for(const k of Array.isArray(keys)?keys:[keys])delete store[k];} };
  const module={exports:{}};
  vm.runInNewContext(code,{module,exports:module.exports,chrome:{storage:{local:api}},crypto:webcrypto,URL,Date,TextEncoder,TextDecoder,console});
  function reset(){for(const k in counts) counts[k]=0;}
  await module.exports.getAllDailyStatsSummary();const cold={...counts};reset();
  const summary=await module.exports.getAllDailyStatsSummary();const warm={...counts};reset();
  await module.exports.recordSession(latest);const checkpoint={...counts};
  return {days,summaryDays:Object.keys(summary).length,cold,warm,checkpoint};
}
const report={sourceSha256:createHash('sha256').update(code).digest('hex'),methodology:'Actual storage module with synthetic history (20 domains × 30 intervals per day). Counts JSON payload bytes crossing mocked local storage, not real Chrome CPU/latency or stored byte quotas.',results:await Promise.all([measure(30),measure(365)])};
const json=JSON.stringify(report,null,2)+'\n';if(process.argv[2])writeFileSync(process.argv[2],json);console.log(json);

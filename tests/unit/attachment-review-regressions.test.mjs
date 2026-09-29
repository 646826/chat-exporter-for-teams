import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchAttachmentCandidate, prefetchEphemeralAttachments, downloadAttachments } from '../../src/content/attachments.js';
import { fetchWithRetry } from '../../src/content/retry.js';

const config = { attachmentTimeoutMs:5000, attachmentRetries:0, attachmentRetryDelayMs:1, attachmentConcurrency:1, maxSingleAttachmentBytes:32, maxTotalAttachmentBytes:64, includeAttachments:true };
const overlay = {update(){},log(){},text:key=>key};
function replaceFetch(t, fn) { const old=globalThis.fetch; globalThis.fetch=fn; t.after(()=>{globalThis.fetch=old;}); }
async function outcome(promise) {
  let timer;
  try { return await Promise.race([promise.then(value=>({value}),error=>({error})),new Promise(resolve=>{timer=setTimeout(()=>resolve({stalled:true}),1000);})]); }
  finally { clearTimeout(timer); }
}

test('Cancel interrupts retry even when response-body cancellation never settles',async t=>{
 const controller=new AbortController(); const reason=new Error('user cancelled'); let calls=0;
 const response=new Response(new ReadableStream({cancel(){controller.abort(reason);return new Promise(()=>{});}}),{status:503});
 replaceFetch(t,async()=>{calls++;return response;});
 const result=await outcome(fetchWithRetry('https://example.test/file.pdf',{signal:controller.signal},{attachmentRetryDelayMs:1}));
 assert.equal(result.error,reason,'body cleanup must not trap cancellation'); assert.equal(calls,1);
});
for (const declared of [true,false]) {
 test(`oversize ${declared?'declared':'streamed'} responses do not await a stuck cancellation hook`,async t=>{
  const body=new ReadableStream({start(controller){controller.enqueue(new Uint8Array(64));},cancel(){return new Promise(()=>{});}});
  const response=new Response(body,{headers:declared?{'content-length':'64'}:{}});
  replaceFetch(t,async()=>response);
  const result=await outcome(fetchAttachmentCandidate({url:'https://example.test/file.pdf'},null,config));
  assert.equal(result.error?.code,'ATTACHMENT_TOO_LARGE'); assert.equal(body.locked,false);
 });
}
test('empty ephemeral files remain real downloadable zero-byte files',async t=>{
 replaceFetch(t,async()=>new Response(new Uint8Array(0),{headers:{'content-type':'application/octet-stream'}}));
 const candidate={url:'blob:https://teams.cloud.microsoft/empty',nameHint:'empty.bin'}; const cache=new Map();
 await prefetchEphemeralAttachments([{attachments:[candidate]}],cache,null,true,config);
 assert.equal((await cache.get(candidate.url)).blob?.size,0);
 const result=await downloadAttachments([candidate],cache,overlay,null,config);
 assert.equal(result.records[0].status,'downloaded'); assert.equal(result.records[0].bytes,0);
});
for (const url of ['blob:https://teams.cloud.microsoft/expired','data:invalid']) {
 test(`non-network URL errors are attempted only once: ${url.split(':')[0]}`,async t=>{
  let calls=0;replaceFetch(t,async()=>{calls++;throw new TypeError('URL unavailable');});
  await assert.rejects(fetchWithRetry(url,{}, {attachmentRetries:2,attachmentRetryDelayMs:1}),TypeError);
  assert.equal(calls,1);
 });
}
for (const fail of [false,true]) {
 test(`prefetch preserves actual request history on ${fail?'failure':'success'}`,async t=>{
  const url='blob:https://teams.cloud.microsoft/history'; const cache=new Map();
  replaceFetch(t,async()=>{if(fail)throw new TypeError('expired');return new Response('bytes');});
  await prefetchEphemeralAttachments([{attachments:[{url}]}],cache,null,true,config);
  assert.deepEqual((await cache.get(url)).attempts,[url]);
  const result=await downloadAttachments([{url}],cache,overlay,null,config);
  assert.deepEqual(result.records[0].attempts,[url]);
  assert.equal(result.records[0].status,fail?'failed':'downloaded');
 });
}
test('cache-budget rejections retain the request that consumed the bytes',async t=>{
 replaceFetch(t,async()=>new Response('123'));
 const urls=['blob:https://teams.cloud.microsoft/one','blob:https://teams.cloud.microsoft/two'];
 const candidates=urls.map(url=>({url}));const cache=new Map();
 await prefetchEphemeralAttachments([{attachments:candidates}],cache,null,true,{...config,maxTotalAttachmentBytes:4});
 const result=await downloadAttachments(candidates,cache,overlay,null,config);
 assert.equal(result.records[1].errorCode,'ATTACHMENT_TOTAL_LIMIT');assert.deepEqual(result.records[1].attempts,[urls[1]]);
});
for(const [hint,expected] of [['Link report.pdf','001_report.pdf'],['Shared report.pdf','001_Shared report.pdf']]) {
 test(`meaningful filename survives an opaque URL: ${hint}`,async t=>{
  replaceFetch(t,async()=>new Response('pdf',{headers:{'content-type':'application/pdf'}}));
  const result=await downloadAttachments([{url:'https://example.test/api/download',nameHint:hint}],new Map(),overlay,null,config);
  assert.equal(result.records[0].filename,expected);
 });
}

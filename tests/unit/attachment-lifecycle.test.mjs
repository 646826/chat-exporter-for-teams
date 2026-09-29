import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchAttachmentCandidate, prefetchEphemeralAttachments } from '../../src/content/attachments.js';
import { fetchWithRetry, retryDelayMs } from '../../src/content/retry.js';

function replaceFetch(t, fn) { const previous=globalThis.fetch; globalThis.fetch=fn; t.after(()=>{globalThis.fetch=previous;}); }
const config={attachmentTimeoutMs:30, maxSingleAttachmentBytes:16, maxTotalAttachmentBytes:32, attachmentConcurrency:2, attachmentRetries:0};

test('timeout cancels an attachment stream stalled after headers', async t=>{
 let cancelled=0;
 const response=new Response(new ReadableStream({cancel(){cancelled++;}}));
 replaceFetch(t,async()=>response);
 const result=await Promise.race([
  fetchAttachmentCandidate({url:'https://example.test/file.pdf'},null,config).then(()=> 'success', e=>e.code),
  new Promise(resolve=>setTimeout(()=>resolve('stalled'),200)),
 ]);
 assert.equal(result,'ATTACHMENT_TIMEOUT');assert.equal(cancelled,1);assert.equal(response.body.locked,false);
});
test('ephemeral media prefetch respects download concurrency',async t=>{
 let active=0, peak=0;
 replaceFetch(t,async()=>{active++;peak=Math.max(peak,active);await new Promise(r=>setTimeout(r,10));active--;return new Response('data');});
 const messages=[{attachments:Array.from({length:6},(_,i)=>({url:`blob:https://teams.cloud.microsoft/${i}`}))}];
 const cache=new Map();
 await prefetchEphemeralAttachments(messages,cache,null,true,{...config,attachmentTimeoutMs:1000});
 assert.equal(cache.size,6);assert.ok(peak<=2,`peak ${peak} exceeds configured concurrency`);
});
test('ephemeral oversize files are rejected during capture, before archiving',async t=>{
 replaceFetch(t,async()=>new Response('too large for budget'));
 const cache=new Map();const url='blob:https://teams.cloud.microsoft/large';
 await prefetchEphemeralAttachments([{attachments:[{url}]}],cache,null,true,{...config,maxSingleAttachmentBytes:4});
 const result=await cache.get(url);assert.equal(result.blob,null);assert.equal(result.errorCode,'ATTACHMENT_TOO_LARGE');
});
test('Retry-After is bounded and HTTP dates are supported',()=>{
 assert.equal(retryDelayMs('100000',0,1,0),30000);
 assert.equal(retryDelayMs('2',0,1,0),2000);
 assert.equal(retryDelayMs('Thu, 01 Jan 1970 00:00:03 GMT',0,1,0),3000);
 assert.equal(retryDelayMs('invalid',2,100),400);
});
test('cancelling a retry wait never starts another request',async t=>{
 let calls=0;const controller=new AbortController();
 replaceFetch(t,async()=>{calls++;return new Response('busy',{status:429,headers:{'retry-after':'30'}});});
 const reason=new Error('cancel');const pending=fetchWithRetry('https://example.test/file.pdf',{signal:controller.signal},{});
 setTimeout(()=>controller.abort(reason),10);
 await assert.rejects(pending,e=>e===reason);assert.equal(calls,1);
});
test('network failures can recover without silently losing an attachment',async t=>{
 let calls=0;replaceFetch(t,async()=>{if(++calls===1)throw new TypeError('network');return new Response('recovered');});
 const response=await fetchWithRetry('https://example.test/file.pdf',{}, {attachmentRetryDelayMs:1});
 assert.equal(await response.text(),'recovered');assert.equal(calls,2);
});

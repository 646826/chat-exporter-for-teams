import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchAttachmentCandidate, downloadAttachments, prefetchEphemeralAttachments } from '../../src/content/attachments.js';
const config={attachmentTimeoutMs:80,attachmentRetries:0,attachmentConcurrency:1,maxSingleAttachmentBytes:100,maxTotalAttachmentBytes:100,includeAttachments:true};
const overlay={update(){},log(){},text:k=>k};
function mock(t,fn){const old=globalThis.fetch;globalThis.fetch=fn;t.after(()=>{globalThis.fetch=old;});}
async function bounded(promise){let timer;try{return await Promise.race([promise.then(value=>({value}),error=>({error})),new Promise(resolve=>{timer=setTimeout(()=>resolve({stalled:true}),1000);})]);}finally{clearTimeout(timer);}}
test('a fetch wrapper ignoring AbortSignal cannot trap cancellation',async t=>{
 const controller=new AbortController();const reason=new Error('cancelled');
 mock(t,()=>{queueMicrotask(()=>controller.abort(reason));return new Promise(()=>{});});
 const outcome=await bounded(fetchAttachmentCandidate({url:'https://example.test/file.pdf'},controller.signal,config));
 assert.equal(outcome.error,reason);
});
test('all SharePoint candidate attempts share one deadline',async t=>{
 let calls=0;
 mock(t,(_url,init)=>{calls++;return new Promise((resolve,reject)=>init.signal.addEventListener('abort',()=>reject(init.signal.reason),{once:true}));});
 const outcome=await bounded(fetchAttachmentCandidate({url:'https://example.sharepoint.com/sites/X/file.pdf'},null,config));
 assert.equal(outcome.error?.code,'ATTACHMENT_TIMEOUT');assert.equal(calls,1);
});
test('HTML viewer responses are rejected before reading their body',async t=>{
 let pulled=0,cancelled=0;
 const body=new ReadableStream({pull(c){pulled++;c.enqueue(new Uint8Array(20));},cancel(){cancelled++;}}, {highWaterMark:0});
 mock(t,async()=>new Response(body,{headers:{'content-type':'text/html'}}));
 await assert.rejects(fetchAttachmentCandidate({url:'https://example.test/report.pdf'},null,config),e=>e.code==='ATTACHMENT_SIGN_IN_PAGE');
 assert.equal(pulled,0);assert.equal(cancelled,1);
});
test('explicitly named zero-byte HTTP downloads are preserved',async t=>{
 mock(t,async()=>new Response(new Uint8Array(0),{headers:{'content-type':'application/octet-stream','content-disposition':'attachment; filename="empty.bin"','content-length':'0'}}));
 const result=await fetchAttachmentCandidate({url:'https://example.test/download'},null,config);assert.equal(result.blob.size,0);
});
test('local HTML blob files are not confused with a network sign-in page',async t=>{
 mock(t,async()=>new Response('<p>local</p>',{headers:{'content-type':'text/html'}}));
 const url='blob:https://teams.cloud.microsoft/local-html';const cache=new Map();
 await prefetchEphemeralAttachments([{attachments:[{url}]}],cache,null,true,config);
 assert.equal((await cache.get(url)).blob?.type,'text/html');
});
test('archive-budget rejection preserves actual request attempts',async t=>{
 mock(t,async()=>new Response('12345678',{headers:{'content-type':'application/pdf'}}));
 const url='https://example.test/file.pdf';
 const result=await downloadAttachments([{url}],new Map(),overlay,null,{...config,maxTotalAttachmentBytes:4});
 assert.equal(result.records[0].errorCode,'ATTACHMENT_TOTAL_LIMIT');assert.deepEqual(result.records[0].attempts,[url]);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchAttachmentCandidate } from '../../src/content/attachments.js';
import { sharePointDownloadCandidates } from '../../src/shared/urls.js';
const original='https://example.sharepoint.com/sites/Design/_layouts/15/Doc.aspx?sourcedoc=%7B11111111-2222-4333-8444-555555555555%7D&file=Guide.pptx&action=edit';
const direct=sharePointDownloadCandidates(original)[0];
const config={attachmentTimeoutMs:600,attachmentRetries:0,maxSingleAttachmentBytes:1000};
function mock(t,fn){const previous=globalThis.fetch;globalThis.fetch=fn;t.after(()=>{globalThis.fetch=previous;});}
for(const mode of ['headers','body']) {
 test(`a stalled generated SharePoint ${mode} leaves a chance for the original URL`,async t=>{
  const calls=[];let cancelled=false;
  mock(t,async(url,init)=>{
   calls.push(url);
   if(url===direct){
    if(mode==='headers')return new Promise((resolve,reject)=>init.signal.addEventListener('abort',()=>{cancelled=true;reject(init.signal.reason);},{once:true}));
    return new Response(new ReadableStream({cancel(){cancelled=true;}}),{headers:{'content-type':'application/octet-stream'}});
   }
   assert.equal(url,original,'the original must be the first fallback');
   return new Response('original-file-bytes',{headers:{'content-type':'application/octet-stream'}});
  });
  const result=await fetchAttachmentCandidate({url:original,nameHint:'Guide.pptx'},null,config);
  assert.equal(await result.blob.text(),'original-file-bytes');assert.deepEqual(calls,[direct,original]);
  assert.deepEqual(result.attempts,calls);assert.equal(cancelled,true);
 });
}
test('user cancellation during the speculative request never starts a fallback',async t=>{
 const controller=new AbortController();const reason=new Error('user cancelled');const calls=[];
 mock(t,async(url,init)=>{
  calls.push(url);queueMicrotask(()=>controller.abort(reason));
  return new Promise((resolve,reject)=>init.signal.addEventListener('abort',()=>reject(init.signal.reason),{once:true}));
 });
 await assert.rejects(fetchAttachmentCandidate({url:original},controller.signal,config),e=>e===reason);
 assert.deepEqual(calls,[direct]);
});
test('a stalled original fallback still respects the single overall file deadline',async t=>{
 const calls=[];const signals=[];
 mock(t,(url,init)=>{calls.push(url);signals.push(init.signal);return new Promise((resolve,reject)=>init.signal.addEventListener('abort',()=>reject(init.signal.reason),{once:true}));});
 await assert.rejects(fetchAttachmentCandidate({url:original},null,config),e=>e.code==='ATTACHMENT_TIMEOUT');
 assert.deepEqual(calls,[direct,original]);assert.ok(signals.every(signal=>signal.aborted));
});

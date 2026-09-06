import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchAttachmentCandidate, downloadAttachments } from '../../src/content/attachments.js';
const candidate={url:'https://example.test/file.bin',nameHint:'file.bin'};
const config={attachmentTimeoutMs:1000,maxSingleAttachmentBytes:8,maxTotalAttachmentBytes:100,includeAttachments:true,attachmentConcurrency:1};
const overlay={update(){},log(){},text:key=>key};
function mockFetch(t,response) {
  const original=globalThis.fetch;globalThis.fetch=async()=>response;
  t.after(()=>{globalThis.fetch=original;});
}
function streamed(headers={}) {
  let pulls=0,cancels=0;
  const body=new ReadableStream({
    pull(controller){pulls++;if(pulls<=5) controller.enqueue(new Uint8Array([1,2,3,4]));else controller.close();},
    cancel(){cancels++;}
  });
  return {response:new Response(body,{headers}),get pulls(){return pulls;},get cancels(){return cancels;}};
}
for(const [name,headers] of [['missing length',{}],['understated length',{'content-length':'1'}]]) {
  test('stops oversized attachment streams early with '+name,async t=>{
    const stream=streamed(headers);mockFetch(t,stream.response);
    await assert.rejects(fetchAttachmentCandidate(candidate,null,config),e=>e.code==='ATTACHMENT_TOO_LARGE');
    assert.equal(stream.cancels,1);assert.ok(stream.pulls<=4,'must not consume the entire oversized response');
    assert.equal(stream.response.body.locked,false);
  });
}
test('preserves valid bytes, MIME and filename at the exact size limit',async t=>{
  const response=new Response(new Uint8Array([1,2,3,4,5,6,7,8]),{headers:{'content-type':'application/octet-stream','content-disposition':'attachment; filename="safe.bin"'}});
  mockFetch(t,response);const result=await fetchAttachmentCandidate(candidate,null,config);
  assert.deepEqual([...new Uint8Array(await result.blob.arrayBuffer())],[1,2,3,4,5,6,7,8]);
  assert.equal(result.mimeType,'application/octet-stream');assert.equal(result.contentDispositionName,'safe.bin');
  assert.equal(response.body.locked,false);
});
test('rejects empty responses as before',async t=>{
  mockFetch(t,new Response(''));await assert.rejects(fetchAttachmentCandidate(candidate,null,config),e=>e.code==='ATTACHMENT_HTTP_ERROR');
});
test('stream read failure releases the reader lock',async t=>{
  const response=new Response(new ReadableStream({pull(controller){controller.error(new Error('read failed'));}}));
  mockFetch(t,response);await assert.rejects(fetchAttachmentCandidate(candidate,null,config),/read failed/);
  assert.equal(response.body.locked,false);
});
test('cancels a response whose declared length already exceeds the limit',async t=>{
  const stream=streamed({'content-length':'20'});mockFetch(t,stream.response);
  await assert.rejects(fetchAttachmentCandidate(candidate,null,config),e=>e.code==='ATTACHMENT_TOO_LARGE');
  assert.equal(stream.cancels,1);
});
test('the single-file limit also applies to already prefetched media',async()=>{
  const cache=new Map([[candidate.url,Promise.resolve({blob:new Blob(['123456789']),mimeType:'text/plain'})]]);
  const result=await downloadAttachments([candidate],cache,overlay,null,config);
  assert.equal(result.records[0].status,'skipped');assert.equal(result.totalBytes,0);
});
test('valid prefetched media remains downloadable',async()=>{
  const cache=new Map([[candidate.url,Promise.resolve({blob:new Blob(['12345678']),mimeType:'text/plain'})]]);
  const result=await downloadAttachments([candidate],cache,overlay,null,config);
  assert.equal(result.records[0].status,'downloaded');assert.equal(result.totalBytes,8);
});
test('an already cancelled export never starts an attachment request',async t=>{
  const original=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;return new Response('x');};t.after(()=>{globalThis.fetch=original;});
  const controller=new AbortController();const reason=new Error('cancelled');controller.abort(reason);
  await assert.rejects(fetchAttachmentCandidate(candidate,controller.signal,config),e=>e===reason);assert.equal(calls,0);
});

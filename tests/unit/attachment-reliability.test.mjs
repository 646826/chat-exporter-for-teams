import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyAttachmentUrl } from '../../src/shared/urls.js';
import { fetchAttachmentCandidate, downloadAttachments } from '../../src/content/attachments.js';
const config = { attachmentTimeoutMs:1000, attachmentRetries:2, attachmentRetryDelayMs:1, maxSingleAttachmentBytes:1024, maxTotalAttachmentBytes:2048, includeAttachments:true, attachmentConcurrency:2 };
const overlay = {update(){},log(){},text:k=>k};
function replaceFetch(t, fn) { const old=globalThis.fetch; globalThis.fetch=fn; t.after(()=>{globalThis.fetch=old;}); }

test('HTML website routes remain links unless explicitly downloadable',()=>{
 assert.equal(classifyAttachmentUrl('https://example.test/game/iframe.html#room=ROOM'), 'link');
 assert.equal(classifyAttachmentUrl('https://example.test/export.html', {download:true}), 'attachment');
 assert.equal(classifyAttachmentUrl('https://example.test/report.pdf'), 'attachment');
});
test.todo('SharePoint viewer direct-download resolution remains unimplemented — issue #8; blocked source change');
test('transient HTTP errors retry the same URL before failing',async t=>{
 let calls=0; replaceFetch(t,async()=>++calls<3?new Response('busy',{status:503}):new Response('bytes',{headers:{'content-type':'application/pdf'}}));
 const result=await fetchAttachmentCandidate({url:'https://example.test/report.pdf'},null,config);
 assert.equal(await result.blob.text(),'bytes'); assert.equal(calls,3); assert.equal(result.attempts.length,3);
});
test('access denial is not retried on an ordinary file URL',async t=>{
 let calls=0;replaceFetch(t,async()=>{calls++;return new Response('denied',{status:403});});
 await assert.rejects(fetchAttachmentCandidate({url:'https://example.test/report.pdf'},null,config));assert.equal(calls,1);
});
test('URL filename takes precedence over a generic Link aria label',async t=>{
 replaceFetch(t,async()=>new Response('pdf',{headers:{'content-type':'application/pdf'}}));
 const result=await downloadAttachments([{url:'https://example.test/report.pdf',nameHint:'Link https___example.test_report.pdf'}],new Map(),overlay,null,config);
 assert.equal(result.records[0].filename,'001_report.pdf');
});
test('failed attachment records preserve a structured error code',async t=>{
 replaceFetch(t,async()=>new Response('missing',{status:404}));
 const result=await downloadAttachments([{url:'https://example.test/report.pdf'}],new Map(),overlay,null,config);
 assert.equal(result.records[0].status,'failed');assert.equal(result.records[0].errorCode,'ATTACHMENT_HTTP_ERROR');
});

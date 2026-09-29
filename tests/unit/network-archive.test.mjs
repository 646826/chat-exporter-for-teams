import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { downloadAttachments, fetchAttachmentCandidate } from '../../src/content/attachments.js';
import { buildArchive } from '../../src/content/archive.js';
import { crc32Bytes } from '../../src/content/zip.js';
import { parseZipBuffer } from '../../scripts/lib/zip.mjs';

const overlay={update(){},log(){},text:key=>key};
const config={includeAttachments:true,attachmentConcurrency:3,attachmentTimeoutMs:45000,attachmentRetries:2,attachmentRetryDelayMs:1,maxSingleAttachmentBytes:200000,maxTotalAttachmentBytes:1000000};
async function fixture(t) {
 const binary=Buffer.from(Array.from({length:90000},(_,i)=>i%251));
 const counts=new Map();
 const server=createServer((request,response)=>{
  const path=request.url;counts.set(path,(counts.get(path)||0)+1);
  if(path==='/retry.pdf' && counts.get(path)<3){response.writeHead(503,{'Retry-After':'0'});response.end('busy');return;}
  if(path==='/missing.pdf'){response.writeHead(404);response.end('not found');return;}
  if(path==='/viewer'){response.writeHead(200,{'Content-Type':'text/html'});response.end('<html>Sign in</html>');return;}
  if(path==='/empty'){response.writeHead(200,{'Content-Type':'application/octet-stream','Content-Disposition':'attachment; filename="empty.bin"','Content-Length':'0'});response.end();return;}
  if(path==='/stall'){response.writeHead(200,{'Content-Type':'application/octet-stream'});response.flushHeaders();return;}
  response.writeHead(200,{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="${path==='/retry.pdf'?'retried':'binary'}.pdf"`,'Content-Length':String(binary.length)});response.end(binary);
 });
 server.listen(0,'127.0.0.1');await once(server,'listening');
 t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);}));
 return {binary,counts,base:`http://127.0.0.1:${server.address().port}`};
}
test('real HTTP downloads produce a readable ZIP with exact bytes and honest failed-file reports',async t=>{
 const {base,binary,counts}=await fixture(t);
 const candidates=['/binary.pdf','/retry.pdf','/empty','/missing.pdf','/viewer'].map(path=>({url:base+path,nameHint:path.slice(1),messageIds:['fixture-message']}));
 const downloaded=await downloadAttachments(candidates,new Map(),overlay,null,config);
 assert.deepEqual(downloaded.records.map(r=>r.status),['downloaded','downloaded','downloaded','failed','failed'],JSON.stringify(downloaded.records.map(r=>({status:r.status,error:r.error}))));
 assert.equal(counts.get('/retry.pdf'),3);assert.equal(counts.get('/missing.pdf'),1);
 assert.equal(downloaded.records[1].attempts.length,3);
 assert.equal(downloaded.totalBytes,2*binary.length);
 const messages=[{id:'fixture-message',author:'Synthetic Fixture',timestamp:'2026-09-29T00:00:00.000Z',text:'Synthetic network export',attachments:candidates,links:[]}];
 const zip=await buildArchive({title:'Synthetic Network Fixture',sourceUrl:base,exportedAt:'2026-09-29T00:00:00.000Z',messages,attachmentRecords:downloaded.records,overlay,extensionVersion:'test'});
 const entries=parseZipBuffer(Buffer.from(await zip.arrayBuffer()));const files=new Map(entries.map(e=>[e.name,e.data]));
 assert.equal(entries.length,11);
 for(const entry of entries) assert.equal(crc32Bytes(entry.data),entry.crc32,entry.name);
 for(const record of downloaded.records.slice(0,2)) assert.deepEqual(files.get(record.path),binary);
 assert.equal(files.get(downloaded.records[2].path).length,0);
 const json=JSON.parse(files.get('chat.json'));assert.equal(json.format,'chat-exporter-for-teams/v1');assert.equal(json.attachments.length,5);
 assert.match(files.get('failed-attachments.html').toString(),/HTTP 404/);
 assert.match(files.get('attachments-report.csv').toString(),/ATTACHMENT_SIGN_IN_PAGE/);
 assert.ok(files.has('chat.md') && files.has('links.csv'));
});
test('a real HTTP response stalled after headers times out instead of hanging',async t=>{
 const {base}=await fixture(t);
 await assert.rejects(fetchAttachmentCandidate({url:base+'/stall'},null,{...config,attachmentTimeoutMs:150,attachmentRetries:0}),e=>e.code==='ATTACHMENT_TIMEOUT');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { sharePointDownloadCandidates } from '../../src/shared/urls.js';
const guid='11111111-2222-4333-8444-555555555555';
for(const site of ['/sites/Design','/personal/test_example_com','']) {
 test('SharePoint viewer download preserves site scope '+site,()=>{
  const original=`https://example.sharepoint.com/:p:/r${site}/_layouts/15/Doc.aspx?sourcedoc=%7B${guid}%7D&file=Guide.pptx&action=edit`;
  const urls=sharePointDownloadCandidates(original); const first=new URL(urls[0]);
  assert.equal(first.pathname,`${site}/_layouts/15/download.aspx`);
  assert.equal(first.searchParams.get('UniqueId'),guid);
  assert.ok(urls.includes(original));assert.equal(new Set(urls).size,urls.length);
  assert.ok(urls.every(u=>new URL(u).origin==='https://example.sharepoint.com'));
 });
}
test('direct signed downloads are preserved exactly and not expanded',()=>{
 const url=`https://example.sharepoint.com/sites/Test/_layouts/15/download.aspx?UniqueId=${guid}&tempauth=synthetic-test-signature`;
 assert.deepEqual(sharePointDownloadCandidates(url),[url]);
});
test('malformed GUID or deceptive hosts do not generate a direct endpoint',()=>{
 for(const url of ['https://example.sharepoint.com/_layouts/15/Doc.aspx?sourcedoc=../admin','https://example.sharepoint.com.evil.test/_layouts/15/Doc.aspx?sourcedoc='+guid]) {
  assert.ok(sharePointDownloadCandidates(url).every(u=>!new URL(u).pathname.endsWith('/download.aspx')));
 }
});

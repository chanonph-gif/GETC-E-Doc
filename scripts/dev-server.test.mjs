import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from './dev-server.mjs';

test('prototype serves its page and modules without exposing repository files',async()=>{
  const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  try {
    const page=await fetch(base);assert.equal(page.status,200);assert.match(await page.text(),/lang="th"/);assert.match(page.headers.get('content-security-policy'),/script-src 'self'/);
    const module=await fetch(base+'/domain.mjs');assert.equal(module.status,200);assert.match(module.headers.get('content-type'),/javascript/);
    assert.equal((await fetch(base+'/assets/Sarabun-Regular.woff')).status,200);
    for(const name of ['/../package.json','/%2e%2e%2fREADME.md','/.git/config','/domain.test.mjs'])assert.equal((await fetch(base+name)).status,404);
    assert.equal((await fetch(base,{method:'POST'})).status,405);
  } finally {await new Promise(resolve=>server.close(resolve));}
});

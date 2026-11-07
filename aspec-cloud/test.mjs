import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createCloud,validName} from './server.mjs';
import {DatabaseSync} from 'node:sqlite';
const alice='03cd1d2d-9d0e-4ac4-a785-ad78e34168ef',bob='03cd1d2d-9d0e-4ac4-a785-ad78e34168ee';
test('reject traversal, control characters and dangerous names; allow installer extensions',()=>{for(const n of ['../x','..','.','a/b','a\\b','x\n',' x'])assert.throws(()=>validName(n));assert.equal(validName('설치 프로그램.exe'),'설치 프로그램.exe');});

test('upgrade adds short aliases to existing long shares without breaking their links',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'aspec-legacy-share-'));
 const id='bbbbbbbb-bbbb-4bbb-abbb-bbbbbbbbbbbb',token='a'.repeat(64);
 let app;
 try {
  await fs.mkdir(path.join(dir,'meta'));await fs.mkdir(path.join(dir,'files'));
  const db=new DatabaseSync(path.join(dir,'meta','cloud.sqlite'));
  db.exec(`CREATE TABLE entries(id TEXT PRIMARY KEY,owner TEXT NOT NULL,parent TEXT NOT NULL DEFAULT '',name TEXT NOT NULL,kind TEXT NOT NULL,size INTEGER NOT NULL DEFAULT 0,updated TEXT NOT NULL);
   CREATE TABLE shares(token TEXT PRIMARY KEY,entry_id TEXT NOT NULL UNIQUE REFERENCES entries(id) ON DELETE CASCADE,created TEXT NOT NULL);`);
  db.prepare('INSERT INTO entries VALUES(?,?,?,?,?,?,?)').run(id,alice,'','legacy.txt','file',3,new Date().toISOString());
  db.prepare('INSERT INTO shares VALUES(?,?,?)').run(token,id,new Date().toISOString());db.close();
  await fs.writeFile(path.join(dir,'files',id),'old');
  app=createCloud({dataDir:dir,origin:'https://erp.aspec-tech.co.kr',allowedUsers:new Set([alice]),reserve:0,verify:async()=>({id:alice})});
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port;
  assert.equal(await (await fetch(base+'/cloud/shared/'+token)).text(),'old');
  const response=await fetch(base+'/cloud/shares',{method:'POST',headers:{Authorization:'Bearer alice','Content-Type':'application/json'},body:JSON.stringify({id})});
  const {url,codeUrl}=await response.json();assert.match(url,/^\/s\/[23456789abcdefghjkmnpqrstuvwxyz]{16}$/);
  assert.equal(await (await fetch(base+url)).text(),'old');
  assert.equal(await (await fetch(base+'/cloud/shared/'+token)).text(),'old');
  assert.equal((await fetch(base+'/s/'+'2'.repeat(16))).status,404);
  const metadata=new DatabaseSync(path.join(dir,'meta','cloud.sqlite'));
  metadata.prepare('UPDATE quick_shares SET expires=? WHERE token=?').run(Date.now()-1,token);metadata.close();
  assert.equal((await fetch(base+codeUrl)).status,404);
  assert.equal((await fetch(base+url)).status,200);
  const renewed=await (await fetch(base+'/cloud/shares',{method:'POST',headers:{Authorization:'Bearer alice','Content-Type':'application/json'},body:JSON.stringify({id})})).json();
  assert.notEqual(renewed.codeUrl,codeUrl);assert.equal(renewed.url,url);
  assert.equal((await fetch(base+renewed.codeUrl)).status,200);
  let limited;
  for(let i=0;i<21;i++)limited=await fetch(base+'/s/'+'2'.repeat(8));
  assert.equal(limited.status,429);
  assert.equal((await fetch(base+url)).status,200);
 } finally {if(app)await app.close();await fs.rm(dir,{recursive:true,force:true});}
});

test('public file shares persist, allow anonymous downloads, and stop after revocation or deletion',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'aspec-share-test-'));
 const allowedUsers=new Set([alice,bob]);
 let verifications=0,app,base;
 const options={dataDir:dir,origin:'https://erp.aspec-tech.co.kr',allowedUsers,reserve:0,verify:async token=>{verifications++;return {id:token==='alice'?alice:bob};}};
 async function start(){app=createCloud(options);await new Promise(r=>app.server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+app.server.address().port;}
 async function req(p,method='GET',body,token='alice') {
  return fetch(base+'/cloud'+p,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
 }
 async function upload(name,bytes){
  const {id}=await (await req('/uploads','POST',{name,size:bytes.length})).json();
  if(bytes.length){const chunk=await fetch(base+'/cloud/uploads/'+id,{method:'PATCH',headers:{Authorization:'Bearer alice','Upload-Offset':'0'},body:bytes});assert.equal(chunk.status,200);}
  assert.equal((await req('/uploads/'+id+'/complete','POST',{})).status,200);return id;
 }
 try {
  await start();
  const bytes=Buffer.from('<html>공유 파일</html>');
  const id=await upload('자료.html',bytes);
  const folder=await (await req('/folders','POST',{name:'공유 불가 폴더'})).json();
  assert.equal((await req('/shares','POST',{id},'')).status,401);
  assert.equal((await req('/shares','POST',{id},'bob')).status,404);
  assert.equal((await req('/shares','POST',{id:folder.id})).status,400);
  const shared=await req('/shares','POST',{id});assert.equal(shared.status,200);
  const {url,code,codeUrl,codeExpiresAt}=await shared.json();assert.match(url,/^\/s\/[23456789abcdefghjkmnpqrstuvwxyz]{16}$/);
  assert.match(code,/^[23456789abcdefghjkmnpqrstuvwxyz]{8}$/);assert.equal(codeUrl,'/s/'+code);
  assert.ok(Date.parse(codeExpiresAt)>Date.now()+23*60*60*1000);
  assert.equal((await fetch(base+codeUrl)).status,200);
  const landing=await fetch(base+'/');assert.equal(landing.status,200);assert.match(await landing.text(),/8자리/);
  const form=await fetch(base+'/s/?code='+code.toUpperCase(),{redirect:'manual'});assert.equal(form.status,303);assert.equal(form.headers.get('location'),codeUrl);
  assert.equal((await fetch(base+url.toUpperCase().replace('/S/','/s/'))).status,200);
  const metadata=new DatabaseSync(path.join(dir,'meta','cloud.sqlite'));
  const legacy='/cloud/shared/'+metadata.prepare('SELECT token FROM shares WHERE entry_id=?').get(id).token;
  metadata.close();
  assert.equal((await fetch(base+legacy)).status,200);
  assert.equal((await (await req('/shares','POST',{id})).json()).url,url);
  const verifiedBefore=verifications;
  const download=await fetch(base+url);
  assert.equal(download.status,200);assert.deepEqual(Buffer.from(await download.arrayBuffer()),bytes);
  assert.equal(verifications,verifiedBefore);
  assert.match(download.headers.get('content-disposition'),/^attachment;/);
  assert.equal(download.headers.get('content-type'),'application/octet-stream');
  assert.equal(download.headers.get('x-content-type-options'),'nosniff');
  assert.equal(download.headers.get('referrer-policy'),'no-referrer');
  const head=await fetch(base+url,{method:'HEAD'});assert.equal(head.status,200);assert.equal(Number(head.headers.get('content-length')),bytes.length);assert.equal(await head.text(),'');
  const partial=await fetch(base+url,{headers:{Range:'bytes=1-3'}});assert.equal(partial.status,206);assert.deepEqual(Buffer.from(await partial.arrayBuffer()),bytes.subarray(1,4));
  assert.equal((await fetch(base+url,{headers:{Range:'bytes=999999-'}})).status,416);
  assert.equal((await fetch(base+'/cloud/shared/'+id)).status,404);
  assert.equal((await fetch(base+'/cloud/shared/'+'0'.repeat(64))).status,404);
  assert.equal((await req('/entries/'+id,'GET',undefined,'')).status,401);
  assert.equal((await req('/shares/'+id,'DELETE',undefined,'bob')).status,404);
  await req('/logout','POST');
  assert.equal((await fetch(base+url)).status,200);
  await app.close();await start();
  assert.equal((await fetch(base+url)).status,200);
  await req('/entries/'+id,'PATCH',{name:'이름변경.zip'});
  const renamed=await fetch(base+url);assert.equal(renamed.status,200);assert.match(renamed.headers.get('content-disposition'),/\.zip/);
  assert.equal((await req('/shares/'+id,'DELETE')).status,200);
  assert.equal((await fetch(base+url)).status,404);
  assert.equal((await fetch(base+legacy)).status,404);
  assert.equal((await fetch(base+codeUrl)).status,404);
  const next=await (await req('/shares','POST',{id})).json();assert.notEqual(next.url,url);
  allowedUsers.delete(alice);assert.equal((await fetch(base+next.url)).status,404);allowedUsers.add(alice);
  await req('/entries/'+id,'DELETE');assert.equal((await fetch(base+next.url)).status,404);
  const emptyId=await upload('빈 파일.txt',Buffer.alloc(0));
  const empty=await (await req('/shares','POST',{id:emptyId})).json();
  const emptyDownload=await fetch(base+empty.url);assert.equal(emptyDownload.status,200);assert.equal(await emptyDownload.text(),'');
 } finally {if(app)await app.close();await fs.rm(dir,{recursive:true,force:true});}
});
test('authenticated owner isolation, chunk resume, move cycles, downloads, restart recovery and reservation',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'aspec-test-'));
 const options={dataDir:dir,origin:'https://erp.aspec-tech.co.kr',allowedUsers:new Set([alice,bob]),verify:async token=>({id:token==='alice'?alice:token==='bob'?bob:'invalid'}),reserve:0};
 let app,base;
 async function start(){app=createCloud(options);await new Promise(r=>app.server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+app.server.address().port;}
 async function req(p,method='GET',body,token='alice',extra={}){const r=await fetch(base+'/cloud'+p,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{}),...extra},body:body?JSON.stringify(body):undefined});return {status:r.status,body:await r.json(),headers:r.headers};}
 try{
 await start();
 assert.equal((await req('/files','GET',undefined,'')).status,401);
 assert.equal((await req('/files','GET',undefined,'bad')).status,401);
 assert.equal((await req('/files','GET',undefined,'alice',{Origin:'https://evil.example'})).status,403);
 const folder=(await req('/folders','POST',{name:'자료'})).body.id;
 const sub=(await req('/folders','POST',{name:'하위',parent:folder})).body.id;
 assert.equal((await req('/entries/'+folder,'PATCH',{parent:sub})).status,400);
 assert.equal((await req('/entries/'+folder,'DELETE')).status,409);
 const bytes=Buffer.alloc(1024*1024+13,42);
 const u=(await req('/uploads','POST',{name:'프로그램.zip',parent:folder,size:bytes.length})).body.id;
 async function chunk(offset,data){const r=await fetch(base+'/cloud/uploads/'+u,{method:'PATCH',headers:{Authorization:'Bearer alice','Upload-Offset':String(offset)},body:data});return {status:r.status,body:await r.json()};}
 assert.equal((await req('/uploads/'+u,'GET',undefined,'bob')).status,404);
 assert.equal((await req('/uploads/'+u+'/complete','POST',{})).status,409);
 assert.equal((await chunk(1,bytes.subarray(0,100))).status,409);
 assert.equal((await chunk(0,bytes.subarray(0,100))).body.offset,100);
 await app.close();
 await fs.appendFile(path.join(dir,'uploads',u),'incomplete write');
 await start();assert.equal((await fs.stat(path.join(dir,'uploads',u))).size,100);
 assert.equal((await req('/uploads/'+u)).body.offset,100);
 assert.equal((await chunk(100,bytes.subarray(100))).body.offset,bytes.length);
 assert.equal((await req('/uploads/'+u+'/complete','POST',{})).status,200);
 assert.equal((await req('/uploads/'+u+'/complete','POST',{})).status,200);
 assert.deepEqual(await fs.readFile(path.join(dir,'files',u)),bytes);
 assert.equal((await req('/files?parent='+folder,'GET',undefined,'bob')).status,404);
 assert.equal((await req('/entries/'+u,'PATCH',{name:'renamed.exe'})).status,200);
 assert.equal((await req('/files?q=renamed')).body.items.length,1);
 assert.equal((await req('/entries/'+u,'DELETE',undefined,'bob')).status,404);
 assert.equal((await req('/download/'+u)).status,401);
 const ticket=await req('/download-session','POST',{id:u});const cookie=ticket.headers.get('set-cookie').split(';')[0];
 const download=await fetch(base+'/cloud/download/'+u,{headers:{Cookie:cookie,Range:'bytes=10-19'}});
 assert.equal(download.status,206);assert.equal((await download.arrayBuffer()).byteLength,10);assert.match(download.headers.get('content-disposition'),/^attachment/);
 const badRange=await fetch(base+'/cloud/download/'+u,{headers:{Cookie:cookie,Range:'bytes=999999999-'}});assert.equal(badRange.status,416);
 await req('/logout','POST');assert.equal((await fetch(base+'/cloud/download/'+u,{headers:{Cookie:cookie}})).status,401);
 assert.equal((await req('/uploads','POST',{name:'too-large',size:5*1024**3+1})).status,413);
 const before=(await req('/storage')).body;
 const pending=await req('/uploads','POST',{name:'reserve',size:4096});
 const after=(await req('/storage')).body;assert.equal(after.pending-before.pending,4096);
 await req('/uploads/'+pending.body.id,'DELETE');
 await req('/entries/'+u,'DELETE');await req('/entries/'+sub,'DELETE');assert.equal((await req('/entries/'+folder,'DELETE')).status,200);
 }finally{if(app)await app.close();await fs.rm(dir,{recursive:true,force:true});}
});

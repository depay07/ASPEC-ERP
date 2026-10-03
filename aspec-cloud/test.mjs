import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createCloud,validName} from './server.mjs';
const alice='03cd1d2d-9d0e-4ac4-a785-ad78e34168ef',bob='03cd1d2d-9d0e-4ac4-a785-ad78e34168ee';
test('reject traversal, control characters and dangerous names; allow installer extensions',()=>{for(const n of ['../x','..','.','a/b','a\\b','x\n',' x'])assert.throws(()=>validName(n));assert.equal(validName('설치 프로그램.exe'),'설치 프로그램.exe');});
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

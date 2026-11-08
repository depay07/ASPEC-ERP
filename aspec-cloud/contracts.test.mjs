import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createCloud} from './server.mjs';
const alice='03cd1d2d-9d0e-4ac4-a785-ad78e34168ef',bob='03cd1d2d-9d0e-4ac4-a785-ad78e34168ee';
async function harness(){
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'aspec-contracts-'));let app,base;
 const start=async()=>{app=createCloud({dataDir:dir,origin:'https://erp.aspec-tech.co.kr',allowedUsers:new Set([alice,bob]),reserve:0,verify:async token=>({id:token==='alice'?alice:bob})});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+app.server.address().port;};
 await start();
 return {dir,get base(){return base;},async restart(){await app.close();await start();},async close(){await app.close();await fs.rm(dir,{recursive:true,force:true});},
  req:async(p,method='GET',body,token='alice')=>{const r=await fetch(base+'/cloud'+p,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json(),headers:r.headers};},
  upload:async(id,name,bytes,token='alice',uploadId)=>{const r=await fetch(base+'/cloud/contracts/'+id+'/files',{method:'POST',headers:{Authorization:'Bearer '+token,'X-File-Name':encodeURIComponent(name),...(uploadId?{'X-Upload-Id':uploadId}:{})},body:bytes});return {status:r.status,data:await r.json()};}
 };
}
test('contracts support search, optimistic edits, private scans, archive and restore across restarts',async()=>{
 const h=await harness();
 try {
  assert.equal((await h.req('/contracts','GET',undefined,'')).status,401);
  assert.equal((await h.req('/contracts','POST',{title:' '})).status,400);
  assert.equal((await h.req('/contracts','POST',{title:'잘못된 날짜',contract_date:'2026-02-31'})).status,400);
  const created=await h.req('/contracts','POST',{title:'설비 공급 계약서',partner:'한빛테크',contract_date:'2026-11-07',memo:'서명 원본 보관'});assert.equal(created.status,201);
  const c=created.data;assert.equal(c.version,0);
  const repeated=await h.req('/contracts','POST',{id:c.id,title:c.title,partner:c.partner,contract_date:c.contract_date,memo:c.memo});assert.equal(repeated.status,200);assert.equal(repeated.data.id,c.id);
  assert.equal((await h.req('/contracts')).data.total,1);
  assert.equal((await h.req('/contracts?q='+encodeURIComponent('한빛'))).data.total,1);
  assert.equal((await h.req('/contracts','GET',undefined,'bob')).data.total,0);
  assert.equal((await h.req('/contracts/'+c.id,'GET',undefined,'bob')).status,404);
  assert.equal((await h.req('/contracts/'+c.id,'PATCH',{title:'다른 계정',version:0},'bob')).status,404);
  assert.equal((await h.req('/contracts/'+c.id,'PATCH',{title:'수정 계약서',version:0})).status,200);
  assert.equal((await h.req('/contracts/'+c.id,'PATCH',{title:'덮어쓰기',version:0})).status,409);
  const pdf=Buffer.from('%PDF-1.7\nsynthetic scan\n%%EOF');
  const uploadId='cccccccc-cccc-4ccc-accc-cccccccccccc';
  const upload=await h.upload(c.id,'계약서 서명본.pdf',pdf,'alice',uploadId);assert.equal(upload.status,201);
  const retried=await h.upload(c.id,'계약서 서명본.pdf',pdf,'alice',uploadId);assert.equal(retried.status,201);assert.equal(retried.data.file.id,uploadId);
  const file=upload.data.file;assert.equal(file.storageDir,'contracts');
  assert.equal((await h.req('/files')).data.items.length,0);
  assert.equal((await h.req('/shares','POST',{id:file.id})).status,404);
  assert.equal((await h.req('/download-session','POST',{contractFileId:file.id},'bob')).status,404);
  assert.equal((await h.req('/contracts/'+c.id+'/files/'+file.id,'DELETE',undefined,'bob')).status,404);
  const session=await h.req('/download-session','POST',{contractFileId:file.id,preview:true});assert.equal(session.status,200);
  const cookie=session.headers.get('set-cookie').split(';')[0];
  const preview=await fetch(h.base+session.data.url,{headers:{Cookie:cookie}});assert.equal(preview.status,200);assert.equal(preview.headers.get('content-type'),'application/pdf');assert.match(preview.headers.get('content-disposition'),/^inline/);assert.deepEqual(Buffer.from(await preview.arrayBuffer()),pdf);
  const partial=await fetch(h.base+session.data.url,{headers:{Cookie:cookie,Range:'bytes=0-4'}});assert.equal(partial.status,206);assert.equal(await partial.text(),'%PDF-');
  assert.equal((await fetch(h.base+session.data.url)).status,401);
  const latest=(await h.req('/contracts/'+c.id)).data;assert.equal(latest.files.length,1);
  assert.equal((await h.req('/contracts/'+c.id,'PATCH',{archived:true,version:latest.version})).status,200);
  assert.equal((await h.req('/contracts')).data.total,0);assert.equal((await h.req('/contracts?archived=1')).data.total,1);
  assert.equal((await h.upload(c.id,'수정본.pdf',pdf)).status,409);
  await h.restart();
  const saved=(await h.req('/contracts/'+c.id)).data;assert.equal(saved.files[0].id,file.id);assert.equal(saved.archived,1);
  assert.equal((await h.req('/contracts/'+c.id,'PATCH',{archived:false,version:saved.version})).status,200);
  assert.equal((await h.req('/contracts/'+c.id+'/files/'+file.id,'DELETE')).status,200);
  assert.equal((await h.req('/contracts/'+c.id)).data.files.length,0);
  await assert.rejects(fs.stat(path.join(h.dir,'contracts',file.id)),{code:'ENOENT'});
 }finally{await h.close();}
});
test('scan validation rejects unsafe files and interrupted leftovers; list pages do not omit records',async()=>{
 const h=await harness();
 try {
  const c=(await h.req('/contracts','POST',{title:'검증용 계약서'})).data;
  assert.equal((await h.upload(c.id,'실행.exe',Buffer.from('MZ'))).status,415);
  assert.equal((await h.upload(c.id,'위장.pdf',Buffer.from('MZfake'))).status,415);
  assert.equal((await h.upload(c.id,'../계약서.pdf',Buffer.from('%PDF-test'))).status,400);
  assert.equal((await h.upload(c.id,'빈.pdf',Buffer.alloc(0))).status,413);
  assert.equal((await fs.readdir(path.join(h.dir,'contracts'))).length,0);
  const png=Buffer.from([137,80,78,71,13,10,26,10]);assert.equal((await h.upload(c.id,'서명.png',png)).status,201);
  const orphan='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';await fs.writeFile(path.join(h.dir,'contracts',orphan),'incomplete');await h.restart();
  await assert.rejects(fs.stat(path.join(h.dir,'contracts',orphan)),{code:'ENOENT'});assert.equal((await h.req('/contracts/'+c.id)).data.files.length,1);
  for(let i=0;i<51;i++)assert.equal((await h.req('/contracts','POST',{title:'목록 '+i})).status,201);
  const first=(await h.req('/contracts')).data,second=(await h.req('/contracts?page=1')).data;
  assert.equal(first.total,52);assert.equal(first.items.length,50);assert.equal(second.items.length,2);
  assert.equal(new Set([...first.items,...second.items].map(r=>r.id)).size,52);
 }finally{await h.close();}
});

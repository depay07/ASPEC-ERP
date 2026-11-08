import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';

export function createContracts({db,dataDir,fail,storage,validName}) {
 const dir=path.join(dataDir,'contracts');fs.mkdirSync(dir,{recursive:true,mode:0o750});
 db.exec(`CREATE TABLE IF NOT EXISTS contracts(id TEXT PRIMARY KEY,owner TEXT NOT NULL,title TEXT NOT NULL,partner TEXT NOT NULL DEFAULT '',contract_date TEXT NOT NULL DEFAULT '',memo TEXT NOT NULL DEFAULT '',archived INTEGER NOT NULL DEFAULT 0,created TEXT NOT NULL,updated TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 0);
 CREATE INDEX IF NOT EXISTS contracts_owner_date ON contracts(owner,archived,contract_date);
 CREATE TABLE IF NOT EXISTS contract_files(id TEXT PRIMARY KEY,owner TEXT NOT NULL,contract_id TEXT NOT NULL REFERENCES contracts(id),name TEXT NOT NULL,mime TEXT NOT NULL,size INTEGER NOT NULL,created TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS contract_files_contract ON contract_files(contract_id);`);
 const get=(s,...a)=>db.prepare(s).get(...a),all=(s,...a)=>db.prepare(s).all(...a),run=(s,...a)=>db.prepare(s).run(...a);
 const now=()=>new Date().toISOString();
 const contract=(id,owner)=>{const c=get('SELECT * FROM contracts WHERE id=? AND owner=?',id,owner);if(!c)fail(404,'계약서를 찾을 수 없습니다.');return c;};
 for(const id of fs.readdirSync(dir))if(/^[a-f0-9-]{36}$/.test(id)&&!get('SELECT id FROM contract_files WHERE id=?',id))fs.unlinkSync(path.join(dir,id));
 const detail=(id,owner)=>({...contract(id,owner),files:all('SELECT id,name,mime,size,created FROM contract_files WHERE contract_id=? AND owner=? ORDER BY created,id',id,owner)});
 const text=(b,key,max,fallback='')=>{const v=b[key]===undefined?fallback:b[key];if(typeof v!=='string'||v.trim().length>max)fail(400,'계약서 입력 내용을 확인하세요.');return v.trim();};
 const values=(b,old={})=>{
  const title=text(b,'title',200,old.title||''),partner=text(b,'partner',200,old.partner||''),memo=text(b,'memo',10000,old.memo||''),date=text(b,'contract_date',10,old.contract_date||'');
  if(!title)fail(400,'계약명을 입력하세요.');
  if(date&&(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T00:00:00Z'))||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date))fail(400,'계약일을 확인하세요.');
  return {title,partner,memo,date};
 };
 const lookup=(id,owner)=>{const e=get('SELECT f.* FROM contract_files f JOIN contracts c ON c.id=f.contract_id WHERE f.id=? AND f.owner=? AND c.owner=?',id,owner,owner);if(!e)fail(404,'첨부파일을 찾을 수 없습니다.');return {...e,storageDir:'contracts'};};
 async function handle(req,res,p,url,owner,json,send) {
  if(!p.startsWith('/cloud/contracts'))return false;
  if(p==='/cloud/contracts'&&req.method==='GET') {
   const q=(url.searchParams.get('q')||'').slice(0,200),archived=url.searchParams.get('archived')==='1'?1:0;
   const page=Math.max(0,Math.min(100000,Number.parseInt(url.searchParams.get('page')||'0',10)||0));
   const filter='owner=? AND archived=? AND (?=\'\' OR instr(lower(title),lower(?))>0 OR instr(lower(partner),lower(?))>0 OR instr(lower(memo),lower(?))>0)';
   const args=[owner,archived,q,q,q,q];
   const total=get('SELECT COUNT(*) AS n FROM contracts WHERE '+filter,...args).n;
   const items=all('SELECT c.*,(SELECT COUNT(*) FROM contract_files f WHERE f.contract_id=c.id) AS file_count FROM contracts c WHERE '+filter+' ORDER BY contract_date DESC,created DESC,id LIMIT 50 OFFSET ?',...args,page*50);
   send(res,{items,total,page,pageSize:50});return true;
  }
  if(p==='/cloud/contracts'&&req.method==='POST') {
   const b=await json(req),v=values(b),id=b.id||randomUUID(),at=now();
   if(!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(id))fail(400,'계약서 ID를 확인하세요.');
   const saved=get('SELECT * FROM contracts WHERE id=?',id);
   if(saved){if(saved.owner!==owner||saved.title!==v.title||saved.partner!==v.partner||saved.contract_date!==v.date||saved.memo!==v.memo)fail(409,'이 계약서는 이미 저장됐습니다. 목록에서 다시 열어 확인하세요.');send(res,detail(id,owner));return true;}
   run('INSERT INTO contracts(id,owner,title,partner,contract_date,memo,created,updated) VALUES(?,?,?,?,?,?,?,?)',id,owner,v.title,v.partner,v.date,v.memo,at,at);
   send(res,detail(id,owner),201);return true;
  }
  const cm=/^\/cloud\/contracts\/([a-f0-9-]{36})$/.exec(p);
  if(cm&&req.method==='GET'){send(res,detail(cm[1],owner));return true;}
  if(cm&&req.method==='PATCH') {
   const old=contract(cm[1],owner),b=await json(req),v=values(b,old);
   if(!Number.isSafeInteger(b.version)||b.version!==old.version)fail(409,'다른 곳에서 계약서가 변경되었습니다. 다시 열어 확인하세요.');
   if(b.archived!==undefined&&typeof b.archived!=='boolean')fail(400,'보관 상태를 확인하세요.');
   run('UPDATE contracts SET title=?,partner=?,contract_date=?,memo=?,archived=?,updated=?,version=version+1 WHERE id=? AND owner=?',v.title,v.partner,v.date,v.memo,b.archived===undefined?old.archived:Number(b.archived),now(),old.id,owner);
   send(res,detail(old.id,owner));return true;
  }
  const fm=/^\/cloud\/contracts\/([a-f0-9-]{36})\/files(?:\/([a-f0-9-]{36}))?$/.exec(p);
  if(fm) {
   const c=contract(fm[1],owner);
   if(req.method==='POST'&&!fm[2]) {
    if(c.archived)fail(409,'보관된 계약서를 먼저 복원하세요.');
    let name;try{name=decodeURIComponent(String(req.headers['x-file-name']||''));}catch{fail(400,'파일명을 확인하세요.');}name=validName(name);
    const ext=path.extname(name).toLowerCase(),mime={'.pdf':'application/pdf','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png'}[ext];
    if(!mime)fail(415,'PDF, JPG, PNG 파일을 선택하세요.');
    const size=Number(req.headers['content-length']);
    if(!Number.isSafeInteger(size)||size<1||size>50*1024**2)fail(413,'파일은 0바이트보다 크고 50 MB 이하여야 합니다.');
    const uploadId=req.headers['x-upload-id'];
    if(uploadId&&!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(uploadId))fail(400,'업로드 ID를 확인하세요.');
    if(uploadId){const saved=get('SELECT * FROM contract_files WHERE id=?',uploadId);if(saved){if(saved.owner!==owner||saved.contract_id!==c.id||saved.name!==name||saved.size!==size)fail(409,'업로드 ID가 다른 파일에 사용됐습니다.');req.resume();send(res,{file:lookup(saved.id,owner)},201);return true;}}
    if(get('SELECT COUNT(*) AS n FROM contract_files WHERE contract_id=?',c.id).n>=30)fail(400,'계약서당 최대 30개 파일을 등록할 수 있습니다.');
    if(size>(await storage()).uploadAvailable)fail(507,'남은 저장공간이 부족합니다.');
    const id=uploadId||randomUUID(),file=path.join(dir,id);let written=0,head=Buffer.alloc(0);
    const guard=new Transform({transform(chunk,encoding,callback){written+=chunk.length;if(written>size)return callback(Object.assign(new Error('파일 크기가 일치하지 않습니다.'),{status:400}));if(head.length<8)head=Buffer.concat([head,chunk.subarray(0,8-head.length)]);callback(null,chunk);}});
    const output=fs.createWriteStream(file,{flags:'wx',mode:0o640});let created=false;output.once('open',()=>{created=true;});
    try {
     await pipeline(req,guard,output);
     if(written!==size)fail(400,'업로드가 중단됐습니다. 파일을 다시 선택하세요.');
     const valid=mime==='application/pdf'?head.subarray(0,5).toString()==='%PDF-':mime==='image/jpeg'?head.subarray(0,3).equals(Buffer.from([255,216,255])):head.equals(Buffer.from([137,80,78,71,13,10,26,10]));
     if(!valid)fail(415,'파일 내용이 PDF, JPG, PNG 형식과 일치하지 않습니다.');
     const handle=await fsp.open(file,'r+');try{await handle.sync();}finally{await handle.close();}
     db.exec('BEGIN IMMEDIATE');
     try{run('INSERT INTO contract_files VALUES(?,?,?,?,?,?,?)',id,owner,c.id,name,mime,size,now());run('UPDATE contracts SET updated=?,version=version+1 WHERE id=?',now(),c.id);db.exec('COMMIT');}
     catch(e){db.exec('ROLLBACK');throw e;}
    }catch(e){if(created)await fsp.rm(file,{force:true});throw e;}
    send(res,{file:lookup(id,owner)},201);return true;
   }
   if(req.method==='DELETE'&&fm[2]) {
    const file=lookup(fm[2],owner);if(file.contract_id!==c.id)fail(404,'첨부파일을 찾을 수 없습니다.');
    if(c.archived)fail(409,'보관된 계약서를 먼저 복원하세요.');
    run('DELETE FROM contract_files WHERE id=? AND owner=?',file.id,owner);
    await fsp.rm(path.join(dir,file.id),{force:true});run('UPDATE contracts SET updated=?,version=version+1 WHERE id=?',now(),c.id);
    send(res,{ok:true});return true;
   }
  }
  fail(404,'계약서 API를 찾을 수 없습니다.');
 }
 return {handle,lookup};
}

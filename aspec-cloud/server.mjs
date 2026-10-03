import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import project from './project.json' with {type:'json'};

const fail = (status, message) => { throw Object.assign(new Error(message), {status}); };
const uuid = v => typeof v === 'string' && /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
export function validName(v) {
  if (typeof v !== 'string' || !v.trim() || v !== v.trim() || Buffer.byteLength(v) > 240 || /[\\/\x00-\x1f\x7f]/.test(v) || v === '.' || v === '..') fail(400, '파일 또는 폴더 이름을 확인하세요.');
  return v.normalize('NFC');
}
export function createCloud({dataDir, origin, allowedUsers, verify, maxFile = 5 * 1024 ** 3, reserve = 1024 ** 3}) {
  for (const dir of ['files','uploads','meta']) fs.mkdirSync(path.join(dataDir, dir), {recursive:true, mode:0o750});
  const db = new DatabaseSync(path.join(dataDir,'meta','cloud.sqlite'));
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS entries(id TEXT PRIMARY KEY, owner TEXT NOT NULL, parent TEXT NOT NULL DEFAULT '', name TEXT NOT NULL, kind TEXT NOT NULL, size INTEGER NOT NULL DEFAULT 0, updated TEXT NOT NULL);
    CREATE UNIQUE INDEX IF NOT EXISTS entry_name ON entries(owner,parent,name);
    CREATE TABLE IF NOT EXISTS uploads(id TEXT PRIMARY KEY, owner TEXT NOT NULL, parent TEXT NOT NULL, name TEXT NOT NULL, size INTEGER NOT NULL, offset INTEGER NOT NULL DEFAULT 0, updated TEXT NOT NULL);
    CREATE UNIQUE INDEX IF NOT EXISTS upload_name ON uploads(owner,parent,name);`);
  const get = (sql,...args) => db.prepare(sql).get(...args);
  const all = (sql,...args) => db.prepare(sql).all(...args);
  const run = (sql,...args) => db.prepare(sql).run(...args);
  const disk = (dir,id) => { if (!uuid(id)) fail(400,'잘못된 ID입니다.'); return path.join(dataDir,dir,id); };
  const entry = (id,owner) => { const v=get('SELECT * FROM entries WHERE id=? AND owner=?',id,owner); if(!v) fail(404,'항목을 찾을 수 없습니다.'); return v; };
  const folder = (id,owner) => { if(id && entry(id,owner).kind !== 'folder') fail(400,'폴더를 선택하세요.'); };
  const freeName = (owner,parent,name,except='') => { if(get('SELECT id FROM entries WHERE owner=? AND parent=? AND name=? AND id<>?',owner,parent,name,except) || get('SELECT id FROM uploads WHERE owner=? AND parent=? AND name=?',owner,parent,name)) fail(409,'같은 이름의 항목 또는 업로드가 있습니다.'); };
  const now = () => new Date().toISOString();
  const commitUpload = u => { db.exec('BEGIN IMMEDIATE'); try { run('INSERT OR IGNORE INTO entries VALUES(?,?,?,?,?,?,?)',u.id,u.owner,u.parent,u.name,'file',u.size,now()); run('DELETE FROM uploads WHERE id=?',u.id); db.exec('COMMIT'); } catch(e) {db.exec('ROLLBACK'); throw e;} };
  // Recover interrupted completion or partially written chunks after process/VM restart.
  for(const u of all('SELECT * FROM uploads')) {
    if(fs.existsSync(disk('files',u.id))) commitUpload(u);
    else if(fs.existsSync(disk('uploads',u.id))) fs.truncateSync(disk('uploads',u.id),u.offset);
    else run('DELETE FROM uploads WHERE id=?',u.id);
  }
  // UUID files without metadata can only be remnants of an interrupted deletion/creation.
  for(const dir of ['files','uploads']) for(const id of fs.readdirSync(path.join(dataDir,dir))) {
    if(uuid(id) && !get(`SELECT id FROM ${dir==='files'?'entries':'uploads'} WHERE id=?`,id)) fs.unlinkSync(disk(dir,id));
  }
  let queue=Promise.resolve();
  const serial = fn => {const next=queue.then(fn); queue=next.catch(()=>{}); return next;};
  const tickets=new Map(), authCache=new Map(), rates=new Map();
  async function authenticate(req) {
    const token=(req.headers.authorization || '').match(/^Bearer (.{1,8192})$/)?.[1];
    if(!token) fail(401,'ERP에 다시 로그인하세요.');
    const key=createHash('sha256').update(token).digest('hex');
    let hit=authCache.get(key);
    if(!hit || hit.until<=Date.now()) {
      const user=await verify(token);
      if(!user || !uuid(user.id) || user.is_anonymous) fail(401,'유효한 로그인 계정이 필요합니다.');
      let expiry=Date.now()+15000;
      try { const claims=JSON.parse(Buffer.from(token.split('.')[1],'base64url')); if(Number.isFinite(claims.exp)) expiry=Math.min(expiry,claims.exp*1000); } catch {}
      hit={id:user.id,until:expiry};
      if(authCache.size>512) authCache.clear();
      authCache.set(key,hit);
    }
    if(!allowedUsers.has(hit.id)) fail(403,'클라우드 사용 권한이 없습니다.');
    return {owner:hit.id,token};
  }
  async function json(req) {
    if(!String(req.headers['content-type']).startsWith('application/json')) fail(415,'JSON 요청이 필요합니다.');
    let n=0; const chunks=[];
    for await(const c of req) {n+=c.length; if(n>16384) fail(413,'요청이 너무 큽니다.'); chunks.push(c);}
    try{return JSON.parse(Buffer.concat(chunks).toString());}catch{fail(400,'잘못된 JSON입니다.');}
  }
  const storage=async()=> {const s=await fsp.statfs(dataDir); const total=s.blocks*s.bsize, free=s.bavail*s.bsize; const pending=get('SELECT COALESCE(SUM(size-offset),0) AS n FROM uploads').n; return {total,used:(s.blocks-s.bfree)*s.bsize,free,reserved:reserve,pending,uploadAvailable:Math.max(0,free-reserve-pending)};};
  const send=(res,obj,status=200)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'}); res.end(JSON.stringify(obj));};
  const timer=setInterval(()=>serial(async()=>{
    for(const [k,v] of tickets) if(v.until<Date.now()) tickets.delete(k);
    rates.clear();
    for(const u of all('SELECT * FROM uploads WHERE updated<?',new Date(Date.now()-7*86400000).toISOString())) {await fsp.rm(disk('uploads',u.id),{force:true}); run('DELETE FROM uploads WHERE id=?',u.id);}
  }).catch(()=>console.error('cloud maintenance failed')),60000); timer.unref();
  const server=http.createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff'); res.setHeader('Cache-Control','no-store'); res.setHeader('Referrer-Policy','no-referrer');
    try {
      const url=new URL(req.url,'http://localhost'), p=url.pathname, method=req.method;
      if(req.headers.origin && req.headers.origin!==origin) fail(403,'허용되지 않은 Origin입니다.');
      if(req.headers.origin===origin) {res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Credentials','true');}
      if(method==='OPTIONS') {res.setHeader('Access-Control-Allow-Methods','GET,POST,PATCH,DELETE,OPTIONS');res.setHeader('Access-Control-Allow-Headers','Authorization,Content-Type,Upload-Offset');res.writeHead(204); return res.end();}
      const ip=req.socket.remoteAddress, count=(rates.get(ip)||0)+1; rates.set(ip,count); if(count>1200) fail(429,'잠시 후 다시 시도하세요.');
      if(p==='/cloud/health' && method==='GET') return send(res,{ok:true});
      if(p.startsWith('/cloud/download/') && ['GET','HEAD'].includes(method)) {
        const ticket=(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('__Secure-aspec_download='))?.split('=')[1];
        const t=tickets.get(ticket), id=p.split('/')[3];
        if(!t || t.until<Date.now() || t.id!==id || !allowedUsers.has(t.owner)) fail(401,'다운로드를 다시 선택하세요.');
        const user=await verify(t.token); if(user?.id!==t.owner) fail(401,'다시 로그인하세요.');
        const e=entry(id,t.owner); if(e.kind!=='file') fail(400,'파일을 선택하세요.');
        const handle=await fsp.open(disk('files',id),'r');
        try {
          let start=0,end=e.size-1,status=200;
          if(req.headers.range) {
            const m=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
            if(!m || (!m[1]&&!m[2]) || e.size===0) {res.setHeader('Content-Range',`bytes */${e.size}`);fail(416,'잘못된 다운로드 범위입니다.');}
            if(!m[1]) start=Math.max(0,e.size-Number(m[2])); else {start=Number(m[1]); if(m[2]) end=Math.min(end,Number(m[2]));}
            if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=e.size) {res.setHeader('Content-Range',`bytes */${e.size}`);fail(416,'잘못된 다운로드 범위입니다.');}
            status=206;res.setHeader('Content-Range',`bytes ${start}-${end}/${e.size}`);
          }
          res.setHeader('Content-Type','application/octet-stream');res.setHeader('Content-Disposition',`attachment; filename="download"; filename*=UTF-8''${encodeURIComponent(e.name).replace(/['()*]/g,c=>'%'+c.charCodeAt(0).toString(16))}`);
          res.setHeader('Accept-Ranges','bytes');res.setHeader('Content-Length',Math.max(0,end-start+1));res.writeHead(status);
          if(method==='HEAD'||e.size===0) return res.end();
          await pipeline(handle.createReadStream({start,end,autoClose:false}),res);return;
        } finally {await handle.close();}
      }
      const {owner,token}=await authenticate(req);
      if(p==='/cloud/storage' && method==='GET') return send(res,await storage());
      if(p==='/cloud/files' && method==='GET') {
        const parent=url.searchParams.get('parent')||'', q=(url.searchParams.get('q')||'').slice(0,200);folder(parent,owner);
        const items=q?all('SELECT * FROM entries WHERE owner=? AND instr(lower(name),lower(?))>0 ORDER BY kind DESC,name LIMIT 1001',owner,q):all('SELECT * FROM entries WHERE owner=? AND parent=? ORDER BY kind DESC,name LIMIT 1001',owner,parent);
        const crumbs=[];let cursor=parent;while(cursor){const e=entry(cursor,owner);crumbs.unshift({id:e.id,name:e.name});cursor=e.parent;}
        return send(res,{items:items.slice(0,1000),truncated:items.length>1000,crumbs});
      }
      if(p==='/cloud/logout' && method==='POST') {for(const [k,t] of tickets) if(t.owner===owner) tickets.delete(k);authCache.clear();res.setHeader('Set-Cookie','__Secure-aspec_download=; Path=/cloud/download/; Secure; HttpOnly; SameSite=Strict; Max-Age=0');return send(res,{ok:true});}
      if(p==='/cloud/download-session' && method==='POST') {
        const b=await json(req),e=entry(b.id,owner);if(e.kind!=='file') fail(400,'파일을 선택하세요.');
        if(tickets.size>=512) fail(429,'잠시 후 다시 시도하세요.');
        const key=randomBytes(32).toString('hex');tickets.set(key,{id:e.id,owner,token,until:Date.now()+90000});
        res.setHeader('Set-Cookie',`__Secure-aspec_download=${key}; Path=/cloud/download/; Secure; HttpOnly; SameSite=Strict; Max-Age=90`);return send(res,{url:'/cloud/download/'+e.id});
      }
      // Serialize changes so rename/delete/move cannot race with an upload chunk.
      await serial(async()=>{
        if(p==='/cloud/folders' && method==='POST') {const b=await json(req),name=validName(b.name),parent=b.parent||'';folder(parent,owner);freeName(owner,parent,name);const id=randomUUID();run('INSERT INTO entries VALUES(?,?,?,?,?,?,?)',id,owner,parent,name,'folder',0,now());return send(res,{id},201);}
        const em=/^\/cloud\/entries\/([^/]+)$/.exec(p);
        if(em && ['PATCH','DELETE','GET'].includes(method)) {
          const e=entry(em[1],owner);
          if(method==='GET') return send(res,e);
          if(method==='DELETE') {
            if(e.kind==='folder' && (get('SELECT id FROM entries WHERE parent=?',e.id)||get('SELECT id FROM uploads WHERE parent=?',e.id))) fail(409,'폴더를 비운 후 삭제하세요. 진행 중인 업로드도 취소해야 합니다.');
            run('DELETE FROM entries WHERE id=?',e.id);if(e.kind==='file') await fsp.rm(disk('files',e.id),{force:true});return send(res,{ok:true});
          }
          const b=await json(req),name=b.name===undefined?e.name:validName(b.name),parent=b.parent===undefined?e.parent:b.parent;folder(parent,owner);
          let cur=parent;while(cur){if(cur===e.id)fail(400,'자기 자신이나 하위 폴더로 이동할 수 없습니다.');cur=entry(cur,owner).parent;}
          freeName(owner,parent,name,e.id);run('UPDATE entries SET name=?,parent=?,updated=? WHERE id=?',name,parent,now(),e.id);return send(res,{ok:true});
        }
        if(p==='/cloud/uploads' && method==='POST') {
          const b=await json(req),name=validName(b.name),parent=b.parent||'';folder(parent,owner);
          if(!Number.isSafeInteger(b.size)||b.size<0||b.size>maxFile) fail(413,'파일당 최대 5 GiB까지 업로드할 수 있습니다.');
          freeName(owner,parent,name);if(b.size>(await storage()).uploadAvailable) fail(507,'남은 저장공간이 부족합니다.');
          if(get('SELECT COUNT(*) AS n FROM uploads WHERE owner=?',owner).n>=100)fail(409,'미완료 업로드를 먼저 정리하세요.');
          const id=randomUUID();await fsp.writeFile(disk('uploads',id),'',{flag:'wx',mode:0o640});run('INSERT INTO uploads VALUES(?,?,?,?,?,?,?)',id,owner,parent,name,b.size,0,now());return send(res,{id,offset:0},201);
        }
        if(p==='/cloud/uploads' && method==='GET') return send(res,all('SELECT * FROM uploads WHERE owner=? ORDER BY updated DESC',owner));
        const um=/^\/cloud\/uploads\/([^/]+)(\/complete)?$/.exec(p);
        if(um) {
          const u=get('SELECT * FROM uploads WHERE id=? AND owner=?',um[1],owner);
          if(!u) {if(um[2] && method==='POST' && get('SELECT id FROM entries WHERE id=? AND owner=?',um[1],owner)) return send(res,{id:um[1]}); fail(404,'업로드를 찾을 수 없습니다.');}
          if(method==='GET'&&!um[2])return send(res,u);
          if(method==='DELETE'&&!um[2]){await fsp.rm(disk('uploads',u.id),{force:true});run('DELETE FROM uploads WHERE id=?',u.id);return send(res,{ok:true});}
          if(method==='POST'&&um[2]){if(u.offset!==u.size)fail(409,'업로드가 완료되지 않았습니다.');await fsp.rename(disk('uploads',u.id),disk('files',u.id));commitUpload(u);return send(res,{id:u.id});}
          if(method==='PATCH'&&!um[2]){
            const length=Number(req.headers['content-length']);
            if(!Number.isSafeInteger(length)||length<1||length>8*1024**2||u.offset+length>u.size)fail(413,'잘못된 업로드 조각 크기입니다.');
            if(String(u.offset)!==req.headers['upload-offset'])fail(409,'업로드 위치가 변경됐습니다.');
            if(length>(await storage()).free-reserve)fail(507,'남은 저장공간이 부족합니다.');
            const h=await fsp.open(disk('uploads',u.id),'r+');let written=0;
            try {
              for await(const c of req){if(written+c.length>length)fail(413,'크기가 초과됐습니다.');let pos=0;while(pos<c.length){const r=await h.write(c,pos,c.length-pos,u.offset+written+pos);pos+=r.bytesWritten;}written+=c.length;}
              if(written!==length)fail(400,'업로드가 중단됐습니다.');await h.sync();run('UPDATE uploads SET offset=?,updated=? WHERE id=?',u.offset+written,now(),u.id);
            } catch(e){await h.truncate(u.offset);throw e;}finally{await h.close();}
            return send(res,{offset:u.offset+written});
          }
        }
        fail(404,'API를 찾을 수 없습니다.');
      });
    }catch(e){if(!res.headersSent){send(res,{error:e.status?e.message:'서버 오류가 발생했습니다.'},e.status||500);}else res.destroy();if(!e.status && e.code!=='ERR_STREAM_PREMATURE_CLOSE')console.error('cloud error',e.code||e.name);}
  });
  server.requestTimeout=120000; server.headersTimeout=30000;
  return {server,close:async()=>{clearInterval(timer);await new Promise(r=>server.close(r));await queue;db.close();}};
}

if(process.argv[1]===fileURLToPath(import.meta.url)) {
  const env=process.env, dataDir=env.CLOUD_DATA_DIR, origin=env.CORS_ORIGIN;
  if(!dataDir||!origin||!env.ALLOWED_USER_IDS)throw new Error('Missing cloud environment');
  const allowedUsers=new Set(env.ALLOWED_USER_IDS.split(',').map(v=>v.trim()));if([...allowedUsers].some(v=>!uuid(v)))throw new Error('Invalid user allowlist');
  const base=env.SUPABASE_URL||project.url, apiKey=env.SUPABASE_ANON_KEY||project.anonKey;
  if(!base.startsWith('https://'))throw new Error('Supabase HTTPS required');
  const verify=async token=>{let r;try{r=await fetch(base+'/auth/v1/user',{headers:{apikey:apiKey,Authorization:'Bearer '+token},signal:AbortSignal.timeout(10000)});}catch{fail(503,'인증 서버 연결을 확인하세요.');}if(!r.ok)fail(r.status>=500||r.status===429?503:401,'로그인을 확인하거나 잠시 후 다시 시도하세요.');return r.json();};
  const app=createCloud({dataDir,origin,allowedUsers,verify});app.server.listen(Number(env.PORT||3100),env.HOST||'127.0.0.1',()=>console.log('ASPEC Cloud API ready'));
  for(const s of ['SIGTERM','SIGINT'])process.on(s,()=>app.close().then(()=>process.exit(0)));
}

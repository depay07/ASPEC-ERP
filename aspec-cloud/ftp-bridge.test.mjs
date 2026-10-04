import {createBridge} from './ftp-bridge.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'aspec-bridge-'));
const ftpDir=path.join(root,'ftp'),dataDir=path.join(root,'cloud');
for(const p of [ftpDir,...['files','meta','uploads'].map(x=>path.join(dataDir,x))])fs.mkdirSync(p,{recursive:true});
const db=new DatabaseSync(path.join(dataDir,'meta/cloud.sqlite'));
db.exec(`CREATE TABLE entries(id TEXT PRIMARY KEY,owner TEXT,parent TEXT,name TEXT,kind TEXT,size INTEGER,updated TEXT); CREATE UNIQUE INDEX entry_name ON entries(owner,parent,name); CREATE TABLE uploads(id TEXT,owner TEXT,parent TEXT,name TEXT,size INTEGER,offset INTEGER); CREATE TABLE ftp_import_history(name TEXT,size INTEGER,mtime_ms REAL);`);
const owner='11111111-1111-4111-8111-111111111111';
const folder=(id,parent,name,user=owner)=>db.prepare("INSERT INTO entries VALUES(?,?,?,?,'folder',0,'')").run(id,user,parent,name);
folder('f1','','1');folder('f2','f1','Camera2');folder('other','','private','another-owner');
const old=path.join(ftpDir,'old.jpg');fs.writeFileSync(old,'old');db.prepare('INSERT INTO ftp_import_history VALUES(?,?,?)').run('old.jpg',3,Math.floor(fs.statSync(old).mtimeMs));
const bridge=createBridge({ftpDir,dataDir,owner,stableMs:-1000});
try{
bridge.scan();assert(fs.existsSync(path.join(ftpDir,'1/Camera2')));assert(!fs.existsSync(path.join(ftpDir,'private')));
assert.equal(db.prepare("SELECT count(*) AS n FROM entries WHERE kind='file'").get().n,0);
fs.writeFileSync(path.join(ftpDir,'1/a.jpg'),'imageA');fs.writeFileSync(path.join(ftpDir,'1/Camera2/a.jpg'),'imageB');
bridge.scan();let files=db.prepare("SELECT * FROM entries WHERE kind='file'").all();assert.equal(files.length,2);assert.deepEqual(new Set(files.map(x=>x.parent)),new Set(['f1','f2']));
for(const f of files)assert.equal(fs.readFileSync(path.join(dataDir,'files',f.id),'utf8'),f.parent==='f1'?'imageA':'imageB');
bridge.scan();assert.equal(db.prepare("SELECT count(*) AS n FROM entries WHERE kind='file'").get().n,2);
const deleted=files.find(x=>x.parent==='f1');db.prepare('DELETE FROM entries WHERE id=?').run(deleted.id);fs.unlinkSync(path.join(dataDir,'files',deleted.id));bridge.scan();assert.equal(db.prepare("SELECT count(*) AS n FROM entries WHERE kind='file'").get().n,1);
fs.writeFileSync(path.join(ftpDir,'1/new.jpg'),'new');bridge.scan();assert(db.prepare("SELECT 1 FROM entries WHERE parent='f1' AND name='new.jpg'").get());
// Same-size overwrite is a new revision; preserve the prior cloud file.
const changed=path.join(ftpDir,'1/Camera2/a.jpg');fs.writeFileSync(changed,'imageC');const t=Date.now()/1000-1;fs.utimesSync(changed,t,t);bridge.scan();assert.equal(db.prepare("SELECT count(*) AS n FROM entries WHERE parent='f2' AND kind='file'").get().n,2);
// Never read symlinks or traverse a symlink directory.
fs.symlinkSync('/etc/passwd',path.join(ftpDir,'1/link'));folder('unsafe','','unsafe');fs.symlinkSync('/tmp',path.join(ftpDir,'unsafe'));bridge.scan();assert(!db.prepare("SELECT 1 FROM entries WHERE name='link'").get());
// Folder deletion does not cause its old FTP originals to recreate it.
db.prepare("DELETE FROM entries WHERE parent='f2' OR id='f2'").run();bridge.scan();assert(!db.prepare("SELECT 1 FROM entries WHERE id='f2'").get());
console.log('PASS: existing/nested folders, owner isolation, root history migration, import bytes, dedup, cloud deletion, new upload, same-size revision, symlink rejection, deleted folder');
}finally{bridge.close();db.close();fs.rmSync(root,{recursive:true,force:true});}

import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { pathToFileURL } from 'node:url';

export function createBridge({ftpDir, dataDir, owner, startTime = 0, stableMs = 10000}) {
    if (!/^[a-f0-9-]{36}$/.test(owner)) throw new Error('Invalid cloud owner');
    const db = new DatabaseSync(path.join(dataDir, 'meta/cloud.sqlite'));
    db.exec(`PRAGMA busy_timeout=5000;
        CREATE TABLE IF NOT EXISTS ftp_bridge_history (
            owner TEXT NOT NULL, source TEXT NOT NULL, size INTEGER NOT NULL, mtime_ms INTEGER NOT NULL,
            PRIMARY KEY(owner,source,size,mtime_ms));`);
    const get = (sql, ...args) => db.prepare(sql).get(...args);
    const run = (sql, ...args) => db.prepare(sql).run(...args);
    // Preserve the original root importer's deletion history, including deleted cloud entries.
    if (get("SELECT name FROM sqlite_master WHERE type='table' AND name='ftp_import_history'")) {
        run(`INSERT OR IGNORE INTO ftp_bridge_history
             SELECT ?,name,size,CAST(mtime_ms AS INTEGER) FROM ftp_import_history`, owner);
    }
    const safeName = n => typeof n === 'string' && n !== '.' && n !== '..' && n.length > 0 && !/[\\/\x00-\x1f\x7f]/.test(n);
    function safeDir(parts, create = false) {
        let dir = ftpDir;
        if (!fs.lstatSync(dir).isDirectory() || fs.lstatSync(dir).isSymbolicLink()) throw new Error('Unsafe FTP root');
        for (const part of parts) {
            if (!safeName(part)) throw new Error('Unsafe folder name');
            dir = path.join(dir, part);
            if (create && !fs.existsSync(dir)) {
                fs.mkdirSync(dir, {mode:0o2770});
                fs.chmodSync(dir, 0o2770);
            }
            const stat = fs.lstatSync(dir);
            if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error('Unsafe FTP directory: ' + dir);
        }
        return dir;
    }
    function importFile(parts, parent, file) {
        const dir = safeDir(parts);
        const full = path.join(dir, file);
        const initial = fs.lstatSync(full);
        if (!initial.isFile() || initial.isSymbolicLink()) return;
        if (initial.mtimeMs < startTime || Date.now() - initial.mtimeMs < stableMs) return;
        const source = [...parts, file].join('/');
        const mtime = Math.floor(initial.mtimeMs);
        if (get('SELECT 1 FROM ftp_bridge_history WHERE owner=? AND source=? AND size=? AND mtime_ms=?', owner, source, initial.size, mtime)) return;
        const fd = fs.openSync(full, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
        let destination, committed = false;
        try {
            const before = fs.fstatSync(fd);
            if (before.ino !== initial.ino || before.size !== initial.size || before.mtimeMs !== initial.mtimeMs) return;
            db.exec('BEGIN IMMEDIATE');
            try {
                // Recheck the complete cloud folder chain under the write lock.
                let expectedParent = '';
                for (const part of parts) {
                    const folder = get("SELECT id FROM entries WHERE owner=? AND parent=? AND name=? AND kind='folder'", owner, expectedParent, part);
                    if (!folder) throw new Error('Cloud folder changed; retry next scan');
                    expectedParent = folder.id;
                }
                if (expectedParent !== parent) throw new Error('Cloud folder changed');
                const id = randomUUID();
                let name = file;
                const occupied = n => get('SELECT id FROM entries WHERE owner=? AND parent=? AND name=?', owner, parent, n) || get('SELECT id FROM uploads WHERE owner=? AND parent=? AND name=?', owner, parent, n);
                if (occupied(name)) {
                    const ext = path.extname(file);
                    name = Array.from(path.basename(file, ext)).slice(0, 40).join('') + '-' + id + ext.slice(0, 16);
                }
                const space = fs.statfsSync(dataDir);
                const pending = get('SELECT COALESCE(SUM(size-offset),0) AS n FROM uploads').n;
                if (space.bavail * space.bsize - pending - initial.size < 1024 ** 3) throw new Error('Insufficient cloud disk space');
                destination = path.join(dataDir, 'files', id);
                const out = fs.openSync(destination, 'wx', 0o640);
                try {
                    const buf = Buffer.alloc(1024 * 1024);
                    let bytes;
                    while ((bytes = fs.readSync(fd, buf, 0, buf.length, null)) > 0) {
                        let offset = 0;
                        while (offset < bytes) offset += fs.writeSync(out, buf, offset, bytes-offset);
                    }
                    fs.fsyncSync(out);
                } finally { fs.closeSync(out); }
                const after = fs.fstatSync(fd);
                if (after.size !== before.size || after.mtimeMs !== before.mtimeMs) throw new Error('FTP file still changing');
                run("INSERT INTO entries (id,owner,parent,name,kind,size,updated) VALUES (?,?,?,?,'file',?,?)", id, owner, parent, name, before.size, new Date().toISOString());
                run('INSERT INTO ftp_bridge_history VALUES (?,?,?,?)', owner, source, before.size, mtime);
                db.exec('COMMIT'); committed = true;
                console.log('[IMPORT]', source, '->', name);
            } catch (e) { db.exec('ROLLBACK'); throw e; }
        } finally {
            fs.closeSync(fd);
            if (destination && !committed) fs.rmSync(destination, {force:true});
        }
    }
    function scan() {
        const folders = db.prepare("SELECT id,parent,name FROM entries WHERE owner=? AND kind='folder'").all(owner);
        const children = new Map();
        for (const f of folders) {
            if (!children.has(f.parent)) children.set(f.parent, []);
            children.get(f.parent).push(f);
        }
        const visited = new Set();
        function walk(parent, parts) {
            if (parts.length > 32 || visited.has(parent)) return;
            visited.add(parent);
            let dir;
            try { dir = safeDir(parts, true); }
            catch (e) { console.error('[FOLDER ERROR]', e.message); return; }
            for (const file of fs.readdirSync(dir)) {
                if (!safeName(file)) continue;
                try { importFile(parts, parent, file); }
                catch (e) { console.error('[IMPORT ERROR]', [...parts,file].join('/'), e.message); }
            }
            for (const f of children.get(parent) || []) walk(f.id, [...parts, f.name]);
        }
        walk('', []);
    }
    return {scan, close:() => db.close()};
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const config = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
    const bridge = createBridge(config);
    const scan = () => { try { bridge.scan(); } catch(e) { console.error('[SCAN ERROR]', e.message); } };
    console.log('[ASPEC FTP Bridge] started');
    scan();
    setInterval(scan, 5000);
}

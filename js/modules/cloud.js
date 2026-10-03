// js/modules/cloud.js - ASPEC 업무 파일 클라우드
const CloudModule = (() => {
    const API = 'https://api.aspec-tech.co.kr/cloud';
    const CHUNK_SIZE = 8 * 1024 * 1024;
    let parent = '';
    let searchQuery = '';
    let busy = false;

    const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const fmtBytes = n => {
        n = Number(n) || 0;
        if (n < 1024) return n + ' B';
        const units = ['KB','MB','GB','TB']; let i = -1;
        do { n /= 1024; i++; } while (n >= 1024 && i < units.length - 1);
        return n.toFixed(n >= 10 ? 1 : 2) + ' ' + units[i];
    };
    const fmtDate = value => value ? new Date(value).toLocaleString('ko-KR') : '-';

    async function token() {
        const result = await supabaseClient.auth.getSession();
        const accessToken = result.data?.session?.access_token;
        if (!accessToken) throw new Error('ERP에 다시 로그인하세요.');
        return accessToken;
    }
    async function api(path, options = {}) {
        const headers = new Headers(options.headers || {});
        headers.set('Authorization', 'Bearer ' + await token());
        if (options.json !== undefined) {
            headers.set('Content-Type', 'application/json');
            options.body = JSON.stringify(options.json);
        }
        const response = await fetch(API + path, {...options, headers, credentials:'include'});
        const type = response.headers.get('content-type') || '';
        const data = type.includes('application/json') ? await response.json() : null;
        if (!response.ok) {
            if (response.status === 401) ensureActiveSession({forceRefresh:true, context:'파일 클라우드', notifyNetworkError:false}).catch(()=>{});
            throw new Error(data?.error || ('클라우드 요청 실패 (' + response.status + ')'));
        }
        return data;
    }
    function shell() {
        return `
        <div class="flex flex-col gap-4">
          <div class="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
            <div>
              <h2 class="text-3xl font-bold text-slate-800 border-l-8 border-cyan-500 pl-4">파일 클라우드</h2>
              <p class="text-sm text-slate-500 mt-2 ml-6">업무 파일을 서버에 보관합니다.</p>
            </div>
            <div class="flex flex-wrap gap-2">
              <button onclick="CloudModule.createFolder()" class="bg-slate-700 hover:bg-slate-800 text-white px-4 py-2.5 rounded font-bold text-sm"><i class="fa-solid fa-folder-plus mr-2"></i>새 폴더</button>
              <label class="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2.5 rounded font-bold text-sm cursor-pointer">
                <i class="fa-solid fa-cloud-arrow-up mr-2"></i>파일 업로드
                <input id="cloudFileInput" type="file" multiple class="hidden" onchange="CloudModule.uploadFiles(this.files); this.value=''">
              </label>
            </div>
          </div>
          <div class="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
            <div class="flex flex-col lg:flex-row gap-3 lg:items-center">
              <div id="cloudCrumbs" class="flex-1 flex flex-wrap items-center gap-1 text-sm"></div>
              <div class="flex gap-2">
                <input id="cloudSearch" type="search" class="input-box min-w-[220px]" placeholder="전체 파일/폴더 검색" onkeydown="if(event.key==='Enter') CloudModule.search(this.value)">
                <button onclick="CloudModule.search(document.getElementById('cloudSearch').value)" class="bg-blue-600 hover:bg-blue-700 text-white px-4 rounded font-bold"><i class="fa-solid fa-magnifying-glass"></i></button>
                <button onclick="CloudModule.refresh()" class="bg-slate-100 hover:bg-slate-200 px-4 rounded" title="새로고침"><i class="fa-solid fa-rotate"></i></button>
              </div>
            </div>
            <div id="cloudStorage" class="mt-3 text-xs text-slate-500"></div>
          </div>
          <div id="cloudDrop" class="bg-white rounded-lg border-2 border-dashed border-slate-300 min-h-[360px] overflow-hidden">
            <div id="cloudNotice" class="hidden m-4 rounded p-3 text-sm"></div>
            <div id="cloudUploads" class="hidden border-b border-slate-200 p-4 space-y-3"></div>
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead class="bg-slate-50 text-slate-600"><tr><th class="text-left p-3">이름</th><th class="text-left p-3 w-28">크기</th><th class="text-left p-3 w-44">수정일</th><th class="text-right p-3 w-52">작업</th></tr></thead>
                <tbody id="cloudList"></tbody>
              </table>
            </div>
          </div>
        </div>`;
    }
    function notice(message, error=false) {
        const el = document.getElementById('cloudNotice'); if (!el) return;
        el.textContent = message; el.className = 'm-4 rounded p-3 text-sm ' + (error ? 'bg-red-50 text-red-700' : 'bg-cyan-50 text-cyan-800');
    }
    function renderCrumbs(crumbs) {
        const el = document.getElementById('cloudCrumbs'); if (!el) return;
        let html = '<button class="font-bold text-cyan-700 hover:underline" onclick="CloudModule.openFolder(\'\')"><i class="fa-solid fa-house mr-1"></i>내 파일</button>';
        for (const c of crumbs || []) html += '<i class="fa-solid fa-chevron-right text-slate-300 text-xs mx-1"></i><button class="hover:underline" onclick="CloudModule.openFolder(\'' + esc(c.id) + '\')">' + esc(c.name) + '</button>';
        if (searchQuery) html += '<span class="ml-2 text-slate-500">검색: “' + esc(searchQuery) + '”</span>';
        el.innerHTML = html;
    }
    function renderList(data) {
        renderCrumbs(data.crumbs);
        const body = document.getElementById('cloudList'); if (!body) return;
        if (!data.items?.length) {
            body.innerHTML = '<tr><td colspan="4" class="p-12 text-center text-slate-400"><i class="fa-regular fa-folder-open text-4xl mb-3 block"></i>' + (searchQuery ? '검색 결과가 없습니다.' : '이 폴더가 비어 있습니다. 파일을 끌어다 놓거나 업로드하세요.') + '</td></tr>';
            return;
        }
        body.innerHTML = data.items.map(e => {
            const folder = e.kind === 'folder';
            const name = folder ? '<button class="font-bold text-slate-800 hover:text-cyan-700 text-left" onclick="CloudModule.openFolder(\''+esc(e.id)+'\')"><i class="fa-solid fa-folder text-amber-400 mr-2"></i>'+esc(e.name)+'</button>' : '<span class="text-slate-700"><i class="fa-regular fa-file text-slate-400 mr-2"></i>'+esc(e.name)+'</span>';
            const primary = folder ? '' : '<button onclick="CloudModule.download(\''+esc(e.id)+'\')" class="text-blue-600 hover:underline mr-3">다운로드</button>';
            return '<tr class="border-t border-slate-100 hover:bg-slate-50"><td class="p-3">'+name+'</td><td class="p-3 text-slate-500">'+(folder?'—':fmtBytes(e.size))+'</td><td class="p-3 text-slate-500">'+fmtDate(e.updated)+'</td><td class="p-3 text-right">'+primary+'<button onclick="CloudModule.rename(\''+esc(e.id)+'\',\''+esc(e.name).replace(/'/g,'&#39;')+'\')" class="text-slate-600 hover:underline mr-3">이름변경</button><button onclick="CloudModule.remove(\''+esc(e.id)+'\',\''+esc(e.name).replace(/'/g,'&#39;')+'\')" class="text-red-600 hover:underline">삭제</button></td></tr>';
        }).join('');
        if (data.truncated) notice('검색 결과가 1,000개를 넘어 일부만 표시됩니다.');
    }
    async function load() {
        try {
            const qs = searchQuery ? '?q=' + encodeURIComponent(searchQuery) : '?parent=' + encodeURIComponent(parent);
            const [files, storage] = await Promise.all([api('/files'+qs), api('/storage')]);
            renderList(files);
            const el=document.getElementById('cloudStorage');
            if(el) el.textContent='저장공간: ' + fmtBytes(storage.used) + ' 사용 / ' + fmtBytes(storage.total) + ' · 업로드 가능 ' + fmtBytes(storage.uploadAvailable);
        } catch(e) { notice(e.message, true); }
    }
    async function init(container) {
        parent=''; searchQuery='';
        container.innerHTML=shell();
        const drop=document.getElementById('cloudDrop');
        ['dragenter','dragover'].forEach(n=>drop.addEventListener(n,e=>{e.preventDefault();drop.classList.add('border-cyan-500','bg-cyan-50');}));
        ['dragleave','drop'].forEach(n=>drop.addEventListener(n,e=>{e.preventDefault();drop.classList.remove('border-cyan-500','bg-cyan-50');}));
        drop.addEventListener('drop',e=>uploadFiles(e.dataTransfer.files));
        await load();
        await showPending();
    }
    async function openFolder(id){parent=id;searchQuery='';const s=document.getElementById('cloudSearch');if(s)s.value='';await load();}
    async function search(q){searchQuery=String(q||'').trim();await load();}
    async function refresh(){await load();await showPending();}
    async function createFolder(){
        const name=prompt('새 폴더 이름을 입력하세요.'); if(!name)return;
        try{await api('/folders',{method:'POST',json:{name,parent}});await load();}catch(e){notice(e.message,true);}
    }
    async function rename(id,current){
        const name=prompt('새 이름을 입력하세요.',current);if(!name||name===current)return;
        try{await api('/entries/'+encodeURIComponent(id),{method:'PATCH',json:{name}});await load();}catch(e){notice(e.message,true);}
    }
    async function remove(id,name){
        if(!confirm('“'+name+'”을(를) 삭제하시겠습니까?\n폴더는 비어 있어야 삭제할 수 있습니다.'))return;
        try{await api('/entries/'+encodeURIComponent(id),{method:'DELETE'});await load();}catch(e){notice(e.message,true);}
    }
    async function download(id){
        try{const r=await api('/download-session',{method:'POST',json:{id}});window.location.href='https://api.aspec-tech.co.kr'+r.url;}catch(e){notice(e.message,true);}
    }
    async function fingerprint(file){
        const first=await file.slice(0,65536).arrayBuffer(), last=await file.slice(Math.max(0,file.size-65536)).arrayBuffer();
        const bytes=new Uint8Array(first.byteLength+last.byteLength);bytes.set(new Uint8Array(first));bytes.set(new Uint8Array(last),first.byteLength);
        const hash=await crypto.subtle.digest('SHA-256',bytes);
        return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('');
    }
    async function uploadFiles(fileList){
        if(busy){notice('현재 업로드가 진행 중입니다.',true);return;}
        const files=[...fileList];if(!files.length)return;
        busy=true;
        try{for(const file of files)await uploadOne(file);}finally{busy=false;await load();await showPending();}
    }
    async function uploadOne(file){
        const box=document.getElementById('cloudUploads');box.classList.remove('hidden');
        const row=document.createElement('div');row.className='text-sm';row.innerHTML='<div class="flex justify-between gap-3"><span class="font-medium truncate">'+esc(file.name)+'</span><span class="cloud-pct">준비 중</span></div><div class="h-2 bg-slate-200 rounded mt-1 overflow-hidden"><div class="cloud-bar h-full bg-cyan-600" style="width:0%"></div></div>';box.appendChild(row);
        const pct=row.querySelector('.cloud-pct'),bar=row.querySelector('.cloud-bar');
        try{
            const session=await supabaseClient.auth.getSession();const owner=session.data?.session?.user?.id||'';
            const fp=await fingerprint(file);const key='aspec_cloud_upload:'+owner+':'+parent+':'+file.name+':'+file.size+':'+file.lastModified+':'+fp;
            let id=localStorage.getItem(key), offset=0;
            if(id){try{const u=await api('/uploads/'+id);offset=u.offset;if(u.parent!==parent||u.name!==file.name||u.size!==file.size)throw new Error('mismatch');}catch{localStorage.removeItem(key);id=null;}}
            if(!id){const u=await api('/uploads',{method:'POST',json:{name:file.name,parent,size:file.size}});id=u.id;offset=u.offset;localStorage.setItem(key,id);}
            while(offset<file.size){
                const end=Math.min(file.size,offset+CHUNK_SIZE),blob=file.slice(offset,end);
                let tries=0;
                while(true){try{const r=await api('/uploads/'+id,{method:'PATCH',headers:{'Content-Type':'application/octet-stream','Upload-Offset':String(offset)},body:blob});offset=r.offset;break;}catch(e){if(++tries>=3)throw e;await new Promise(r=>setTimeout(r,1000*tries));const u=await api('/uploads/'+id);offset=u.offset;}}
                const n=file.size?Math.floor(offset/file.size*100):100;pct.textContent=n+'%';bar.style.width=n+'%';
            }
            await api('/uploads/'+id+'/complete',{method:'POST'});localStorage.removeItem(key);pct.textContent='완료';bar.style.width='100%';
        }catch(e){pct.textContent='실패';row.classList.add('text-red-600');notice(file.name+': '+e.message,true);}
    }
    async function showPending(){
        try{
            const list=await api('/uploads');if(!list?.length)return;
            const box=document.getElementById('cloudUploads');if(!box)return;box.classList.remove('hidden');
            const info=document.createElement('div');info.className='text-xs text-amber-700 bg-amber-50 rounded p-2';
            info.textContent='미완료 업로드 '+list.length+'개가 있습니다. 같은 원본 파일을 다시 선택하면 이어서 업로드됩니다.';box.prepend(info);
        }catch{}
    }
    async function logout(){try{await api('/logout',{method:'POST'});}catch{}}
    return {init,openFolder,search,refresh,createFolder,rename,remove,download,uploadFiles,logout};
})();
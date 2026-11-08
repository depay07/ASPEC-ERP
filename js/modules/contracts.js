// 서면 계약서의 정보와 비공개 스캔본 관리
const ContractsModule = (() => {
    const API = 'https://api.aspec-tech.co.kr/cloud';
    const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    let page=0, query='', archived=false, rows=[], editing=null, pending=[], busy=false, requestVersion=0, newId=null;
    const maxSize=50*1024*1024;
    const uploadIds=new WeakMap();
    async function api(path, options={}) {
        const session=await supabaseClient.auth.getSession();
        const token=session.data?.session?.access_token;
        if(!token)throw new Error('ERP에 다시 로그인하세요.');
        const headers=new Headers(options.headers||{});headers.set('Authorization','Bearer '+token);
        if(options.json!==undefined){headers.set('Content-Type','application/json');options.body=JSON.stringify(options.json);}
        const response=await fetch(API+path,{...options,headers,credentials:'include'});
        const data=await response.json();
        if(!response.ok)throw new Error(data.error||'요청을 처리하지 못했습니다.');
        return data;
    }
    function notice(message,error=false){const box=document.getElementById('contractNotice');if(box){box.textContent=message;box.className='text-sm my-3 '+(error?'text-red-600':'text-slate-500');}}
    function fmtDate(value){return value||'미입력';}
    function size(bytes){return bytes<1024*1024?Math.ceil(bytes/1024)+' KB':(bytes/1024/1024).toFixed(1)+' MB';}
    async function init(container){
        page=0;query='';archived=false;
        container.innerHTML=`<div class="space-y-4"><div class="flex flex-wrap justify-between items-start gap-4"><div><h2 class="text-2xl font-bold text-slate-800">계약서 관리</h2><p class="text-sm text-slate-500 mt-1">서면으로 작성한 계약서의 스캔본과 계약 정보를 보관하세요.</p></div><button onclick="ContractsModule.openNew()" class="bg-slate-800 hover:bg-black text-white rounded px-5 py-3 font-bold"><i class="fa-solid fa-plus mr-2"></i>계약서 등록</button></div><form onsubmit="event.preventDefault();ContractsModule.search()" class="bg-white border rounded-lg p-4 flex flex-wrap gap-3"><input id="contractQuery" class="input-box flex-1 min-w-[180px]" aria-label="계약명, 거래처 또는 메모 검색" placeholder="계약명 · 거래처 · 메모 검색" maxlength="200"><select id="contractArchive" class="input-box w-auto" aria-label="보관 상태"><option value="0">등록된 계약서</option><option value="1">보관함</option></select><button class="bg-cyan-700 text-white rounded px-5 py-2 font-bold">조회</button></form><div id="contractNotice" role="status" aria-live="polite"></div><div class="bg-white border rounded-lg overflow-x-auto"><table class="w-full text-sm"><thead class="bg-slate-50 text-slate-500"><tr><th class="p-3 text-left">계약명</th><th class="p-3 text-left">거래처</th><th class="p-3 whitespace-nowrap">계약일</th><th class="p-3 whitespace-nowrap">스캔본</th><th class="p-3 whitespace-nowrap">관리</th></tr></thead><tbody id="contractRows"></tbody></table></div><div class="flex justify-between items-center gap-3"><span id="contractCount" class="text-sm text-slate-500"></span><div class="flex gap-2"><button id="contractPrev" onclick="ContractsModule.movePage(-1)" class="border rounded px-3 py-2 disabled:opacity-40">이전</button><button id="contractNext" onclick="ContractsModule.movePage(1)" class="border rounded px-3 py-2 disabled:opacity-40">다음</button></div></div></div>`;
        await load();
    }
    async function load(){
        const version=++requestVersion;notice('계약서를 불러오는 중입니다…');
        try {
            const result=await api('/contracts?'+new URLSearchParams({q:query,archived:archived?'1':'0',page:String(page)}));
            if(version!==requestVersion||AppState.currentTab!=='contracts')return;
            if(page>0&&!result.items.length&&result.total){page=Math.max(0,Math.ceil(result.total/result.pageSize)-1);return load();}
            rows=result.items;
            document.getElementById('contractRows').innerHTML=rows.length?rows.map(row=>`<tr class="border-t hover:bg-slate-50"><td class="p-3"><button onclick="ContractsModule.open('${row.id}')" class="text-left font-bold text-slate-800 hover:text-cyan-700">${esc(row.title)}</button><p class="text-xs text-slate-400 mt-1 whitespace-pre-wrap">${esc(row.memo.slice(0,100))}</p></td><td class="p-3">${esc(row.partner||'-')}</td><td class="p-3 text-center whitespace-nowrap">${esc(fmtDate(row.contract_date))}</td><td class="p-3 text-center">${row.file_count?row.file_count+'개':'<span class="text-amber-700">미등록</span>'}</td><td class="p-3 text-center whitespace-nowrap"><button onclick="ContractsModule.open('${row.id}')" class="text-cyan-700 p-2 font-bold">열기</button><button onclick="ContractsModule.archive('${row.id}')" class="text-slate-500 p-2">${row.archived?'복원':'보관'}</button></td></tr>`).join(''):'<tr><td colspan="5" class="p-12 text-center text-slate-400">'+(query?'검색 결과가 없습니다.':archived?'보관된 계약서가 없습니다.':'등록된 계약서가 없습니다. 계약서 등록을 눌러 스캔본을 올려주세요.')+'</td></tr>';
            document.getElementById('contractCount').textContent='총 '+result.total+'건 · '+(page+1)+' / '+Math.max(1,Math.ceil(result.total/result.pageSize))+'페이지';
            document.getElementById('contractPrev').disabled=page===0;
            document.getElementById('contractNext').disabled=(page+1)*result.pageSize>=result.total;
            notice('스캔본은 로그인한 본인 계정에서만 조회할 수 있습니다.');
        }catch(e){if(version===requestVersion)notice('조회 실패: '+e.message,true);}
    }
    async function search(){query=document.getElementById('contractQuery').value.trim();archived=document.getElementById('contractArchive').value==='1';page=0;await load();}
    async function movePage(delta){page=Math.max(0,page+delta);await load();}
    function openNew(){if(busy)return alert('현재 저장이 끝난 뒤 다시 시도하세요.');editing=null;newId=crypto.randomUUID();pending=[];form();}
    async function open(id){
        if(busy)return alert('현재 저장이 끝난 뒤 다시 시도하세요.');
        try{const row=await api('/contracts/'+id);if(busy)return;editing=row;pending=[];form();}catch(e){notice(e.message,true);}
    }
    function form(){
        const row=editing||{},locked=!!row.archived;
        openModal(locked?'보관된 계약서':editing?'계약서 상세 · 수정':'계약서 등록');
        document.getElementById('modalBody').innerHTML=`<form id="contractForm" onsubmit="event.preventDefault();ContractsModule.save()" class="space-y-4"><p class="text-sm text-slate-500">작성한 서면 계약서를 스캔하거나 촬영한 파일을 첨부하세요.</p>${locked?'<p class="p-3 rounded bg-amber-50 text-amber-800 text-sm">보관된 계약서입니다. 목록에서 복원하면 수정할 수 있습니다.</p>':''}<div><label for="contractTitle" class="text-xs font-bold text-slate-500">계약명 <span class="text-red-500">*</span></label><input id="contractTitle" class="input-box" maxlength="200" required ${locked?'disabled':''}></div><div class="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label for="contractPartner" class="text-xs font-bold text-slate-500">거래처</label><input id="contractPartner" class="input-box" maxlength="200" list="contractPartnerNames" ${locked?'disabled':''}><datalist id="contractPartnerNames">${(AppState.partnerList||[]).map(p=>`<option value="${esc(p.name)}"></option>`).join('')}</datalist></div><div><label for="contractDate" class="text-xs font-bold text-slate-500">계약일</label><input id="contractDate" type="date" class="input-box" ${locked?'disabled':''}></div></div><div><label for="contractMemo" class="text-xs font-bold text-slate-500">메모</label><textarea id="contractMemo" class="input-box" rows="3" maxlength="10000" ${locked?'disabled':''}></textarea></div><div><h3 class="font-bold text-sm text-slate-700 mb-2">스캔본</h3><div id="contractFiles" class="space-y-2"></div>${locked?'':`<label for="contractUpload" class="mt-3 block border-2 border-dashed border-slate-200 bg-slate-50 rounded-lg p-4 cursor-pointer"><span class="text-sm font-bold text-cyan-800">PDF · JPG · PNG 추가</span><span class="block text-xs text-slate-500 mt-1">여러 파일 선택 가능 · 파일당 최대 50 MB · 계약서당 30개</span><input id="contractUpload" type="file" accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png" multiple class="block text-sm mt-3 w-full" onchange="ContractsModule.choose(this)"></label><div id="contractPending" class="mt-3 space-y-2"></div>`}</div><p id="contractSaveStatus" role="status" aria-live="polite" class="text-sm text-slate-600"></p>${locked?'':'<button id="contractSave" type="submit" class="w-full bg-slate-800 text-white py-3 rounded font-bold disabled:opacity-50">계약서 저장</button>'}</form>`;
        document.getElementById('contractTitle').value=row.title||'';document.getElementById('contractPartner').value=row.partner||'';document.getElementById('contractDate').value=row.contract_date||'';document.getElementById('contractMemo').value=row.memo||'';
        renderFiles();renderPending();
    }
    function renderFiles(){
        const node=document.getElementById('contractFiles');if(!node)return;
        node.innerHTML=editing?.files?.length?editing.files.map(f=>`<div class="flex flex-wrap gap-2 items-center border rounded p-3"><div class="flex-1 min-w-0"><p class="text-sm font-medium break-all">${esc(f.name)}</p><p class="text-xs text-slate-400">${size(f.size)}</p></div><button type="button" onclick="ContractsModule.file('${f.id}',true)" class="text-cyan-700 text-sm p-2">미리보기</button><button type="button" onclick="ContractsModule.file('${f.id}',false)" class="text-slate-600 text-sm p-2">다운로드</button>${editing.archived?'':`<button type="button" onclick="ContractsModule.removeFile('${f.id}')" class="text-red-500 text-sm p-2">삭제</button>`}</div>`).join(''):'<p class="text-sm text-slate-400 p-3 border rounded">아직 등록된 스캔본이 없습니다.</p>';
    }
    function renderPending(){const node=document.getElementById('contractPending');if(node)node.innerHTML=pending.map((f,i)=>`<div class="flex gap-2 items-center bg-cyan-50 rounded px-3 py-2 text-sm"><span class="flex-1 break-all">${esc(f.name)} <span class="text-xs text-slate-500">${size(f.size)}</span></span><button type="button" onclick="ContractsModule.removePending(${i})" class="text-slate-500 p-2">취소</button></div>`).join('');}
    function choose(input){
        if(busy)return;
        const candidates=[...pending,...input.files];
        if(candidates.some(f=>f.size===0||f.size>maxSize||!/\.(pdf|jpe?g|png)$/i.test(f.name))){alert('0바이트보다 크고 50 MB 이하인 PDF, JPG, PNG 파일을 선택하세요.');input.value='';return;}
        if(candidates.length+(editing?.files?.length||0)>30){alert('계약서당 최대 30개 파일을 등록할 수 있습니다.');input.value='';return;}
        pending=candidates.filter((f,i,a)=>a.findIndex(o=>o.name===f.name&&o.size===f.size&&o.lastModified===f.lastModified)===i);input.value='';renderPending();
    }
    function removePending(index){if(busy)return;pending.splice(index,1);renderPending();}
    function status(message,error=false){const node=document.getElementById('contractSaveStatus');if(node){node.textContent=message;node.className='text-sm '+(error?'text-red-600':'text-slate-600');}}
    function lock(value){busy=value;document.querySelectorAll('#contractForm input,#contractForm textarea,#contractForm button').forEach(e=>{e.disabled=value;});}
    async function save(){
        if(busy||editing?.archived)return;
        const values={title:document.getElementById('contractTitle').value.trim(),partner:document.getElementById('contractPartner').value.trim(),contract_date:document.getElementById('contractDate').value,memo:document.getElementById('contractMemo').value.trim()};
        if(!values.title){status('계약명을 입력하세요.',true);return;}
        lock(true);status('계약 정보를 저장하는 중입니다…');
        let metadataSaved=false;
        try{
            editing=await api('/contracts'+(editing?'/'+editing.id:''),{method:editing?'PATCH':'POST',json:{...values,...(editing?{version:editing.version}:{id:newId})}});metadataSaved=true;
            const total=pending.length;let completed=0;
            while(pending.length){
                const f=pending[0];status('스캔본 업로드 중 ('+(completed+1)+'/'+total+'): '+f.name);
                if(!uploadIds.has(f))uploadIds.set(f,crypto.randomUUID());
                await api('/contracts/'+editing.id+'/files',{method:'POST',headers:{'X-File-Name':encodeURIComponent(f.name),'X-Upload-Id':uploadIds.get(f),'Content-Type':'application/octet-stream'},body:f});
                pending.shift();completed++;renderPending();
            }
            editing=await api('/contracts/'+editing.id);closeModal();notice('계약서를 저장했습니다.');
            if(AppState.currentTab==='contracts')await load();
        }catch(e){
            if(metadataSaved){try{editing=await api('/contracts/'+editing.id);renderFiles();}catch{}}
            status((metadataSaved?'계약 정보와 완료된 첨부는 저장됐습니다. 남은 파일을 확인해 다시 저장하세요. ':'저장 실패: ')+e.message,true);
            if(AppState.currentTab==='contracts')await load();
        }finally{lock(false);}
    }
    async function file(id,preview){
        const popup=preview?window.open('about:blank','_blank'):null;if(popup)popup.opener=null;
        try{const result=await api('/download-session',{method:'POST',json:{contractFileId:id,preview}});const url=new URL(result.url,API).href;if(preview){if(popup)popup.location.href=url;else throw new Error('팝업을 허용한 뒤 미리보기를 다시 눌러주세요.');}else window.location.href=url;}
        catch(e){if(popup)popup.close();status(e.message,true);}
    }
    async function removeFile(id){
        if(busy||!editing||!confirm('이 스캔본을 삭제할까요? 계약 정보는 유지됩니다.'))return;
        lock(true);
        try{await api('/contracts/'+editing.id+'/files/'+id,{method:'DELETE'});editing=await api('/contracts/'+editing.id);renderFiles();status('스캔본을 삭제했습니다.');if(AppState.currentTab==='contracts')await load();}catch(e){status(e.message,true);}finally{lock(false);}
    }
    async function archive(id){
        if(busy)return;const row=rows.find(r=>r.id===id);if(!row||!confirm(row.archived?'계약서를 목록으로 복원할까요?':'계약서를 보관함으로 옮길까요? 스캔본은 유지됩니다.'))return;
        busy=true;try{await api('/contracts/'+id,{method:'PATCH',json:{archived:!row.archived,version:row.version}});await load();}catch(e){notice(e.message,true);}finally{busy=false;}
    }
    return {init,search,movePage,openNew,open,choose,removePending,save,file,removeFile,archive};
})();

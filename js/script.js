window.onload = async () => { 
    try { 
        const { data: { user } } = await supabase.auth.getUser();
        if(user) currentUserEmail = user.email;
        setupAutoTimeSync();
        await fetchData(); 
        switchTab('dashboard'); 
        startSessionTimer();
    } catch (e) { console.error("초기화 오류: ", e); }
};

function setupAutoTimeSync() {
    const sDate = document.getElementById('eventStartDate');
    const eDate = document.getElementById('eventEndDate');
    const sTime = document.getElementById('eventStartTime');
    const eTime = document.getElementById('eventEndTime');

    if(sDate && eDate) sDate.addEventListener('change', function() { eDate.value = this.value; });
    if(sTime && eTime) sTime.addEventListener('change', function() {
        if (!this.value) return;
        const [hours, mins] = this.value.split(':').map(Number);
        const dateObj = new Date();
        dateObj.setHours(hours + 1);
        dateObj.setMinutes(mins);
        const newHour = String(dateObj.getHours()).padStart(2, '0');
        const newMin = String(dateObj.getMinutes()).padStart(2, '0');
        eTime.value = `${newHour}:${newMin}`;
    });
}

function startSessionTimer() {
    clearTimeout(sessionTimer);
    sessionTimer = setTimeout(() => {
        if(confirm("로그인 시간이 30분 지났습니다. 연장하시겠습니까?")) startSessionTimer(); else logout();
    }, 30 * 60 * 1000);
}

async function fetchData() {
    const pRes = await supabase.from('partners').select('*');
    const prodRes = await supabase.from('products').select('*').order('name');
    if(!pRes.error) partnerList = pRes.data || [];
    if(!prodRes.error) productList = prodRes.data || [];
}

function storeRowData(row) { const id = 'row_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9); globalDataStore[id] = row; return id; }
function getRowData(id) { return globalDataStore[id]; }

function renderSearchPanel(tab) {
    const panel = document.getElementById('searchContainer');
    if (tab === 'dashboard' || tab === 'calendar') { panel.innerHTML = ''; return; }
    
    const today = new Date(); 
    const currentDay = today.toISOString().split('T')[0];
    let startObj = new Date(); 
    startObj.setFullYear(today.getFullYear() - 1); 
    
    if (tab === 'collections') {
        startObj = new Date(); 
        startObj.setFullYear(today.getFullYear() - 5); 
    }
    else if (tab === 'bookkeeping'|| tab === 'cost_management') {
        startObj = new Date();
        startObj.setFullYear(today.getFullYear() - 1);
    }
    
    const firstDay = startObj.toISOString().split('T')[0];
    
    let html = `<div class="search-panel no-print"><div class="flex flex-wrap gap-6 items-end">`;
    
    if (!['partners', 'products', 'inventory'].includes(tab)) {
        html += `<div><span class="search-label">기간 조회</span><div class="flex items-center gap-2"><input type="date" id="searchStartDate" class="input-box" value="${firstDay}"><span class="text-slate-400">~</span><input type="date" id="searchEndDate" class="input-box" value="${currentDay}"></div></div>`;
    }
    
    if (tab === 'purchase_orders') html += `<div><span class="search-label">납품업체</span><input type="text" id="search_sPartner" class="input-box" placeholder="업체명" onkeypress="handleSearchKeyPress(event, '${tab}')"></div><div><span class="search-label">EndUser</span><input type="text" id="search_sEndUser" class="input-box" placeholder="EndUser" onkeypress="handleSearchKeyPress(event, '${tab}')"></div><div><span class="search-label">품목명</span><input type="text" id="search_sItem" class="input-box" placeholder="품목명" onkeypress="handleSearchKeyPress(event, '${tab}')"></div>`;
    else if (tab === 'purchases') html += `<div><span class="search-label">매입처</span><input type="text" id="search_sPartner" class="input-box" placeholder="매입처" onkeypress="handleSearchKeyPress(event, '${tab}')"></div><div><span class="search-label">품목명</span><input type="text" id="search_sItem" class="input-box" placeholder="품목명" onkeypress="handleSearchKeyPress(event, '${tab}')"></div>`;
    else if (tab === 'partners') html += `<div><span class="search-label">상호명</span><input type="text" id="search_sName" class="input-box" onkeypress="handleSearchKeyPress(event, '${tab}')"></div><div><span class="search-label">담당자</span><input type="text" id="search_sManager" class="input-box" onkeypress="handleSearchKeyPress(event, '${tab}')"></div>`;
    else if (tab === 'products' || tab === 'inventory') {
        html += `<div><span class="search-label">품목명</span><input type="text" id="search_sName" class="input-box" onkeypress="handleSearchKeyPress(event, '${tab}')"></div><div><span class="search-label">코드</span><input type="text" id="search_sCode" class="input-box" onkeypress="handleSearchKeyPress(event, '${tab}')"></div>`;
    }
    else if (tab === 'collections') {
        html += `<div><span class="search-label">거래처</span><input type="text" id="search_sPartner" class="input-box" onkeypress="handleSearchKeyPress(event, '${tab}')"></div>`;
    }
    else if (tab === 'meeting_logs') {
        html += `
            <div><span class="search-label">업체명</span><input type="text" id="search_mlPartner" class="input-box" placeholder="업체명 검색" onkeypress="handleSearchKeyPress(event, '${tab}')"></div>
            <div><span class="search-label">내용 키워드</span><input type="text" id="search_mlContent" class="input-box" placeholder="내용 검색" onkeypress="handleSearchKeyPress(event, '${tab}')"></div>
        `;
    }
    else if (tab === 'bookkeeping') {
        html += `<div><span class="search-label">계정과목</span><select id="search_sCategory" class="input-box h-[38px]" onchange="runSearch('${tab}')"><option value="">전체</option><option>식대</option><option>여비교통비</option><option>소모품비</option><option>도서인쇄비</option><option>접대비</option><option>통신비</option><option>임차료</option><option>기타</option></select></div>
                 <div><span class="search-label">사용처/적요</span><input type="text" id="search_sUsage" class="input-box" onkeypress="handleSearchKeyPress(event, '${tab}')"></div>`;
    }
    else html += `<div><span class="search-label">거래처</span><input type="text" id="search_sPartner" class="input-box" onkeypress="handleSearchKeyPress(event, '${tab}')"></div><div><span class="search-label">담당자</span><input type="text" id="search_sManager" class="input-box" onkeypress="handleSearchKeyPress(event, '${tab}')"></div><div><span class="search-label">비고</span><input type="text" id="search_sNote" class="input-box" onkeypress="handleSearchKeyPress(event, '${tab}')"></div>`;

    let extraControls = '';
    if (tab === 'inventory') {
        extraControls = `<label class="flex items-center gap-2 cursor-pointer mr-4"><input type="checkbox" id="hideZeroStock" class="w-4 h-4" checked><span class="text-sm font-semibold text-slate-700">재고0개품목제외</span></label>`;
    } 
    else if (tab === 'collections') {
        extraControls = `<label class="flex items-center gap-2 cursor-pointer mr-4"><input type="checkbox" id="hideZeroReceivable" class="w-4 h-4" checked><span class="text-sm font-semibold text-slate-700">채권금액 0원은 제외</span></label>`;
    }

    html += `<div class="ml-auto flex items-center">${extraControls}<button onclick="runSearch('${tab}')" class="bg-blue-600 hover:bg-blue-700 text-white px-8 py-2.5 rounded font-bold shadow transition flex items-center gap-2 text-sm"><i class="fa-solid fa-magnifying-glass"></i> 조회</button></div></div></div>`;
    
    panel.innerHTML = html;
}

function handleSearchKeyPress(event, tab) { if (event.key === 'Enter') runSearch(tab); }

async function runSearch(tab) {
    const tbody = document.getElementById('listBody'); tbody.innerHTML = '<tr><td colspan="10" class="text-center p-8">데이터를 불러오는 중입니다...</td></tr>';
    
    if(tab === 'inventory') { await loadInventoryData(true); return; }

    // [신규] 미팅 일지 검색 로직
    if(tab === 'meeting_logs') {
        let query = supabase.from('meeting_logs').select('*').order('date', { ascending: false });
        
        const sDate = document.getElementById('searchStartDate')?.value;
        const eDate = document.getElementById('searchEndDate')?.value;
        if(sDate && eDate) query = query.gte('date', sDate).lte('date', eDate);
    
        const pName = document.getElementById('search_mlPartner')?.value;
        const pContent = document.getElementById('search_mlContent')?.value;
        if(pName) query = query.ilike('partner_name', `%${pName}%`);
        if(pContent) query = query.ilike('content', `%${pContent}%`);
    
        const { data, error } = await query;
        if(error) { alert("검색실패: "+error.message); return; }
        renderTable(tab, data);
        return; 
    } 

    // 수금 관리 등 기존 로직
    let targetTable = tab;
    if (tab === 'collections') targetTable = 'sales';
    if (tab === 'cost_management') targetTable = 'orders';
    
    let query = supabase.from(targetTable).select('*');
    if (tab === 'bookkeeping') {
        query = query.order('date', { ascending: false }); 
    } else {
        query = query.order('created_at', { ascending: false });
    }

    const sDate = document.getElementById('searchStartDate')?.value;
    const eDate = document.getElementById('searchEndDate')?.value;
    if(sDate && eDate && !['partners','products'].includes(tab)) query = query.gte('date', sDate).lte('date', eDate);

    if(tab === 'purchase_orders') { const p = document.getElementById('search_sPartner').value; const e = document.getElementById('search_sEndUser').value; if(p) query = query.ilike('partner_name', `%${p}%`); if(e) query = query.ilike('end_user', `%${e}%`); }
    else if (tab === 'purchases') { const p = document.getElementById('search_sPartner').value; const i = document.getElementById('search_sItem').value; if(p) query = query.ilike('partner_name', `%${p}%`); if(i) query = query.ilike('item_name', `%${i}%`); }
    else if (tab === 'partners') { const n = document.getElementById('search_sName').value; const m = document.getElementById('search_sManager').value; if(n) query = query.ilike('name', `%${n}%`); if(m) query = query.ilike('manager_name', `%${m}%`); }
    else if (tab === 'products') { const n = document.getElementById('search_sName').value; const c = document.getElementById('search_sCode').value; if(n) query = query.ilike('name', `%${n}%`); if(c) query = query.ilike('code', `%${c}%`); }
    else { 
        const p = document.getElementById('search_sPartner')?.value; 
        const m = document.getElementById('search_sManager')?.value; 
        const n = document.getElementById('search_sNote')?.value; 
        if(p) query = query.ilike('partner_name', `%${p}%`); 
        if(m && tab !== 'collections') query = query.ilike('manager', `%${m}%`); 
        if(n && tab !== 'collections') query = query.ilike('note', `%${n}%`); 
    }

    const { data, error } = await query;
    if(error) { alert("검색실패: "+error.message); return; }
    
    let resultData = data;
    if (tab === 'collections') {
        const hideZero = document.getElementById('hideZeroReceivable')?.checked;
        if (hideZero) {
            resultData = data.filter(row => {
                const total = row.total_amount || 0;
                const collected = row.collected_amount || 0;
                const balance = total - collected;
                return balance !== 0; 
            });
        }
    }
    else if(tab === 'purchase_orders' || tab === 'purchases') { const sItem = document.getElementById('search_sItem') ? document.getElementById('search_sItem').value.toLowerCase() : ''; if(sItem) { if(tab === 'purchases') resultData = data.filter(r => r.item_name && r.item_name.toLowerCase().includes(sItem)); else resultData = data.filter(r => r.items && r.items.some(i => i.name.toLowerCase().includes(sItem))); } }     
    else if (tab === 'bookkeeping') {
        const cat = document.getElementById('search_sCategory').value;
        const usage = document.getElementById('search_sUsage').value;
        if(cat) query = query.eq('category', cat);
        if(usage) query = query.ilike('usage_desc', `%${usage}%`);
        query = query.order('created_at', { ascending: false });
    }
    renderTable(tab, resultData);
}

async function switchTab(tab) {
    currentTab = tab; 
    
    const navBtns = document.querySelectorAll('.nav-btn');
    navBtns.forEach(btn => {
        btn.classList.remove('bg-slate-800', 'text-white', 'font-bold');
        if (btn.getAttribute('onclick').includes(`'${tab}'`)) {
            btn.classList.add('bg-slate-800', 'text-white', 'font-bold');
        }
    });

    const container = document.getElementById('contentArea');
    
    if (tab === 'dashboard') {
        renderSearchPanel(tab);
        const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
        container.innerHTML = `<div class="flex flex-col items-center justify-center h-[80vh] animate-fade-in"><div class="bg-white p-10 rounded-2xl shadow-xl text-center border-l-8 border-blue-500 max-w-2xl"><h1 class="text-4xl font-extrabold text-slate-800 mb-6">ASPEC ERP System</h1><p class="text-2xl font-medium text-slate-600 italic leading-relaxed">"${randomQuote}"</p></div><p class="mt-8 text-slate-400 text-sm">오늘도 좋은 하루 되세요!</p></div>`;
        return;
    }
    
    if (tab === 'calendar') {
        renderSearchPanel(tab);
        await renderCalendar();
        return;
    }

    await fetchData(); 
    renderSearchPanel(tab);

    const titles = {'partners':'거래처 관리','products':'품목 관리','purchase_orders':'발주 관리 (PO)','purchases':'구매 관리 (입고)','inventory':'재고 관리 현황','quotes':'견적 관리','orders':'주문 관리 (수주)','sales':'판매 관리 (출고)','collections':'수금 관리', 'bookkeeping':'기장 관리 (지출/비용)', 'cost_management':'원가 관리 (마진 분석)', 'meeting_logs': '미팅 일지 (영업 활동)'};
    
    let buttonsHtml = '';
    const commonBtnClass = "bg-cyan-600 hover:bg-cyan-700 text-white px-6 py-2.5 rounded font-bold shadow-md text-sm flex items-center gap-2";
    
    if (tab === 'products') {
        buttonsHtml = `<div class="flex gap-2"><button onclick="openBOMModal()" class="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2.5 rounded font-bold shadow-md text-sm flex items-center gap-2"><i class="fa-solid fa-layer-group"></i> 세트(BOM) 관리</button><button onclick="openNewModal('${tab}')" class="${commonBtnClass}"><i class="fa-solid fa-plus"></i> 신규 등록</button></div>`;
    } else if (tab === 'inventory') {
        buttonsHtml = `<button onclick="openNewModal('purchases')" class="bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded font-bold shadow-md text-sm flex items-center gap-2"><i class="fa-solid fa-plus"></i> 제품 입고</button>`;
    } else if (tab !== 'collections') {
        buttonsHtml = `<button onclick="openNewModal('${tab}')" class="${commonBtnClass}"><i class="fa-solid fa-plus"></i> 신규 등록</button>`;
    }
    
    let html = `
        <div class="flex justify-between items-center mb-6">
            <h2 class="text-3xl font-bold text-slate-800 border-l-8 border-cyan-500 pl-4">${titles[tab]}</h2>
            ${buttonsHtml}
        </div>
        <div class="bg-white rounded-lg shadow border border-slate-200 overflow-hidden">
            <table class="data-table">`;

    if (tab === 'partners') html += `<thead><tr><th style="width:20%">상호</th><th style="width:15%">담당자</th><th style="width:20%">전화번호</th><th>비고</th><th style="width:15%">관리</th></tr></thead><tbody id="listBody"></tbody>`;
    else if (tab === 'products') html += `<thead><tr><th style="width:15%">품목코드</th><th style="width:25%">품목명</th><th>규격</th><th style="width:8%">단위</th><th style="width:15%">관리</th></tr></thead><tbody id="listBody"></tbody>`;
    else if (tab === 'purchase_orders') html += `<thead><tr><th style="width:12%">PO#</th><th style="width:15%">납품업체</th><th style="width:15%">EndUser</th><th>품목요약</th><th style="width:12%">총액</th><th style="width:10%">일자</th><th style="width:15%">관리</th></tr></thead><tbody id="listBody"></tbody>`;
    else if (tab === 'purchases') html += `<thead><tr><th style="width:10%">일자</th><th style="width:10%">제조사</th><th style="width:15%">매입처</th><th>품목명</th><th style="width:6%">수량</th><th style="width:10%">단가</th><th style="width:10%">합계</th><th style="width:10%">시리얼</th><th style="width:10%">관리</th></tr></thead><tbody id="listBody"></tbody>`;
    else if (tab === 'inventory') html += `<thead><tr><th>품목명</th><th style="width:10%">제조사</th><th style="width:12%">입고처</th><th style="width:10%">입고단가</th><th style="width:8%">총재고</th><th style="width:8%">가용재고</th><th>비고</th><th style="width:10%">예약</th><th style="width:10%">관리</th></tr></thead><tbody id="listBody"></tbody>`;
    else if (tab === 'collections') html += `<thead><tr><th style="width:10%">판매일자</th><th style="width:15%">거래처</th><th style="width:15%">매출총액(VAT포함)</th><th style="width:15%">기수금액</th><th style="width:15%">미수금(잔액)</th><th>비고</th><th style="width:10%">관리</th></tr></thead><tbody id="listBody"></tbody>`;
    else if (tab === 'bookkeeping') html += `<thead><tr><th style="width:10%">일자</th><th style="width:12%">계정과목</th><th style="width:20%">사용처(적요)</th><th style="width:10%">결제수단</th><th style="width:12%">금액</th><th>비고</th><th style="width:15%">관리</th></tr></thead><tbody id="listBody"></tbody>`;
    else if (tab === 'meeting_logs') {
        html += `<thead><tr><th style="width:12%">미팅날짜</th><th style="width:15%">업체명</th><th style="width:15%">참석자</th><th>미팅 내용 (요약)</th><th style="width:20%">향후 계획</th><th style="width:10%">관리</th></tr></thead><tbody id="listBody"></tbody>`;
    }
    else if (tab === 'cost_management') {
        html += `<thead><tr><th style="width:10%">주문일자</th><th style="width:15%">거래처</th><th style="width:20%">주문명(대표품목)</th><th style="width:12%">총 매출액</th><th style="width:12%">총 원가(입력)</th><th style="width:12%">마진금액</th><th style="width:8%">마진율</th><th style="width:10%">관리</th></tr></thead><tbody id="listBody"></tbody>`;
    }
    else html += `<thead><tr><th style="width:10%">일자</th><th style="width:18%">거래처</th><th style="width:12%">담당자</th><th style="width:12%">공급가액</th><th style="width:10%">부가세</th><th style="width:12%">합계</th><th>비고</th><th style="width:15%">관리</th></tr></thead><tbody id="listBody"></tbody>`;
    
    html += `</table></div>`;
    container.innerHTML = html;
    runSearch(tab);
}

function duplicateItem(tab, dataId) {
    const row = getRowData(dataId);
    if (!row) return alert('데이터 오류');
    openNewModal(tab);
    currentEditId = null;
    document.getElementById('modalTitle').innerText = getTitle(tab) + ' 복사 등록';

    setTimeout(() => {
        const today = new Date().toISOString().split('T')[0];

        if(tab === 'purchase_orders') { 
            document.getElementById('poDate').value = today; 
            document.getElementById('poNum').value = 'AUTO (저장시 생성)'; 
            document.getElementById('poPartner').value = row.partner_name; 
            document.getElementById('poEndUser').value = row.end_user||''; 
            document.getElementById('poManager').value = row.manager||''; 
            document.getElementById('poPreOrder').value = row.is_pre_order||''; 
            document.getElementById('poNote').value = row.note||'';
            document.getElementById('poPManager').value = row.partner_manager || ''; 
            document.getElementById('poPhone').value = row.phone || ''; 
            document.getElementById('poEmail').value = row.email || ''; 
            document.getElementById('poAddr').value = row.partner_address || '';
        } 
        else {
            document.getElementById('sDate').value = today;
            document.getElementById('sPartner').value = row.partner_name;
            document.getElementById('sManager').value = row.manager || '';
            if(document.getElementById('sPManager')) document.getElementById('sPManager').value = row.partner_manager || '';
            if(document.getElementById('sContact')) document.getElementById('sContact').value = row.phone || '';
            if(document.getElementById('sAddr')) document.getElementById('sAddr').value = row.partner_address || '';
            if(document.getElementById('sEmail')) document.getElementById('sEmail').value = row.email || '';
            if(document.getElementById('sNote')) document.getElementById('sNote').value = row.note || '';
        }
        tempItems = JSON.parse(JSON.stringify(row.items || []));
        tempItems = tempItems.map(item => {
            if (!item.spec) {
                const prod = productList.find(p => p.name === item.name);
                if (prod) item.spec = prod.spec;
            }
            return item;
        });
        renderGrid();
    }, 50);
}

function renderTable(tab, data) {
    const tbody = document.getElementById('listBody'); tbody.innerHTML = '';
    if(!data || data.length === 0) { tbody.innerHTML = '<tr><td colspan="10" class="text-center p-8 text-slate-500">데이터가 없습니다.</td></tr>'; return; }

    data.forEach(row => {
        let tr = `<tr class="hover:bg-slate-50 border-b transition">`;
        const dataId = storeRowData(row);
        let actions = '<div class="flex justify-center items-center gap-3">';
        
        if (tab !== 'collections') {
            if(['quotes', 'orders', 'sales', 'purchase_orders'].includes(tab)) {
                actions += `<button onclick="printDocument('${tab}', '${dataId}')" class="text-slate-600 hover:text-black p-2 rounded hover:bg-slate-200 transition" title="인쇄"><i class="fa-solid fa-print fa-lg"></i></button>`;
                actions += `<button onclick="duplicateItem('${tab}', '${dataId}')" class="text-green-600 hover:text-green-800 p-2 rounded hover:bg-green-50 transition" title="복사(새 문서로 작성)"><i class="fa-regular fa-copy fa-lg"></i></button>`;
            }
            if(tab !== 'inventory') actions += `<button onclick="openEditModal('${tab}', '${dataId}')" class="text-blue-500 hover:text-blue-700 p-2 rounded hover:bg-blue-50 transition" title="수정"><i class="fa-solid fa-pen-to-square fa-lg"></i></button>`;
            actions += `<button onclick="deleteItem('${tab}', ${row.id})" class="text-red-400 hover:text-red-600 p-2 rounded hover:bg-red-50 transition" title="삭제"><i class="fa-solid fa-trash-can fa-lg"></i></button></div>`;
        }

        if (tab === 'partners') {
            const fileIcon = row.biz_file_url ? `<a href="${row.biz_file_url}" target="_blank" class="text-green-600 hover:text-green-800 ml-2"><i class="fa-solid fa-file-pdf"></i></a>` : '';
            tr += `<td>${row.name} ${fileIcon}</td><td class="text-center">${row.manager_name||'-'}</td><td class="text-center">${row.phone||'-'}</td><td>${row.note||''}</td><td>${actions}</td>`;
        }
        else if (tab === 'products') tr += `<td class="font-mono text-center text-cyan-600">${row.code}</td><td>${row.name}</td><td>${row.spec||'-'}</td><td class="text-center font-bold text-slate-600">${row.unit||'EA'}</td><td>${actions}</td>`;
        else if (tab === 'purchase_orders') {
            const itemsSummary = row.items && row.items.length > 0 ? `${row.items[0].name} 외 ${row.items.length-1}건` : '-';
            tr += `<td class="font-bold text-blue-600 text-center">${row.po_number}</td><td>${row.partner_name}</td><td class="text-center">${row.end_user||'-'}</td><td>${itemsSummary}</td><td class="font-bold text-right">${(row.total_amount||0).toLocaleString()}</td><td class="text-center">${row.date}</td><td>${actions}</td>`;
        } 
        else if (tab === 'purchases') {
            tr += `<td class="text-center">${row.date}</td><td class="text-center">${row.manufacturer||'-'}</td><td>${row.partner_name}</td><td>${row.item_name}</td><td class="text-center font-bold">${row.qty}</td><td class="text-right">${(row.unit_price||0).toLocaleString()}</td><td class="text-right font-bold">${(row.total_amount||0).toLocaleString()}</td><td class="text-center">${row.serial_no||'-'}</td><td>${actions}</td>`;
        } 
        else if (tab === 'meeting_logs') {
            const summary = row.content && row.content.length > 30 ? row.content.substring(0, 30) + '...' : row.content || '';
            tr += `
                <td class="text-center font-bold text-slate-700">${row.date}</td>
                <td class="text-center font-bold text-blue-600">${row.partner_name}</td>
                <td class="text-center text-xs">${row.attendees || '-'}</td>
                <td class="text-xs text-slate-600 cursor-pointer hover:text-blue-500" onclick="openEditModal('${tab}', '${dataId}')">${summary}</td>
                <td class="text-xs text-red-500">${row.next_step || ''}</td>
                <td>${actions}</td>
            `;
        }
        else if (tab === 'collections') {
            const total = row.total_amount || 0;
            const collected = row.collected_amount || 0;
            const balance = total - collected;
            const balanceClass = balance > 0 ? 'text-red-600 font-bold' : 'text-slate-400';
            tr += `
                <td class="text-center">${row.date}</td><td class="font-bold text-slate-700">${row.partner_name}</td>
                <td class="text-right font-bold">${total.toLocaleString()}</td>
                <td class="text-center"><input type="number" id="col_${row.id}" value="${collected}" class="border rounded px-2 py-1 w-24 text-right font-bold text-blue-600 bg-blue-50 focus:bg-white transition" placeholder="0"></td>
                <td class="text-right ${balanceClass}">${balance.toLocaleString()}</td>
                <td><input type="text" id="cnote_${row.id}" value="${row.collection_note || ''}" class="border rounded px-2 py-1 w-full text-xs" placeholder="메모"></td>
                <td class="text-center"><button onclick="updateCollection(${row.id})" class="bg-slate-700 hover:bg-slate-900 text-white px-3 py-1 rounded text-xs font-bold transition">저장</button></td>
            `;
        }
        else if (tab === 'bookkeeping') {
            tr += `<td class="text-center">${row.date}</td><td class="text-center font-bold text-slate-600">${row.category}</td><td>${row.usage_desc}</td>
                   <td class="text-center"><span class="px-2 py-1 rounded text-xs ${row.payment_method==='사업자카드'?'bg-blue-100 text-blue-700':'bg-slate-100'}">${row.payment_method||'-'}</span></td>
                   <td class="text-right font-bold">${(row.amount||0).toLocaleString()}원</td><td>${row.note||''}</td><td>${actions}</td>`;
        }
        else if (tab === 'cost_management') {
            const totalSales = row.total_amount || 0;
            const totalCost = row.total_cost || 0;
            const margin = totalSales - totalCost;
            const marginRate = totalSales > 0 ? ((margin / totalSales) * 100).toFixed(1) : 0;
            const marginClass = margin < 0 ? 'text-red-600' : 'text-blue-600';
            let title = '-';
            if(row.items && row.items.length > 0) { title = row.items[0].name; if(row.items.length > 1) title += ` 외 ${row.items.length-1}건`; }
            tr += `
                <td class="text-center">${row.date}</td><td class="font-bold text-slate-700">${row.partner_name}</td><td>${title}</td>
                <td class="text-right font-bold">${totalSales.toLocaleString()}</td><td class="text-right text-slate-600">${totalCost.toLocaleString()}</td>
                <td class="text-right font-bold ${marginClass}">${margin.toLocaleString()}</td><td class="text-center text-xs ${marginClass}">${marginRate}%</td>
                <td class="text-center"><button onclick="openCostModal(${row.id})" class="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-xs font-bold transition">원가입력</button></td>
            `;
        }
        else if (tab === 'inventory') { } 
        else {
            tr += `<td class="text-center">${row.date}</td><td class="font-bold">${row.partner_name||'-'}</td><td class="text-center">${row.manager||'-'}</td><td class="text-right text-slate-600">${(row.total_supply||0).toLocaleString()}</td><td class="text-right text-slate-400 text-xs">${(row.total_vat||0).toLocaleString()}</td><td class="text-right font-bold text-cyan-700">${(row.total_amount||0).toLocaleString()}</td><td>${row.note||''}</td><td>${actions}</td>`;
        }
        
        if(tab !== 'inventory') tbody.innerHTML += tr;
    });
}

async function updateCollection(id) {
    const collectedAmount = parseInt(document.getElementById(`col_${id}`).value) || 0;
    const note = document.getElementById(`cnote_${id}`).value;
    if (!confirm('수금 정보를 저장하시겠습니까?')) return;
    const { error } = await supabase.from('sales').update({ collected_amount: collectedAmount, collection_note: note }).eq('id', id);
    if (error) { alert("저장 중 오류가 발생했습니다: " + error.message); } else { alert("저장되었습니다."); runSearch('collections'); }
}

function openEditModal(tab, dataId) {
    const row = getRowData(dataId);
    if (!row) return alert('데이터 오류');
    currentEditId = row.id;
    openNewModal(tab, true);
    setTimeout(() => {
        if(tab === 'partners') { 
            document.getElementById('pName').value = row.name; 
            document.getElementById('pBiz').value = row.biz_num||''; 
            document.getElementById('pOwner').value = row.owner_name||''; 
            document.getElementById('pManager').value = row.manager_name||''; 
            document.getElementById('pPhone').value = row.phone||''; 
            document.getElementById('pEmail').value = row.email||''; 
            document.getElementById('pAddr').value = row.address||'';
            document.getElementById('pNote').value = row.note||''; 
            const linkDiv = document.getElementById('pCurrentFileLink');
            if(row.biz_file_url) linkDiv.innerHTML = `<a href="${row.biz_file_url}" target="_blank" class="text-blue-600 hover:underline font-bold ml-2">[기존 파일 보기]</a>`;
            else linkDiv.innerHTML = `<span class="text-slate-400 ml-2">(파일 없음)</span>`;
        }
        else if(tab === 'products') { 
            document.getElementById('prodName').value = row.name; document.getElementById('prodCode').value = row.code; 
            document.getElementById('prodUnit').value = row.unit||''; document.getElementById('prodSpec').value = row.spec||''; 
            document.getElementById('prodMaker').value = row.manufacturer||''; 
        }
        else if(tab === 'meeting_logs') {
            document.getElementById('mlDate').value = row.date;
            document.getElementById('mlPartner').value = row.partner_name;
            document.getElementById('mlAttendees').value = row.attendees || '';
            document.getElementById('mlContent').value = row.content || '';
            document.getElementById('mlNextStep').value = row.next_step || '';
        }
        else if(tab === 'bookkeeping') {
            document.getElementById('bkDate').value = row.date; document.getElementById('bkCategory').value = row.category;
            document.getElementById('bkUsage').value = row.usage_desc; document.getElementById('bkMethod').value = row.payment_method;
            document.getElementById('bkAmount').value = row.amount; document.getElementById('bkNote').value = row.note || '';
        }
        else if(tab === 'purchases') { 
            document.getElementById('purDate').value = row.date; document.getElementById('purPartner').value = row.partner_name; 
            document.getElementById('purItem').value = row.item_name; document.getElementById('purQty').value = row.qty; 
            document.getElementById('purPrice').value = row.unit_price; document.getElementById('purSerial').value = row.serial_no||''; 
            document.getElementById('purNote').value = row.note||''; 
        }
        else if(tab === 'purchase_orders') { 
            document.getElementById('poNum').value = row.po_number; document.getElementById('poDate').value = row.date; 
            document.getElementById('poPartner').value = row.partner_name; document.getElementById('poEndUser').value = row.end_user||''; 
            document.getElementById('poManager').value = row.manager||''; document.getElementById('poPreOrder').value = row.is_pre_order||''; 
            document.getElementById('poNote').value = row.note||''; document.getElementById('poPManager').value = row.partner_manager || ''; 
            document.getElementById('poPhone').value = row.phone || ''; document.getElementById('poEmail').value = row.email || ''; 
            document.getElementById('poAddr').value = row.partner_address || '';
            tempItems = (row.items || []).map(item => { if (!item.spec) { const prod = productList.find(p => p.name === item.name); if (prod) item.spec = prod.spec; } return item; });
            renderGrid(); 
        }
        else {
            document.getElementById('sDate').value = row.date; document.getElementById('sPartner').value = row.partner_name;
            document.getElementById('sManager').value = row.manager || '';
            if(document.getElementById('sPManager')) document.getElementById('sPManager').value = row.partner_manager || '';
            if(document.getElementById('sContact')) document.getElementById('sContact').value = row.phone || '';
            if(document.getElementById('sAddr')) document.getElementById('sAddr').value = row.partner_address || '';
            if(document.getElementById('sEmail')) document.getElementById('sEmail').value = row.email || '';
            if(document.getElementById('sNote')) document.getElementById('sNote').value = row.note || '';
            tempItems = (row.items || []).map(item => { if (!item.spec) { const prod = productList.find(p => p.name === item.name); if (prod) item.spec = prod.spec; } return item; });
            renderGrid();
        }
    }, 50);
}

async function openNewModal(tab, isEdit = false) {
    if(!isEdit) { currentEditId = null; tempItems = []; }
    const modal = document.getElementById('genericModal');
    document.getElementById('modalTitle').innerText = getTitle(tab) + (isEdit ? ' 수정' : ' 등록');
    const body = document.getElementById('modalBody');
    modal.classList.add('active');
    let html = ''; const today = new Date().toISOString().split('T')[0];
    
    if (tab === 'purchase_orders') {
        let autoPO = '';
        if (!isEdit) {
            const { count } = await supabase.from('purchase_orders').select('*', { count: 'exact', head: true }).eq('date', today);
            const nextSeq = (count || 0) + 1;
            const seqStr = String(nextSeq).padStart(2, '0');
            const yymmdd = today.slice(2).replace(/-/g,'');
            autoPO = `ASPEC-${yymmdd}-P${seqStr}`;
        }
        html = `<div class="bg-slate-50 p-4 rounded mb-4 border"><div class="grid grid-cols-3 gap-3 mb-2"><div><label class="text-xs text-slate-500">PO# (자동생성)</label><input id="poNum" class="input-box bg-gray-100" value="${autoPO}"></div><div><label class="text-xs text-slate-500">수주일자</label><input type="date" id="poDate" class="input-box" value="${today}"></div><div><label class="text-xs text-slate-500">발주업체 </label><input id="poPartner" class="input-box" list="dl_part" onchange="fillPOPart(this.value)"></div></div><div class="grid grid-cols-3 gap-3 mb-2"><div><label class="text-xs text-slate-500">거래처 담당자</label><input id="poPManager" class="input-box"></div><div><label class="text-xs text-slate-500">연락처</label><input id="poPhone" class="input-box"></div><div><label class="text-xs text-slate-500">선발주여부</label><select id="poPreOrder" class="input-box"><option>N</option><option>Y</option></select></div></div><div class="mb-2"><label class="text-xs text-slate-500">주소</label><input id="poAddr" class="input-box"></div><div class="grid grid-cols-2 gap-3 mb-2"><div><label class="text-xs text-slate-500">이메일</label><input id="poEmail" class="input-box"></div><div><label class="text-xs text-slate-500">비고</label><input id="poNote" class="input-box"></div></div><div class="grid grid-cols-2 gap-3 mb-2"><div><label class="text-xs text-slate-500">EndUser</label><input id="poEndUser" class="input-box"></div><div><label class="text-xs text-slate-500">담당자(우리측)</label><input id="poManager" class="input-box"></div></div></div>${renderItemInputArea(tab)}`;
    }
    else if (tab === 'partners') html = `<div class="grid grid-cols-2 gap-3"><div><label class="text-xs">상호 (필수)</label><input id="pName" class="input-box"></div><div><label class="text-xs">사업자번호</label><input id="pBiz" class="input-box"></div><div><label class="text-xs">대표자</label><input id="pOwner" class="input-box"></div><div><label class="text-xs">담당자</label><input id="pManager" class="input-box"></div><div><label class="text-xs">전화번호</label><input id="pPhone" class="input-box"></div><div><label class="text-xs">이메일</label><input id="pEmail" class="input-box"></div><div class="col-span-2"><label class="text-xs">주소</label><input id="pAddr" class="input-box" placeholder="주소를 입력하세요"></div><div class="col-span-2 border p-2 rounded bg-slate-50"><label class="text-xs font-bold">사업자등록증 (PDF/이미지)</label><div class="flex gap-2 mt-1"><input type="file" id="pFile" class="text-xs w-full" accept=".pdf,.jpg,.png,.jpeg"><div id="pCurrentFileLink" class="text-xs flex items-center"></div></div></div><div class="col-span-2"><label class="text-xs">비고</label><input id="pNote" class="input-box"></div></div><button onclick="saveSimpleData('partners')" class="w-full mt-4 bg-cyan-600 text-white py-3 rounded font-bold">저장</button>`;
    else if (tab === 'products') html = `<div class="grid grid-cols-2 gap-3"><div class="col-span-2"><label class="text-xs">품목명 (필수)</label><input id="prodName" class="input-box" oninput="autoGenCode(this.value)"></div><div><label class="text-xs">품목코드 (자동)</label><input id="prodCode" class="input-box bg-slate-100" readonly></div><div><label class="text-xs">단위</label><input id="prodUnit" class="input-box" placeholder="EA"></div><div class="col-span-2"><label class="text-xs">규격</label><input id="prodSpec" class="input-box"></div><div class="col-span-2"><label class="text-xs">제조사</label><input id="prodMaker" class="input-box"></div></div><button onclick="saveSimpleData('products')" class="w-full mt-4 bg-cyan-600 text-white py-3 rounded font-bold">저장</button>`;
    else if (tab === 'meeting_logs') {
        html = `
            <div class="grid grid-cols-2 gap-4">
                <div><label class="text-xs font-bold text-slate-700">미팅 날짜 (필수)</label><input type="date" id="mlDate" class="input-box" value="${today}"></div>
                <div><label class="text-xs font-bold text-slate-700">업체명 (필수)</label><input id="mlPartner" class="input-box" list="dl_part" placeholder="업체명 입력 또는 선택"></div>
                <div class="col-span-2"><label class="text-xs font-bold text-slate-700">참석자</label><input id="mlAttendees" class="input-box" placeholder="예: 김철수 부장, 이영희 대리"></div>
                <div class="col-span-2"><label class="text-xs font-bold text-slate-700">미팅 상세 내용</label><textarea id="mlContent" class="input-box h-40 resize-none p-3" placeholder="미팅 내용을 상세히 기록하세요."></textarea></div>
                <div class="col-span-2"><label class="text-xs font-bold text-slate-700 text-red-600">향후 계획 / 조치 사항</label><input id="mlNextStep" class="input-box" placeholder="다음 미팅 일정 혹은 확인해야 할 사항"></div>
            </div>
            <button onclick="saveSimpleData('meeting_logs')" class="w-full mt-6 bg-slate-800 text-white py-3 rounded font-bold hover:bg-slate-900 transition">일지 저장</button>
            <datalist id="dl_part"></datalist>
        `;
        setTimeout(() => fillDL('dl_part', partnerList), 100);
    }
    else if (tab === 'purchases') {
        html = `
        <div class="bg-slate-50 p-4 rounded mb-4 border">
            <div class="grid grid-cols-2 gap-3 mb-2"><div><label class="text-xs text-slate-500">입고일자</label><input type="date" id="purDate" class="input-box" value="${today}"></div><div><label class="text-xs text-slate-500">매입처 (공통)</label><input id="purPartner" class="input-box" list="dl_part"></div></div>
            <div><label class="text-xs text-slate-500">비고 (공통)</label><input id="purNote" class="input-box"></div>
        </div>
        <div class="bg-white border p-3 rounded mb-4 shadow-sm">
            <div class="flex flex-wrap gap-2 items-end">
                <div class="w-1/4"><label class="text-xs">품목명</label><input id="purItem" class="input-box" list="dl_prod"></div>
                <div class="w-1/6"><label class="text-xs">제조사</label><input id="purMaker" class="input-box"></div>
                <div class="w-1/6"><label class="text-xs">시리얼</label><input id="purSerial" class="input-box"></div>
                <div class="w-16"><label class="text-xs">수량</label><input type="number" id="purQty" class="input-box" value="1"></div>
                <div class="w-24"><label class="text-xs">단가</label><input type="number" id="purPrice" class="input-box"></div>
                <button onclick="addPurchaseItem()" class="bg-slate-700 text-white px-4 py-2 rounded font-bold text-sm h-9">추가</button>
            </div>
        </div>
        <table class="w-full text-sm border-collapse border text-center mb-4"><thead class="bg-slate-100"><tr><th>품목명</th> <th>제조사</th> <th>시리얼</th> <th>수량</th> <th>단가</th> <th>합계</th> <th>삭제</th></tr></thead><tbody id="purItemGrid"></tbody></table>
        <div class="text-right text-lg font-bold text-cyan-700">총 합계: <span id="purGrandTotal">0</span>원</div>
        <button onclick="savePurchase()" class="w-full mt-4 bg-cyan-600 text-white py-3 rounded font-bold shadow-lg">입고 처리 (저장)</button>
        <datalist id="dl_part"></datalist><datalist id="dl_prod"></datalist>`;
    }
    else if (tab === 'bookkeeping') {
        html = `
        <div class="bg-yellow-50 p-4 rounded mb-4 border border-yellow-200">
            <h3 class="text-sm font-bold text-yellow-800 mb-2"><i class="fa-solid fa-lightbulb"></i> 1인 사업자 비용 가이드</h3>
            <p class="text-xs text-slate-700 mb-1">· <strong>식대</strong>: 직원 없는 1인 사업자는 원칙적 불가</p>
            <p class="text-xs text-slate-700 mb-1">· <strong>차량유지비</strong>: 업무용 차량의 주유비, 수리비, 자동차세 등</p>
            <p class="text-xs text-slate-700 mb-1">· <strong>여비교통비</strong>: 출장 시 식사, 대중교통비, 주차비</p>
            <p class="text-xs text-slate-700 mb-1">· <strong>비품/소모품비</strong>: 100만 원 기준 자산/비용 구분</p>
        </div>
        <div class="grid grid-cols-2 gap-4">
            <div><label class="text-xs font-bold text-slate-700">지출 일자</label><input type="date" id="bkDate" class="input-box" value="${today}"></div>
            <div><label class="text-xs font-bold text-slate-700">계정 과목</label><select id="bkCategory" class="input-box"><option value="소모품비">소모품비</option><option value="비품">비품</option><option value="차량유지비">차량유지비</option><option value="여비교통비">여비교통비</option><option value="접대비">접대비</option><option value="식대">식대</option><option value="도서인쇄비">도서인쇄비</option><option value="통신비">통신비</option><option value="임차료">임차료</option><option value="지급수수료">지급수수료</option><option value="광고선전비">광고선전비</option><option value="기타">기타</option></select></div>
            <div class="col-span-2"><label class="text-xs font-bold text-slate-700">사용처 / 적요 (필수)</label><input id="bkUsage" class="input-box" placeholder="예: OO식당 점심식사"></div>
            <div><label class="text-xs font-bold text-slate-700">결제 수단</label><select id="bkMethod" class="input-box"><option value="사업자카드">사업자카드</option><option value="개인카드">개인카드</option><option value="현금영수증">현금영수증</option><option value="계좌이체">계좌이체</option><option value="기타">기타</option></select></div>
            <div><label class="text-xs font-bold text-slate-700">공급대가 (VAT포함)</label><input type="number" id="bkAmount" class="input-box" placeholder="숫자만 입력"></div>
            <div class="col-span-2"><label class="text-xs font-bold text-slate-700">비고</label><input id="bkNote" class="input-box" placeholder="메모 사항"></div>
        </div>
        <button onclick="saveSimpleData('bookkeeping')" class="w-full mt-6 bg-slate-800 text-white py-3 rounded font-bold hover:bg-slate-900 transition">저장하기</button>`;
    }
    else { renderComplexForm(tab, body); return; }
    body.innerHTML = html;
    if(tab === 'purchases' || tab === 'purchase_orders') { fillDL('dl_part', partnerList); fillDL('dl_prod', productList); }
}

async function saveData(tab, data) {
    let res;
    if (currentEditId) res = await supabase.from(tab).update(data).eq('id', currentEditId);
    else res = await supabase.from(tab).insert(data);
    if(res.error) { alert("오류: " + res.error.message); return false; }
    return true;
}

async function saveSimpleData(tab) {
    let data = {};
    if(tab === 'partners') {
        data = { name: el('pName'), biz_num: el('pBiz'), owner_name: el('pOwner'), manager_name: el('pManager'), phone: el('pPhone'), email: el('pEmail'), address: el('pAddr'), note: el('pNote') };
        const fileInput = document.getElementById('pFile');
        if (fileInput && fileInput.files.length > 0) {
            const file = fileInput.files[0]; const fileName = `biz_${Date.now()}.${file.name.split('.').pop()}`; 
            const { data: uploadData, error: uploadError } = await supabase.storage.from('erp').upload(fileName, file);
            if (uploadError) { alert("파일 업로드 실패: " + uploadError.message); return; }
            const { data: publicUrlData } = supabase.storage.from('erp').getPublicUrl(fileName);
            data.biz_file_url = publicUrlData.publicUrl; 
        }
    }
    else if(tab === 'products') {
        data = { name: el('prodName'), code: el('prodCode'), spec: el('prodSpec'), unit: el('prodUnit'), manufacturer: el('prodMaker') };
    }
    else if(tab === 'meeting_logs') {
        const pName = el('mlPartner');
        const pDate = el('mlDate');
        const pContent = el('mlContent');
        if(!pName || !pDate || !pContent) { alert("날짜, 업체명, 내용은 필수입니다."); return; }
        data = { date: pDate, partner_name: pName, attendees: el('mlAttendees'), content: pContent, next_step: el('mlNextStep') };
    }
    else if(tab === 'bookkeeping') {
        const usage = el('bkUsage');
        const amount = el('bkAmount');
        if(!usage || !amount) { alert("사용처와 금액은 필수입니다."); return; }
        data = { date: el('bkDate'), category: el('bkCategory'), usage_desc: usage, payment_method: el('bkMethod'), amount: parseInt(amount) || 0, note: el('bkNote') };
    }
    if(await saveData(tab, data)) { closeModal(); runSearch(tab); }
}

async function savePurchase() {
    if (tempItems.length === 0) return alert("입고할 품목을 추가해주세요.");
    const dateVal = document.getElementById('purDate').value;
    const partnerVal = document.getElementById('purPartner').value;
    const noteVal = document.getElementById('purNote').value;
    if (!dateVal || !partnerVal) return alert("날짜와 매입처를 입력해주세요.");
    let successCount = 0;
    for (const item of tempItems) {
        const data = { date: dateVal, partner_name: partnerVal, item_name: item.name, manufacturer: item.manufacturer, qty: item.qty, unit_price: item.unit_price, supply_price: item.unit_price * item.qty, vat: Math.floor(item.unit_price * item.qty * 0.1), total_amount: item.total_amount, serial_no: item.serial_no, note: noteVal };
        const { error } = await supabase.from('purchases').insert(data);
        if (!error) {
            successCount++;
            const prod = productList.find(p => p.name === item.name);
            if (prod) {
                prod.stock = prod.stock + item.qty; 
                await supabase.from('products').update({ stock: prod.stock, last_vendor: partnerVal, last_price: item.unit_price, last_serial_no: item.serial_no, manufacturer: item.manufacturer || prod.manufacturer }).eq('id', prod.id);
            }
        }
    }
    if (successCount > 0) { alert(`${successCount}건의 품목이 입고 처리되었습니다.`); closeModal(); runSearch('purchases'); } else { alert("저장에 실패했습니다."); }
}

async function saveComplexData(tab) {
    if(tempItems.length === 0) return alert("품목 없음");
    let tSupply=0, tVat=0, tTotal=0; tempItems.forEach(i => { tSupply+=i.supply; tVat+=i.vat; tTotal+=i.total; });
    let dateVal = el(tab === 'purchase_orders' ? 'poDate' : 'sDate') || new Date().toISOString().split('T')[0];
    let data = { items: tempItems, total_supply: tSupply, total_vat: tVat, total_amount: tTotal, date: dateVal, partner_name: el('sPartner'), manager: el('sManager'), note: el('sNote') };
    if(tab === 'purchase_orders') { 
        data.po_number = el('poNum'); data.partner_name = el('poPartner'); data.end_user = el('poEndUser'); data.manager = el('poManager'); data.is_pre_order = el('poPreOrder'); data.note = el('poNote'); 
        data.partner_manager = el('poPManager'); data.phone = el('poPhone'); data.email = el('poEmail'); data.partner_address = el('poAddr');
        if (!currentEditId) {
            const { count } = await supabase.from(tab).select('*', { count: 'exact', head: true }).eq('date', dateVal);
            const seq = (count || 0) + 1; 
            const yymmdd = dateVal.slice(2).replace(/-/g, ''); 
            data.po_number = `ASPEC-${yymmdd}-P${String(seq).padStart(2, '0')}`;
        }
    } else { 
        data.email = el('sEmail'); data.partner_manager = el('sPManager'); data.phone = el('sContact'); data.partner_address = el('sAddr'); 
        if(tab === 'orders') data.po_number = 'AUTO'; 
    }
    if(await saveData(tab, data)) { 
        if(tab === 'sales' && !currentEditId) { 
            const { data: bomList } = await supabase.from('bom').select('*');
            for(const item of tempItems) { 
                const relatedParts = bomList ? bomList.filter(b => b.parent_name === item.name) : [];
                if (relatedParts.length > 0) {
                    for (const part of relatedParts) {
                        const childProd = productList.find(p => p.name === part.child_name);
                        if (childProd) await supabase.from('products').update({ stock: childProd.stock - (item.qty * part.qty) }).eq('id', childProd.id);
                    }
                } else {
                    const prod = productList.find(p => p.name === item.name); 
                    if(prod) await supabase.from('products').update({ stock: prod.stock - item.qty }).eq('id', prod.id); 
                }
            }
            if (currentLoadedOrderId) {
                await supabase.from('orders').update({ status: 'completed' }).eq('id', currentLoadedOrderId);
                currentLoadedOrderId = null; 
            }
        }
        alert("저장되었습니다."); closeModal(); runSearch(tab);
    }
}

async function deleteItem(table, id) { 
    if(!confirm("정말 삭제하시겠습니까?")) return; 
    if (table === 'sales') {
        const { data: saleData } = await supabase.from('sales').select('items').eq('id', id).single();
        if (saleData && saleData.items) {
            for (const item of saleData.items) {
                const prod = productList.find(p => p.name === item.name);
                if (prod) await supabase.from('products').update({ stock: prod.stock + item.qty }).eq('id', prod.id);
            }
        }
    }
    const { error } = await supabase.from(table).delete().eq('id', id); 
    if(error) alert("삭제 실패"); else runSearch(table); 
}

async function printDocument(tab, dataId) {
    const row = getRowData(dataId); if (!row) return alert('데이터 오류');
    const isPO = (tab === 'purchase_orders');
    const addrRow1 = document.getElementById('print_row_addr_1');
    const addrRow2 = document.getElementById('print_row_addr_2');
    if (tab === 'quotes') {
        if(addrRow1) addrRow1.style.display = 'none';
        if(addrRow2) addrRow2.style.display = 'none';
    } else {
        if(addrRow1) addrRow1.style.display = 'table-row';
        if(addrRow2) addrRow2.style.display = 'table-row';
    }
    let titleKo="거래명세서", titleEn="TRANSACTION STATEMENT", prefix="T"; 
    if (tab==='quotes') { titleKo="견적서"; titleEn="QUOTATION"; prefix="Q"; }
    else if (tab==='orders') { titleKo="주문서"; titleEn="ORDER SHEET"; prefix="D"; }
    else if (tab==='purchase_orders') { titleKo="발주서"; titleEn="PURCHASE ORDER"; prefix="P"; }
    document.getElementById('p_title_ko').innerText = titleKo; document.getElementById('p_title_en').innerText = titleEn;
    document.getElementById('p_date').innerText = row.date;
    if (isPO && row.po_number && row.po_number.startsWith('ASPEC')) document.getElementById('p_no').innerText = row.po_number;
    else {
        const { count } = await supabase.from(tab).select('*', { count: 'exact', head: true }).eq('date', row.date).lte('id', row.id);
        const d = new Date(row.date); const yymmdd = d.getFullYear().toString().slice(2) + (d.getMonth()+1).toString().padStart(2,'0') + d.getDate().toString().padStart(2,'0');
        document.getElementById('p_no').innerText = `ASPEC-${yymmdd}-${prefix}${String(count).padStart(2,'0')}`;
    }
    if (isPO) {
        document.getElementById('p_left_role').innerText = "수 주 처"; document.getElementById('p_left_name').innerText = row.partner_name;
        document.getElementById('p_left_manager').innerText = row.partner_manager||''; document.getElementById('p_left_email').innerText = row.email||''; 
        document.getElementById('p_left_phone').innerText = row.phone||''; document.getElementById('p_left_addr').innerText = row.partner_address||'';
        document.getElementById('p_right_role').innerText = "발 주 처";
    } else {
        document.getElementById('p_left_role').innerText = "공 급 받 는 자"; document.getElementById('p_left_name').innerText = row.partner_name;
        document.getElementById('p_left_manager').innerText = row.partner_manager||''; document.getElementById('p_left_email').innerText = row.email||''; 
        document.getElementById('p_left_phone').innerText = row.phone||''; document.getElementById('p_left_addr').innerText = row.partner_address||''; 
        document.getElementById('p_right_role').innerText = "공 급 자";
    }
    document.getElementById('p_right_name').innerText = "아스펙 (ASPEC)"; document.getElementById('p_right_manager').innerText = "이창현 프로";
    document.getElementById('p_right_email').innerText = currentUserEmail; document.getElementById('p_right_mp').innerText = "010-5919-1810"; 
    
    const tableContainer = document.querySelector('.print-items-table');
    tableContainer.innerHTML = `<colgroup><col style="width: 5%;"><col style="width: 25%;"><col style="width: 30%;"><col style="width: 8%;"><col style="width: 8%;"><col style="width: 12%;"><col style="width: 12%;"></colgroup><thead><tr><th>No</th><th>품명</th><th>규격</th><th>단위</th><th>수량</th><th>단가</th><th>공급가액</th></tr></thead><tbody id="p_tbody"></tbody><tfoot><tr style="background: #f8f8f8;"><td colspan="4" style="text-align: center; border-right: 1px solid black; font-weight: bold;">합 계 (Total)</td><td style="text-align: center; border-right: 1px solid black; font-weight: bold;" id="p_total_qty"></td><td style="text-align: right; border-right: 1px solid black; font-size: 11px;">공급가액</td><td style="text-align: right; font-weight: bold;" id="p_sum_supply"></td></tr><tr><td colspan="5" style="border-right: 1px solid black; border-bottom: 1px solid black;"></td><td style="text-align: right; border-right: 1px solid black; background: #f8f8f8; font-size: 11px;">부가세 (VAT)</td><td style="text-align: right;" id="p_sum_vat"></td></tr><tr style="font-weight: bold;"><td colspan="5" style="border-right: 1px solid black; border-bottom: 1px solid black;"></td><td style="text-align: right; border-right: 1px solid black; background: #e6e6e6;">총 합계</td><td style="text-align: right; background: #e6e6e6;" id="p_total_amt"></td></tr><tr style="background: #fff; border-top: 2px double black;"><td colspan="7" style="padding: 10px; text-align: left;"><strong>[비고]</strong> <span id="p_note"></span></td></tr></tfoot>`;
    const tbody = document.getElementById('p_tbody'); tbody.innerHTML = ''; 
    let sumQty=0, sumAmt=0;
    if (row.items) {
        row.items.forEach((item, idx) => {
            let spec = item.spec; if (!spec) { const prod = productList.find(p => p.name === item.name); if (prod) spec = prod.spec; }
            sumQty += parseInt(item.qty)||0; sumAmt += parseInt(item.supply)||0; 
            tbody.innerHTML += `<tr class="items-row"><td style="text-align:center">${idx+1}</td><td>${item.name}</td><td style="font-size:10px">${spec||'-'}</td><td style="text-align:center">${item.unit||'EA'}</td><td style="text-align:center">${item.qty}</td><td style="text-align:right">${(item.price||0).toLocaleString()}</td><td style="text-align:right">${(item.supply||0).toLocaleString()}</td></tr>`;
        });
    }
    for (let i=0; i<10-(row.items?.length||0); i++) tbody.innerHTML += `<tr class="items-row"><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>`;
    const vatAmt = Math.floor(sumAmt * 0.1); const totalAmt = row.total_amount || (sumAmt + vatAmt);
    document.getElementById('p_total_qty').innerText = sumQty.toLocaleString(); document.getElementById('p_sum_supply').innerText = sumAmt.toLocaleString(); 
    document.getElementById('p_sum_vat').innerText = vatAmt.toLocaleString(); document.getElementById('p_total_amt').innerText = "₩ " + totalAmt.toLocaleString(); 
    document.getElementById('p_note').innerText = row.note || '';
    document.getElementById('printContainer').classList.remove('hidden');
    setTimeout(() => { window.print(); document.getElementById('printContainer').classList.add('hidden'); }, 100);
}

function getTitle(tab) { const map = {'partners':'거래처','products':'품목','purchase_orders':'발주','purchases':'구매(입고)','quotes':'견적','orders':'주문','sales':'판매', 'meeting_logs':'미팅 일지'}; return map[tab] || ''; }
function closeModal() { document.getElementById('genericModal').classList.remove('active'); }
function autoGenCode(val) { if(val && !currentEditId) document.getElementById('prodCode').value = 'P-' + Date.now().toString().slice(-6); }
function el(id) { return document.getElementById(id) ? document.getElementById(id).value : ''; }
function fillDL(id, list) { document.getElementById(id).innerHTML = list.map(i=>`<option value="${i.name}">`).join(''); }
function fillPart(val) { const f = partnerList.find(x=>x.name===val); if(f) { if(document.getElementById('sPManager')) document.getElementById('sPManager').value = f.manager_name||''; if(document.getElementById('sContact')) document.getElementById('sContact').value = f.phone||''; if(document.getElementById('sAddr')) document.getElementById('sAddr').value = f.address||''; if(document.getElementById('sEmail')) document.getElementById('sEmail').value = f.email||''; } }
function fillPOPart(val) { const f = partnerList.find(x=>x.name===val); if(f) { if(document.getElementById('poPManager')) document.getElementById('poPManager').value = f.manager_name||''; if(document.getElementById('poPhone')) document.getElementById('poPhone').value = f.phone||''; if(document.getElementById('poEmail')) document.getElementById('poEmail').value = f.email||''; if(document.getElementById('poAddr')) document.getElementById('poAddr').value = f.address||''; } }
function fillProd(val) { const f = productList.find(x=>x.name===val); if(f) { if(document.getElementById('iSpec')) document.getElementById('iSpec').value = f.spec || ''; } }

async function loadInventoryData(isSearch = false) {
    const tbody = document.getElementById('listBody'); 
    const ordersRes = await supabase.from('orders').select('*'); 
    const allOrders = ordersRes.data ||

// js/ui.js - 공통 UI 컴포넌트

/**
 * 모달 열기
 */
function openModal(title = '입력') {
    const modal = document.getElementById('genericModal');
    document.getElementById('modalTitle').innerText = title;
    modal.classList.add('active');
}

/**
 * 모달 닫기
 */
function closeModal() {
    document.getElementById('genericModal').classList.remove('active');
    AppState.currentEditId = null;
    AppState.tempItems = [];
}

/**
 * 검색 패널 렌더링
 */
function renderSearchPanel(tab) {
    const panel = document.getElementById('searchContainer');
    
    if (tab === 'dashboard' || tab === 'calendar') {
        panel.innerHTML = '';
        return;
    }
    
    const dateRange = getDateRangeForTab(tab);
    let html = `<div class="search-panel no-print"><div class="flex flex-wrap gap-6 items-end">`;
    
    // 기간 조회 (일부 탭 제외)
    if (!['partners', 'products', 'inventory'].includes(tab)) {
        html += `
            <div>
                <span class="search-label">기간 조회</span>
                <div class="flex items-center gap-2">
                    <input type="date" id="searchStartDate" class="input-box" value="${dateRange.start}">
                    <span class="text-slate-400">~</span>
                    <input type="date" id="searchEndDate" class="input-box" value="${dateRange.end}">
                </div>
            </div>`;
    }
    
    // 탭별 추가 필터
    html += getTabSpecificFilters(tab);
    
    // 추가 컨트롤 + 조회 버튼
    html += `
        <div class="ml-auto flex items-center">
            ${getExtraControls(tab)}
            <button onclick="runSearch('${tab}')" class="bg-blue-600 hover:bg-blue-700 text-white px-8 py-2.5 rounded font-bold shadow transition flex items-center gap-2 text-sm">
                <i class="fa-solid fa-magnifying-glass"></i> 조회
            </button>
        </div>
    </div></div>`;
    
    panel.innerHTML = html;
}

/**
 * 탭별 날짜 범위 설정
 */
function getDateRangeForTab(tab) {
    if (tab === 'collections') {
        return getDefaultDateRange(5);
    } else if (tab === 'bookkeeping' || tab === 'cost_management') {
        return getDefaultDateRange(1);
    }
    return getDefaultDateRange(1);
}

/**
 * 탭별 추가 필터 HTML
 */
function getTabSpecificFilters(tab) {
    switch (tab) {
        case 'purchase_orders':
            return `
                <div><span class="search-label">납품업체</span><input type="text" id="search_sPartner" class="input-box" placeholder="업체명" onkeypress="handleSearchKeyPress(event, '${tab}')"></div>
                <div><span class="search-label">EndUser</span><input type="text" id="search_sEndUser" class="input-box" placeholder="EndUser" onkeypress="handleSearchKeyPress(event, '${tab}')"></div>
                <div><span class="search-label">품목명</span><input type="text" id="search_sItem" class="input-box" placeholder="품목명" onkeypress="handleSearchKeyPress(event, '${tab}')"></div>`;
        
        case 'purchases':
            return `
                <div><span class="search-label">매입처</span><input type="text" id="search_sPartner" class="input-box" placeholder="매입처" onkeypress="handleSearchKeyPress(event, '${tab}')"></div>
                <div><span class="search-label">품목명</span><input type="text" id="search_sItem" class="input-box" placeholder="품목명" onkeypress="handleSearchKeyPress(event, '${tab}')"></div>`;
        
        case 'partners':
            return `
                <div><span class="search-label">상호명</span><input type="text" id="search_sName" class="input-box" onkeypress="handleSearchKeyPress(event, '${tab}')"></div>
                <div><span class="search-label">담당자</span><input type="text" id="search_sManager" class="input-box" onkeypress="handleSearchKeyPress(event, '${tab}')"></div>`;
        
        case 'products':
        case 'inventory':
            return `
                <div><span class="search-label">품목명</span><input type="text" id="search_sName" class="input-box" onkeypress="handleSearchKeyPress(event, '${tab}')"></div>
                <div><span class="search-label">코드</span><input type="text" id="search_sCode" class="input-box" onkeypress="handleSearchKeyPress(event, '${tab}')"></div>`;
        
        case 'collections':
            return `<div><span class="search-label">거래처</span><input type="text" id="search_sPartner" class="input-box" onkeypress="handleSearchKeyPress(event, '${tab}')"></div>`;
        
        case 'meeting_logs':
            return `
                <div><span class="search-label">업체명</span><input type="text" id="search_mlPartner" class="input-box" placeholder="업체명 검색" onkeypress="handleSearchKeyPress(event, '${tab}')"></div>
                <div><span class="search-label">내용 키워드</span><input type="text" id="search_mlContent" class="input-box" placeholder="내용 검색" onkeypress="handleSearchKeyPress(event, '${tab}')"></div>`;

        case 'memos':
            return `
                <div>
                    <span class="search-label">메모 내용</span>
                    <input type="text" id="search_memoContent" class="input-box" placeholder="내용 키워드 검색" onkeypress="handleSearchKeyPress(event, '${tab}')">
                </div>`;

        // ▼▼▼▼▼ 여기가 수정된 부분입니다 ▼▼▼▼▼
        case 'bookkeeping':
            return `
                <div><span class="search-label">계정과목</span>
                    <select id="search_sCategory" class="input-box h-[38px]" onchange="runSearch('${tab}')">
                        <option value="">전체</option>
                        <option>식대</option><option>여비교통비</option><option>소모품비</option>
                        <option>도서인쇄비</option><option>접대비</option><option>통신비</option>
                        <option>임차료</option><option>기타</option>
                    </select>
                </div>
                <div><span class="search-label">사용처/적요</span><input type="text" id="search_sUsage" class="input-box" onkeypress="handleSearchKeyPress(event, '${tab}')"></div>
                
                <div class="pb-1">
                    <span id="totalAmountDisplay" class="font-bold text-blue-600 text-lg"></span>
                </div>`;
        // ▲▲▲▲▲ 중간에 끊기지 않고 끝까지 이어집니다 ▲▲▲▲▲

        default:
            return `
                <div><span class="search-label">거래처</span><input type="text" id="search_sPartner" class="input-box" onkeypress="handleSearchKeyPress(event, '${tab}')"></div>
                <div><span class="search-label">담당자</span><input type="text" id="search_sManager" class="input-box" onkeypress="handleSearchKeyPress(event, '${tab}')"></div>
                <div><span class="search-label">비고</span><input type="text" id="search_sNote" class="input-box" onkeypress="handleSearchKeyPress(event, '${tab}')"></div>`;
    }
}


/**
 * 탭별 추가 컨트롤 (체크박스 등)
 */
function getExtraControls(tab) {
    if (tab === 'inventory') {
        return `<label class="flex items-center gap-2 cursor-pointer mr-4">
            <input type="checkbox" id="hideZeroStock" class="w-4 h-4" checked>
            <span class="text-sm font-semibold text-slate-700">재고0개품목제외</span>
        </label>`;
    }
    if (tab === 'collections') {
        return `<label class="flex items-center gap-2 cursor-pointer mr-4">
            <input type="checkbox" id="hideZeroReceivable" class="w-4 h-4" checked>
            <span class="text-sm font-semibold text-slate-700">채권금액 0원은 제외</span>
        </label>`;
    }
    return '';
}

/**
 * 로딩 표시
 */
function showTableLoading(colspan = 10) {
    const tbody = document.getElementById('listBody');
    if (tbody) {
        tbody.innerHTML = `<tr><td colspan="${colspan}" class="text-center p-8">데이터를 불러오는 중입니다...</td></tr>`;
    }
}

/**
 * 빈 데이터 표시
 */
function showEmptyTable(colspan = 10) {
    const tbody = document.getElementById('listBody');
    if (tbody) {
        tbody.innerHTML = `<tr><td colspan="${colspan}" class="text-center p-8 text-slate-500">데이터가 없습니다.</td></tr>`;
    }
}

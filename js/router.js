// js/router.js - 탭 전환 및 라우팅 (캐싱 적용)

/**
 * 탭 전환 메인 함수
 */
async function switchTab(tab) {
    AppState.currentTab = tab;
    updateNavigation(tab);
    
    const container = document.getElementById('contentArea');
    
    // 대시보드
    if (tab === 'dashboard') {
        renderSearchPanel(tab);
        DashboardModule.render(container);
        return;
    }
    
    // 캘린더
    if (tab === 'calendar') {
        renderSearchPanel(tab);
        await CalendarModule.render();
        return;
    }
    
    // 일반 탭 - 마스터 데이터는 캐시 사용 (강제 로드 안함)
    await fetchMasterData(false);
    renderSearchPanel(tab);
    renderTabContent(tab, container);
    runSearch(tab);
}

/**
 * 검색 실행 - 탭별 모듈로 분기
 */
async function runSearch(tab, forceRefresh) {
    // forceRefresh가 명시적으로 true가 아니면 캐시 체크
    if (forceRefresh !== true && isCacheValid(tab)) {
        console.log(tab + ' 캐시 데이터 사용');
        renderCachedData(tab);
        return;
    }
    
    switch (tab) {
        case 'partners':
            await PartnersModule.search();
            break;
        case 'products':
            await ProductsModule.search();
            break;
        case 'bookkeeping':
            await BookkeepingModule.search();
            break;
        case 'meeting_logs':
            await MeetingLogsModule.search();
            break;
        case 'purchases':
            await PurchasesModule.search();
            break;
        case 'purchase_orders':
            await PurchaseOrdersModule.search();
            break;
        case 'quotes':
            await QuotesModule.search();
            break;
        case 'orders':
            await OrdersModule.search();
            break;
        case 'sales':
            await SalesModule.search();
            break;
        case 'collections':
            await CollectionsModule.search();
            break;
        case 'inventory':
            await InventoryModule.search();
            break;
        case 'cost_management':
            await CostManagementModule.search();
            break;
        default:
            console.warn('Unknown tab:', tab);
    }
}

/**
 * 캐시된 데이터 렌더링
 */
function renderCachedData(tab) {
    const data = getCache(tab);
    if (!data) return;
    
    switch (tab) {
        case 'partners':
            PartnersModule.renderTable(data);
            break;
        case 'products':
            ProductsModule.renderTable(data);
            break;
        case 'bookkeeping':
            BookkeepingModule.renderTable(data);
            break;
        case 'meeting_logs':
            MeetingLogsModule.renderTable(data);
            break;
        case 'purchases':
            PurchasesModule.renderTable(data);
            break;
        case 'purchase_orders':
            PurchaseOrdersModule.renderTable(data);
            break;
        case 'quotes':
            QuotesModule.renderTable(data);
            break;
        case 'orders':
            OrdersModule.renderTable(data);
            break;
        case 'sales':
            SalesModule.renderTable(data);
            break;
        case 'collections':
            CollectionsModule.renderTable(data);
            break;
        case 'inventory':
            InventoryModule.renderTable(data, {});
            break;
        case 'cost_management':
            CostManagementModule.renderTable(data);
            break;
    }
}

/**
 * 신규 등록 모달 열기 - 탭별 모듈로 분기
 */
function openNewModal(tab) {
    switch (tab) {
        case 'partners':
            PartnersModule.openNewModal();
            break;
        case 'products':
            ProductsModule.openNewModal();
            break;
        case 'bookkeeping':
            BookkeepingModule.openNewModal();
            break;
        case 'meeting_logs':
            MeetingLogsModule.openNewModal();
            break;
        case 'purchases':
            PurchasesModule.openNewModal();
            break;
        case 'purchase_orders':
            PurchaseOrdersModule.openNewModal();
            break;
        case 'quotes':
            QuotesModule.openNewModal();
            break;
        case 'orders':
            OrdersModule.openNewModal();
            break;
        case 'sales':
            SalesModule.openNewModal();
            break;
        default:
            console.warn('Unknown tab for new modal:', tab);
    }
}

/**
 * 네비게이션 활성화 상태 업데이트
 */
function updateNavigation(activeTab) {
    const navBtns = document.querySelectorAll('.nav-btn');
    navBtns.forEach(function(btn) {
        btn.classList.remove('bg-slate-800', 'text-white', 'font-bold');
        var onclickAttr = btn.getAttribute('onclick');
        if (onclickAttr && onclickAttr.indexOf("'" + activeTab + "'") !== -1) {
            btn.classList.add('bg-slate-800', 'text-white', 'font-bold');
        }
    });
}

/**
 * 일반 탭 콘텐츠 렌더링
 */
function renderTabContent(tab, container) {
    const title = getTabTitle(tab);
    const buttonsHtml = getTabButtons(tab);
    const tableHtml = getTableStructure(tab);
    
    var html = '';
    html += '<div class="flex justify-between items-center mb-6">';
    html += '<h2 class="text-3xl font-bold text-slate-800 border-l-8 border-cyan-500 pl-4">' + title + '</h2>';
    html += buttonsHtml;
    html += '</div>';
    html += '<div class="bg-white rounded-lg shadow border border-slate-200 overflow-hidden">';
    html += '<table class="data-table">';
    html += tableHtml;
    html += '<tbody id="listBody"></tbody>';
    html += '</table>';
    html += '</div>';
    
    container.innerHTML = html;
}

/**
 * 탭별 버튼 HTML
 */
function getTabButtons(tab) {
    var commonBtnClass = "bg-cyan-600 hover:bg-cyan-700 text-white px-6 py-2.5 rounded font-bold shadow-md text-sm flex items-center gap-2";
    
    if (tab === 'products') {
        return '<div class="flex gap-2">' +
            '<button onclick="openBOMModal()" class="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2.5 rounded font-bold shadow-md text-sm flex items-center gap-2">' +
            '<i class="fa-solid fa-layer-group"></i> 세트(BOM) 관리</button>' +
            '<button onclick="openNewModal(\'' + tab + '\')" class="' + commonBtnClass + '">' +
            '<i class="fa-solid fa-plus"></i> 신규 등록</button></div>';
    }
    
    if (tab === 'inventory') {
        return '<button onclick="openNewModal(\'purchases\')" class="bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded font-bold shadow-md text-sm flex items-center gap-2">' +
            '<i class="fa-solid fa-plus"></i> 제품 입고</button>';
    }
    
    if (tab === 'collections' || tab === 'cost_management') {
        return '';
    }
    
    return '<button onclick="openNewModal(\'' + tab + '\')" class="' + commonBtnClass + '">' +
        '<i class="fa-solid fa-plus"></i> 신규 등록</button>';
}

/**
 * 탭별 테이블 헤더 구조
 */
function getTableStructure(tab) {
    var structures = {
        partners: '<thead><tr><th style="width:20%">상호</th><th style="width:15%">담당자</th><th style="width:20%">전화번호</th><th>비고</th><th style="width:15%">관리</th></tr></thead>',
        products: '<thead><tr><th style="width:15%">품목코드</th><th style="width:25%">품목명</th><th>규격</th><th style="width:8%">단위</th><th style="width:15%">관리</th></tr></thead>',
        purchase_orders: '<thead><tr><th style="width:12%">PO#</th><th style="width:15%">납품업체</th><th style="width:15%">EndUser</th><th>품목요약</th><th style="width:12%">총액</th><th style="width:10%">일자</th><th style="width:15%">관리</th></tr></thead>',
        purchases: '<thead><tr><th style="width:10%">일자</th><th style="width:10%">제조사</th><th style="width:15%">매입처</th><th>품목명</th><th style="width:6%">수량</th><th style="width:10%">단가</th><th style="width:10%">합계</th><th style="width:10%">시리얼</th><th style="width:10%">관리</th></tr></thead>',
        inventory: '<thead><tr><th>품목명</th><th style="width:10%">제조사</th><th style="width:12%">입고처</th><th style="width:10%">입고단가</th><th style="width:8%">총재고</th><th style="width:8%">가용재고</th><th>비고</th><th style="width:10%">예약</th><th style="width:10%">관리</th></tr></thead>',
        collections: '<thead><tr><th style="width:10%">판매일자</th><th style="width:15%">거래처</th><th style="width:15%">매출총액(VAT포함)</th><th style="width:15%">기수금액</th><th style="width:15%">미수금(잔액)</th><th>비고</th><th style="width:10%">관리</th></tr></thead>',
        bookkeeping: '<thead><tr><th style="width:10%">일자</th><th style="width:12%">계정과목</th><th style="width:20%">사용처(적요)</th><th style="width:10%">결제수단</th><th style="width:12%">금액</th><th>비고</th><th style="width:15%">관리</th></tr></thead>',
        meeting_logs: '<thead><tr><th style="width:12%">미팅날짜</th><th style="width:15%">업체명</th><th style="width:15%">참석자</th><th>미팅 내용 (요약)</th><th style="width:20%">향후 계획</th><th style="width:10%">관리</th></tr></thead>',
        cost_management: '<thead><tr><th style="width:10%">주문일자</th><th style="width:15%">거래처</th><th style="width:20%">주문명(대표품목)</th><th style="width:12%">총 매출액</th><th style="width:12%">총 원가(입력)</th><th style="width:12%">마진금액</th><th style="width:8%">마진율</th><th style="width:10%">관리</th></tr></thead>'
    };
    
    var defaultStructure = '<thead><tr><th style="width:10%">일자</th><th style="width:18%">거래처</th><th style="width:12%">담당자</th><th style="width:12%">공급가액</th><th style="width:10%">부가세</th><th style="width:12%">합계</th><th>비고</th><th style="width:15%">관리</th></tr></thead>';
    
    return structures[tab] || defaultStructure;
}

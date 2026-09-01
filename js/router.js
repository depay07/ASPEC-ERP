// js/router.js - 탭 전환 및 라우팅

/**
 * 탭 전환 메인 함수
 */
async function switchTab(tab) {
    var sessionReady = await ensureActiveSession({
        context: getTabTitle(tab) + ' 열기',
        notifyNetworkError: true
    });
    if (!sessionReady) return;

    AppState.currentTab = tab;
    updateNavigation(tab);
    closeMobileSidebar();
    
    var container = document.getElementById('contentArea');
    
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

    // [추가] 프로젝트 탭 - 전용 초기화 로직 실행 (전용 검색바 사용)
    if (tab === 'projects') {
        renderTabContent(tab, container); // 테이블 구조 먼저 생성
        ProjectsModule.init(); // 전용 검색바 생성 및 데이터 로드
        return;
    }
    
    // 일반 탭 - 마스터 데이터는 캐시 사용
    await fetchMasterData(false);
    renderSearchPanel(tab);
    renderTabContent(tab, container);
    runSearch(tab, false); // 캐시 사용 허용
}

/**
 * 검색 실행 - 탭별 모듈로 분기
 */
async function runSearch(tab, forceRefresh, userInitiated) {
    forceRefresh = forceRefresh || false;
    userInitiated = userInitiated || false;

    var sessionReady = await ensureActiveSession({
        context: getTabTitle(tab) + ' 조회',
        notifyNetworkError: true
    });
    if (!sessionReady) return;
    
    switch (tab) {
        case 'partners':
            await PartnersModule.search(forceRefresh);
            break;
        case 'products':
            await ProductsModule.search(forceRefresh);
            break;
        case 'price_list':
            await PriceListModule.search(forceRefresh);
            break;
        case 'bookkeeping':
            await BookkeepingModule.search(forceRefresh);
            break;
        case 'meeting_logs':
            await MeetingLogsModule.search(forceRefresh);
            break;
        case 'purchases':
            await PurchasesModule.search(forceRefresh);
            break;
        case 'purchase_orders':
            await PurchaseOrdersModule.search(forceRefresh, userInitiated);
            break;
        case 'quotes':
            await QuotesModule.search(forceRefresh);
            break;
        case 'orders':
            await OrdersModule.search(forceRefresh, userInitiated);
            break;
        case 'sales':
            await SalesModule.search(forceRefresh, userInitiated);
            break;                                            
        case 'collections':
            await CollectionsModule.search(forceRefresh);
            break;
        case 'inventory':
            await InventoryModule.search(forceRefresh);
            break;
        case 'cost_management':
            await CostManagementModule.search(forceRefresh, userInitiated);
            break;
        case 'rentals':
            await RentalsModule.search(forceRefresh);
            break;
        case 'projects':                                      
            await ProjectsModule.search(); // 프로젝트는 전용 검색 로직 사용
            break;                                            
        case 'memos':
            await MemosModule.search();
            break;
        default:
            console.warn('Unknown tab:', tab);
    }
}

/**
 * 신규 등록 모달 열기
 */
function openNewModal(tab) {
    switch (tab) {
        case 'partners': PartnersModule.openNewModal(); break;
        case 'products': ProductsModule.openNewModal(); break;
        case 'price_list': PriceListModule.openNewModal(); break;
        case 'bookkeeping': BookkeepingModule.openNewModal(); break;
        case 'meeting_logs': MeetingLogsModule.openNewModal(); break;
        case 'purchases': PurchasesModule.openNewModal(); break;
        case 'purchase_orders': PurchaseOrdersModule.openNewModal(); break;
        case 'quotes': QuotesModule.openNewModal(); break;
        case 'orders': OrdersModule.openNewModal(); break;
        case 'sales': SalesModule.openNewModal(); break;
        case 'rentals': RentalsModule.openNewModal(); break;
        case 'projects': ProjectsModule.openNewModal(); break;
        case 'memos': MemosModule.openNewModal(); break;
        default: console.warn('Unknown tab for modal:', tab);
    }
}

/**
 * 네비게이션 활성화 상태 업데이트
 */
function updateNavigation(activeTab) {
    var navBtns = document.querySelectorAll('.nav-btn');
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
    
    var html = '';
    html += '<div class="flex justify-between items-center mb-6">';
    html += '<h2 class="text-3xl font-bold text-slate-800 border-l-8 border-cyan-500 pl-4">' + title + '</h2>';
    html += buttonsHtml;
    html += '</div>';

    if (tab === 'cost_management') {
        html += '<section id="costSummary" class="hidden mb-5 bg-white border-y border-slate-200" aria-live="polite"></section>';
    } else if (tab === 'sales') {
        html += '<section id="salesSummary" class="hidden mb-5 bg-white border-y border-slate-200" aria-live="polite"></section>';
    } else if (tab === 'orders') {
        html += '<section id="ordersSummary" class="hidden mb-5 bg-white border-y border-slate-200" aria-live="polite"></section>';
    } else if (tab === 'purchase_orders') {
        html += '<section id="purchaseOrdersSummary" class="hidden mb-5 bg-white border-y border-slate-200" aria-live="polite"></section>';
    }

    if (tab === 'memos') {
        html += '<div class="flex flex-col md:flex-row min-h-[560px] border-t border-slate-200 bg-white">';
        html += '<aside class="w-full md:w-56 flex-shrink-0 border-b md:border-b-0 md:border-r border-slate-200 p-3">';
        html += '<div class="flex items-center justify-between mb-3">';
        html += '<h3 class="font-bold text-slate-700 flex items-center gap-2"><i class="fa-solid fa-folder text-amber-500"></i> 폴더</h3>';
        html += '<button onclick="runSaveOnce(\'memo-folder-create\', this, () => MemosModule.createFolder())" class="w-8 h-8 inline-flex items-center justify-center text-slate-500 hover:text-cyan-700 hover:bg-cyan-50 rounded" title="새 폴더"><i class="fa-solid fa-plus"></i></button>';
        html += '</div>';
        html += '<div id="memoFolderList" class="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible pb-2 md:pb-0"></div>';
        html += '</aside>';
        html += '<section class="flex-1 min-w-0 bg-slate-50">';
        html += '<div id="memoFolderNotice"></div>';
        html += '<div id="listBody" class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 p-4"></div>';
        html += '</section></div>';
    } else {
        const isWideTable = tab === 'price_list' || tab === 'purchase_orders' || tab === 'rentals';
        const tableWrapClass = isWideTable ? 'overflow-x-auto' : 'overflow-hidden';
        const tableClass = tab === 'price_list'
            ? 'data-table min-w-[900px]'
            : (tab === 'purchase_orders'
                ? 'data-table min-w-[1450px]'
                : (tab === 'rentals' ? 'data-table min-w-[1800px]' : 'data-table'));
        html += '<div class="bg-white rounded-lg shadow border border-slate-200 ' + tableWrapClass + '">';
        html += '<table class="' + tableClass + '">';
        html += getTableStructure(tab);
        html += '<tbody id="listBody"></tbody>';
        html += '</table>';
        html += '</div>';
    }
    
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

    if (tab === 'price_list') {
        return '<button onclick="openNewModal(\'price_list\')" class="' + commonBtnClass + '">' +
            '<i class="fa-solid fa-plus"></i> 가격표 품목 추가</button>';
    }

    if (tab === 'rentals') {
        return '<button onclick="openNewModal(\'rentals\')" class="' + commonBtnClass + '">' +
            '<i class="fa-solid fa-plus"></i> 대여 등록</button>';
    }
    
    if (tab === 'inventory') {
        return '<button onclick="openNewModal(\'purchases\')" class="bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded font-bold shadow-md text-sm flex items-center gap-2">' +
            '<i class="fa-solid fa-plus"></i> 제품 입고</button>';
    }
    
    if (tab === 'collections' || tab === 'cost_management') {
        return '';
    }
    
    if (tab === 'memos') {
        return '<button onclick="openNewModal(\'memos\')" class="' + commonBtnClass + '">' +
            '<i class="fa-solid fa-plus"></i> 신규 메모 등록</button>';
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
        price_list: '<thead><tr><th style="width:12%">품목코드</th><th style="width:18%">품목명</th><th>규격</th><th style="width:12%">제조사</th><th style="width:7%">단위</th><th style="width:14%">단가</th><th style="width:13%">통화</th><th style="width:10%">관리</th></tr></thead>',
        purchase_orders: '<thead><tr><th style="width:10%">PO#</th><th style="width:10%">납품업체</th><th style="width:8%">EndUser</th><th style="width:12%">품목요약</th><th style="width:8%">총액</th><th style="width:7%">발주일</th><th style="width:7%">입고일</th><th style="width:7%">결제조건</th><th style="width:8%">송금예정일</th><th style="width:5%">송금완료</th><th style="width:7%">송금액</th><th style="width:11%">관리</th></tr></thead>',
        purchases: '<thead><tr><th style="width:10%">일자</th><th style="width:10%">제조사</th><th style="width:15%">매입처</th><th>품목명</th><th style="width:6%">수량</th><th style="width:10%">단가</th><th style="width:10%">합계</th><th style="width:10%">시리얼</th><th style="width:10%">관리</th></tr></thead>',
        inventory: '<thead><tr><th>품목명</th><th style="width:10%">제조사</th><th style="width:12%">입고처</th><th style="width:10%">입고단가</th><th style="width:8%">총재고</th><th style="width:8%">가용재고</th><th>비고</th><th style="width:10%">예약</th><th style="width:10%">관리</th></tr></thead>',
        collections: '<thead><tr><th style="width:10%">판매일자</th><th style="width:15%">거래처</th><th style="width:15%">매출총액(VAT포함)</th><th style="width:15%">기수금액</th><th style="width:15%">미수금(잔액)</th><th>비고</th><th style="width:10%">관리</th></tr></thead>',
        bookkeeping: '<thead><tr><th style="width:10%">일자</th><th style="width:12%">계정과목</th><th style="width:20%">사용처(적요)</th><th style="width:10%">결제수단</th><th style="width:12%">금액</th><th>비고</th><th style="width:15%">관리</th></tr></thead>',
        meeting_logs: '<thead><tr><th style="width:12%">미팅날짜</th><th style="width:15%">업체명</th><th style="width:15%">참석자</th><th>미팅 내용 (요약)</th><th style="width:20%">향후 계획</th><th style="width:10%">관리</th></tr></thead>',
        cost_management: '<thead><tr><th style="width:10%">주문일자</th><th style="width:15%">거래처</th><th style="width:20%">주문명(대표품목)</th><th style="width:12%">총 매출액(VAT제외)</th><th style="width:12%">총 원가(입력)</th><th style="width:12%">마진금액</th><th style="width:8%">마진율</th><th style="width:10%">관리</th></tr></thead>',
        rentals: '<thead><tr><th style="width:9%">대여번호</th><th style="width:6%">대여일자</th><th style="width:9%">거래처</th><th style="width:7%">담당자</th><th style="width:7%">대여 목적</th><th style="width:11%">품목 요약</th><th style="width:6%">총 수량</th><th style="width:7%">회수예정일</th><th style="width:7%">상태</th><th style="width:7%">실제 회수일</th><th style="width:13%">비고</th><th style="width:11%">관리</th></tr></thead>',
        projects: '<thead><tr><th style="width:15%">프로젝트명</th><th style="width:10%">고객사</th><th style="width:8%">상태</th><th style="width:15%">진척도</th><th style="width:8%">EndUser</th><th style="width:10%">검사 종류</th><th style="width:15%">광학 조건</th><th>비고</th><th style="width:10%">관리</th></tr></thead>',
        sales: '<thead><tr><th style="width:10%">일자</th><th style="width:15%">거래처</th><th style="width:10%">담당자</th><th style="width:10%">공급가액</th><th style="width:10%">부가세</th><th style="width:10%">합계</th><th style="width:15%">비고</th><th style="width:8%">계산서</th><th style="width:12%">관리</th></tr></thead>'
    };
    var defaultStructure = '<thead><tr><th style="width:10%">일자</th><th style="width:18%">거래처</th><th style="width:12%">담당자</th><th style="width:12%">공급가액</th><th style="width:10%">부가세</th><th style="width:12%">합계</th><th>비고</th><th style="width:15%">관리</th></tr></thead>';
    return structures[tab] || defaultStructure;
}

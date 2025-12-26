// js/config.js - Supabase 설정 및 공통 함수

const SUPABASE_URL = 'https://gqttpmdpqotrkbdbstuu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdxdHRwbWRwcW90cmtiZGJzdHV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzNjU4MjIsImV4cCI6MjA3ODk0MTgyMn0.pR6dL8yU2lpugzYWpdDkQh_l5WcVO4YMlOPhMlCJmP8';

var supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// 전역 상태 저장소
var AppState = {
    currentTab: 'dashboard',
    currentEditId: null,
    currentUserEmail: '',
    tempItems: [],
    partnerList: [],
    productList: [],
    globalDataStore: {},
    sessionTimer: null,
    
    // 캐시 저장소
    cache: {},
    cacheTime: {},
    
    // 캘린더 관련
    calendar: {
        currentYear: new Date().getFullYear(),
        currentMonth: new Date().getMonth(),
        events: [],
        selectedColor: 'green',
        editingEventId: null
    }
};

// 캐시 유효 시간 (5분)
var CACHE_DURATION = 5 * 60 * 1000;

// 명언 목록
var QUOTES = [
    "할 수 있다고 믿는다면, 이미 절반은 해낸 것이다.",
    "위대한 업적은 대개 커다란 위험을 감수한 결과이다.",
    "실패는 성공으로 가는 이정표이다.",
    "오늘 걷지 않으면 내일은 뛰어야 한다.",
    "작은 기회로부터 종종 위대한 업적이 시작된다.",
    "성공의 비결은 시작하는 것이다.",
    "준비된 자에게만 기회가 온다.",
    "꿈을 꿀 수 있다면, 이룰 수도 있다.",
    "최고의 복수는 엄청난 성공이다.",
    "미래는 현재 우리가 무엇을 하는가에 달려 있다."
];

// 탭별 제목 매핑
var TAB_TITLES = {
    partners: '거래처 관리',
    products: '품목 관리',
    purchase_orders: '발주 관리 (PO)',
    purchases: '구매 관리 (입고)',
    inventory: '재고 관리 현황',
    quotes: '견적 관리',
    orders: '주문 관리 (수주)',
    sales: '판매 관리 (출고)',
    collections: '수금 관리',
    bookkeeping: '기장 관리 (지출/비용)',
    cost_management: '원가 관리 (마진 분석)',
    meeting_logs: '미팅 일지 (영업 활동)',
    memos: '메모장'
};

// ========== 캐시 관련 공통 함수 ==========

/**
 * 캐시가 유효한지 체크
 */
function isCacheValid(tabName) {
    if (!AppState.cache[tabName] || !AppState.cacheTime[tabName]) {
        return false;
    }
    return (Date.now() - AppState.cacheTime[tabName]) < CACHE_DURATION;
}

/**
 * 캐시 저장
 */
function setCache(tabName, data) {
    AppState.cache[tabName] = data;
    AppState.cacheTime[tabName] = Date.now();
}

/**
 * 캐시 가져오기
 */
function getCache(tabName) {
    return AppState.cache[tabName];
}

/**
 * 특정 탭 캐시 삭제
 */
function clearCache(tabName) {
    delete AppState.cache[tabName];
    delete AppState.cacheTime[tabName];
}

/**
 * 전체 캐시 삭제
 */
function clearAllCache() {
    AppState.cache = {};
    AppState.cacheTime = {};
}

// ========== 데이터 조회 공통 함수 ==========

/**
 * 공통 검색 함수 (캐싱 자동 적용)
 * @param {string} tabName - 탭/테이블 이름
 * @param {Promise} queryPromise - Supabase 쿼리 Promise
 * @param {Function} renderFn - 렌더링 함수
 * @param {number} colspan - 로딩 표시용 컬럼 수
 * @param {boolean} forceRefresh - 강제 새로고침 여부
 */
async function cachedSearch(tabName, queryPromise, renderFn, colspan, forceRefresh) {
    colspan = colspan || 10;
    forceRefresh = forceRefresh || false;
    
    // 캐시 체크 (강제 새로고침이 아닐 때만)
    if (!forceRefresh && isCacheValid(tabName)) {
        console.log(tabName + ' 캐시 데이터 사용');
        renderFn(getCache(tabName));
        return;
    }
    
    // 로딩 표시
    showTableLoading(colspan);
    
    try {
        var result = await queryPromise;
        
        if (result.error) {
            alert("검색 실패: " + result.error.message);
            return;
        }
        
        // 캐시 저장
        setCache(tabName, result.data);
        
        // 렌더링
        renderFn(result.data);
        
    } catch (e) {
        console.error(tabName + ' search error:', e);
        alert("검색 중 오류 발생");
    }
}

/**
 * 저장/삭제 후 공통 처리
 * @param {string} tabName - 탭 이름
 * @param {boolean} refreshMaster - 마스터 데이터도 새로고침할지
 */
async function afterDataChange(tabName, refreshMaster) {
    // 해당 탭 캐시 삭제
    clearCache(tabName);
    
    // 마스터 데이터 새로고침 (거래처, 품목 변경 시)
    if (refreshMaster) {
        await fetchMasterData(true);
    }
    
    // 모달 닫기
    closeModal();
    
    // 현재 탭 데이터 새로고침
    await runSearch(tabName, true);
}

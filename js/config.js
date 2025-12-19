// js/config.js - Supabase 설정
const SUPABASE_URL = 'https://gqttpmdpqotrkbdbstuu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdxdHRwbWRwcW90cmtiZGJzdHV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzNjU4MjIsImV4cCI6MjA3ODk0MTgyMn0.pR6dL8yU2lpugzYWpdDkQh_l5WcVO4YMlOPhMlCJmP8';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// 전역 상태 저장소
const AppState = {
    currentTab: 'dashboard',
    currentEditId: null,
    currentUserEmail: '',
    tempItems: [],
    partnerList: [],
    productList: [],
    globalDataStore: {},
    sessionTimer: null,
    
    // 캘린더 관련
    calendar: {
        currentYear: new Date().getFullYear(),
        currentMonth: new Date().getMonth(),
        events: [],
        selectedColor: 'green',
        editingEventId: null
    }
};

// 명언 목록
const QUOTES = [
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
const TAB_TITLES = {
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
    meeting_logs: '미팅 일지 (영업 활동)'
};

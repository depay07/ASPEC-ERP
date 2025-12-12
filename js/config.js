const SUPABASE_URL = 'https://gqttpmdpqotrkbdbstuu.supabase.co'; 
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdxdHRwbWRwcW90cmtiZGJzdHV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzNjU4MjIsImV4cCI6MjA3ODk0MTgyMn0.pR6dL8yU2lpugzYWpdDkQh_l5WcVO4YMlOPhMlCJmP8'; 
if(!SUPABASE_URL || SUPABASE_URL.includes('YOUR_URL')) alert("API 키를 설정해주세요.");

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// 전역 변수들
let currentTab = 'dashboard';
let tempItems = []; 
let partnerList = []; 
let productList = [];
let currentEditId = null; 
let currentUserEmail = ""; 
let globalDataStore = {};
let sessionTimer;
let currentLoadedOrderId = null; 
let currentLoadSource = '';      
let draggedItemIndex = null;

// 명언 데이터
const quotes = [
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

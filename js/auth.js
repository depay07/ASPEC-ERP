// js/auth.js - 인증 관련

/**
 * 초기 인증 체크 및 앱 시작
 */
async function initializeApp() {
    try {
        var result = await supabaseClient.auth.getUser();
        var user = result.data.user;
        
        if (!user) {
            alert("로그인이 필요합니다.");
            window.location.href = 'index.html';
            return false;
        }
        
        AppState.currentUserEmail = user.email;
        startSessionTimer();
        await fetchMasterData(true); // 최초는 강제 로드
        return true;
        
    } catch (e) {
        console.error("초기화 오류:", e);
        return false;
    }
}

/**
 * 마스터 데이터 로드 (거래처, 품목) - 캐싱 적용
 */
async function fetchMasterData(forceRefresh) {
    forceRefresh = forceRefresh || false;
    
    // 강제 새로고침이 아니고, 이미 데이터가 있으면 스킵
    if (!forceRefresh && AppState.partnerList.length > 0 && AppState.productList.length > 0) {
        console.log("마스터 데이터 캐시 사용");
        return;
    }
    
    try {
        console.log("마스터 데이터 로드 중...");
        
        var results = await Promise.all([
            supabaseClient.from('partners').select('*'),
            supabaseClient.from('products').select('*').order('name')
        ]);
        
        var partnersRes = results[0];
        var productsRes = results[1];
        
        if (!partnersRes.error) AppState.partnerList = partnersRes.data || [];
        if (!productsRes.error) AppState.productList = productsRes.data || [];
        
        console.log("마스터 데이터 로드 완료");
    } catch (e) {
        console.error("fetchMasterData 오류:", e);
    }
}

/**
 * 세션 타이머 시작 (30분)
 */
function startSessionTimer() {
    clearTimeout(AppState.sessionTimer);
    
    AppState.sessionTimer = setTimeout(function() {
        if (confirm("로그인 시간이 30분 지났습니다. 연장하시겠습니까?")) {
            startSessionTimer();
        } else {
            logout();
        }
    }, 30 * 60 * 1000);
}

/**
 * 로그아웃
 */
async function logout() {
    await supabaseClient.auth.signOut();
    window.location.href = 'index.html';
}

// js/utils.js - 공통 유틸리티 함수

/**
 * 요소의 값을 가져오기
 */
function el(id) {
    const element = document.getElementById(id);
    return element ? element.value : '';
}

/**
 * 데이터를 전역 저장소에 저장하고 ID 반환
 */
function storeRowData(row) {
    const id = 'row_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    AppState.globalDataStore[id] = row;
    return id;
}

/**
 * 저장소에서 데이터 가져오기
 */
function getRowData(id) {
    return AppState.globalDataStore[id];
}

/**
 * Datalist 채우기
 */
function fillDatalist(id, list) {
    const dl = document.getElementById(id);
    if (dl) {
        dl.innerHTML = list.map(i => `<option value="${i.name}">`).join('');
    }
}

/**
 * 숫자 포맷팅 (천단위 콤마)
 */
function formatNumber(num) {
    return (num || 0).toLocaleString();
}

/**
 * 오늘 날짜 (YYYY-MM-DD)
 */
function getToday() {
    return new Date().toISOString().split('T')[0];
}

/**
 * 날짜 범위 계산 (기본 1년 전 ~ 오늘)
 */
function getDefaultDateRange(yearsBack = 1) {
    const today = new Date();
    const startDate = new Date();
    startDate.setFullYear(today.getFullYear() - yearsBack);
    
    return {
        start: startDate.toISOString().split('T')[0],
        end: today.toISOString().split('T')[0]
    };
}

/**
 * 탭별 제목 가져오기
 */
function getTabTitle(tab) {
    return TAB_TITLES[tab] || '';
}

/**
 * 검색 Enter 키 처리
 */
function handleSearchKeyPress(event, tab) {
    if (event.key === 'Enter') {
        runSearch(tab);
    }
}

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
 * HTML에 텍스트를 안전하게 표시하기
 */
function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * HTML 속성에 값을 안전하게 넣기
 */
function escapeAttr(value) {
    return escapeHtml(value);
}

// 네트워크 응답 전 같은 저장 작업이 다시 실행되는 것을 방지합니다.
var activeSaveActions = new Set();

async function runSaveOnce(key, button, action) {
    const lockKey = String(key);
    if (activeSaveActions.has(lockKey)) return false;

    activeSaveActions.add(lockKey);

    const originalHtml = button ? button.innerHTML : '';
    if (button) {
        button.disabled = true;
        button.setAttribute('aria-busy', 'true');
        button.classList.add('opacity-60', 'cursor-wait');
        button.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i>저장 중...';
    }

    try {
        return await action();
    } catch (error) {
        console.error('저장 처리 오류:', error);
        alert('저장 처리 중 오류가 발생했습니다: ' + (error?.message || error));
        return false;
    } finally {
        activeSaveActions.delete(lockKey);

        if (button && button.isConnected) {
            button.disabled = false;
            button.removeAttribute('aria-busy');
            button.classList.remove('opacity-60', 'cursor-wait');
            button.innerHTML = originalHtml;
        }
    }
}

/**
 * Datalist 채우기
 */
function fillDatalist(id, list) {
    const dl = document.getElementById(id);
    if (dl) {
        dl.innerHTML = list.map(i => `<option value="${escapeAttr(i.name)}">`).join('');
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
    return formatDateInTimeZone(new Date());
}

/**
 * 지정 시간대 기준 날짜 문자열 (YYYY-MM-DD)
 */
function formatDateInTimeZone(date, timeZone = 'Asia/Seoul') {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(date);
    
    const values = {};
    parts.forEach(part => {
        if (part.type !== 'literal') values[part.type] = part.value;
    });
    
    return `${values.year}-${values.month}-${values.day}`;
}

/**
 * YYYY-MM-DD 문자열을 시간대 변환 없이 날짜 구성요소로 분해
 */
function parseDateString(dateStr) {
    const [year, month, day] = String(dateStr || '').split('-').map(Number);
    return {
        year: year || 0,
        month: month || 0,
        day: day || 0
    };
}

/**
 * 날짜 범위 계산 (기본 1년 전 ~ 오늘)
 */
function getDefaultDateRange(yearsBack = 1) {
    const todayStr = getToday();
    const todayParts = parseDateString(todayStr);
    const startYear = todayParts.year - yearsBack;
    
    return {
        start: `${startYear}-${String(todayParts.month).padStart(2, '0')}-${String(todayParts.day).padStart(2, '0')}`,
        end: todayStr
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

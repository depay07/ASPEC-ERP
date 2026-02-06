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
// ==========================================
// [추가 기능] 품목 자동완성 및 순서변경 유틸리티
// ==========================================

const ItemGridHelper = {
    /**
     * 기능 초기화 (모달 열릴 때 호출)
     * @param {string} tbodyId - 품목 리스트가 들어가는 tbody의 ID (보통 itemGrid 또는 listBody)
     */
    init(tbodyId) {
        const tbody = document.getElementById(tbodyId);
        if (!tbody) return;

        // 1. 드래그 앤 드롭 기능 활성화
        this.enableDragSort(tbody);

        // 2. 자동완성(데이터 채우기) 이벤트 연결
        // 기존 이벤트가 중복되지 않도록 한 번 제거 후 연결
        tbody.removeEventListener('input', this.handleInput);
        tbody.addEventListener('input', this.handleInput);
    },

    /**
     * 입력 감지 및 자동 채우기 핸들러
     */
    handleInput(e) {
        // 품목명 입력칸인지 확인 (name이 item_name[] 이거나 클래스에 item-name이 포함된 경우)
        // DocumentBaseModule의 정확한 구조를 몰라 일반적인 이름으로 체크합니다.
        const input = e.target;
        
        // 입력 필드가 품목명인지 체크 (name 속성이나 class 등으로 확인)
        // 보통 name="items[][name]" 형태이거나 name="item_name[]" 형태일 것입니다.
        const isNameField = input.name && (input.name.includes('name') || input.name.includes('item'));
        
        if (!isNameField || !input.list) return; // list 속성(datalist)이 연결된 input만 처리

        const val = input.value;
        // 전역 제품 목록에서 일치하는 것 찾기
        const product = AppState.productList.find(p => p.name === val);

        if (product) {
            const row = input.closest('tr');
            
            // 규격(Spec) 채우기
            const specInput = row.querySelector('input[name*="spec"]');
            if (specInput) specInput.value = product.spec || '';

            // 단위(Unit) 채우기
            const unitInput = row.querySelector('input[name*="unit"]');
            if (unitInput) unitInput.value = product.unit || 'EA';

            // 단가(Price) 채우기 (단가가 있다면)
            const priceInput = row.querySelector('input[name*="price"]');
            if (priceInput && product.price) priceInput.value = product.price; // product에 price가 있다면
        }
    },

    /**
     * 심플 드래그 앤 드롭 (라이브러리 없이 구현)
     */
    enableDragSort(tbody) {
        let draggedRow = null;

        // 기존 행들에 드래그 속성 추가
        const rows = tbody.querySelectorAll('tr');
        rows.forEach(row => {
            row.setAttribute('draggable', 'true');
            row.style.cursor = 'move';
            row.classList.add('cursor-move'); // Tailwind 클래스
        });

        // 이벤트 위임 (동적으로 추가된 행도 처리하기 위해 tbody에 검)
        tbody.addEventListener('dragstart', (e) => {
            if (e.target.tagName !== 'TR') return;
            draggedRow = e.target;
            e.target.classList.add('bg-slate-100'); // 드래그 중 스타일
            e.dataTransfer.effectAllowed = 'move';
        });

        tbody.addEventListener('dragend', (e) => {
            if (e.target.tagName !== 'TR') return;
            e.target.classList.remove('bg-slate-100');
            draggedRow = null;
        });

        tbody.addEventListener('dragover', (e) => {
            e.preventDefault();
            const targetRow = e.target.closest('tr');
            if (!targetRow || targetRow === draggedRow || !tbody.contains(targetRow)) return;

            // 마우스 위치에 따라 위/아래 판단
            const bounding = targetRow.getBoundingClientRect();
            const offset = bounding.y + (bounding.height / 2);
            
            if (e.clientY - offset > 0) {
                targetRow.after(draggedRow);
            } else {
                targetRow.before(draggedRow);
            }
        });
        
        // 행이 추가될 때(동적 추가)를 감지하여 draggable 속성 부여 (MutationObserver)
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.tagName === 'TR') {
                        node.setAttribute('draggable', 'true');
                        node.style.cursor = 'move';
                        node.classList.add('cursor-move');
                    }
                });
            });
        });
        
        observer.observe(tbody, { childList: true });
    }
};

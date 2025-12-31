// js/modules/sales.js - 판매 관리 모듈 (수정됨)

const SalesModule = {
    tableName: 'sales',
    currentLoadedOrderId: null,
    
    /**
     * 검색
     */
    async search() {
        const data = await DocumentBaseModule.baseSearch(this.tableName);
        if (data) this.renderTable(data);
    },
    
    /**
     * 테이블 렌더링 (수정됨: 계산서 발행 아이콘 추가)
     */
    renderTable(data) {
        const tbody = document.getElementById('listBody');
        
        if (!data || data.length === 0) {
            showEmptyTable(9); // 컬럼이 9개로 늘어남
            return;
        }
        
        tbody.innerHTML = data.map(row => {
            const dataId = storeRowData(row);
            
            // 계산서 발행 여부 아이콘 (DB 컬럼명이 is_tax_invoice 라고 가정)
            // true면 초록색, false면 주황색
            const taxIcon = row.is_tax_invoice 
                ? '<i class="fa-solid fa-circle text-green-500" title="발행완료"></i>' 
                : '<i class="fa-solid fa-circle text-orange-500" title="미발행"></i>';

            return `
            <tr class="hover:bg-slate-50 border-b transition text-sm">
                <td class="text-center p-2">${row.date}</td>
                <td class="text-center font-bold p-2">${row.partner_name}</td>
                <td class="text-center p-2 text-xs">${row.manager || '-'}</td>
                <td class="text-right p-2 text-slate-600">${formatNumber(row.total_supply)}</td>
                <td class="text-right p-2 text-slate-400 text-xs">${formatNumber(row.total_vat)}</td>
                <td class="text-right p-2 font-bold">${formatNumber(row.total_amount)}</td>
                <td class="text-left p-2 text-xs truncate max-w-[150px]">${row.note || ''}</td>
                
                <!-- 새로 추가된 계산서 상태 컬럼 -->
                <td class="text-center p-2 text-lg">${taxIcon}</td>
                
                <td class="p-2">
                    <div class="flex justify-center items-center gap-2">
                        <button onclick="printDocument('sales', '${dataId}')" class="text-slate-600 hover:text-black p-1" title="인쇄"><i class="fa-solid fa-print"></i></button>
                        <button onclick="SalesModule.duplicate('${dataId}')" class="text-green-600 hover:text-green-800 p-1" title="복사"><i class="fa-regular fa-copy"></i></button>
                        <button onclick="SalesModule.openEditModal('${dataId}')" class="text-blue-500 hover:text-blue-700 p-1" title="수정"><i class="fa-solid fa-pen-to-square"></i></button>
                        <button onclick="SalesModule.delete(${row.id})" class="text-red-400 hover:text-red-600 p-1" title="삭제"><i class="fa-solid fa-trash-can"></i></button>
                    </div>
                </td>
            </tr>`;
        }).join('');
    },
    
    /**
     * [헬퍼] 모달창에 '계산서 발행' 체크박스 UI 주입
     */
    _injectTaxCheckbox(isChecked = false) {
        // 모달 내 '비고' 입력란을 찾아서 그 근처나, 폼 상단 적절한 위치에 체크박스를 추가
        const modalBody = document.getElementById('modalBody');
        if (!modalBody) return;

        // 예시: 폼 최상단이나 비고 근처에 HTML 삽입
        // 여기서는 눈에 잘 띄게 폼 맨 위에 박스를 하나 추가합니다.
        const checkboxHtml = `
            <div class="bg-yellow-50 p-2 rounded border border-yellow-200 mb-3 flex items-center justify-between">
                <span class="text-sm font-bold text-slate-700">세금계산서 발행 여부</span>
                <label class="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" id="chkTaxInvoice" class="w-5 h-5 text-blue-600 rounded focus:ring-blue-500" ${isChecked ? 'checked' : ''}>
                    <span class="text-xs text-slate-600">발행 완료시 체크 (초록색 표시)</span>
                </label>
            </div>
        `;
        
        // 모달 바디의 맨 처음에 삽입
        modalBody.insertAdjacentHTML('afterbegin', checkboxHtml);
    },

    /**
     * 신규 등록 모달
     */
    openNewModal() {
        AppState.currentEditId = null;
        AppState.tempItems = [];
        this.currentLoadedOrderId = null;
        openModal('판매 등록');
        
        const loadBtn = `<button onclick="SalesModule.openLoadModal()" class="bg-orange-500 text-white px-3 py-1 rounded text-xs font-bold ml-2 hover:bg-orange-600">
            <i class="fa-solid fa-cloud-arrow-down"></i> 주문서 불러오기
        </button>`;
        
        const body = document.getElementById('modalBody');
        // 기본 폼 생성
        body.innerHTML = DocumentBaseModule.getDocumentFormHtml('sales', loadBtn);
        
        // ★ 체크박스 UI 추가 (기본값: 체크해제)
        this._injectTaxCheckbox(false);

        fillDatalist('dl_part_doc', AppState.partnerList);
        fillDatalist('dl_prod_doc', AppState.productList);
        DocumentBaseModule.renderItemGrid();
    },
    
    // ... openLoadModal, loadFromOrder 함수는 기존과 동일 ...
    async openLoadModal() {
        const modal = document.getElementById('loadDataModal');
        document.getElementById('loadModalTitle').innerText = '주문서 불러오기';
        const { data } = await supabaseClient.from('orders').select('*').order('created_at', { ascending: false }).limit(50);
        const tbody = document.getElementById('loadDataBody');
        tbody.innerHTML = (data || []).map(row => `
            <tr class="hover:bg-slate-50 cursor-pointer" onclick="SalesModule.loadFromOrder(${row.id})">
                <td class="p-3">${row.date}</td><td class="p-3 font-bold">${row.partner_name}</td>
                <td class="p-3 text-right">${formatNumber(row.total_amount)}</td>
                <td class="p-3"><button class="bg-blue-500 text-white px-3 py-1 rounded text-xs font-bold">선택</button></td>
            </tr>`).join('');
        modal.classList.add('active');
    },
    
    async loadFromOrder(orderId) {
        const { data } = await supabaseClient.from('orders').select('*').eq('id', orderId).single();
        if (data) {
            this.currentLoadedOrderId = orderId;
            DocumentBaseModule.fillFormData(data);
            document.getElementById('sDate').value = getToday();
        }
        document.getElementById('loadDataModal').classList.remove('active');
    },

    /**
     * 수정 모달
     */
    openEditModal(dataId) {
        const row = getRowData(dataId);
        if (!row) return alert('데이터 오류');
        
        AppState.currentEditId = row.id;
        openModal('판매 수정');
        
        const body = document.getElementById('modalBody');
        body.innerHTML = DocumentBaseModule.getDocumentFormHtml('sales');
        
        // ★ 체크박스 UI 추가 및 값 설정
        // DB에 저장된 값이 true면 체크, 없으면 해제
        this._injectTaxCheckbox(row.is_tax_invoice === true);
        
        DocumentBaseModule.fillFormData(row);
    },
    
    /**
     * 복사
     */
    duplicate(dataId) {
        const row = getRowData(dataId);
        if (!row) return alert('데이터 오류');
        
        AppState.currentEditId = null;
        this.currentLoadedOrderId = null;
        openModal('판매 복사 등록');
        
        const body = document.getElementById('modalBody');
        body.innerHTML = DocumentBaseModule.getDocumentFormHtml('sales');
        
        // ★ 체크박스 UI 추가 (복사 시에는 기본적으로 체크 해제 상태로 두는 것이 일반적이나, 필요시 row.is_tax_invoice 전달)
        this._injectTaxCheckbox(false);
        
        DocumentBaseModule.fillFormData(row);
        document.getElementById('sDate').value = getToday();
    },
    
    /**
     * 저장 (수정됨: 체크박스 값 포함)
     */
    async save() {
        const data = DocumentBaseModule.buildSaveData('sales');
        if (!data) return;
        
        // ★ 체크박스 값 읽어서 데이터 객체에 추가
        const chk = document.getElementById('chkTaxInvoice');
        data.is_tax_invoice = chk ? chk.checked : false;
        
        let result;
        if (AppState.currentEditId) {
            result = await supabaseClient
                .from(this.tableName)
                .update(data)
                .eq('id', AppState.currentEditId);
        } else {
            result = await supabaseClient
                .from(this.tableName)
                .insert(data);
            
            // 신규 판매 시 재고 차감 (기존 로직 유지)
            if (!result.error) {
                await this.deductStock(data.items);
                if (this.currentLoadedOrderId) {
                    await supabaseClient.from('orders').update({ status: 'completed' }).eq('id', this.currentLoadedOrderId);
                    this.currentLoadedOrderId = null;
                }
            }
        }
        
        if (result.error) {
            alert("저장 실패: " + result.error.message);
            return;
        }
        
        alert("저장되었습니다.");
        closeModal();
        await fetchMasterData(); // 재고 등 갱신
        this.search();
    },
    
    // ... deductStock, delete 함수는 기존 코드 유지 ...
    async deductStock(items) {
        const { data: bomList } = await supabaseClient.from('bom').select('*');
        for (const item of items) {
            const relatedParts = bomList ? bomList.filter(b => b.parent_name === item.name) : [];
            if (relatedParts.length > 0) {
                for (const part of relatedParts) {
                    const childProd = AppState.productList.find(p => p.name === part.child_name);
                    if (childProd) {
                        await supabaseClient.from('products').update({ stock: (childProd.stock || 0) - (item.qty * part.qty) }).eq('id', childProd.id);
                    }
                }
            } else {
                const prod = AppState.productList.find(p => p.name === item.name);
                if (prod) {
                    await supabaseClient.from('products').update({ stock: (prod.stock || 0) - item.qty }).eq('id', prod.id);
                }
            }
        }
    },
    
    async delete(id) {
        if (!confirm("정말 삭제하시겠습니까?\n(재고가 복구됩니다)")) return;
        const { data: saleData } = await supabaseClient.from(this.tableName).select('items').eq('id', id).single();
        if (saleData && saleData.items) {
            for (const item of saleData.items) {
                const prod = AppState.productList.find(p => p.name === item.name);
                if (prod) {
                    await supabaseClient.from('products').update({ stock: (prod.stock || 0) + item.qty }).eq('id', prod.id);
                }
            }
        }
        const { error } = await supabaseClient.from(this.tableName).delete().eq('id', id);
        if (error) { alert("삭제 실패: " + error.message); return; }
        await fetchMasterData();
        this.search();
    }
};

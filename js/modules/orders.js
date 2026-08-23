// js/modules/orders.js - 주문 관리 모듈

const OrdersModule = {
    tableName: 'orders',

    calculateSummary(data) {
        return (data || []).reduce((total, row) => {
            return total + (Number(row.total_amount) || 0);
        }, 0);
    },

    hideSummary() {
        const summary = document.getElementById('ordersSummary');
        if (!summary) return;
        summary.classList.add('hidden');
        summary.innerHTML = '';
    },

    renderSummary(data) {
        const summary = document.getElementById('ordersSummary');
        if (!summary) return;

        const totalAmount = this.calculateSummary(data);
        const startDate = el('searchStartDate');
        const endDate = el('searchEndDate');

        summary.innerHTML = `
            <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
                <h3 class="font-bold text-slate-800">기간 조회 합계</h3>
                <span class="text-xs text-slate-500">${startDate} ~ ${endDate} · ${data.length}건</span>
            </div>
            <div class="p-4">
                <span class="block text-xs font-bold text-slate-500">합계금액</span>
                <strong class="mt-1 block text-lg text-blue-600">${formatNumber(totalAmount)}원</strong>
            </div>`;
        summary.classList.remove('hidden');
    },
    
    /**
     * 검색
     */
    async search(forceRefresh, showSummary) {
        this.hideSummary();
        const data = await DocumentBaseModule.baseSearch(this.tableName);
        if (data) {
            this.renderTable(data);
            if (showSummary) this.renderSummary(data);
        }
    },
    
    /**
     * 테이블 렌더링
     */
    renderTable(data) {
        const tbody = document.getElementById('listBody');
        
        if (!data || data.length === 0) {
            showEmptyTable(8);
            return;
        }
        
        tbody.innerHTML = data.map(row => 
            DocumentBaseModule.renderDocumentRow(row, 'orders')
        ).join('');
    },
    
    /**
     * 신규 등록 모달
     */
    openNewModal() {
        AppState.currentEditId = null;
        AppState.tempItems = [];
        openModal('주문 등록');
        
        const loadBtn = `<button onclick="OrdersModule.openLoadModal()" class="bg-orange-500 text-white px-3 py-1 rounded text-xs font-bold ml-2 hover:bg-orange-600">
            <i class="fa-solid fa-cloud-arrow-down"></i> 견적서 불러오기
        </button>`;
        
        const body = document.getElementById('modalBody');
        body.innerHTML = DocumentBaseModule.getDocumentFormHtml('orders', loadBtn);
        
        fillDatalist('dl_part_doc', AppState.partnerList);
        fillDatalist('dl_prod_doc', AppState.productList);
        DocumentBaseModule.renderItemGrid();
    },
    
    /**
     * 견적서 불러오기 모달
     */
    async openLoadModal() {
        const modal = document.getElementById('loadDataModal');
        document.getElementById('loadModalTitle').innerText = '견적서 불러오기';
        
        const { data } = await supabaseClient
            .from('quotes')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);
        
        const tbody = document.getElementById('loadDataBody');
        tbody.innerHTML = (data || []).map(row => `
            <tr class="hover:bg-slate-50 cursor-pointer" onclick="OrdersModule.loadFromQuote(${row.id})">
                <td class="p-3">${row.date}</td>
                <td class="p-3 font-bold">${row.partner_name}</td>
                <td class="p-3 text-right">${formatNumber(row.total_amount)}</td>
                <td class="p-3">
                    <button class="bg-blue-500 text-white px-3 py-1 rounded text-xs font-bold">선택</button>
                </td>
            </tr>
        `).join('');
        
        modal.classList.add('active');
    },
    
    /**
     * 견적서에서 불러오기
     */
    async loadFromQuote(quoteId) {
        const { data } = await supabaseClient
            .from('quotes')
            .select('*')
            .eq('id', quoteId)
            .single();
        
        if (data) {
            DocumentBaseModule.fillFormData(data, { date: getToday() });
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
        openModal('주문 수정');
        
        const body = document.getElementById('modalBody');
        body.innerHTML = DocumentBaseModule.getDocumentFormHtml('orders');
        
        DocumentBaseModule.fillFormData(row);
    },
    
    /**
     * 복사
     */
    duplicate(dataId) {
        const row = getRowData(dataId);
        if (!row) return alert('데이터 오류');
        
        AppState.currentEditId = null;
        openModal('주문 복사 등록');
        
        const body = document.getElementById('modalBody');
        body.innerHTML = DocumentBaseModule.getDocumentFormHtml('orders');
        
        DocumentBaseModule.fillFormData(row, { date: getToday() });
    },
    
    /**
     * 저장
     */
    async save() {
        const data = DocumentBaseModule.buildSaveData('orders');
        if (!data) return;
        
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
        }
        
        if (result.error) {
            alert("저장 실패: " + result.error.message);
            return;
        }
        
        alert("저장되었습니다.");
        closeModal();
        this.search();
    },
    
    /**
     * 삭제
     */
    async delete(id) {
        if (!confirm("정말 삭제하시겠습니까?")) return;
        
        const { error } = await supabaseClient
            .from(this.tableName)
            .delete()
            .eq('id', id);
        
        if (error) {
            alert("삭제 실패: " + error.message);
            return;
        }
        
        this.search();
    }
};

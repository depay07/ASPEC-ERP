// js/modules/quotes.js - 견적 관리 모듈

const QuotesModule = {
    tableName: 'quotes',
    
    /**
     * 검색
     */
    async search() {
        const data = await DocumentBaseModule.baseSearch(this.tableName);
        if (data) this.renderTable(data);
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
            DocumentBaseModule.renderDocumentRow(row, 'quotes')
        ).join('');
    },
    
    /**
     * 신규 등록 모달
     */
    openNewModal() {
        AppState.currentEditId = null;
        AppState.tempItems = [];
        openModal('견적 등록');
        
        const body = document.getElementById('modalBody');
        body.innerHTML = DocumentBaseModule.getDocumentFormHtml('quotes');
        
        fillDatalist('dl_part_doc', AppState.partnerList);
        fillDatalist('dl_prod_doc', AppState.productList);
        DocumentBaseModule.renderItemGrid();
    },
    
    /**
     * 수정 모달
     */
    openEditModal(dataId) {
        const row = getRowData(dataId);
        if (!row) return alert('데이터 오류');
        
        AppState.currentEditId = row.id;
        openModal('견적 수정');
        
        const body = document.getElementById('modalBody');
        body.innerHTML = DocumentBaseModule.getDocumentFormHtml('quotes');
        
        DocumentBaseModule.fillFormData(row);
    },
    
    /**
     * 복사
     */
    duplicate(dataId) {
        const row = getRowData(dataId);
        if (!row) return alert('데이터 오류');
        
        AppState.currentEditId = null;
        openModal('견적 복사 등록');
        
        const body = document.getElementById('modalBody');
        body.innerHTML = DocumentBaseModule.getDocumentFormHtml('quotes');
        
        DocumentBaseModule.fillFormData(row);
        document.getElementById('sDate').value = getToday();
    },
    
    /**
     * 저장
     */
    async save() {
        const data = DocumentBaseModule.buildSaveData('quotes');
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

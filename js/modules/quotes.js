// js/modules/quotes.js - 견적 관리 모듈 (수정됨)

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
     * 테이블 렌더링 (순서 강제 수정)
     */
    renderTable(data) {
        const tbody = document.getElementById('listBody');
        
        if (!data || data.length === 0) {
             if (typeof showEmptyTable === 'function') showEmptyTable(8);
             else tbody.innerHTML = '<tr><td colspan="8" class="p-8 text-center text-slate-400">데이터가 없습니다.</td></tr>';
            return;
        }
        
        // DocumentBaseModule.renderDocumentRow를 사용하지 않고 직접 매핑
        tbody.innerHTML = data.map(row => `
            <tr class="hover:bg-slate-50 border-b transition-colors">
                <td class="p-3 text-center text-slate-500">
                    ${row.date || (row.created_at ? row.created_at.substring(0, 10) : '-')}
                </td>
                
                <td class="p-3 font-bold text-slate-700">
                    ${row.partner_name || '-'}
                </td>
                
                <td class="p-3 text-center text-slate-600">
                    ${row.manager_name || '-'}
                </td>
                
                <td class="p-3 text-right font-mono text-blue-600 font-semibold">
                    ${(row.supply_price || 0).toLocaleString()}
                </td>
                
                <td class="p-3 text-right font-mono text-slate-500">
                    ${(row.vat_amount || 0).toLocaleString()}
                </td>
                
                <td class="p-3 text-right font-bold text-slate-800 font-mono">
                    ${(row.total_amount || 0).toLocaleString()}
                </td>
                
                <td class="p-3 text-slate-400 text-sm truncate max-w-[150px]">
                    ${row.remarks || ''}
                </td>
                
                <td class="p-3 text-center">
                    <div class="flex items-center justify-center gap-2">
                        <button onclick="DocumentBaseModule.print('${this.tableName}', ${row.id})" class="text-slate-400 hover:text-slate-600" title="인쇄">
                            <i class="fa-solid fa-print"></i>
                        </button>
                        <button onclick="QuotesModule.duplicate(${row.id})" class="text-green-400 hover:text-green-600" title="복사">
                            <i class="fa-solid fa-copy"></i>
                        </button>
                        <button onclick="QuotesModule.openEditModal(${row.id})" class="text-blue-400 hover:text-blue-600" title="수정">
                            <i class="fa-regular fa-pen-to-square"></i>
                        </button>
                        <button onclick="QuotesModule.delete(${row.id})" class="text-red-400 hover:text-red-600" title="삭제">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
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

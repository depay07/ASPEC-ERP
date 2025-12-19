// js/modules/sales.js - 판매 관리 모듈

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
     * 테이블 렌더링
     */
    renderTable(data) {
        const tbody = document.getElementById('listBody');
        
        if (!data || data.length === 0) {
            showEmptyTable(8);
            return;
        }
        
        tbody.innerHTML = data.map(row => 
            DocumentBaseModule.renderDocumentRow(row, 'sales')
        ).join('');
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
        body.innerHTML = DocumentBaseModule.getDocumentFormHtml('sales', loadBtn);
        
        fillDatalist('dl_part_doc', AppState.partnerList);
        fillDatalist('dl_prod_doc', AppState.productList);
        DocumentBaseModule.renderItemGrid();
    },
    
    /**
     * 주문서 불러오기 모달
     */
    async openLoadModal() {
        const modal = document.getElementById('loadDataModal');
        document.getElementById('loadModalTitle').innerText = '주문서 불러오기';
        
        const { data } = await supabaseClient
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);
        
        const tbody = document.getElementById('loadDataBody');
        tbody.innerHTML = (data || []).map(row => `
            <tr class="hover:bg-slate-50 cursor-pointer" onclick="SalesModule.loadFromOrder(${row.id})">
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
     * 주문서에서 불러오기
     */
    async loadFromOrder(orderId) {
        const { data } = await supabaseClient
            .from('orders')
            .select('*')
            .eq('id', orderId)
            .single();
        
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
        
        DocumentBaseModule.fillFormData(row);
        document.getElementById('sDate').value = getToday();
    },
    
    /**
     * 저장
     */
    async save() {
        const data = DocumentBaseModule.buildSaveData('sales');
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
            
            // 신규 판매 시 재고 차감
            if (!result.error) {
                await this.deductStock(data.items);
                
                // 주문서 상태 업데이트
                if (this.currentLoadedOrderId) {
                    await supabaseClient
                        .from('orders')
                        .update({ status: 'completed' })
                        .eq('id', this.currentLoadedOrderId);
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
        await fetchMasterData();
        this.search();
    },
    
    /**
     * 재고 차감
     */
    async deductStock(items) {
        const { data: bomList } = await supabaseClient.from('bom').select('*');
        
        for (const item of items) {
            const relatedParts = bomList ? bomList.filter(b => b.parent_name === item.name) : [];
            
            if (relatedParts.length > 0) {
                // BOM(세트) 품목인 경우
                for (const part of relatedParts) {
                    const childProd = AppState.productList.find(p => p.name === part.child_name);
                    if (childProd) {
                        await supabaseClient
                            .from('products')
                            .update({ stock: (childProd.stock || 0) - (item.qty * part.qty) })
                            .eq('id', childProd.id);
                    }
                }
            } else {
                // 일반 품목
                const prod = AppState.productList.find(p => p.name === item.name);
                if (prod) {
                    await supabaseClient
                        .from('products')
                        .update({ stock: (prod.stock || 0) - item.qty })
                        .eq('id', prod.id);
                }
            }
        }
    },
    
    /**
     * 삭제 (재고 복구 포함)
     */
    async delete(id) {
        if (!confirm("정말 삭제하시겠습니까?\n(재고가 복구됩니다)")) return;
        
        // 삭제 전 재고 복구
        const { data: saleData } = await supabaseClient
            .from(this.tableName)
            .select('items')
            .eq('id', id)
            .single();
        
        if (saleData && saleData.items) {
            for (const item of saleData.items) {
                const prod = AppState.productList.find(p => p.name === item.name);
                if (prod) {
                    await supabaseClient
                        .from('products')
                        .update({ stock: (prod.stock || 0) + item.qty })
                        .eq('id', prod.id);
                }
            }
        }
        
        const { error } = await supabaseClient
            .from(this.tableName)
            .delete()
            .eq('id', id);
        
        if (error) {
            alert("삭제 실패: " + error.message);
            return;
        }
        
        await fetchMasterData();
        this.search();
    }
};

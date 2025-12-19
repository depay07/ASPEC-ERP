// js/modules/inventory.js - 재고 관리 모듈

const InventoryModule = {
    
    /**
     * 검색 (재고 현황 로드)
     */
    async search() {
        showTableLoading(9);
        
        // 품목 목록 조회
        let query = supabaseClient
            .from('products')
            .select('*')
            .order('name');
        
        // 필터
        const nameFilter = el('search_sName');
        const codeFilter = el('search_sCode');
        
        if (nameFilter) query = query.ilike('name', `%${nameFilter}%`);
        if (codeFilter) query = query.ilike('code', `%${codeFilter}%`);
        
        const { data: products, error } = await query;
        
        if (error) {
            alert("검색 실패: " + error.message);
            return;
        }
        
        // 예약 수량 조회 (주문 중 미출고)
        const { data: orders } = await supabaseClient
            .from('orders')
            .select('items')
            .neq('status', 'completed');
        
        // 예약 수량 계산
        const reservedQty = {};
        if (orders) {
            orders.forEach(order => {
                if (order.items) {
                    order.items.forEach(item => {
                        reservedQty[item.name] = (reservedQty[item.name] || 0) + (item.qty || 0);
                    });
                }
            });
        }
        
        // 재고 0 제외 필터
        let resultData = products || [];
        const hideZero = document.getElementById('hideZeroStock')?.checked;
        if (hideZero) {
            resultData = resultData.filter(p => (p.stock || 0) > 0);
        }
        
        this.renderTable(resultData, reservedQty);
    },
    
    /**
     * 테이블 렌더링
     */
    renderTable(data, reservedQty = {}) {
        const tbody = document.getElementById('listBody');
        
        if (!data || data.length === 0) {
            showEmptyTable(9);
            return;
        }
        
        tbody.innerHTML = data.map(row => {
            const totalStock = row.stock || 0;
            const reserved = reservedQty[row.name] || 0;
            const available = totalStock - reserved;
            
            const availableClass = available <= 0 ? 'text-red-600 font-bold' : 
                                   available <= 5 ? 'text-orange-500 font-bold' : 
                                   'text-green-600 font-bold';
            
            return `
                <tr class="hover:bg-slate-50 border-b transition">
                    <td class="font-bold">${row.name}</td>
                    <td class="text-center text-xs text-slate-500">${row.manufacturer || '-'}</td>
                    <td class="text-center">${row.last_vendor || '-'}</td>
                    <td class="text-right">${formatNumber(row.last_price)}</td>
                    <td class="text-center font-bold text-slate-700">${totalStock}</td>
                    <td class="text-center ${availableClass}">${available}</td>
                    <td class="text-xs text-slate-500">${row.last_serial_no || ''}</td>
                    <td class="text-center">
                        ${reserved > 0 ? `<span class="bg-orange-100 text-orange-700 px-2 py-1 rounded text-xs font-bold">${reserved}개 예약</span>` : '-'}
                    </td>
                    <td>${this.getActionButtons(row.id)}</td>
                </tr>`;
        }).join('');
    },
    
    /**
     * 액션 버튼
     */
    getActionButtons(rowId) {
        return `
            <div class="flex justify-center items-center gap-3">
                <button onclick="InventoryModule.openAdjustModal(${rowId})" class="text-blue-500 hover:text-blue-700 p-2 rounded hover:bg-blue-50 transition" title="재고 조정">
                    <i class="fa-solid fa-sliders fa-lg"></i>
                </button>
                <button onclick="InventoryModule.delete(${rowId})" class="text-red-400 hover:text-red-600 p-2 rounded hover:bg-red-50 transition" title="삭제">
                    <i class="fa-solid fa-trash-can fa-lg"></i>
                </button>
            </div>`;
    },
    
    /**
     * 재고 조정 모달
     */
    async openAdjustModal(productId) {
        const { data: product } = await supabaseClient
            .from('products')
            .select('*')
            .eq('id', productId)
            .single();
        
        if (!product) return alert('품목 정보를 찾을 수 없습니다.');
        
        openModal('재고 조정');
        
        const body = document.getElementById('modalBody');
        body.innerHTML = `
            <div class="bg-blue-50 p-4 rounded mb-4 border border-blue-200">
                <h3 class="font-bold text-blue-800 mb-2">${product.name}</h3>
                <p class="text-sm text-slate-600">현재 재고: <span class="font-bold text-xl text-blue-600">${product.stock || 0}</span>개</p>
            </div>
            
            <div class="grid grid-cols-2 gap-4 mb-4">
                <div>
                    <label class="text-xs font-bold text-slate-700">조정 유형</label>
                    <select id="adjustType" class="input-box" onchange="InventoryModule.updateAdjustPreview(${product.stock || 0})">
                        <option value="set">수량 직접 지정</option>
                        <option value="add">증가 (+)</option>
                        <option value="subtract">감소 (-)</option>
                    </select>
                </div>
                <div>
                    <label class="text-xs font-bold text-slate-700">수량</label>
                    <input type="number" id="adjustQty" class="input-box" value="0" min="0" 
                           oninput="InventoryModule.updateAdjustPreview(${product.stock || 0})">
                </div>
            </div>
            
            <div class="bg-slate-100 p-4 rounded mb-4">
                <p class="text-sm">조정 후 재고: <span id="adjustPreview" class="font-bold text-xl text-green-600">${product.stock || 0}</span>개</p>
            </div>
            
            <div class="mb-4">
                <label class="text-xs font-bold text-slate-700">조정 사유</label>
                <input id="adjustReason" class="input-box" placeholder="예: 재고 실사, 파손 등">
            </div>
            
            <button onclick="InventoryModule.saveAdjustment(${productId})" class="w-full bg-blue-600 text-white py-3 rounded font-bold hover:bg-blue-700 transition">
                재고 조정
            </button>`;
    },
    
    /**
     * 조정 미리보기 업데이트
     */
    updateAdjustPreview(currentStock) {
        const type = el('adjustType');
        const qty = parseInt(el('adjustQty')) || 0;
        let newStock = currentStock;
        
        if (type === 'set') {
            newStock = qty;
        } else if (type === 'add') {
            newStock = currentStock + qty;
        } else if (type === 'subtract') {
            newStock = currentStock - qty;
        }
        
        const preview = document.getElementById('adjustPreview');
        preview.innerText = newStock;
        preview.className = newStock < 0 ? 'font-bold text-xl text-red-600' : 'font-bold text-xl text-green-600';
    },
    
    /**
     * 재고 조정 저장
     */
    async saveAdjustment(productId) {
        const type = el('adjustType');
        const qty = parseInt(el('adjustQty')) || 0;
        const reason = el('adjustReason');
        
        // 현재 재고 조회
        const { data: product } = await supabaseClient
            .from('products')
            .select('stock')
            .eq('id', productId)
            .single();
        
        const currentStock = product?.stock || 0;
        let newStock = currentStock;
        
        if (type === 'set') {
            newStock = qty;
        } else if (type === 'add') {
            newStock = currentStock + qty;
        } else if (type === 'subtract') {
            newStock = currentStock - qty;
        }
        
        if (newStock < 0) {
            alert('재고는 0 미만이 될 수 없습니다.');
            return;
        }
        
        if (!confirm(`재고를 ${currentStock}개에서 ${newStock}개로 조정하시겠습니까?`)) return;
        
        const { error } = await supabaseClient
            .from('products')
            .update({ stock: newStock })
            .eq('id', productId);
        
        if (error) {
            alert("조정 실패: " + error.message);
            return;
        }
        
        alert("재고가 조정되었습니다.");
        closeModal();
        await fetchMasterData();
        this.search();
    },
    
    /**
     * 삭제
     */
    async delete(id) {
        if (!confirm("이 품목을 삭제하시겠습니까?\n(품목 정보와 재고가 모두 삭제됩니다)")) return;
        
        const { error } = await supabaseClient
            .from('products')
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

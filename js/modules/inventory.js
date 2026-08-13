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
                <tr class="hover:bg-slate-50 border-b transition cursor-pointer"
                    ondblclick="InventoryModule.openHistoryModal(${row.id})"
                    title="더블클릭하여 입출고 내역 보기">
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
                    <td ondblclick="event.stopPropagation()">${this.getActionButtons(row.id)}</td>
                </tr>`;
        }).join('');
    },
    
    /**
     * 액션 버튼
     */
    getActionButtons(rowId) {
        return `
            <div class="flex justify-center items-center gap-3">
                <button onclick="InventoryModule.openHistoryModal(${rowId})" class="text-emerald-600 hover:text-emerald-800 p-2 rounded hover:bg-emerald-50 transition" title="입출고 내역">
                    <i class="fa-solid fa-clock-rotate-left fa-lg"></i>
                </button>
                <button onclick="InventoryModule.openAdjustModal(${rowId})" class="text-blue-500 hover:text-blue-700 p-2 rounded hover:bg-blue-50 transition" title="재고 조정">
                    <i class="fa-solid fa-sliders fa-lg"></i>
                </button>
                <button onclick="InventoryModule.delete(${rowId})" class="text-red-400 hover:text-red-600 p-2 rounded hover:bg-red-50 transition" title="삭제">
                    <i class="fa-solid fa-trash-can fa-lg"></i>
                </button>
            </div>`;
    },

    /**
     * 품목별 구매(입고) 및 판매(출고) 내역
     */
    async openHistoryModal(productId) {
        const { data: product, error: productError } = await supabaseClient
            .from('products')
            .select('*')
            .eq('id', productId)
            .single();

        if (productError || !product) {
            alert('품목 정보를 불러오지 못했습니다.');
            return;
        }

        openModal('입출고 내역');
        const body = document.getElementById('modalBody');
        body.innerHTML = '<div class="py-12 text-center text-slate-500"><i class="fa-solid fa-spinner fa-spin mr-2"></i>입출고 내역을 불러오는 중입니다.</div>';

        const [purchasesResult, salesResult, bomResult] = await Promise.all([
            supabaseClient
                .from('purchases')
                .select('id,date,partner_name,item_name,qty,unit_price,serial_no,note')
                .eq('item_name', product.name)
                .order('date', { ascending: false }),
            supabaseClient
                .from('sales')
                .select('id,date,partner_name,items,note')
                .order('date', { ascending: false }),
            supabaseClient
                .from('bom')
                .select('parent_name,child_name,qty')
        ]);

        const loadError = purchasesResult.error || salesResult.error || bomResult.error;
        if (loadError) {
            body.innerHTML = `<div class="py-12 text-center text-red-600">입출고 내역을 불러오지 못했습니다.<br><span class="text-xs">${escapeHtml(loadError.message)}</span></div>`;
            return;
        }

        const movements = [];
        (purchasesResult.data || []).forEach(row => {
            movements.push({
                date: row.date,
                type: '입고',
                qty: Number(row.qty) || 0,
                partner: row.partner_name || '-',
                detail: row.serial_no ? `시리얼: ${row.serial_no}` : (row.note || '')
            });
        });

        const bomByParent = {};
        (bomResult.data || []).forEach(row => {
            if (!bomByParent[row.parent_name]) bomByParent[row.parent_name] = [];
            bomByParent[row.parent_name].push(row);
        });

        (salesResult.data || []).forEach(row => {
            let items = row.items;
            if (typeof items === 'string') {
                try { items = JSON.parse(items); } catch (e) { items = []; }
            }
            if (!Array.isArray(items)) return;

            let outboundQty = 0;
            const bomParents = [];
            items.forEach(item => {
                const saleQty = Number(item.qty) || 0;
                const parts = bomByParent[item.name] || [];

                if (parts.length > 0) {
                    parts.forEach(part => {
                        if (part.child_name === product.name) {
                            outboundQty += saleQty * (Number(part.qty) || 0);
                            bomParents.push(item.name);
                        }
                    });
                } else if (item.name === product.name) {
                    outboundQty += saleQty;
                }
            });

            if (outboundQty > 0) {
                const bomLabel = bomParents.length > 0
                    ? `${[...new Set(bomParents)].join(', ')} 판매에 사용된 구성품`
                    : '';
                movements.push({
                    date: row.date,
                    type: '판매',
                    qty: -outboundQty,
                    partner: row.partner_name || '-',
                    detail: bomLabel || row.note || ''
                });
            }
        });

        movements.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

        const totalInbound = movements
            .filter(item => item.qty > 0)
            .reduce((sum, item) => sum + item.qty, 0);
        const totalOutbound = movements
            .filter(item => item.qty < 0)
            .reduce((sum, item) => sum + Math.abs(item.qty), 0);
        const currentStock = Number(product.stock) || 0;
        const untrackedAdjustment = currentStock - (totalInbound - totalOutbound);

        const movementRows = movements.map(item => {
            const isInbound = item.qty > 0;
            const typeClass = isInbound ? 'text-emerald-700 bg-emerald-50' : 'text-red-700 bg-red-50';
            const qtyClass = isInbound ? 'text-emerald-700' : 'text-red-700';
            const qtyPrefix = isInbound ? '+' : '-';
            const displayDate = item.date ? String(item.date).slice(0, 10).replace(/-/g, '.') : '-';

            return `
                <tr class="border-b last:border-b-0">
                    <td class="p-3 text-center whitespace-nowrap">${escapeHtml(displayDate)}</td>
                    <td class="p-3 text-center"><span class="inline-block px-2 py-1 rounded text-xs font-bold ${typeClass}">${item.type}</span></td>
                    <td class="p-3">${escapeHtml(item.partner)}</td>
                    <td class="p-3 text-right font-bold ${qtyClass}">${qtyPrefix}${formatNumber(Math.abs(item.qty))}</td>
                    <td class="p-3 text-sm text-slate-500">${escapeHtml(item.detail || '-')}</td>
                </tr>`;
        }).join('');

        const adjustmentRow = untrackedAdjustment !== 0 ? `
            <tr class="border-b bg-amber-50">
                <td class="p-3 text-center text-slate-500">-</td>
                <td class="p-3 text-center"><span class="inline-block px-2 py-1 rounded text-xs font-bold text-amber-700 bg-amber-100">기초/조정</span></td>
                <td class="p-3 text-slate-500">재고 조정 및 기존 재고</td>
                <td class="p-3 text-right font-bold text-amber-700">${untrackedAdjustment > 0 ? '+' : '-'}${formatNumber(Math.abs(untrackedAdjustment))}</td>
                <td class="p-3 text-sm text-slate-500">구매·판매 내역과 현재고의 차이</td>
            </tr>` : '';

        body.innerHTML = `
            <div class="flex flex-wrap items-start justify-between gap-3 mb-4">
                <div>
                    <div class="text-xl font-bold text-slate-800">${escapeHtml(product.name)}</div>
                    <div class="text-sm text-slate-500 mt-1">${escapeHtml(product.spec || '')}</div>
                </div>
                <div class="text-right">
                    <div class="text-xs text-slate-500">현재 재고</div>
                    <div class="text-2xl font-bold text-blue-700">${formatNumber(currentStock)}</div>
                </div>
            </div>
            <div class="grid grid-cols-3 gap-2 mb-4 text-center">
                <div class="border p-3 rounded"><div class="text-xs text-slate-500">총 입고</div><div class="font-bold text-emerald-700 mt-1">+${formatNumber(totalInbound)}</div></div>
                <div class="border p-3 rounded"><div class="text-xs text-slate-500">총 출고</div><div class="font-bold text-red-700 mt-1">-${formatNumber(totalOutbound)}</div></div>
                <div class="border p-3 rounded"><div class="text-xs text-slate-500">기초/조정</div><div class="font-bold text-amber-700 mt-1">${untrackedAdjustment > 0 ? '+' : ''}${formatNumber(untrackedAdjustment)}</div></div>
            </div>
            <p class="text-xs text-slate-500 mb-3">구매 관리의 입고와 판매 관리의 출고를 최신순으로 표시합니다.</p>
            <div class="overflow-x-auto border rounded max-h-[55vh] overflow-y-auto">
                <table class="w-full min-w-[680px] text-sm">
                    <thead class="bg-slate-100 sticky top-0">
                        <tr><th class="p-3">날짜</th><th class="p-3">구분</th><th class="p-3">거래처</th><th class="p-3">수량</th><th class="p-3">비고</th></tr>
                    </thead>
                    <tbody>${movementRows || '<tr><td colspan="5" class="p-10 text-center text-slate-400">등록된 입출고 내역이 없습니다.</td></tr>'}${adjustmentRow}</tbody>
                </table>
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
            
            <button onclick="runSaveOnce('inventory-adjust-${productId}', this, () => InventoryModule.saveAdjustment(${productId}))" class="w-full bg-blue-600 text-white py-3 rounded font-bold hover:bg-blue-700 transition">
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

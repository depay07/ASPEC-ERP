// js/modules/cost-management.js - 원가 관리 모듈

const CostManagementModule = {
    tableName: 'orders',
    currentOrder: null,
    bomList: [],
    
    /**
     * 검색
     */
    async search() {
        showTableLoading(8);
        
        let query = supabaseClient
            .from(this.tableName)
            .select('*')
            .order('created_at', { ascending: false });
        
        // 날짜 필터
        const startDate = el('searchStartDate');
        const endDate = el('searchEndDate');
        if (startDate && endDate) {
            query = query.gte('date', startDate).lte('date', endDate);
        }
        
        // 거래처 필터
        const partnerFilter = el('search_sPartner');
        if (partnerFilter) query = query.ilike('partner_name', `%${partnerFilter}%`);
        
        const { data, error } = await query;
        
        if (error) {
            alert("검색 실패: " + error.message);
            return;
        }
        
        this.renderTable(data);
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
        
        tbody.innerHTML = data.map(row => {
            const totalSales = row.total_amount || 0;
            const totalCost = row.total_cost || 0;
            const margin = totalSales - totalCost;
            const marginRate = totalSales > 0 ? ((margin / totalSales) * 100).toFixed(1) : 0;
            const marginClass = margin < 0 ? 'text-red-600' : 'text-blue-600';
            
            let title = '-';
            if (row.items && row.items.length > 0) {
                title = row.items[0].name;
                if (row.items.length > 1) title += ` 외 ${row.items.length - 1}건`;
            }
            
            return `
                <tr class="hover:bg-slate-50 border-b transition">
                    <td class="text-center">${row.date}</td>
                    <td class="font-bold text-slate-700">${row.partner_name}</td>
                    <td>${title}</td>
                    <td class="text-right font-bold">${formatNumber(totalSales)}</td>
                    <td class="text-right text-slate-600">${formatNumber(totalCost)}</td>
                    <td class="text-right font-bold ${marginClass}">${formatNumber(margin)}</td>
                    <td class="text-center text-xs ${marginClass}">${marginRate}%</td>
                    <td class="text-center">
                        <button onclick="CostManagementModule.openCostModal(${row.id})" 
                                class="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-xs font-bold transition">
                            원가입력
                        </button>
                    </td>
                </tr>`;
        }).join('');
    },
    
    /**
     * 원가 입력 모달
     */
    async openCostModal(orderId) {
        // 주문 정보 조회
        const { data: order, error } = await supabaseClient
            .from(this.tableName)
            .select('*')
            .eq('id', orderId)
            .single();
        
        if (error || !order) {
            alert("주문 정보를 가져오는데 실패했습니다.");
            return;
        }
        
        // BOM 목록 조회
        const { data: bomData } = await supabaseClient.from('bom').select('*');
        this.bomList = bomData || [];
        
        // items 파싱
        let items = order.items;
        if (typeof items === 'string') {
            try { items = JSON.parse(items); } catch (e) { items = []; }
        }
        if (!items || !Array.isArray(items)) items = [];
        order.items = items;
        
        this.currentOrder = order;
        
        openModal('원가(매입단가) 입력');
        
        const body = document.getElementById('modalBody');
        body.innerHTML = this.getCostFormHtml(order);
        
        // 초기 마진 계산
        setTimeout(() => this.calcRealTimeMargin(), 50);
    },
    
    /**
     * 원가 입력 폼 HTML
     */
    getCostFormHtml(order) {
        let itemsHtml = '';
        
        if (order.items && order.items.length > 0) {
            order.items.forEach((item, idx) => {
                const sellPrice = item.price || item.unit_price || 0;
                const qty = item.qty || 0;
                
                // BOM 구성품 확인
                const children = this.bomList.filter(b => b.parent_name === item.name);
                const isBOM = children.length > 0;
                
                if (isBOM) {
                    const savedBreakdown = item.bom_breakdown || [];
                    
                    // 세트 품목 행
                    itemsHtml += `
                        <tr class="bg-slate-100 font-bold text-slate-700">
                            <td class="p-2 border text-left">
                                <i class="fa-solid fa-layer-group text-purple-600 mr-1"></i> ${item.name} (세트)
                            </td>
                            <td class="p-2 border text-right">${formatNumber(sellPrice)}</td>
                            <td class="p-2 border">${qty}</td>
                            <td class="p-2 border text-right text-xs text-slate-500">(하단 구성품 입력)</td>
                            <td class="p-2 border text-right text-blue-600" id="margin_parent_${idx}">-</td>
                        </tr>`;
                    
                    // 구성품 행들
                    children.forEach((child, cIdx) => {
                        const savedChild = savedBreakdown.find(s => s.name === child.child_name);
                        const childCost = savedChild ? savedChild.cost : 0;
                        
                        itemsHtml += `
                            <tr class="text-xs bg-purple-50">
                                <td class="p-2 border text-left pl-6">
                                    └ ${child.child_name} <span class="text-slate-400">(${child.qty}ea/set)</span>
                                </td>
                                <td class="p-2 border text-center text-slate-400">-</td>
                                <td class="p-2 border text-center text-slate-500">${qty * child.qty}</td>
                                <td class="p-2 border bg-white">
                                    <input type="number" id="cost_input_bom_${idx}_${cIdx}" 
                                           data-parent="${idx}" data-qty="${child.qty}" 
                                           value="${childCost}" 
                                           class="w-full text-right border p-1 rounded font-bold text-slate-700" 
                                           oninput="CostManagementModule.calcRealTimeMargin()" 
                                           placeholder="단가 입력">
                                </td>
                                <td class="p-2 border text-center text-slate-400">-</td>
                            </tr>`;
                    });
                } else {
                    // 일반 품목 행
                    const costPrice = item.cost_price || 0;
                    const margin = (sellPrice - costPrice) * qty;
                    
                    itemsHtml += `
                        <tr>
                            <td class="p-2 border text-left">${item.name}</td>
                            <td class="p-2 border text-right text-slate-500">${formatNumber(sellPrice)}</td>
                            <td class="p-2 border">${qty}</td>
                            <td class="p-2 border bg-yellow-50">
                                <input type="number" id="cost_input_${idx}" 
                                       value="${costPrice}" 
                                       class="w-full text-right border p-1 rounded font-bold text-slate-700" 
                                       oninput="CostManagementModule.calcRealTimeMargin()" 
                                       placeholder="0">
                            </td>
                            <td class="p-2 border text-right font-bold text-blue-600" id="margin_display_${idx}">
                                ${formatNumber(margin)}
                            </td>
                        </tr>`;
                }
            });
        } else {
            itemsHtml = '<tr><td colspan="5" class="p-4 text-center text-slate-400">품목 상세 내역이 없습니다.</td></tr>';
        }
        
        return `
            <div class="bg-green-50 p-4 rounded mb-4 border border-green-200">
                <div class="flex justify-between mb-2">
                    <span class="font-bold text-green-900">주문일자: ${order.date}</span>
                    <span class="font-bold text-green-900">거래처: ${order.partner_name}</span>
                </div>
                <p class="text-xs text-green-700">※ 세트(BOM) 품목은 구성품별로 원가를 입력하면 합계가 자동 계산됩니다.</p>
            </div>
            
            <div class="overflow-y-auto max-h-[60vh]">
                <table class="w-full text-sm border-collapse border text-center mb-4">
                    <thead class="bg-slate-100 sticky top-0 z-10">
                        <tr>
                            <th class="p-2 border">품목명</th>
                            <th class="p-2 border">판매단가</th>
                            <th class="p-2 border">수량</th>
                            <th class="p-2 border bg-yellow-50">입고단가(원가)</th>
                            <th class="p-2 border">예상마진</th>
                        </tr>
                    </thead>
                    <tbody id="costListBody">${itemsHtml}</tbody>
                    <tfoot class="bg-slate-50 font-bold border-t-2 border-slate-300">
                        <tr>
                            <td colspan="3" class="p-3 text-right">총 합계</td>
                            <td class="p-3 text-right text-red-600" id="totalCostDisplay">0</td>
                            <td class="p-3 text-right text-blue-600" id="totalMarginDisplay">0</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
            
            <button onclick="CostManagementModule.saveCost(${order.id})" 
                    class="w-full bg-slate-800 text-white py-3 rounded font-bold hover:bg-slate-900 transition">
                원가 저장 및 마진 확정
            </button>`;
    },
    
    /**
     * 실시간 마진 계산
     */
    calcRealTimeMargin() {
        if (!this.currentOrder || !this.currentOrder.items) return;
        
        let totalCost = 0;
        let totalMargin = 0;
        
        this.currentOrder.items.forEach((item, idx) => {
            const sellPrice = item.price || item.unit_price || 0;
            const qty = item.qty || 0;
            
            const children = this.bomList.filter(b => b.parent_name === item.name);
            const isBOM = children.length > 0;
            
            let itemUnitCost = 0;
            
            if (isBOM) {
                children.forEach((child, cIdx) => {
                    const inputEl = document.getElementById(`cost_input_bom_${idx}_${cIdx}`);
                    if (inputEl) {
                        itemUnitCost += (parseInt(inputEl.value) || 0) * child.qty;
                    }
                });
                
                const margin = (sellPrice - itemUnitCost) * qty;
                const parentMarginEl = document.getElementById(`margin_parent_${idx}`);
                if (parentMarginEl) parentMarginEl.innerText = formatNumber(margin);
                
                totalCost += (itemUnitCost * qty);
                totalMargin += margin;
            } else {
                const inputEl = document.getElementById(`cost_input_${idx}`);
                if (inputEl) {
                    itemUnitCost = parseInt(inputEl.value) || 0;
                    const margin = (sellPrice - itemUnitCost) * qty;
                    
                    const displayEl = document.getElementById(`margin_display_${idx}`);
                    if (displayEl) displayEl.innerText = formatNumber(margin);
                    
                    totalCost += (itemUnitCost * qty);
                    totalMargin += margin;
                }
            }
        });
        
        document.getElementById('totalCostDisplay').innerText = formatNumber(totalCost);
        document.getElementById('totalMarginDisplay').innerText = formatNumber(totalMargin);
    },
    
    /**
     * 원가 저장
     */
    async saveCost(orderId) {
        if (!this.currentOrder || !this.currentOrder.items) {
            alert("저장할 데이터가 없습니다.");
            return;
        }
        
        let totalCostAccumulated = 0;
        
        const updatedItems = this.currentOrder.items.map((item, idx) => {
            const children = this.bomList.filter(b => b.parent_name === item.name);
            const isBOM = children.length > 0;
            
            let finalUnitCost = 0;
            let bomBreakdown = [];
            
            if (isBOM) {
                children.forEach((child, cIdx) => {
                    const inputEl = document.getElementById(`cost_input_bom_${idx}_${cIdx}`);
                    const childCost = inputEl ? (parseInt(inputEl.value) || 0) : 0;
                    finalUnitCost += (childCost * child.qty);
                    bomBreakdown.push({
                        name: child.child_name,
                        cost: childCost,
                        req_qty: child.qty
                    });
                });
            } else {
                const inputEl = document.getElementById(`cost_input_${idx}`);
                finalUnitCost = inputEl ? (parseInt(inputEl.value) || 0) : 0;
            }
            
            totalCostAccumulated += (finalUnitCost * (item.qty || 0));
            
            return {
                ...item,
                cost_price: finalUnitCost,
                bom_breakdown: isBOM ? bomBreakdown : null
            };
        });
        
        const { error } = await supabaseClient
            .from(this.tableName)
            .update({
                items: updatedItems,
                total_cost: totalCostAccumulated
            })
            .eq('id', orderId);
        
        if (error) {
            alert("저장 실패: " + error.message);
            return;
        }
        
        alert("원가가 저장되었습니다.");
        closeModal();
        this.search();
    }
};

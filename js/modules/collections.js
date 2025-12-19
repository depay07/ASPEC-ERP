// js/modules/collections.js - 수금 관리 모듈

const CollectionsModule = {
    tableName: 'sales', // 판매 테이블 참조
    
    /**
     * 검색
     */
    async search() {
        showTableLoading(7);
        
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
        
        // 채권 0원 제외 필터
        let resultData = data || [];
        const hideZero = document.getElementById('hideZeroReceivable')?.checked;
        if (hideZero) {
            resultData = resultData.filter(row => {
                const total = row.total_amount || 0;
                const collected = row.collected_amount || 0;
                return (total - collected) !== 0;
            });
        }
        
        this.renderTable(resultData);
    },
    
    /**
     * 테이블 렌더링
     */
    renderTable(data) {
        const tbody = document.getElementById('listBody');
        
        if (!data || data.length === 0) {
            showEmptyTable(7);
            return;
        }
        
        tbody.innerHTML = data.map(row => {
            const total = row.total_amount || 0;
            const collected = row.collected_amount || 0;
            const balance = total - collected;
            const balanceClass = balance > 0 ? 'text-red-600 font-bold' : 'text-slate-400';
            
            return `
                <tr class="hover:bg-slate-50 border-b transition">
                    <td class="text-center">${row.date}</td>
                    <td class="font-bold text-slate-700">${row.partner_name}</td>
                    <td class="text-right font-bold">${formatNumber(total)}</td>
                    <td class="text-center">
                        <input type="number" id="col_${row.id}" value="${collected}" 
                               class="border rounded px-2 py-1 w-24 text-right font-bold text-blue-600 bg-blue-50 focus:bg-white transition" 
                               placeholder="0">
                    </td>
                    <td class="text-right ${balanceClass}">${formatNumber(balance)}</td>
                    <td>
                        <input type="text" id="cnote_${row.id}" value="${row.collection_note || ''}" 
                               class="border rounded px-2 py-1 w-full text-xs" placeholder="메모">
                    </td>
                    <td class="text-center">
                        <button onclick="CollectionsModule.save(${row.id})" 
                                class="bg-slate-700 hover:bg-slate-900 text-white px-3 py-1 rounded text-xs font-bold transition">
                            저장
                        </button>
                    </td>
                </tr>`;
        }).join('');
    },
    
    /**
     * 수금 정보 저장
     */
    async save(id) {
        const collectedAmount = parseInt(document.getElementById(`col_${id}`).value) || 0;
        const note = document.getElementById(`cnote_${id}`).value;
        
        if (!confirm('수금 정보를 저장하시겠습니까?')) return;
        
        const { error } = await supabaseClient
            .from(this.tableName)
            .update({ 
                collected_amount: collectedAmount, 
                collection_note: note 
            })
            .eq('id', id);
        
        if (error) {
            alert("저장 중 오류가 발생했습니다: " + error.message);
        } else {
            alert("저장되었습니다.");
            this.search();
        }
    }
};

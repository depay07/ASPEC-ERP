// js/modules/purchase-orders.js - 발주 관리 모듈

const PurchaseOrdersModule = {
    tableName: 'purchase_orders',
    
    /**
     * 검색 실행
     */
    async search() {
        // 컬럼이 9개(기존 7 + 송금여부, 송금액)로 늘어났으므로 로딩바 칸수를 9로 설정
        showTableLoading(9);
        
        let query = supabaseClient
            .from(this.tableName)
            .select('*')
            .order('created_at', { ascending: false });
        
        // 날짜 필터 적용
        const startDate = el('searchStartDate');
        const endDate = el('searchEndDate');
        if (startDate && endDate) {
            query = query.gte('date', startDate).lte('date', endDate);
        }
        
        // 업체명, EndUser 필터
        const partnerFilter = el('search_sPartner');
        const endUserFilter = el('search_sEndUser');
        const itemFilter = el('search_sItem');
        
        if (partnerFilter) query = query.ilike('partner_name', `%${partnerFilter}%`);
        if (endUserFilter) query = query.ilike('end_user', `%${endUserFilter}%`);
        
        const { data, error } = await query;
        
        if (error) {
            alert("검색 실패: " + error.message);
            return;
        }
        
        // 품목명 필터 (클라이언트 사이드 필터링)
        let resultData = data || [];
        if (itemFilter) {
            const lowerItem = itemFilter.toLowerCase();
            resultData = resultData.filter(r => 
                r.items && r.items.some(i => i.name.toLowerCase().includes(lowerItem))
            );
        }
        
        this.renderTable(resultData);
    },
    
    /**
     * 메인 테이블 렌더링
     */
    renderTable(data) {
        const tbody = document.getElementById('listBody');
        
        if (!data || data.length === 0) {
            showEmptyTable(9); // 9칸 전체에 '데이터 없음' 표시
            return;
        }
        
        tbody.innerHTML = data.map(row => {
            const dataId = storeRowData(row);
            const itemsSummary = row.items && row.items.length > 0 
                ? `${row.items[0].name} 외 ${row.items.length - 1}건` 
                : '-';
            
            // 송금 여부 계산 로직
            const totalAmount = row.total_amount || 0;
            const remittedAmount = row.remitted_amount || 0;
            const isPaid = totalAmount > 0 && remittedAmount >= totalAmount;
            
            // 아이콘 설정: 일치하면 초록색 동그라미, 아니면 주황색 X
            const statusIcon = isPaid 
                ? '<i class="fa-solid fa-circle text-green-500" title="송금완료"></i>' 
                : '<i class="fa-solid fa-circle-xmark text-orange-500" title="미입금/금액불일치"></i>';

            return `
                <tr class="hover:bg-slate-50 border-b transition text-sm">
                    <td class="font-bold text-blue-600 text-center">${row.po_number}</td>
                    <td class="pl-2">${row.partner_name}</td>
                    <td class="text-center text-xs">${row.end_user || '-'}</td>
                    <td class="pl-2 text-xs">${itemsSummary}</td>
                    <td class="font-bold text-right pr-2">${formatNumber(totalAmount)}</td>
                    <td class="text-center">${row.date}</td>
                    <!-- 송금 완료 여부 아이콘 칸 -->
                    <td class="text-center text-lg">${statusIcon}</td>
                    <!-- 송금액 표시 칸 -->
                    <td class="text-right font-bold text-slate-600 pr-2">${formatNumber(remittedAmount)}</td>
                    <td>${this.getActionButtons(dataId, row.id)}</td>
                </tr>`;
        }).join('');
    },
    
    /**
     * 테이블 우측 액션 버튼 HTML
     */
    getActionButtons(dataId, rowId) {
        return `
            <div class="flex justify-center items-center gap-3">
                <button onclick="printDocument('purchase_orders', '${dataId}')" class="text-slate-600 hover:text-black p-2 rounded hover:bg-slate-200 transition" title="인쇄">
                    <i class="fa-solid fa-print fa-lg"></i>
                </button>
                <button onclick="PurchaseOrdersModule.duplicate('${dataId}')" class="text-green-600 hover:text-green-800 p-2 rounded hover:bg-green-50 transition" title="복사">
                    <i class="fa-regular fa-copy fa-lg"></i>
                </button>
                <button onclick="PurchaseOrdersModule.openEditModal('${dataId}')" class="text-blue-500 hover:text-blue-700 p-2 rounded hover:bg-blue-50 transition" title="수정">
                    <i class="fa-solid fa-pen-to-square fa-lg"></i>
                </button>
                <button onclick="PurchaseOrdersModule.delete(${rowId})" class="text-red-400 hover:text-red-600 p-2 rounded hover:bg-red-50 transition" title="삭제">
                    <i class="fa-solid fa-trash-can fa-lg"></i>
                </button>
            </div>`;
    },
    
    /**
     * 신규 등록 모달 열기
     */
    async openNewModal() {
        AppState.currentEditId = null;
        AppState.tempItems = [];
        openModal('발주 등록');
        
        // 오늘 날짜 기준 PO 번호 자동 생성
        const today = getToday();
        const { count } = await supabaseClient
            .from(this.tableName)
            .select('*', { count: 'exact', head: true })
            .eq('date', today);
        
        const nextSeq = (count || 0) + 1;
        const yymmdd = today.slice(2).replace(/-/g, '');
        const autoPO = `ASPEC-${yymmdd}-P${String(nextSeq).padStart(2, '0')}`;
        
        const body = document.getElementById('modalBody');
        body.innerHTML = this.getFormHtml(autoPO, today);
        
        fillDatalist('dl_part_po', AppState.partnerList);
        fillDatalist('dl_product_list', AppState.productList);
        DocumentBaseModule.renderItemGrid();
    },
    
    /**
     * 수정 모달 열기
     */
    openEditModal(dataId) {
        const row = getRowData(dataId);
        if (!row) return alert('데이터 오류');
        
        AppState.currentEditId = row.id;
        openModal('발주 수정');
        
        const body = document.getElementById('modalBody');
        body.innerHTML = this.getFormHtml(row.po_number, row.date);
        
        this.fillFormData(row);
    },

    /**
     * 기존 데이터 복사하여 새로 등록
     */
    async duplicate(dataId) {
        const row = getRowData(dataId);
        if (!row) return alert('데이터 오류');
        
        AppState.currentEditId = null;
        openModal('발주 복사 등록');
        
        const today = getToday();
        const { count } = await supabaseClient
            .from(this.tableName)
            .select('*', { count: 'exact', head: true })
            .eq('date', today);
        
        const nextSeq = (count || 0) + 1;
        const yymmdd = today.slice(2).replace(/-/g, '');
        const autoPO = `ASPEC-${yymmdd}-P${String(nextSeq).padStart(2, '0')}`;
        
        const body = document.getElementById('modalBody');
        body.innerHTML = this.getFormHtml(autoPO, today);
        
        this.fillFormData(row);
        document.getElementById('poDate').value = today;
        document.getElementById('poNum').value = autoPO;
    },
    
    /**
     * 입력 폼 HTML 생성 (송금액 필드 포함)
     */
    getFormHtml(poNumber, date) {
        return `
            <div class="bg-slate-50 p-4 rounded mb-4 border text-left">
                <div class="grid grid-cols-3 gap-3 mb-2">
                    <div>
                        <label class="text-xs text-slate-500 font-bold">PO# (자동생성)</label>
                        <input id="poNum" class="input-box bg-gray-100" value="${poNumber}" readonly>
                    </div>
                    <div>
                        <label class="text-xs text-slate-500 font-bold">발주일자</label>
                        <input type="date" id="poDate" class="input-box" value="${date}">
                    </div>
                    <div>
                        <label class="text-xs text-slate-500 font-bold">납품업체 (필수)</label>
                        <input id="poPartner" class="input-box" list="dl_part_po" onchange="PurchaseOrdersModule.fillPartnerInfo(this.value)" placeholder="업체 선택 또는 입력">
                    </div>
                </div>
                <div class="grid grid-cols-3 gap-3 mb-2">
                    <div>
                        <label class="text-xs text-slate-500 font-bold">거래처 담당자</label>
                        <input id="poPManager" class="input-box">
                    </div>
                    <div>
                        <label class="text-xs text-slate-500 font-bold">연락처</label>
                        <input id="poPhone" class="input-box">
                    </div>
                    <div>
                        <label class="text-xs text-slate-500 font-bold">선발주여부</label>
                        <select id="poPreOrder" class="input-box">
                            <option value="N">N (일반)</option>
                            <option value="Y">Y (선발주)</option>
                        </select>
                    </div>
                </div>
                <div class="mb-2">
                    <label class="text-xs text-slate-500 font-bold">납품 주소</label>
                    <input id="poAddr" class="input-box">
                </div>
                <div class="grid grid-cols-2 gap-3 mb-2">
                    <div>
                        <label class="text-xs text-slate-500 font-bold">이메일</label>
                        <input id="poEmail" class="input-box">
                    </div>
                    <div>
                        <label class="text-xs text-slate-500 font-bold">비고</label>
                        <input id="poNote" class="input-box">
                    </div>
                </div>
                <div class="grid grid-cols-3 gap-3">
                    <div>
                        <label class="text-xs text-slate-500 font-bold">EndUser (실수요처)</label>
                        <input id="poEndUser" class="input-box">
                    </div>
                    <div>
                        <label class="text-xs text-slate-500 font-bold">담당자 (우리측)</label>
                        <input id="poManager" class="input-box">
                    </div>
                    <!-- 송금액 입력 필드 (리스트 상태 업데이트용) -->
                    <div>
                        <label class="text-xs font-bold text-blue-600">실제 송금액 (결제금액)</label>
                        <input type="number" id="poRemittedAmount" class="input-box border-blue-300 bg-blue-50" placeholder="금액 입력">
                    </div>
                </div>
            </div>
            
            ${DocumentBaseModule.getItemInputHtml()}
            
            <div class="overflow-x-auto">
                <table class="w-full text-sm border-collapse border text-center mb-4 table-fixed">
                    <thead class="bg-slate-100">
                        <tr>
                            <th class="p-2 border w-10">No</th>
                            <th class="p-2 border w-[22%]">품목명</th>
                            <th class="p-2 border w-[30%]">규격</th>
                            <th class="p-2 border w-14">단위</th>
                            <th class="p-2 border w-16">수량</th>
                            <th class="p-2 border">단가</th>
                            <th class="p-2 border">공급가액</th>
                            <th class="p-2 border w-10">삭제</th>
                        </tr>
                    </thead>
                    <tbody id="itemGrid"></tbody>
                    <tfoot class="bg-slate-50 font-bold">
                        <tr>
                            <td colspan="6" class="p-2 text-right border">합계 (공급가액)</td>
                            <td class="p-2 text-right border" id="tSupply">0</td>
                            <td class="p-2 border"></td>
                        </tr>
                        <tr>
                            <td colspan="6" class="p-2 text-right border text-slate-500">부가세 (VAT)</td>
                            <td class="p-2 text-right border text-slate-500" id="tVat">0</td>
                            <td class="p-2 border"></td>
                        </tr>
                        <tr>
                            <td colspan="6" class="p-2 text-right border text-blue-600 text-lg">총 합계 (발주액)</td>
                            <td class="p-2 text-right border text-blue-600 text-lg" id="tTotal">0</td>
                            <td class="p-2 border"></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
            
            <button onclick="PurchaseOrdersModule.save()" class="w-full mt-4 bg-cyan-600 text-white py-3 rounded font-bold shadow-lg hover:bg-cyan-700 transition">
                발주 데이터 저장하기
            </button>
            
            <datalist id="dl_part_po"></datalist>
            <datalist id="dl_prod_doc"></datalist>`;
    },
    
    /**
     * 업체 선택 시 기본 정보 자동 채우기
     */
    fillPartnerInfo(partnerName) {
        const partner = AppState.partnerList.find(p => p.name === partnerName);
        if (partner) {
            document.getElementById('poPManager').value = partner.manager_name || '';
            document.getElementById('poPhone').value = partner.phone || '';
            document.getElementById('poEmail').value = partner.email || '';
            document.getElementById('poAddr').value = partner.address || '';
        }
    },
    
    /**
     * 모달창에 기존 데이터 세팅
     */
    fillFormData(row) {
        setTimeout(() => {
            document.getElementById('poNum').value = row.po_number || '';
            document.getElementById('poDate').value = row.date || '';
            document.getElementById('poPartner').value = row.partner_name || '';
            document.getElementById('poEndUser').value = row.end_user || '';
            document.getElementById('poManager').value = row.manager || '';
            document.getElementById('poPreOrder').value = row.is_pre_order || 'N';
            document.getElementById('poNote').value = row.note || '';
            document.getElementById('poPManager').value = row.partner_manager || '';
            document.getElementById('poPhone').value = row.phone || '';
            document.getElementById('poEmail').value = row.email || '';
            document.getElementById('poAddr').value = row.partner_address || '';
            
            // 송금액 필드 데이터 로드
            const remitInput = document.getElementById('poRemittedAmount');
            if (remitInput) remitInput.value = row.remitted_amount || 0;
            
            // 품목 데이터 로드
            AppState.tempItems = (row.items || []).map(item => {
                if (!item.spec) {
                    const prod = AppState.productList.find(p => p.name === item.name);
                    if (prod) item.spec = prod.spec;
                }
                return { ...item };
            });
            
            DocumentBaseModule.renderItemGrid();
            fillDatalist('dl_part_po', AppState.partnerList);
            fillDatalist('dl_prod_po', AppState.productList);
        }, 50);
    },
    
    /**
     * 데이터 저장 (DB 전송)
     */
    async save() {
        if (AppState.tempItems.length === 0) {
            alert("품목을 최소 하나 이상 추가해주세요.");
            return;
        }
        
        // 합계 재계산
        let tSupply = 0, tVat = 0, tTotal = 0;
        AppState.tempItems.forEach(i => {
            tSupply += i.supply || 0;
            tVat += i.vat || 0;
            tTotal += i.total || 0;
        });
        
        const dateVal = el('poDate') || getToday();
        
        const data = {
            po_number: el('poNum'),
            date: dateVal,
            partner_name: el('poPartner'),
            end_user: el('poEndUser'),
            manager: el('poManager'),
            is_pre_order: el('poPreOrder'),
            note: el('poNote'),
            partner_manager: el('poPManager'),
            phone: el('poPhone'),
            email: el('poEmail'),
            partner_address: el('poAddr'),
            items: AppState.tempItems,
            // 새 컬럼: 송금액 저장
            remitted_amount: Number(document.getElementById('poRemittedAmount').value) || 0,
            total_supply: tSupply,
            total_vat: tVat,
            total_amount: tTotal
        };
        
        // 신규 등록 시 중복 방지를 위한 PO 번호 최종 확정
        if (!AppState.currentEditId) {
            const { count } = await supabaseClient
                .from(this.tableName)
                .select('*', { count: 'exact', head: true })
                .eq('date', dateVal);
            
            const seq = (count || 0) + 1;
            const yymmdd = dateVal.slice(2).replace(/-/g, '');
            data.po_number = `ASPEC-${yymmdd}-P${String(seq).padStart(2, '0')}`;
        }
        
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
        
        alert("성공적으로 저장되었습니다.");
        closeModal();
        this.search();
    },
    
    /**
     * 데이터 삭제
     */
    async delete(id) {
        if (!confirm("정말 삭제하시겠습니까? 관련 데이터가 모두 삭제됩니다.")) return;
        
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

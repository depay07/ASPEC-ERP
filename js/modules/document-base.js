// js/modules/document-base.js - 견적/주문/판매 공통 베이스 모듈

const DocumentBaseModule = {
    
    /**
     * 공통 검색 로직
     */
    async baseSearch(tableName, colspan = 8) {
        showTableLoading(colspan);
        
        let query = supabaseClient
            .from(tableName)
            .select('*')
            .order('created_at', { ascending: false });
        
        // 날짜 필터
        const startDate = el('searchStartDate');
        const endDate = el('searchEndDate');
        if (startDate && endDate) {
            query = query.gte('date', startDate).lte('date', endDate);
        }
        
        // 공통 필터
        const partnerFilter = el('search_sPartner');
        const managerFilter = el('search_sManager');
        const noteFilter = el('search_sNote');
        
        if (partnerFilter) query = query.ilike('partner_name', `%${partnerFilter}%`);
        if (managerFilter) query = query.ilike('manager', `%${managerFilter}%`);
        if (noteFilter) query = query.ilike('note', `%${noteFilter}%`);
        
        const { data, error } = await query;
        
        if (error) {
            alert("검색 실패: " + error.message);
            return null;
        }
        
        return data;
    },
    
    /**
     * 공통 테이블 행 렌더링
     */
    renderDocumentRow(row, tab) {
        const dataId = storeRowData(row);
        
        let actions = '<div class="flex justify-center items-center gap-3">';
        actions += `<button onclick="printDocument('${tab}', '${dataId}')" class="text-slate-600 hover:text-black p-2 rounded hover:bg-slate-200 transition" title="인쇄"><i class="fa-solid fa-print fa-lg"></i></button>`;
        actions += `<button onclick="${this.getModuleName(tab)}.duplicate('${dataId}')" class="text-green-600 hover:text-green-800 p-2 rounded hover:bg-green-50 transition" title="복사"><i class="fa-regular fa-copy fa-lg"></i></button>`;
        actions += `<button onclick="${this.getModuleName(tab)}.openEditModal('${dataId}')" class="text-blue-500 hover:text-blue-700 p-2 rounded hover:bg-blue-50 transition" title="수정"><i class="fa-solid fa-pen-to-square fa-lg"></i></button>`;
        actions += `<button onclick="${this.getModuleName(tab)}.delete(${row.id})" class="text-red-400 hover:text-red-600 p-2 rounded hover:bg-red-50 transition" title="삭제"><i class="fa-solid fa-trash-can fa-lg"></i></button>`;
        actions += '</div>';
        
        return `
            <tr class="hover:bg-slate-50 border-b transition">
                <td class="text-center">${row.date}</td>
                <td class="font-bold">${row.partner_name || '-'}</td>
                <td class="text-center">${row.manager || '-'}</td>
                <td class="text-right text-slate-600">${formatNumber(row.total_supply)}</td>
                <td class="text-right text-slate-400 text-xs">${formatNumber(row.total_vat)}</td>
                <td class="text-right font-bold text-cyan-700">${formatNumber(row.total_amount)}</td>
                <td>${row.note || ''}</td>
                <td>${actions}</td>
            </tr>`;
    },
    
    /**
     * 모듈명 가져오기
     */
    getModuleName(tab) {
        const map = {
            quotes: 'QuotesModule',
            orders: 'OrdersModule',
            sales: 'SalesModule'
        };
        return map[tab] || '';
    },
    
    /**
     * 공통 폼 HTML
     */
    getDocumentFormHtml(tab, loadButtonHtml = '') {
        const addressField = tab === 'quotes' ? '' : `
            <div>
                <label class="text-xs text-slate-500">주소</label>
                <input id="sAddr" class="input-box">
            </div>`;
        
        return `
            <div class="bg-slate-50 p-4 rounded mb-4 border">
                <div class="grid grid-cols-2 gap-3 mb-2">
                    <div>
                        <label class="text-xs text-slate-500">일자</label>
                        <input type="date" id="sDate" class="input-box" value="${getToday()}">
                    </div>
                    <div>
                        <label class="text-xs text-slate-500">거래처 ${loadButtonHtml}</label>
                        <input id="sPartner" class="input-box" list="dl_part_doc" onchange="DocumentBaseModule.fillPartnerInfo(this.value)" placeholder="거래처 검색">
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-3 mb-2">
                    <div>
                        <label class="text-xs text-slate-500">담당자 (거래처)</label>
                        <input id="sPManager" class="input-box">
                    </div>
                    <div>
                        <label class="text-xs text-slate-500">연락처</label>
                        <input id="sContact" class="input-box">
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-3 mb-2">
                    <div>
                        <label class="text-xs text-slate-500">이메일</label>
                        <input id="sEmail" class="input-box">
                    </div>
                    ${addressField}
                </div>
                <div class="grid grid-cols-2 gap-3 mb-2">
                    <div>
                        <label class="text-xs text-slate-500">담당자 (우리측)</label>
                        <input id="sManager" class="input-box">
                    </div>
                    <div>
                        <label class="text-xs text-slate-500">비고</label>
                        <input id="sNote" class="input-box">
                    </div>
                </div>
            </div>
            
            ${this.getItemInputHtml()}
            
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
                            <td colspan="6" class="p-2 text-right border">합계 (공급가액 + 세액)</td>
                            <td class="p-2 text-right border" id="tSupply">0</td>
                            <td class="p-2 border"></td>
                        </tr>
                        <tr>
                            <td colspan="6" class="p-2 text-right border text-slate-500">부가세 (VAT)</td>
                            <td class="p-2 text-right border text-slate-500" id="tVat">0</td>
                            <td class="p-2 border"></td>
                        </tr>
                        <tr>
                            <td colspan="6" class="p-2 text-right border text-blue-600 text-lg">총 합계</td>
                            <td class="p-2 text-right border text-blue-600 text-lg" id="tTotal">0</td>
                            <td class="p-2 border"></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
            
            <button onclick="${this.getModuleName(tab)}.save()" class="w-full mt-4 bg-cyan-600 text-white py-3 rounded font-bold shadow-lg hover:bg-cyan-700 transition">
                저장하기
            </button>
            
            <datalist id="dl_part_doc"></datalist>
            <datalist id="dl_prod_doc"></datalist>`;
    },
    
    /**
     * 품목 입력 영역 HTML
     */
    getItemInputHtml() {
        return `
            <div class="bg-white border p-3 rounded mb-4 shadow-sm">
                <div class="flex flex-wrap gap-2 items-end">
                    <div class="w-[22%] min-w-[150px]">
                        <label class="text-xs text-slate-500 font-bold">품목명</label>
                        <input id="iName" class="input-box" list="dl_prod_doc" onchange="DocumentBaseModule.fillProductInfo(this.value)" placeholder="품목 검색">
                    </div>
                    <div class="flex-1 min-w-[200px]">
                        <label class="text-xs text-slate-500 font-bold">규격</label>
                        <input id="iSpec" class="input-box">
                    </div>
                    <div class="w-14">
                        <label class="text-xs text-slate-500">단위</label>
                        <input id="iUnit" class="input-box" value="EA">
                    </div>
                    <div class="w-16">
                        <label class="text-xs text-slate-500 font-bold">수량</label>
                        <input type="number" id="iQty" class="input-box" value="1" onkeypress="if(event.key==='Enter') document.getElementById('iPrice').focus()">
                    </div>
                    <div class="w-28">
                        <label class="text-xs text-slate-500 font-bold">단가</label>
                        <input type="number" id="iPrice" class="input-box" onkeypress="if(event.key==='Enter') DocumentBaseModule.addItem()">
                    </div>
                    <button onclick="DocumentBaseModule.addItem()" class="bg-slate-700 hover:bg-slate-800 text-white px-4 py-2 rounded font-bold text-sm h-[38px] transition">
                        <i class="fa-solid fa-plus"></i> 추가
                    </button>
                </div>
            </div>`;
    },
    
    /**
     * 거래처 정보 자동 채우기
     */
    fillPartnerInfo(partnerName) {
        const partner = AppState.partnerList.find(p => p.name === partnerName);
        if (partner) {
            const pManager = document.getElementById('sPManager');
            const contact = document.getElementById('sContact');
            const addr = document.getElementById('sAddr');
            const email = document.getElementById('sEmail');
            
            if (pManager) pManager.value = partner.manager_name || '';
            if (contact) contact.value = partner.phone || '';
            if (addr) addr.value = partner.address || '';
            if (email) email.value = partner.email || '';
        }
    },
    
    /**
     * 품목 정보 자동 채우기
     */
    fillProductInfo(productName) {
        const product = AppState.productList.find(p => p.name === productName);
        if (product) {
            const spec = document.getElementById('iSpec');
            if (spec) spec.value = product.spec || '';
        }
    },
    
    /**
     * 품목 추가
     */
    addItem() {
        const name = el('iName');
        const spec = el('iSpec');
        const unit = el('iUnit');
        const qty = parseInt(el('iQty')) || 0;
        const price = parseInt(el('iPrice')) || 0;
        
        if (!name) return alert("품목명은 필수입니다.");
        
        const supply = price * qty;
        const vat = Math.floor(supply * 0.1);
        const total = supply + vat;
        
        AppState.tempItems.push({
            name, spec, unit, qty, price, supply, vat, total,
            manufacturer: '', serial_no: ''
        });
        
        // 입력 필드 초기화
        document.getElementById('iName').value = '';
        document.getElementById('iSpec').value = '';
        document.getElementById('iQty').value = '1';
        document.getElementById('iPrice').value = '';
        document.getElementById('iName').focus();
        
        this.renderItemGrid();
    },
    
    /**
     * 품목 그리드 렌더링
     */
    renderItemGrid() {
        const tbody = document.getElementById('itemGrid');
        if (!tbody) return;
        
        let tSupply = 0, tVat = 0, tTotal = 0;
        
        tbody.innerHTML = AppState.tempItems.map((item, idx) => {
            tSupply += item.supply || 0;
            tVat += item.vat || 0;
            tTotal += item.total || 0;
            
            return `
                <tr class="hover:bg-slate-50 border-b group" draggable="true">
                    <td class="p-2 border text-slate-400 cursor-move">
                        <i class="fa-solid fa-bars"></i> ${idx + 1}
                    </td>
                    <td class="p-2 border text-left font-bold text-slate-700">${item.name}</td>
                    <td class="p-2 border text-xs text-slate-500">${item.spec || ''}</td>
                    <td class="p-2 border text-center text-xs">${item.unit}</td>
                    <td class="p-2 border text-center font-bold">${item.qty}</td>
                    <td class="p-2 border text-right text-slate-600">${formatNumber(item.price)}</td>
                    <td class="p-2 border text-right font-bold">${formatNumber(item.supply)}</td>
                    <td class="p-2 border text-center">
                        <button onclick="DocumentBaseModule.removeItem(${idx})" class="text-red-400 hover:text-red-600 transition">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </td>
                </tr>`;
        }).join('');
        
        document.getElementById('tSupply').innerText = formatNumber(tSupply);
        document.getElementById('tVat').innerText = formatNumber(tVat);
        document.getElementById('tTotal').innerText = formatNumber(tTotal);
    },
    
    /**
     * 품목 제거
     */
    removeItem(idx) {
        AppState.tempItems.splice(idx, 1);
        this.renderItemGrid();
    },
    
    /**
     * 공통 저장 데이터 생성
     */
    buildSaveData(tab) {
        if (AppState.tempItems.length === 0) {
            alert("품목을 추가해주세요.");
            return null;
        }
        
        let tSupply = 0, tVat = 0, tTotal = 0;
        AppState.tempItems.forEach(i => {
            tSupply += i.supply;
            tVat += i.vat;
            tTotal += i.total;
        });
        
        return {
            items: AppState.tempItems,
            total_supply: tSupply,
            total_vat: tVat,
            total_amount: tTotal,
            date: el('sDate') || getToday(),
            partner_name: el('sPartner'),
            manager: el('sManager'),
            note: el('sNote'),
            email: el('sEmail'),
            partner_manager: el('sPManager'),
            phone: el('sContact'),
            partner_address: el('sAddr') || ''
        };
    },
    
    /**
     * 폼에 데이터 채우기 (수정/복사용)
     */
    fillFormData(row) {
        setTimeout(() => {
            document.getElementById('sDate').value = row.date || '';
            document.getElementById('sPartner').value = row.partner_name || '';
            document.getElementById('sManager').value = row.manager || '';
            
            const sPManager = document.getElementById('sPManager');
            const sContact = document.getElementById('sContact');
            const sAddr = document.getElementById('sAddr');
            const sEmail = document.getElementById('sEmail');
            const sNote = document.getElementById('sNote');
            
            if (sPManager) sPManager.value = row.partner_manager || '';
            if (sContact) sContact.value = row.phone || '';
            if (sAddr) sAddr.value = row.partner_address || '';
            if (sEmail) sEmail.value = row.email || '';
            if (sNote) sNote.value = row.note || '';
            
            // 품목 데이터 복사
            AppState.tempItems = (row.items || []).map(item => {
                if (!item.spec) {
                    const prod = AppState.productList.find(p => p.name === item.name);
                    if (prod) item.spec = prod.spec;
                }
                return { ...item };
            });
            
            this.renderItemGrid();
            fillDatalist('dl_part_doc', AppState.partnerList);
            fillDatalist('dl_prod_doc', AppState.productList);
        }, 50);
    }
};

// js/modules/document-base.js - 문서 공통 모듈 (견적, 발주, 주문 공통 기능)

const DocumentBaseModule = {
    /**
     * 공통 검색 기능
     */
    async baseSearch(tableName) {
        showTableLoading(8);
        
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
        
        // 파트너(업체) 필터
        const partnerFilter = el('search_sPartner');
        if (partnerFilter) {
            query = query.ilike('partner_name', `%${partnerFilter}%`);
        }

        const { data, error } = await query;
        
        if (error) {
            alert("검색 실패: " + error.message);
            return null;
        }

        // 품목명 필터 (클라이언트 사이드)
        const itemFilter = el('search_sItem');
        let resultData = data || [];
        
        if (itemFilter) {
            const lowerItem = itemFilter.toLowerCase();
            resultData = resultData.filter(r => 
                r.items && r.items.some(i => i.name.toLowerCase().includes(lowerItem))
            );
        }
        
        return resultData;
    },

    /**
     * [수정됨] 문서별 테이블 행(Row) 렌더링 - 견적/주문 디자인 원상복구
     */
    renderDocumentRow(row, type) {
        const dataId = storeRowData(row);
        
        // 품목 요약 텍스트
        const itemsSummary = row.items && row.items.length > 0 
            ? `${row.items[0].name} 외 ${row.items.length - 1}건` 
            : '-';
            
        // 금액 콤마
        const totalAmt = row.total_amount ? Number(row.total_amount).toLocaleString() : '0';
        const dateStr = row.date || '-'; // 날짜가 없으면 - 표시

        // 모듈명 및 번호 필드 설정
        let moduleName = '';
        let numberVal = '';
        
        if (type === 'quotes') {
            moduleName = 'QuotesModule';
            numberVal = row.quote_number;
        } else if (type === 'orders') {
            moduleName = 'OrdersModule';
            numberVal = row.order_number;
        }

        // 견적 및 주문 리스트 HTML (기존 디자인 유지)
        return `
            <tr class="hover:bg-slate-50 border-b transition text-sm">
                <td class="font-bold text-blue-600 text-center p-3">${numberVal}</td>
                
                <td class="pl-2 font-bold text-slate-700">${row.partner_name || '-'}</td>
                
                <td class="text-center text-xs text-slate-500">${row.end_user || '-'}</td>
                
                <td class="pl-2 text-xs text-slate-600">${itemsSummary}</td>
                
                <td class="font-bold text-right pr-4 text-blue-900">${totalAmt}</td>
                
                <td class="text-center">${dateStr}</td>
                
                <td class="text-center text-xs">${row.manager || '-'}</td>
                
                <td>
                    <div class="flex justify-center items-center gap-2">
                        <button onclick="printDocument('${type}', '${dataId}')" class="text-slate-500 hover:text-black p-1 rounded hover:bg-slate-200 transition" title="인쇄">
                            <i class="fa-solid fa-print"></i>
                        </button>
                        <button onclick="${moduleName}.duplicate('${dataId}')" class="text-green-600 hover:text-green-800 p-1 rounded hover:bg-green-50 transition" title="복사">
                            <i class="fa-regular fa-copy"></i>
                        </button>
                        <button onclick="${moduleName}.openEditModal('${dataId}')" class="text-blue-500 hover:text-blue-700 p-1 rounded hover:bg-blue-50 transition" title="수정">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button onclick="${moduleName}.delete(${row.id})" class="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition" title="삭제">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </td>
            </tr>`;
    },

    /**
     * 공통 입력 폼 HTML 생성
     */
    getDocumentFormHtml(type, extraButton = '') {
        let numberLabel = type === 'quotes' ? '견적번호' : '주문번호';
        let dateLabel = type === 'quotes' ? '견적일자' : '주문일자';

        return `
            <div class="bg-slate-50 p-4 rounded mb-4 border text-left">
                <div class="grid grid-cols-3 gap-3 mb-2">
                    <div>
                        <label class="text-xs text-slate-500 font-bold">${numberLabel} (자동생성)</label>
                        <input id="docNum" class="input-box bg-gray-100" readonly placeholder="저장 시 생성됨">
                    </div>
                    <div>
                        <label class="text-xs text-slate-500 font-bold">${dateLabel}</label>
                        <input type="date" id="sDate" class="input-box">
                    </div>
                    <div>
                        <label class="text-xs text-slate-500 font-bold">거래처 (필수)</label>
                        <div class="flex">
                            <input id="sPartner" class="input-box" list="dl_product_list" onchange="DocumentBaseModule.fillPartnerInfo(this.value)" placeholder="업체 선택/입력">
                            ${extraButton}
                        </div>
                    </div>
                </div>
                <div class="grid grid-cols-3 gap-3 mb-2">
                    <div>
                        <label class="text-xs text-slate-500 font-bold">거래처 담당자</label>
                        <input id="sPManager" class="input-box">
                    </div>
                    <div>
                        <label class="text-xs text-slate-500 font-bold">연락처</label>
                        <input id="sPhone" class="input-box">
                    </div>
                    <div>
                        <label class="text-xs text-slate-500 font-bold">이메일</label>
                        <input id="sEmail" class="input-box">
                    </div>
                </div>
                <div class="mb-2">
                    <label class="text-xs text-slate-500 font-bold">사업장 주소</label>
                    <input id="sAddr" class="input-box">
                </div>
                <div class="grid grid-cols-2 gap-3 mb-2">
                    <div>
                        <label class="text-xs text-slate-500 font-bold">EndUser (실수요처)</label>
                        <input id="sEndUser" class="input-box">
                    </div>
                    <div>
                        <label class="text-xs text-slate-500 font-bold">담당자 (우리측)</label>
                        <input id="sManager" class="input-box">
                    </div>
                </div>
                <div>
                    <label class="text-xs text-slate-500 font-bold">비고</label>
                    <input id="sNote" class="input-box">
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
                            <td colspan="6" class="p-2 text-right border text-blue-600 text-lg">총 합계</td>
                            <td class="p-2 text-right border text-blue-600 text-lg" id="tTotal">0</td>
                            <td class="p-2 border"></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
            
            <button onclick="${type === 'quotes' ? 'QuotesModule' : 'OrdersModule'}.save()" class="w-full mt-4 bg-cyan-600 text-white py-3 rounded font-bold shadow-lg hover:bg-cyan-700 transition">
                저장하기
            </button>
            
            <datalist id="dl_part_doc"></datalist>
            <datalist id="dl_product_list"></datalist>
        `;
    },

    /**
     * [수정됨] 품목 입력 상단 버튼명 '행 추가' -> '품목 추가'로 복구
     */
    getItemInputHtml() {
        return `
            <div class="flex justify-between items-center mb-2">
                <h3 class="font-bold text-slate-700">품목 상세</h3>
                <button onclick="DocumentBaseModule.addItem()" class="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition">
                    <i class="fa-solid fa-plus"></i> 품목 추가
                </button>
            </div>
        `;
    },

    /**
     * 품목 리스트 렌더링 (Input 기능 유지)
     */
    renderItemGrid() {
        const tbody = document.getElementById('itemGrid');
        if (!tbody) return;

        tbody.innerHTML = AppState.tempItems.map((item, index) => {
            const qty = Number(item.quantity) || 0;
            const price = Number(item.unit_price) || 0;
            
            item.supply = qty * price;
            item.vat = Math.floor(item.supply * 0.1);
            item.total = item.supply + item.vat;

            return `
                <tr class="border-b hover:bg-slate-50">
                    <td class="p-2 text-center border text-slate-500">${index + 1}</td>
                    <td class="p-2 border">
                        <input type="text" class="w-full bg-transparent outline-none font-bold text-blue-900" 
                               list="dl_product_list"
                               value="${item.name || ''}" 
                               placeholder="품목 검색"
                               onchange="DocumentBaseModule.updateItemValue(${index}, 'name', this.value)">
                    </td>
                    <td class="p-2 border">
                        <input type="text" class="w-full bg-transparent outline-none" 
                               value="${item.spec || ''}" 
                               onchange="DocumentBaseModule.updateItemValue(${index}, 'spec', this.value)">
                    </td>
                    <td class="p-2 border">
                        <input type="text" class="w-full text-center bg-transparent outline-none" 
                               value="${item.unit || ''}" 
                               onchange="DocumentBaseModule.updateItemValue(${index}, 'unit', this.value)">
                    </td>
                    <td class="p-2 border">
                        <input type="number" class="w-full text-right font-bold bg-orange-50 px-1 outline-none focus:bg-orange-100" 
                               value="${qty}" 
                               onchange="DocumentBaseModule.updateItemValue(${index}, 'quantity', this.value)">
                    </td>
                    <td class="p-2 border">
                        <input type="number" class="w-full text-right font-bold bg-blue-50 px-1 outline-none focus:bg-blue-100" 
                               value="${price}" 
                               onchange="DocumentBaseModule.updateItemValue(${index}, 'unit_price', this.value)">
                    </td>
                    <td class="p-2 border text-right pr-2 text-slate-700" id="row-supply-${index}">
                        ${(item.supply || 0).toLocaleString()}
                    </td>
                    <td class="p-2 border text-center">
                        <button onclick="DocumentBaseModule.removeItem(${index})" 
                                class="text-red-400 hover:text-red-600 transition">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        this.updateFooterTotals();
    },

    /**
     * 값 변경 시 자동채우기 및 계산 로직
     */
    updateItemValue(index, field, value) {
        const item = AppState.tempItems[index];
        if (!item) return;

        if (field === 'name') {
            item.name = value;
            const product = AppState.productList.find(p => p.name === value);
            if (product) {
                item.spec = product.spec || '';
                item.unit = product.unit || '';
                item.unit_price = product.price || 0;
                this.renderItemGrid(); 
                return;
            }
        } else if (field === 'quantity' || field === 'unit_price') {
            item[field] = Number(value);
            item.supply = (item.quantity || 0) * (item.unit_price || 0);
            item.vat = Math.floor(item.supply * 0.1);
            item.total = item.supply + item.vat;

            const supplyCell = document.getElementById(`row-supply-${index}`);
            if (supplyCell) supplyCell.innerText = item.supply.toLocaleString();
            
            this.updateFooterTotals();
        } else {
            item[field] = value;
        }
    },

    /**
     * 하단 합계 업데이트
     */
    updateFooterTotals() {
        let tSupply = 0, tVat = 0, tTotal = 0;
        AppState.tempItems.forEach(i => {
            tSupply += (i.supply || 0);
            tVat += (i.vat || 0);
            tTotal += (i.total || 0);
        });
        
        const elSupply = document.getElementById('tSupply');
        const elVat = document.getElementById('tVat');
        const elTotal = document.getElementById('tTotal');

        if (elSupply) elSupply.innerText = tSupply.toLocaleString();
        if (elVat) elVat.innerText = tVat.toLocaleString();
        if (elTotal) elTotal.innerText = tTotal.toLocaleString();
    },

    /**
     * 품목 추가
     */
    addItem() {
        AppState.tempItems.push({
            name: '', spec: '', unit: '', quantity: 0, unit_price: 0, supply: 0, vat: 0, total: 0
        });
        this.renderItemGrid();
    },

    /**
     * 품목 삭제
     */
    removeItem(index) {
        AppState.tempItems.splice(index, 1);
        this.renderItemGrid();
    },

    /**
     * 거래처 정보 자동 입력
     */
    fillPartnerInfo(partnerName) {
        const partner = AppState.partnerList.find(p => p.name === partnerName);
        if (partner) {
            const setVal = (id, val) => {
                const el = document.getElementById(id);
                if (el) el.value = val || '';
            };
            setVal('sPManager', partner.manager_name);
            setVal('sPhone', partner.phone);
            setVal('sEmail', partner.email);
            setVal('sAddr', partner.address);
        }
    },

    /**
     * 폼 데이터 채우기 (수정 모드)
     */
    fillFormData(row) {
        setTimeout(() => {
            const setVal = (id, val) => {
                const el = document.getElementById(id);
                if (el) el.value = val || '';
            };

            setVal('docNum', row.quote_number || row.order_number);
            setVal('sDate', row.date);
            setVal('sPartner', row.partner_name);
            setVal('sEndUser', row.end_user);
            setVal('sManager', row.manager);
            setVal('sNote', row.note);
            
            setVal('sPManager', row.partner_manager);
            setVal('sPhone', row.phone);
            setVal('sEmail', row.email);
            setVal('sAddr', row.partner_address);

            AppState.tempItems = (row.items || []).map(item => ({...item}));
            this.renderItemGrid();
            
            fillDatalist('dl_part_doc', AppState.partnerList);
            fillDatalist('dl_product_list', AppState.productList);
        }, 50);
    },

    /**
     * 저장 데이터 생성
     */
    buildSaveData(type) {
        if (AppState.tempItems.length === 0) {
            alert("품목을 최소 하나 이상 추가해주세요.");
            return null;
        }

        let tSupply = 0, tVat = 0, tTotal = 0;
        AppState.tempItems.forEach(i => {
            tSupply += i.supply || 0;
            tVat += i.vat || 0;
            tTotal += i.total || 0;
        });

        const commonData = {
            date: el('sDate') || getToday(),
            partner_name: el('sPartner'),
            end_user: el('sEndUser'),
            manager: el('sManager'),
            note: el('sNote'),
            partner_manager: el('sPManager'),
            phone: el('sPhone'),
            email: el('sEmail'),
            partner_address: el('sAddr'),
            items: AppState.tempItems,
            total_supply: tSupply,
            total_vat: tVat,
            total_amount: tTotal
        };

        if (type === 'quotes') {
            commonData.quote_number = el('docNum'); 
        } else if (type === 'orders') {
            commonData.order_number = el('docNum');
        }

        return commonData;
    }
};

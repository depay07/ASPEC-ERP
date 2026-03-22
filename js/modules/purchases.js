// js/modules/purchases.js - 구매/입고 관리 모듈

const PurchasesModule = {
    tableName: 'purchases',
    
    /**
     * 검색 실행
     */
    async search() {
        showTableLoading(9);
        
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
        
        // 매입처 필터
        const partnerFilter = el('search_sPartner');
        if (partnerFilter) query = query.ilike('partner_name', `%${partnerFilter}%`);
        
        // 품목명 필터
        const itemFilter = el('search_sItem');
        if (itemFilter) query = query.ilike('item_name', `%${itemFilter}%`);
        
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
            showEmptyTable(9);
            return;
        }
        
        tbody.innerHTML = data.map(row => {
            const dataId = storeRowData(row);
            
            return `
                <tr class="hover:bg-slate-50 border-b transition">
                    <td class="text-center">${row.date}</td>
                    <td class="text-center">${row.manufacturer || '-'}</td>
                    <td>${row.partner_name}</td>
                    <td>${row.item_name}</td>
                    <td class="text-center font-bold">${row.qty}</td>
                    <td class="text-right">${formatNumber(row.unit_price)}</td>
                    <td class="text-right font-bold">${formatNumber(row.total_amount)}</td>
                    <td class="text-center">${row.serial_no || '-'}</td>
                    <td>${this.getActionButtons(dataId, row.id)}</td>
                </tr>`;
        }).join('');
    },
    
    /**
     * 액션 버튼
     */
    getActionButtons(dataId, rowId) {
        return `
            <div class="flex justify-center items-center gap-3">
                <button onclick="PurchasesModule.openEditModal('${dataId}')" class="text-blue-500 hover:text-blue-700 p-2 rounded hover:bg-blue-50 transition" title="수정">
                    <i class="fa-solid fa-pen-to-square fa-lg"></i>
                </button>
                <button onclick="PurchasesModule.delete(${rowId})" class="text-red-400 hover:text-red-600 p-2 rounded hover:bg-red-50 transition" title="삭제">
                    <i class="fa-solid fa-trash-can fa-lg"></i>
                </button>
            </div>`;
    },
    
    /**
     * 신규 등록 모달
     */
    openNewModal() {
        AppState.currentEditId = null;
        AppState.tempItems = [];
        openModal('구매(입고) 등록');
        
        const body = document.getElementById('modalBody');
        body.innerHTML = this.getFormHtml();
        
        document.getElementById('purDate').value = getToday();
        fillDatalist('dl_part_pur', AppState.partnerList);
        fillDatalist('dl_prod_pur', AppState.productList);
    },
    
    /**
     * 수정 모달
     */
    openEditModal(dataId) {
        const row = getRowData(dataId);
        if (!row) return alert('데이터 오류');
        
        // 단일 품목 수정 (기존 방식 호환)
        AppState.currentEditId = row.id;
        openModal('구매(입고) 수정');
        
        const body = document.getElementById('modalBody');
        body.innerHTML = this.getSingleEditFormHtml();
        
        setTimeout(() => {
            document.getElementById('purDate').value = row.date || '';
            document.getElementById('purPartner').value = row.partner_name || '';
            document.getElementById('purItem').value = row.item_name || '';
            document.getElementById('purMaker').value = row.manufacturer || '';
            document.getElementById('purQty').value = row.qty || '';
            document.getElementById('purPrice').value = row.unit_price || '';
            document.getElementById('purSerial').value = row.serial_no || '';
            document.getElementById('purNote').value = row.note || '';
            
            fillDatalist('dl_part_pur', AppState.partnerList);
            fillDatalist('dl_prod_pur', AppState.productList);
        }, 50);
    },

    /**
     * 발주서 불러오기 모달 (오버레이) 표시
     */
    async showPOSelector() {
        // 최근 발주 내역 20건 조회
        const { data, error } = await supabaseClient
            .from('purchase_orders')
            .select('id, po_number, date, partner_name, items, total_amount')
            .order('date', { ascending: false })
            .limit(20);

        if (error) {
            alert("발주 내역을 불러오는데 실패했습니다: " + error.message);
            return;
        }

        if (!data || data.length === 0) {
            alert("불러올 수 있는 발주 내역이 없습니다.");
            return;
        }

        // 오버레이 UI 생성
        const overlayHtml = `
            <div id="poSelectorOverlay" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]">
                <div class="bg-white rounded-lg shadow-xl w-[700px] max-h-[80vh] flex flex-col">
                    <div class="p-4 border-b flex justify-between items-center bg-slate-50 rounded-t-lg">
                        <h3 class="font-bold text-lg text-slate-800">발주서 불러오기</h3>
                        <button onclick="document.getElementById('poSelectorOverlay').remove()" class="text-gray-400 hover:text-red-500 transition">
                            <i class="fa-solid fa-xmark fa-xl"></i>
                        </button>
                    </div>
                    <div class="p-4 overflow-y-auto flex-1">
                        <table class="w-full text-sm border-collapse text-center">
                            <thead class="bg-slate-100 border-y sticky top-0">
                                <tr>
                                    <th class="p-2">발주일자</th>
                                    <th class="p-2">PO 번호</th>
                                    <th class="p-2">매입처</th>
                                    <th class="p-2">품목수</th>
                                    <th class="p-2">발주총액</th>
                                    <th class="p-2">선택</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${data.map(po => `
                                    <tr class="border-b hover:bg-slate-50 transition">
                                        <td class="p-2">${po.date}</td>
                                        <td class="p-2 text-blue-600 font-bold">${po.po_number}</td>
                                        <td class="p-2">${po.partner_name}</td>
                                        <td class="p-2">${po.items ? po.items.length : 0}건</td>
                                        <td class="p-2 text-right">${formatNumber(po.total_amount)}원</td>
                                        <td class="p-2">
                                            <button onclick="PurchasesModule.loadPOData(${po.id})" class="bg-blue-500 text-white px-3 py-1 rounded text-xs hover:bg-blue-600 font-bold shadow-sm">
                                                적용
                                            </button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>`;
        
        document.body.insertAdjacentHTML('beforeend', overlayHtml);
    },

    /**
     * 선택한 발주 데이터를 입고 폼에 적용
     */
    async loadPOData(poId) {
        // 상세 데이터 조회
        const { data: po, error } = await supabaseClient
            .from('purchase_orders')
            .select('*')
            .eq('id', poId)
            .single();

        if (error || !po) {
            alert("발주 상세 데이터를 불러오는데 실패했습니다.");
            return;
        }

        // 모달창 닫기
        const overlay = document.getElementById('poSelectorOverlay');
        if (overlay) overlay.remove();

        // 매입처 및 비고 세팅
        document.getElementById('purPartner').value = po.partner_name || '';
        document.getElementById('purNote').value = po.po_number ? `[${po.po_number}] 발주 연동` : '';

        // 품목 데이터를 입고 배열(AppState.tempItems) 형식에 맞게 변환하여 세팅
        if (po.items && Array.isArray(po.items)) {
            AppState.tempItems = po.items.map(item => {
                // 발주 데이터의 key와 입고 데이터의 key 매핑
                const qty = Number(item.qty) || 1;
                const price = Number(item.price) || Number(item.unit_price) || 0;
                
                return {
                    name: item.name || '',
                    manufacturer: item.manufacturer || '', 
                    serial_no: '', // 입고 시 검수용으로 비워둠
                    qty: qty,
                    unit_price: price,
                    total_amount: qty * price
                };
            });
            
            // 그리드 화면 재렌더링
            this.renderItemGrid();
        }
    },
    
    /**
     * 폼 HTML (다중 품목 입고)
     */
    getFormHtml() {
        return `
            <div class="bg-slate-50 p-4 rounded mb-4 border">
                <div class="grid grid-cols-2 gap-3 mb-2">
                    <div>
                        <label class="text-xs text-slate-500">입고일자</label>
                        <input type="date" id="purDate" class="input-box">
                    </div>
                    <div>
                        <div class="flex justify-between items-end mb-1">
                            <label class="text-xs text-slate-500">매입처 (공통)</label>
                            <button type="button" onclick="PurchasesModule.showPOSelector()" class="bg-orange-500 text-white px-2 py-0.5 rounded text-xs font-bold hover:bg-orange-600 transition shadow-sm">
                                <i class="fa-solid fa-cloud-arrow-down"></i> 발주서 불러오기
                            </button>
                        </div>
                        <input id="purPartner" class="input-box" list="dl_part_pur">
                    </div>
                </div>
                <div>
                    <label class="text-xs text-slate-500">비고 (공통)</label>
                    <input id="purNote" class="input-box">
                </div>
            </div>
            
            <div class="bg-white border p-3 rounded mb-4 shadow-sm">
                <div class="flex flex-wrap gap-2 items-end">
                    <div class="w-1/4">
                        <label class="text-xs">품목명</label>
                        <input id="purItem" class="input-box" list="dl_prod_pur">
                    </div>
                    <div class="w-1/6">
                        <label class="text-xs">제조사</label>
                        <input id="purMaker" class="input-box">
                    </div>
                    <div class="w-1/6">
                        <label class="text-xs">시리얼</label>
                        <input id="purSerial" class="input-box">
                    </div>
                    <div class="w-16">
                        <label class="text-xs">수량</label>
                        <input type="number" id="purQty" class="input-box" value="1">
                    </div>
                    <div class="w-24">
                        <label class="text-xs">단가</label>
                        <input type="number" id="purPrice" class="input-box">
                    </div>
                    <button onclick="PurchasesModule.addItem()" class="bg-slate-700 text-white px-4 py-2 rounded font-bold text-sm h-9">추가</button>
                </div>
            </div>
            
            <table class="w-full text-sm border-collapse border text-center mb-4">
                <thead class="bg-slate-100">
                    <tr><th>품목명</th><th>제조사</th><th>시리얼</th><th>수량</th><th>단가</th><th>합계</th><th>삭제</th></tr>
                </thead>
                <tbody id="purItemGrid"></tbody>
            </table>
            
            <div class="text-right text-lg font-bold text-cyan-700">
                총 합계: <span id="purGrandTotal">0</span>원
            </div>
            
            <button onclick="PurchasesModule.save()" class="w-full mt-4 bg-cyan-600 text-white py-3 rounded font-bold shadow-lg hover:bg-cyan-700 transition">
                입고 처리 (저장)
            </button>
            
            <datalist id="dl_part_pur"></datalist>
            <datalist id="dl_prod_pur"></datalist>`;
    },
    
    /**
     * 단일 품목 수정 폼
     */
    getSingleEditFormHtml() {
        return `
            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="text-xs">입고일자</label>
                    <input type="date" id="purDate" class="input-box">
                </div>
                <div>
                    <label class="text-xs">매입처</label>
                    <input id="purPartner" class="input-box" list="dl_part_pur">
                </div>
                <div>
                    <label class="text-xs">품목명</label>
                    <input id="purItem" class="input-box" list="dl_prod_pur">
                </div>
                <div>
                    <label class="text-xs">제조사</label>
                    <input id="purMaker" class="input-box">
                </div>
                <div>
                    <label class="text-xs">수량</label>
                    <input type="number" id="purQty" class="input-box">
                </div>
                <div>
                    <label class="text-xs">단가</label>
                    <input type="number" id="purPrice" class="input-box">
                </div>
                <div>
                    <label class="text-xs">시리얼</label>
                    <input id="purSerial" class="input-box">
                </div>
                <div>
                    <label class="text-xs">비고</label>
                    <input id="purNote" class="input-box">
                </div>
            </div>
            <button onclick="PurchasesModule.saveEdit()" class="w-full mt-4 bg-cyan-600 text-white py-3 rounded font-bold hover:bg-cyan-700 transition">
                저장
            </button>
            <datalist id="dl_part_pur"></datalist>
            <datalist id="dl_prod_pur"></datalist>`;
    },
    
    /**
     * 품목 추가 (다중 입고용)
     */
    addItem() {
        const name = el('purItem');
        const maker = el('purMaker');
        const serial = el('purSerial');
        const qty = parseInt(el('purQty')) || 0;
        const price = parseInt(el('purPrice')) || 0;
        
        if (!name) return alert("품목명을 입력해주세요.");
        if (qty <= 0) return alert("수량은 1개 이상이어야 합니다.");
        
        AppState.tempItems.push({
            name: name,
            manufacturer: maker,
            serial_no: serial,
            qty: qty,
            unit_price: price,
            total_amount: qty * price
        });
        
        // 입력 필드 초기화
        document.getElementById('purItem').value = '';
        document.getElementById('purMaker').value = '';
        document.getElementById('purSerial').value = '';
        document.getElementById('purQty').value = '1';
        document.getElementById('purPrice').value = '';
        document.getElementById('purItem').focus();
        
        this.renderItemGrid();
    },
    
    /**
     * 품목 그리드 렌더링
     */
    renderItemGrid() {
        const tbody = document.getElementById('purItemGrid');
        const totalEl = document.getElementById('purGrandTotal');
        if (!tbody) return;
        
        let grandTotal = 0;
        
        tbody.innerHTML = AppState.tempItems.map((item, idx) => {
            grandTotal += item.total_amount;
            return `
                <tr class="border-b hover:bg-slate-50">
                    <td class="p-2">${item.name}</td>
                    <td class="p-2 text-xs text-slate-500">${item.manufacturer || '-'}</td>
                    <td class="p-2 text-xs text-blue-600">${item.serial_no || '-'}</td>
                    <td class="p-2 font-bold">${item.qty}</td>
                    <td class="p-2 text-right text-slate-600">${formatNumber(item.unit_price)}</td>
                    <td class="p-2 text-right font-bold">${formatNumber(item.total_amount)}</td>
                    <td class="p-2">
                        <button onclick="PurchasesModule.removeItem(${idx})" class="text-red-400 hover:text-red-600">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </td>
                </tr>`;
        }).join('');
        
        if (totalEl) totalEl.innerText = formatNumber(grandTotal);
    },
    
    /**
     * 품목 제거
     */
    removeItem(idx) {
        AppState.tempItems.splice(idx, 1);
        this.renderItemGrid();
    },
    
    /**
     * 저장 (다중 입고)
     */
   async save() {
        if (AppState.tempItems.length === 0) {
            return alert("입고할 품목을 추가해주세요.");
        }
        
        const dateVal = el('purDate');
        const partnerVal = el('purPartner');
        const noteVal = el('purNote');
        
        if (!dateVal || !partnerVal) {
            return alert("날짜와 매입처를 입력해주세요.");
        }
        
        let successCount = 0;
        
        for (const item of AppState.tempItems) {
            // 1. 구매 이력 저장 (기존 로직 유지)
            const data = {
                date: dateVal,
                partner_name: partnerVal,
                item_name: item.name,
                manufacturer: item.manufacturer,
                qty: item.qty,
                unit_price: item.unit_price,
                supply_price: item.unit_price * item.qty,
                vat: Math.floor(item.unit_price * item.qty * 0.1),
                total_amount: item.total_amount,
                serial_no: item.serial_no,
                note: noteVal
            };
            
            const { error } = await supabaseClient.from(this.tableName).insert(data);
            
            if (!error) {
                successCount++;
                
                // 2. 재고(Products) 테이블 업데이트 로직 개선
                // 기존에 등록된 품목인지 확인
                const prod = AppState.productList.find(p => p.name === item.name);
                
                if (prod) {
                    // CASE A: 이미 존재하는 품목이면 -> 수량(Stock) 추가
                    await supabaseClient.from('products').update({
                        stock: (prod.stock || 0) + item.qty,
                        last_vendor: partnerVal,
                        last_price: item.unit_price,
                        last_serial_no: item.serial_no,
                        manufacturer: item.manufacturer || prod.manufacturer
                    }).eq('id', prod.id);
                } else {
                    // CASE B: 없는 품목이면 -> 신규 품목으로 등록
                    await supabaseClient.from('products').insert({
                        name: item.name,
                        manufacturer: item.manufacturer,
                        stock: item.qty, // 초기 재고
                        category: '기타', // 카테고리 컬럼이 필수라면 기본값 설정 필요
                        purchase_price: item.unit_price, // 매입가 참조용
                        location: '입고대기', // 기본 위치
                        last_vendor: partnerVal,
                        last_serial_no: item.serial_no
                    });
                }
            }
        }
        
        if (successCount > 0) {
            alert(`${successCount}건의 품목이 입고 처리되었습니다.`);
            closeModal();
            await fetchMasterData(); // 마스터 데이터(재고 목록) 갱신
            this.search();
        } else {
            alert("저장에 실패했습니다.");
        }
    },
    
    /**
     * 저장 (단일 수정)
     */
    async saveEdit() {
        const qty = parseInt(el('purQty')) || 0;
        const price = parseInt(el('purPrice')) || 0;
        
        const data = {
            date: el('purDate'),
            partner_name: el('purPartner'),
            item_name: el('purItem'),
            manufacturer: el('purMaker'),
            qty: qty,
            unit_price: price,
            supply_price: qty * price,
            vat: Math.floor(qty * price * 0.1),
            total_amount: qty * price,
            serial_no: el('purSerial'),
            note: el('purNote')
        };
        
        const { error } = await supabaseClient
            .from(this.tableName)
            .update(data)
            .eq('id', AppState.currentEditId);
        
        if (error) {
            alert("저장 실패: " + error.message);
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

// js/modules/bookkeeping.js - 기장 관리 모듈

const BookkeepingModule = {
    tableName: 'bookkeeping',
    
    /**
     * 검색 실행
     */
    async search() {
        showTableLoading(7);
        
        let query = supabaseClient
            .from(this.tableName)
            .select('*')
            .order('date', { ascending: false });
        
        // 날짜 필터
        const startDate = el('searchStartDate');
        const endDate = el('searchEndDate');
        if (startDate && endDate) {
            query = query.gte('date', startDate).lte('date', endDate);
        }
        
        // 카테고리 필터
        const category = el('search_sCategory');
        if (category) query = query.eq('category', category);
        
        // 사용처 필터
        const usage = el('search_sUsage');
        if (usage) query = query.ilike('usage_desc', `%${usage}%`);
        
        const { data, error } = await query;
        
        if (error) {
            alert("검색 실패: " + error.message);
            return;
        }
                // ==========================================
        // ✨ [추가된 부분] 총 사용금액 계산 및 표시
        // ==========================================
        if (data && data.length > 0) {
            // data 배열을 순회하며 금액(amount) 컬럼의 합을 구합니다.
            // DB 컬럼명이 'amount'가 아니라면 'price', 'cost' 등 실제 컬럼명으로 변경하세요.
            const totalSum = data.reduce((sum, row) => {
                return sum + (Number(row.amount) || 0); 
            }, 0);

            // HTML에 표시 (천단위 콤마 포맷팅 포함)
            const displayEl = document.getElementById('totalAmountDisplay');
            if (displayEl) {
                displayEl.innerHTML = `총 합계: ${totalSum.toLocaleString()}원`;
            }
        } else {
            // 데이터가 없을 경우 0원으로 초기화
            const displayEl = document.getElementById('totalAmountDisplay');
            if (displayEl) {
                displayEl.innerHTML = `총 합계: 0원`;
            }
        }

        this.renderTable(data);
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
            const dataId = storeRowData(row);
            const methodClass = row.payment_method === '사업자카드' 
                ? 'bg-blue-100 text-blue-700' 
                : 'bg-slate-100';
            
            return `
                <tr class="hover:bg-slate-50 border-b transition">
                    <td class="text-center">${row.date}</td>
                    <td class="text-center font-bold text-slate-600">${row.category}</td>
                    <td>${row.usage_desc}</td>
                    <td class="text-center">
                        <span class="px-2 py-1 rounded text-xs ${methodClass}">${row.payment_method || '-'}</span>
                    </td>
                    <td class="text-right font-bold">${formatNumber(row.amount)}원</td>
                    <td>${row.note || ''}</td>
                    <td>${this.getActionButtons(dataId, row.id)}</td>
                </tr>`;
        }).join('');
    },
    
    /**
     * 액션 버튼 HTML
     */
    getActionButtons(dataId, rowId) {
        return `
            <div class="flex justify-center items-center gap-3">
                <button onclick="BookkeepingModule.openEditModal('${dataId}')" class="text-blue-500 hover:text-blue-700 p-2 rounded hover:bg-blue-50 transition" title="수정">
                    <i class="fa-solid fa-pen-to-square fa-lg"></i>
                </button>
                <button onclick="BookkeepingModule.delete(${rowId})" class="text-red-400 hover:text-red-600 p-2 rounded hover:bg-red-50 transition" title="삭제">
                    <i class="fa-solid fa-trash-can fa-lg"></i>
                </button>
            </div>`;
    },
    
    /**
     * 신규 등록 모달 열기
     */
    openNewModal() {
        AppState.currentEditId = null;
        openModal('기장 등록');
        
        const body = document.getElementById('modalBody');
        body.innerHTML = this.getFormHtml();
        
        // 오늘 날짜 설정
        document.getElementById('bkDate').value = getToday();
    },
    
    /**
     * 수정 모달 열기
     */
    openEditModal(dataId) {
        const row = getRowData(dataId);
        if (!row) return alert('데이터 오류');
        
        AppState.currentEditId = row.id;
        openModal('기장 수정');
        
        const body = document.getElementById('modalBody');
        body.innerHTML = this.getFormHtml();
        
        // 데이터 채우기
        setTimeout(() => {
            document.getElementById('bkDate').value = row.date || '';
            document.getElementById('bkCategory').value = row.category || '';
            document.getElementById('bkUsage').value = row.usage_desc || '';
            document.getElementById('bkMethod').value = row.payment_method || '';
            document.getElementById('bkAmount').value = row.amount || '';
            document.getElementById('bkNote').value = row.note || '';
        }, 50);
    },
    
    /**
     * 폼 HTML
     */
    getFormHtml() {
        return `
            <div class="bg-yellow-50 p-4 rounded mb-4 border border-yellow-200">
                <h3 class="text-sm font-bold text-yellow-800 mb-2">
                    <i class="fa-solid fa-lightbulb"></i> 1인 사업자 비용 가이드
                </h3>
                <p class="text-xs text-slate-700 mb-1">· <strong>식대</strong>: 직원 없는 1인 사업자는 원칙적 불가</p>
                <p class="text-xs text-slate-700 mb-1">· <strong>차량유지비</strong>: 업무용 차량의 주유비, 수리비, 자동차세 등</p>
                <p class="text-xs text-slate-700 mb-1">· <strong>여비교통비</strong>: 출장 시 식사, 대중교통비, 주차비</p>
                <p class="text-xs text-slate-700 mb-1">· <strong>비품/소모품비</strong>: 100만 원 기준 자산/비용 구분</p>
            </div>
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="text-xs font-bold text-slate-700">지출 일자</label>
                    <input type="date" id="bkDate" class="input-box">
                </div>
                <div>
                    <label class="text-xs font-bold text-slate-700">계정 과목</label>
                    <select id="bkCategory" class="input-box">
                        <option value="소모품비">소모품비</option>
                        <option value="비품">비품</option>
                        <option value="차량유지비">차량유지비</option>
                        <option value="여비교통비">여비교통비</option>
                        <option value="접대비">접대비</option>
                        <option value="식대">식대</option>
                        <option value="도서인쇄비">도서인쇄비</option>
                        <option value="통신비">통신비</option>
                        <option value="임차료">임차료</option>
                        <option value="지급수수료">지급수수료</option>
                        <option value="광고선전비">광고선전비</option>
                        <option value="기타">기타</option>
                    </select>
                </div>
                <div class="col-span-2">
                    <label class="text-xs font-bold text-slate-700">사용처 / 적요 (필수)</label>
                    <input id="bkUsage" class="input-box" placeholder="예: OO식당 점심식사">
                </div>
                <div>
                    <label class="text-xs font-bold text-slate-700">결제 수단</label>
                    <select id="bkMethod" class="input-box">
                        <option value="사업자카드">사업자카드</option>
                        <option value="개인카드">개인카드</option>
                        <option value="현금영수증">현금영수증</option>
                        <option value="계좌이체">계좌이체</option>
                        <option value="기타">기타</option>
                    </select>
                </div>
                <div>
                    <label class="text-xs font-bold text-slate-700">공급대가 (VAT포함)</label>
                    <input type="number" id="bkAmount" class="input-box" placeholder="숫자만 입력">
                </div>
                <div class="col-span-2">
                    <label class="text-xs font-bold text-slate-700">비고</label>
                    <input id="bkNote" class="input-box" placeholder="메모 사항">
                </div>
            </div>
            <button onclick="BookkeepingModule.save()" class="w-full mt-6 bg-slate-800 text-white py-3 rounded font-bold hover:bg-slate-900 transition">
                저장하기
            </button>`;
    },
    
    /**
     * 저장
     */
    async save() {
        const usage = el('bkUsage');
        const amount = el('bkAmount');
        
        if (!usage || !amount) {
            alert('사용처와 금액은 필수입니다.');
            return;
        }
        
        const data = {
            date: el('bkDate'),
            category: el('bkCategory'),
            usage_desc: usage,
            payment_method: el('bkMethod'),
            amount: parseInt(amount) || 0,
            note: el('bkNote')
        };
        
        // 저장 실행
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

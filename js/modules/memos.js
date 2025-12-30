const MemosModule = {
    tableName: 'memos',
    
    // 1. 검색 및 목록 불러오기
    async search() {
        const container = document.getElementById('listBody');
        // 로딩 표시
        container.innerHTML = '<div class="col-span-full text-center py-10">메모를 불러오는 중...</div>';
        
        let query = supabaseClient
            .from(this.tableName)
            .select('*')
            .order('created_at', { ascending: false });
        
        // 검색어 필터
        const keyword = typeof el === 'function' && el('search_memoContent'); // el 함수가 없을 경우 대비 안전장치
        if (keyword) query = query.ilike('content', `%${keyword}%`);
        
        const { data, error } = await query;
        if (error) {
            alert("조회 실패: " + error.message);
            return;
        }
        
        // 데이터가 로드되면 카드 렌더링 함수 호출
        this.renderCards(data);
    },
    
    // 2. 카드 그리기 (작은 사이즈 + 더블클릭 이벤트)
    renderCards(data) {
        const container = document.getElementById('listBody');
        
        if (!data || data.length === 0) {
            container.innerHTML = '<div class="col-span-full text-center py-10 text-slate-400">등록된 메모가 없습니다.</div>';
            return;
        }
        
        container.innerHTML = data.map(row => {
            const dataId = storeRowData(row); // utils.js의 storeRowData 사용 가정
            const dateStr = row.created_at ? row.created_at.split('T')[0] : '';
            
            return `
                <div ondblclick="MemosModule.openDetailModal('${dataId}')"
                     class="h-48 p-4 rounded-xl shadow-sm border-t-4 transition hover:shadow-md hover:-translate-y-1 relative flex flex-col cursor-pointer overflow-hidden bg-white" 
                     style="border-top-color: ${row.color || '#06b6d4'};">
                    
                    <div class="flex justify-between items-center mb-2 flex-shrink-0">
                        <span class="text-[11px] font-bold text-slate-400">${dateStr}</span>
                        <div class="flex gap-2" onclick="event.stopPropagation()"> 
                            <button onclick="MemosModule.openEditModal('${dataId}')" class="text-slate-400 hover:text-blue-500">
                                <i class="fa-solid fa-pen"></i>
                            </button>
                            <button onclick="MemosModule.delete(${row.id})" class="text-slate-400 hover:text-red-500">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                        </div>
                    </div>

                    <div class="text-sm text-slate-700 leading-relaxed overflow-hidden">
                        <div class="line-clamp-6 whitespace-pre-wrap">
                            ${row.content}
                        </div>
                    </div>
                </div>`;
        }).join('');
    },
    
    // 3. 새 메모 등록 모달 열기
    openNewModal() {
        AppState.currentEditId = null;
        openModal('새 메모 등록');
        document.getElementById('modalBody').innerHTML = this.getFormHtml();
    },
    
    // 4. 수정 모달 열기
    openEditModal(dataId) {
        const row = getRowData(dataId);
        if (!row) return;
        
        AppState.currentEditId = row.id;
        openModal('메모 수정');
        const body = document.getElementById('modalBody');
        body.innerHTML = this.getFormHtml();
        
        document.getElementById('memoContent').value = row.content || '';
        document.getElementById('memoColor').value = row.color || '#06b6d4';
    },

    // 5. [신규] 상세 보기 모달 (더블클릭 시 실행)
    openDetailModal(dataId) {
        const row = getRowData(dataId);
        if (!row) return;

        openModal('메모 상세 내용'); 
        const body = document.getElementById('modalBody');
        
        body.innerHTML = `
            <div class="flex flex-col h-full">
                <div class="flex justify-end mb-2">
                    <span class="text-xs text-slate-400">${row.created_at ? row.created_at.split('T')[0] : ''}</span>
                </div>
                <div class="flex-1 p-4 bg-slate-50 rounded-lg border border-slate-200 overflow-y-auto max-h-[60vh]">
                    <p class="text-slate-800 whitespace-pre-wrap leading-relaxed text-base">${row.content}</p>
                </div>
                <div class="mt-4 flex justify-end gap-2">
                    <button onclick="closeModal()" class="px-4 py-2 bg-slate-200 text-slate-700 rounded hover:bg-slate-300 transition">닫기</button>
                    <button onclick="MemosModule.openEditModal('${dataId}')" class="px-4 py-2 bg-slate-800 text-white rounded hover:bg-slate-900 transition">수정하기</button>
                </div>
            </div>
        `;
    },

    // 6. 입력 폼 HTML 반환
    getFormHtml() {
        return `
            <div class="space-y-4">
                <div>
                    <label class="text-xs font-bold text-slate-700">메모 내용</label>
                    <textarea id="memoContent" class="w-full h-48 p-3 border rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none resize-none mt-1" placeholder="내용을 입력하세요..."></textarea>
                </div>
                <div>
                    <label class="text-xs font-bold text-slate-700 block mb-1">라벨 색상</label>
                    <input type="color" id="memoColor" value="#06b6d4" class="w-full h-10 rounded cursor-pointer border-none bg-transparent">
                </div>
                <button onclick="MemosModule.save()" class="w-full bg-slate-800 text-white py-3 rounded-lg font-bold hover:bg-slate-900 transition">
                    메모 저장
                </button>
            </div>`;
    },
    
    // 7. 저장 (추가/수정)
    async save() {
        const content = document.getElementById('memoContent').value;
        const color = document.getElementById('memoColor').value;
        
        if (!content) return alert('내용을 입력해주세요.');
        
        const data = { content, color };
        
        let result;
        if (AppState.currentEditId) {
            result = await supabaseClient.from(this.tableName).update(data).eq('id', AppState.currentEditId);
        } else {
            result = await supabaseClient.from(this.tableName).insert(data);
        }
        
        if (result.error) return alert("저장 실패: " + result.error.message);
        
        closeModal();
        this.search();
    },
    
    // 8. 삭제
    async delete(id) {
        if (!confirm("삭제하시겠습니까?")) return;
        const { error } = await supabaseClient.from(this.tableName).delete().eq('id', id);
        if (error) return alert("삭제 실패");
        this.search();
    }
};

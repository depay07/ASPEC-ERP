// js/modules/memos.js - 메모 관리 모듈

const MemosModule = {
    tableName: 'memos',
    
    /**
     * 메모 목록 가져오기 (검색 기능 포함)
     */
    async search() {
        // 별도의 로딩 표시기가 있다면 사용 (예: showTableLoading)
        
        let query = supabaseClient
            .from(this.tableName)
            .select('*')
            .order('created_at', { ascending: false });
        
        // 검색 필터 (필요 시)
        const keyword = el('search_memoContent');
        if (keyword) query = query.ilike('content', `%${keyword}%`);
        
        const { data, error } = await query;
        
        if (error) {
            alert("메모를 불러오는데 실패했습니다: " + error.message);
            return;
        }
        
        this.renderCards(data);
    },
    
    /**
     * 메모 카드 렌더링 (그리드 스타일)
     */
    renderCards(data) {
        const container = document.getElementById('listBody'); // 기존 테이블 바디 ID를 쓰거나 별도 div 지정
        
        if (!data || data.length === 0) {
            container.innerHTML = `<div class="col-span-full text-center py-10 text-slate-400">등록된 메모가 없습니다.</div>`;
            return;
        }
        
        // 테이블 형태가 아닌 카드 형태로 보이게 하려면 container의 클래스를 조정해야 할 수 있습니다.
        // 기존 listBody가 <tbody>라면 아래 구조 대신 <tr>을 유지하거나, 
        // HTML 구조를 div 기반의 그리드로 바꾸는 것을 추천합니다.
        
        container.innerHTML = data.map(row => {
            const dateStr = new Date(row.created_at).toLocaleDateString();
            return `
                <div class="memo-card p-4 rounded-lg shadow-sm border-l-4 transition hover:shadow-md relative" 
                     style="background-color: ${row.color || '#fff9c4'}; border-color: rgba(0,0,0,0.1);">
                    <div class="flex justify-between items-start mb-2">
                        <span class="text-[10px] text-slate-500 font-mono">${dateStr}</span>
                        <button onclick="MemosModule.delete(${row.id})" class="text-slate-400 hover:text-red-500 transition">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                    <div class="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed cursor-pointer" 
                         onclick="MemosModule.openEditModal(${row.id}, '${encodeURIComponent(row.content)}')">
                        ${row.content}
                    </div>
                </div>`;
        }).join('');

        // 부모 컨테이너가 그리드 레이아웃이 되도록 설정 (기존 listBody가 div일 경우)
        container.className = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4";
    },

    /**
     * 등록 모달 열기
     */
    openNewModal() {
        AppState.currentEditId = null;
        openModal('새 메모 등록');
        const body = document.getElementById('modalBody');
        body.innerHTML = this.getFormHtml();
    },

    /**
     * 수정 모달 열기
     */
    openEditModal(id, encodedContent) {
        AppState.currentEditId = id;
        openModal('메모 수정');
        const body = document.getElementById('modalBody');
        body.innerHTML = this.getFormHtml();
        
        document.getElementById('memoContent').value = decodeURIComponent(encodedContent);
    },

    /**
     * 폼 HTML
     */
    getFormHtml() {
        return `
            <div class="flex flex-col gap-4">
                <div>
                    <label class="text-xs font-bold text-slate-700">메모 내용</label>
                    <textarea id="memoContent" class="input-box h-48 resize-none p-4 mt-1 border-2 focus:border-slate-400" 
                              placeholder="아이디어나 기억해야 할 업무를 적으세요."></textarea>
                </div>
                <div class="flex gap-2">
                    <label class="text-xs font-bold text-slate-700">색상 선택:</label>
                    <input type="color" id="memoColor" value="#fff9c4" class="w-8 h-8 cursor-pointer border-none bg-transparent">
                </div>
            </div>
            <button onclick="MemosModule.save()" class="w-full mt-6 bg-slate-800 text-white py-3 rounded font-bold hover:bg-slate-900 transition">
                메모 저장
            </button>`;
    },

    /**
     * 저장 (등록/수정)
     */
    async save() {
        const content = el('memoContent');
        const color = document.getElementById('memoColor').value;
        
        if (!content) return alert('내용을 입력해주세요.');
        
        const data = {
            content: content,
            color: color
        };
        
        let result;
        if (AppState.currentEditId) {
            result = await supabaseClient.from(this.tableName).update(data).eq('id', AppState.currentEditId);
        } else {
            result = await supabaseClient.from(this.tableName).insert(data);
        }
        
        if (result.error) {
            alert("저장 실패: " + result.error.message);
            return;
        }
        
        closeModal();
        this.search();
    },

    /**
     * 삭제
     */
    async delete(id) {
        if (!confirm("메모를 삭제하시겠습니까?")) return;
        const { error } = await supabaseClient.from(this.tableName).delete().eq('id', id);
        if (error) return alert("삭제 실패: " + error.message);
        this.search();
    }
};

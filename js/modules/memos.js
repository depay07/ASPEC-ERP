const MemosModule = {
    tableName: 'memos',
    
    async search() {
        // 검색 중 표시
        const container = document.getElementById('listBody');
        container.innerHTML = '<div class="col-span-full text-center py-10">메모를 불러오는 중...</div>';
        
        let query = supabaseClient
            .from(this.tableName)
            .select('*')
            .order('created_at', { ascending: false });
        
        const keyword = el('search_memoContent');
        if (keyword) query = query.ilike('content', `%${keyword}%`);
        
        const { data, error } = await query;
        if (error) {
            alert("조회 실패: " + error.message);
            return;
        }
        this.renderCards(data);
    },
    
    renderCards(data) {
        const container = document.getElementById('listBody');
        if (!data || data.length === 0) {
            container.innerHTML = '<div class="col-span-full text-center py-10 text-slate-400">등록된 메모가 없습니다.</div>';
            return;
        }
        
        container.innerHTML = data.map(row => {
            const dataId = storeRowData(row); // utils.js 함수 사용
            const dateStr = row.created_at ? row.created_at.split('T')[0] : '';
            
            return `
                <div class="p-5 rounded-xl shadow-sm border-t-4 transition hover:shadow-md relative flex flex-col justify-between" 
                     style="background-color: white; border-top-color: ${row.color || '#06b6d4'};">
                    <div class="mb-4">
                        <div class="flex justify-between items-center mb-2">
                            <span class="text-[11px] font-bold text-slate-400">${dateStr}</span>
                            <div class="flex gap-2">
                                <button onclick="MemosModule.openEditModal('${dataId}')" class="text-slate-400 hover:text-blue-500">
                                    <i class="fa-solid fa-pen"></i>
                                </button>
                                <button onclick="MemosModule.delete(${row.id})" class="text-slate-400 hover:text-red-500">
                                    <i class="fa-solid fa-trash-can"></i>
                                </button>
                            </div>
                        </div>
                        <div class="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                            ${row.content}
                        </div>
                    </div>
                </div>`;
        }).join('');
    },
    
    openNewModal() {
        AppState.currentEditId = null;
        openModal('새 메모 등록');
        document.getElementById('modalBody').innerHTML = this.getFormHtml();
    },
    
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
    
    async delete(id) {
        if (!confirm("삭제하시겠습니까?")) return;
        const { error } = await supabaseClient.from(this.tableName).delete().eq('id', id);
        if (error) return alert("삭제 실패");
        this.search();
    }
};

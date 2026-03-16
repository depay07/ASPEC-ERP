const MemosModule = {
    tableName: 'memos',
    bucketName: 'memos', // Supabase Storage 버킷 이름

    // 1. 검색 및 목록 불러오기 (기존과 동일)
    async search() {
        const container = document.getElementById('listBody');
        container.innerHTML = '<div class="col-span-full text-center py-10">메모를 불러오는 중...</div>';
        
        let query = supabaseClient
            .from(this.tableName)
            .select('*')
            .order('created_at', { ascending: false });
        
        const keyword = typeof el === 'function' && el('search_memoContent');
        if (keyword) query = query.ilike('content', `%${keyword}%`);
        
        const { data, error } = await query;
        if (error) {
            alert("조회 실패: " + error.message);
            return;
        }
        this.renderCards(data);
    },
    
    // 2. 카드 그리기 (이미지 썸네일 추가)
    renderCards(data) {
        const container = document.getElementById('listBody');
        if (!data || data.length === 0) {
            container.innerHTML = '<div class="col-span-full text-center py-10 text-slate-400">등록된 메모가 없습니다.</div>';
            return;
        }
        
        container.innerHTML = data.map(row => {
            const dataId = storeRowData(row);
            const dateStr = row.created_at ? row.created_at.split('T')[0] : '';
            // 이미지가 있으면 표시
            const imageHtml = row.image_url ? 
                `<div class="w-full h-24 mb-2 overflow-hidden rounded-lg bg-slate-100">
                    <img src="${row.image_url}" class="w-full h-full object-cover">
                </div>` : '';
            
            return `
                <div ondblclick="MemosModule.openDetailModal('${dataId}')"
                     class="min-h-48 p-4 rounded-xl shadow-sm border-t-4 transition hover:shadow-md hover:-translate-y-1 relative flex flex-col cursor-pointer overflow-hidden bg-white" 
                     style="border-top-color: ${row.color || '#06b6d4'};">
                    
                    <div class="flex justify-between items-center mb-2 flex-shrink-0">
                        <span class="text-[11px] font-bold text-slate-400">${dateStr}</span>
                        <div class="flex gap-2" onclick="event.stopPropagation()"> 
                            <button onclick="MemosModule.openEditModal('${dataId}')" class="text-slate-400 hover:text-blue-500">
                                <i class="fa-solid fa-pen"></i>
                            </button>
                            <button onclick="MemosModule.delete(${row.id}, '${row.image_url}')" class="text-slate-400 hover:text-red-500">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                        </div>
                    </div>

                    ${imageHtml}

                    <div class="text-sm text-slate-700 leading-relaxed overflow-hidden">
                        <div class="line-clamp-3 whitespace-pre-wrap">${row.content}</div>
                    </div>
                </div>`;
        }).join('');
    },

    // 3~5. 모달 관련 함수 (기존 로직 유지하되 getFormHtml 반영)
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
        document.getElementById('modalBody').innerHTML = this.getFormHtml(row.image_url);
        document.getElementById('memoContent').value = row.content || '';
        document.getElementById('memoColor').value = row.color || '#06b6d4';
    },

    openDetailModal(dataId) {
        const row = getRowData(dataId);
        if (!row) return;
        openModal('메모 상세 내용'); 
        const imageHtml = row.image_url ? `<img src="${row.image_url}" class="w-full rounded-lg mb-4 border shadow-sm">` : '';
        
        document.getElementById('modalBody').innerHTML = `
            <div class="flex flex-col h-full">
                <div class="flex justify-end mb-2">
                    <span class="text-xs text-slate-400">${row.created_at ? row.created_at.split('T')[0] : ''}</span>
                </div>
                <div class="flex-1 p-4 bg-slate-50 rounded-lg border border-slate-200 overflow-y-auto max-h-[70vh]">
                    ${imageHtml}
                    <p class="text-slate-800 whitespace-pre-wrap leading-relaxed text-base">${row.content}</p>
                </div>
                <div class="mt-4 flex justify-end gap-2">
                    <button onclick="closeModal()" class="px-4 py-2 bg-slate-200 text-slate-700 rounded hover:bg-slate-300">닫기</button>
                    <button onclick="MemosModule.openEditModal('${dataId}')" class="px-4 py-2 bg-slate-800 text-white rounded hover:bg-slate-900">수정하기</button>
                </div>
            </div>`;
    },

    // 6. 입력 폼 (파일 input 추가)
    getFormHtml(existingImageUrl = null) {
        return `
            <div class="space-y-4">
                <div>
                    <label class="text-xs font-bold text-slate-700">이미지 첨부</label>
                    <input type="file" id="memoFile" accept="image/*" class="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-cyan-50 file:text-cyan-700 hover:file:bg-cyan-100 mt-1">
                    ${existingImageUrl ? `<p class="text-[10px] text-blue-500 mt-1">※ 새 파일을 선택하면 기존 이미지가 교체됩니다.</p>` : ''}
                </div>
                <div>
                    <label class="text-xs font-bold text-slate-700">메모 내용</label>
                    <textarea id="memoContent" class="w-full h-40 p-3 border rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none resize-none mt-1" placeholder="내용을 입력하세요..."></textarea>
                </div>
                <div>
                    <label class="text-xs font-bold text-slate-700 block mb-1">라벨 색상</label>
                    <input type="color" id="memoColor" value="#06b6d4" class="w-full h-10 rounded cursor-pointer border-none bg-transparent">
                </div>
                <button onclick="MemosModule.save()" id="btnSaveMemo" class="w-full bg-slate-800 text-white py-3 rounded-lg font-bold hover:bg-slate-900 transition">
                    메모 저장
                </button>
            </div>`;
    },
    
    // 7. 저장 (파일 업로드 로직 포함)
    async save() {
        const content = document.getElementById('memoContent').value;
        const color = document.getElementById('memoColor').value;
        const fileInput = document.getElementById('memoFile');
        const btn = document.getElementById('btnSaveMemo');
        
        if (!content) return alert('내용을 입력해주세요.');
        
        btn.disabled = true;
        btn.innerText = "처리 중...";

        let imageUrl = null;

        // 파일 업로드 처리
        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random()}.${fileExt}`;
            const filePath = `uploads/${fileName}`;

            const { data: uploadData, error: uploadError } = await supabaseClient.storage
                .from(this.bucketName)
                .upload(filePath, file);

            if (uploadError) {
                alert("이미지 업로드 실패: " + uploadError.message);
                btn.disabled = false;
                btn.innerText = "메모 저장";
                return;
            }

            // 공용 URL 가져오기
            const { data: urlData } = supabaseClient.storage.from(this.bucketName).getPublicUrl(filePath);
            imageUrl = urlData.publicUrl;
        }

        const submitData = { content, color };
        if (imageUrl) submitData.image_url = imageUrl; // 새 이미지가 있을 때만 업데이트
        
        let result;
        if (AppState.currentEditId) {
            result = await supabaseClient.from(this.tableName).update(submitData).eq('id', AppState.currentEditId);
        } else {
            result = await supabaseClient.from(this.tableName).insert(submitData);
        }
        
        if (result.error) {
            alert("저장 실패: " + result.error.message);
        } else {
            closeModal();
            this.search();
        }
        btn.disabled = false;
        btn.innerText = "메모 저장";
    },
    
    // 8. 삭제 (Storage 이미지도 함께 삭제 권장)
    async delete(id, imageUrl) {
        if (!confirm("삭제하시겠습니까?")) return;

        // DB 삭제
        const { error } = await supabaseClient.from(this.tableName).delete().eq('id', id);
        if (error) return alert("삭제 실패");

        // 이미지 파일이 있었다면 Storage에서도 삭제 처리 (선택 사항)
        if (imageUrl) {
            const path = imageUrl.split('/').pop();
            await supabaseClient.storage.from(this.bucketName).remove([`uploads/${path}`]);
        }

        this.search();
    }
};

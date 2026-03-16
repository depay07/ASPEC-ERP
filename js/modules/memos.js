const MemosModule = {
    tableName: 'memos',
    bucketName: 'memos', // Supabase Storage 버킷 이름
    
    // 1. 검색 및 목록 불러오기
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
    
    // 2. 카드 그리기 (여러 장의 썸네일 대응)
    renderCards(data) {
        const container = document.getElementById('listBody');
        
        if (!data || data.length === 0) {
            container.innerHTML = '<div class="col-span-full text-center py-10 text-slate-400">등록된 메모가 없습니다.</div>';
            return;
        }
        
        container.innerHTML = data.map(row => {
            const dataId = storeRowData(row);
            const dateStr = row.created_at ? row.created_at.split('T')[0] : '';
            
            // 이미지 배열 처리 (최대 2장까지 썸네일 노출)
            const images = row.image_urls || [];
            let imageHtml = '';
            if (images.length > 0) {
                imageHtml = `
                    <div class="grid grid-cols-2 gap-1 mb-2 h-24 overflow-hidden rounded-lg bg-slate-50 relative">
                        ${images.slice(0, 2).map(url => `<img src="${url}" class="w-full h-full object-cover">`).join('')}
                        ${images.length > 2 ? `<div class="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] px-1.5 rounded-md font-bold">+${images.length - 2}</div>` : ''}
                    </div>`;
            }
            
            return `
                <div ondblclick="MemosModule.openDetailModal('${dataId}')"
                     class="h-auto min-h-[12rem] p-4 rounded-xl shadow-sm border-t-4 transition hover:shadow-md hover:-translate-y-1 relative flex flex-col cursor-pointer overflow-hidden bg-white" 
                     style="border-top-color: ${row.color || '#06b6d4'};">
                    
                    <div class="flex justify-between items-center mb-2 flex-shrink-0">
                        <span class="text-[11px] font-bold text-slate-400">${dateStr}</span>
                        <div class="flex gap-2" onclick="event.stopPropagation()"> 
                            <button onclick="MemosModule.openEditModal('${dataId}')" class="text-slate-400 hover:text-blue-500">
                                <i class="fa-solid fa-pen"></i>
                            </button>
                            <button onclick="MemosModule.delete(${row.id}, ${JSON.stringify(images)})" class="text-slate-400 hover:text-red-500">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                        </div>
                    </div>

                    ${imageHtml}

                    <div class="text-sm text-slate-700 leading-relaxed overflow-hidden">
                        <div class="line-clamp-4 whitespace-pre-wrap">${row.content}</div>
                    </div>
                </div>`;
        }).join('');
    },
    
    // 3. 새 메모 등록 모달 열기
    openNewModal() {
        if (typeof AppState !== 'undefined') AppState.currentEditId = null;
        openModal('새 메모 등록');
        document.getElementById('modalBody').innerHTML = this.getFormHtml();
    },
    
    // 4. 수정 모달 열기
    openEditModal(dataId) {
        const row = getRowData(dataId);
        if (!row) return;
        
        if (typeof AppState !== 'undefined') AppState.currentEditId = row.id;
        openModal('메모 수정');
        const body = document.getElementById('modalBody');
        body.innerHTML = this.getFormHtml(row.image_urls);
        
        document.getElementById('memoContent').value = row.content || '';
        document.getElementById('memoColor').value = row.color || '#06b6d4';
    },

    // 5. 상세 보기 모달 (모든 이미지 리스트업)
    openDetailModal(dataId) {
        const row = getRowData(dataId);
        if (!row) return;

        openModal('메모 상세 내용'); 
        const body = document.getElementById('modalBody');
        
        const images = row.image_urls || [];
        const imagesHtml = images.map(url => `
            <div class="mb-3">
                <img src="${url}" class="w-full rounded-lg border shadow-sm cursor-zoom-in" onclick="window.open('${url}')">
            </div>
        `).join('');

        body.innerHTML = `
            <div class="flex flex-col h-full">
                <div class="flex justify-end mb-2">
                    <span class="text-xs text-slate-400">${row.created_at ? row.created_at.split('T')[0] : ''}</span>
                </div>
                <div class="flex-1 p-4 bg-slate-50 rounded-lg border border-slate-200 overflow-y-auto max-h-[65vh]">
                    ${imagesHtml}
                    <p class="text-slate-800 whitespace-pre-wrap leading-relaxed text-base">${row.content}</p>
                </div>
                <div class="mt-4 flex justify-end gap-2">
                    <button onclick="closeModal()" class="px-4 py-2 bg-slate-200 text-slate-700 rounded hover:bg-slate-300 transition">닫기</button>
                    <button onclick="MemosModule.openEditModal('${dataId}')" class="px-4 py-2 bg-slate-800 text-white rounded hover:bg-slate-900 transition">수정하기</button>
                </div>
            </div>
        `;
    },

    // 6. 입력 폼 HTML (multiple 속성 추가)
    getFormHtml(existingImages = []) {
        const hasImages = existingImages && existingImages.length > 0;
        return `
            <div class="space-y-4">
                <div>
                    <label class="text-xs font-bold text-slate-700">이미지 첨부 (다중 선택)</label>
                    <input type="file" id="memoFiles" multiple accept="image/*" class="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-cyan-50 file:text-cyan-700 hover:file:bg-cyan-100 mt-1">
                    ${hasImages ? `<p class="text-[10px] text-blue-500 mt-1">※ 새로 선택하면 기존 ${existingImages.length}장의 이미지가 대체됩니다.</p>` : ''}
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
    
    // 7. 저장 (다중 파일 업로드 로직)
    async save() {
        const content = document.getElementById('memoContent').value;
        const color = document.getElementById('memoColor').value;
        const fileInput = document.getElementById('memoFiles');
        const btn = document.getElementById('btnSaveMemo');
        
        if (!content) return alert('내용을 입력해주세요.');
        
        btn.disabled = true;
        btn.innerText = "업로드 중...";

        let imageUrls = [];

        try {
            // 여러 파일 업로드 처리
            if (fileInput.files.length > 0) {
                for (const file of fileInput.files) {
                    const fileExt = file.name.split('.').pop();
                    const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
                    const filePath = `uploads/${fileName}`;

                    const { error: uploadError } = await supabaseClient.storage
                        .from(this.bucketName)
                        .upload(filePath, file);

                    if (uploadError) throw uploadError;

                    const { data: urlData } = supabaseClient.storage.from(this.bucketName).getPublicUrl(filePath);
                    imageUrls.push(urlData.publicUrl);
                }
            }

            const data = { content, color };
            // 새 이미지가 있을 때만 배열 업데이트
            if (imageUrls.length > 0) data.image_urls = imageUrls;
            
            let result;
            if (typeof AppState !== 'undefined' && AppState.currentEditId) {
                result = await supabaseClient.from(this.tableName).update(data).eq('id', AppState.currentEditId);
            } else {
                result = await supabaseClient.from(this.tableName).insert(data);
            }
            
            if (result.error) throw result.error;
            
            closeModal();
            this.search();
        } catch (err) {
            alert("저장 중 오류 발생: " + err.message);
        } finally {
            btn.disabled = false;
            btn.innerText = "메모 저장";
        }
    },
    
    // 8. 삭제 (Storage 파일들도 함께 삭제)
    async delete(id, imageUrls) {
        if (!confirm("삭제하시겠습니까?")) return;
        
        const { error } = await supabaseClient.from(this.tableName).delete().eq('id', id);
        if (error) return alert("삭제 실패");

        // 연결된 이미지 파일들이 있다면 Storage에서도 삭제
        if (imageUrls && imageUrls.length > 0) {
            const paths = imageUrls.map(url => `uploads/${url.split('/').pop()}`);
            await supabaseClient.storage.from(this.bucketName).remove(paths);
        }
        
        this.search();
    }
};

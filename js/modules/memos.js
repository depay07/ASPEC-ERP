const MemosModule = {
    tableName: 'memos',
    bucketName: 'memos', // Supabase Storage 버킷 이름
    folderTableName: 'memo_folders',
    folders: [],
    folderCounts: {},
    selectedFolderId: 'all',
    folderFeatureReady: false,

    async loadFolders() {
        const [foldersResult, countsResult] = await Promise.all([
            supabaseClient
                .from(this.folderTableName)
                .select('id,name,created_at')
                .order('name'),
            supabaseClient
                .from(this.tableName)
                .select('folder_id')
        ]);

        const error = foldersResult.error || countsResult.error;
        if (error) {
            this.folderFeatureReady = false;
            this.folders = [];
            this.folderCounts = {};
            this.renderFolderList();
            this.renderFolderNotice(error);
            return false;
        }

        this.folderFeatureReady = true;
        this.folders = foldersResult.data || [];
        this.folderCounts = { all: (countsResult.data || []).length, unfiled: 0 };

        (countsResult.data || []).forEach(row => {
            if (row.folder_id === null || row.folder_id === undefined) {
                this.folderCounts.unfiled++;
            } else {
                this.folderCounts[row.folder_id] = (this.folderCounts[row.folder_id] || 0) + 1;
            }
        });

        if (this.selectedFolderId !== 'all' && this.selectedFolderId !== 'unfiled') {
            const selectedExists = this.folders.some(folder => folder.id === Number(this.selectedFolderId));
            if (!selectedExists) this.selectedFolderId = 'all';
        }

        this.renderFolderNotice();
        this.renderFolderList();
        return true;
    },

    renderFolderNotice(error = null) {
        const notice = document.getElementById('memoFolderNotice');
        if (!notice) return;

        if (!error) {
            notice.innerHTML = '';
            return;
        }

        notice.innerHTML = `
            <div class="m-4 mb-0 border border-amber-200 bg-amber-50 text-amber-800 p-3 rounded text-sm">
                <i class="fa-solid fa-circle-info mr-1"></i>
                폴더 기능을 사용하려면 Supabase SQL Editor에서 <strong>supabase-memo-folders.sql</strong>을 실행해 주세요.
            </div>`;
    },

    renderFolderList() {
        const container = document.getElementById('memoFolderList');
        if (!container) return;

        const folderButton = (id, label, icon, count) => {
            const active = String(this.selectedFolderId) === String(id);
            const activeClass = active
                ? 'bg-slate-800 text-white'
                : 'text-slate-600 hover:bg-slate-100';

            return `
                <button onclick="MemosModule.selectFolder('${id}')"
                        class="min-w-max md:w-full flex items-center gap-2 px-3 py-2 rounded text-sm ${activeClass}">
                    <i class="fa-solid ${icon} w-4"></i>
                    <span class="flex-1 text-left">${escapeHtml(label)}</span>
                    <span class="text-[10px] opacity-70">${formatNumber(count || 0)}</span>
                </button>`;
        };

        let html = folderButton('all', '전체 메모', 'fa-note-sticky', this.folderCounts.all || 0);

        if (!this.folderFeatureReady) {
            container.innerHTML = html;
            return;
        }

        html += folderButton('unfiled', '미분류', 'fa-inbox', this.folderCounts.unfiled || 0);
        html += this.folders.map(folder => {
            const active = String(this.selectedFolderId) === String(folder.id);
            const activeClass = active ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100';

            return `
                <div class="min-w-max md:w-full flex items-center rounded group ${activeClass}">
                    <button onclick="MemosModule.selectFolder('${folder.id}')" class="flex-1 min-w-0 flex items-center gap-2 px-3 py-2 text-sm">
                        <i class="fa-solid fa-folder w-4 text-amber-500"></i>
                        <span class="flex-1 text-left truncate">${escapeHtml(folder.name)}</span>
                        <span class="text-[10px] opacity-70">${formatNumber(this.folderCounts[folder.id] || 0)}</span>
                    </button>
                    <button onclick="MemosModule.renameFolder(${folder.id})" class="w-7 h-8 opacity-50 md:opacity-0 md:group-hover:opacity-100" title="폴더 이름 변경"><i class="fa-solid fa-pen text-[10px]"></i></button>
                    <button onclick="MemosModule.deleteFolder(${folder.id})" class="w-7 h-8 opacity-50 md:opacity-0 md:group-hover:opacity-100 hover:text-red-500" title="폴더 삭제"><i class="fa-solid fa-trash-can text-[10px]"></i></button>
                </div>`;
        }).join('');

        container.innerHTML = html;
    },

    async selectFolder(folderId) {
        this.selectedFolderId = folderId;
        this.renderFolderList();
        await this.search(false);
    },

    async createFolder(selectInForm = false) {
        if (!this.folderFeatureReady) {
            alert('먼저 Supabase SQL Editor에서 supabase-memo-folders.sql을 실행해 주세요.');
            return null;
        }

        const name = prompt('새 폴더 이름을 입력하세요.');
        if (name === null) return null;

        const trimmedName = name.trim();
        if (!trimmedName) {
            alert('폴더 이름을 입력해 주세요.');
            return null;
        }
        if (trimmedName.length > 50) {
            alert('폴더 이름은 50자 이하로 입력해 주세요.');
            return null;
        }

        const result = await supabaseClient
            .from(this.folderTableName)
            .insert({ name: trimmedName })
            .select('id,name,created_at')
            .single();

        if (result.error) {
            const message = result.error.code === '23505'
                ? '같은 이름의 폴더가 이미 있습니다.'
                : '폴더 생성 실패: ' + result.error.message;
            alert(message);
            return null;
        }

        if (!selectInForm) this.selectedFolderId = String(result.data.id);
        await this.search();

        if (selectInForm) {
            const select = document.getElementById('memoFolder');
            if (select) {
                select.innerHTML = this.getFolderOptions(result.data.id);
                select.value = String(result.data.id);
            }
        }

        return result.data;
    },

    async renameFolder(folderId) {
        const folder = this.folders.find(item => item.id === Number(folderId));
        if (!folder) return;

        const name = prompt('변경할 폴더 이름을 입력하세요.', folder.name);
        if (name === null) return;

        const trimmedName = name.trim();
        if (!trimmedName || trimmedName === folder.name) return;
        if (trimmedName.length > 50) return alert('폴더 이름은 50자 이하로 입력해 주세요.');

        const result = await supabaseClient
            .from(this.folderTableName)
            .update({ name: trimmedName })
            .eq('id', folder.id);

        if (result.error) {
            alert(result.error.code === '23505' ? '같은 이름의 폴더가 이미 있습니다.' : '이름 변경 실패: ' + result.error.message);
            return;
        }

        await this.search();
    },

    async deleteFolder(folderId) {
        const folder = this.folders.find(item => item.id === Number(folderId));
        if (!folder) return;

        if (!confirm(`'${folder.name}' 폴더를 삭제하시겠습니까?\n폴더 안의 메모는 삭제되지 않고 미분류로 이동합니다.`)) return;

        const result = await supabaseClient
            .from(this.folderTableName)
            .delete()
            .eq('id', folder.id);

        if (result.error) {
            alert('폴더 삭제 실패: ' + result.error.message);
            return;
        }

        if (String(this.selectedFolderId) === String(folder.id)) this.selectedFolderId = 'unfiled';
        await this.search();
    },
    
    // 1. 검색 및 목록 불러오기
    async search(reloadFolders = true) {
        const container = document.getElementById('listBody');
        container.innerHTML = '<div class="col-span-full text-center py-10">메모를 불러오는 중...</div>';

        const folderReady = reloadFolders ? await this.loadFolders() : this.folderFeatureReady;
        
        let query = supabaseClient
            .from(this.tableName)
            .select('*')
            .order('created_at', { ascending: false });

        if (folderReady && this.selectedFolderId === 'unfiled') {
            query = query.is('folder_id', null);
        } else if (folderReady && this.selectedFolderId !== 'all') {
            query = query.eq('folder_id', Number(this.selectedFolderId));
        }
        
        const keyword = typeof el === 'function' && el('search_memoContent');
        if (keyword) query = query.ilike('content', `%${keyword}%`);
        
        const { data, error } = await query;
        if (error) {
            alert("조회 실패: " + error.message);
            return;
        }
        
        this.renderCards(data);
    },

    getFolderName(folderId) {
        if (folderId === null || folderId === undefined) return '미분류';
        return this.folders.find(folder => folder.id === Number(folderId))?.name || '미분류';
    },

    getFolderOptions(selectedFolderId = null) {
        const selectedValue = selectedFolderId === null || selectedFolderId === undefined
            ? ''
            : String(selectedFolderId);
        const unfiledSelected = selectedValue === '' ? 'selected' : '';

        return `<option value="" ${unfiledSelected}>미분류</option>` + this.folders.map(folder => {
            const selected = String(folder.id) === selectedValue ? 'selected' : '';
            return `<option value="${folder.id}" ${selected}>${escapeHtml(folder.name)}</option>`;
        }).join('');
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
            const folderName = this.getFolderName(row.folder_id);
            
            // 이미지 배열 처리 (최대 2장까지 썸네일 노출)
            const images = Array.isArray(row.image_urls) ? row.image_urls : [];
            let imageHtml = '';
            if (images.length > 0) {
                imageHtml = `
                    <div class="grid grid-cols-2 gap-1 mb-2 h-24 overflow-hidden rounded-lg bg-slate-50 relative">
                        ${images.slice(0, 2).map(url => `<img src="${escapeAttr(url)}" class="w-full h-full object-cover">`).join('')}
                        ${images.length > 2 ? `<div class="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] px-1.5 rounded-md font-bold">+${images.length - 2}</div>` : ''}
                    </div>`;
            }
            
            return `
                <div ondblclick="MemosModule.openDetailModal('${dataId}')"
                     class="h-auto min-h-[12rem] p-4 rounded-xl shadow-sm border-t-4 transition hover:shadow-md hover:-translate-y-1 relative flex flex-col cursor-pointer overflow-hidden bg-white" 
                     style="border-top-color: ${row.color || '#06b6d4'};">
                    
                    <div class="flex justify-between items-center mb-2 flex-shrink-0 gap-2">
                        <div class="flex items-center gap-2 min-w-0">
                            <span class="text-[11px] font-bold text-slate-400 whitespace-nowrap">${dateStr}</span>
                            <span class="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 truncate"><i class="fa-solid fa-folder mr-1 text-amber-500"></i>${escapeHtml(folderName)}</span>
                        </div>
                        <div class="flex gap-2" onclick="event.stopPropagation()"> 
                            <button onclick="MemosModule.openEditModal('${dataId}')" class="text-slate-400 hover:text-blue-500">
                                <i class="fa-solid fa-pen"></i>
                            </button>
                            <button onclick="MemosModule.deleteByDataId('${dataId}')" class="text-slate-400 hover:text-red-500">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                        </div>
                    </div>

                    ${imageHtml}

                    <div class="text-sm text-slate-700 leading-relaxed overflow-hidden">
                        <div class="line-clamp-4 whitespace-pre-wrap">${escapeHtml(row.content)}</div>
                    </div>
                </div>`;
        }).join('');
    },
    
    // 3. 새 메모 등록 모달 열기
    openNewModal() {
        if (typeof AppState !== 'undefined') AppState.currentEditId = null;
        openModal('새 메모 등록');
        const defaultFolderId = this.selectedFolderId !== 'all' && this.selectedFolderId !== 'unfiled'
            ? Number(this.selectedFolderId)
            : null;
        document.getElementById('modalBody').innerHTML = this.getFormHtml([], defaultFolderId);
    },
    
    // 4. 수정 모달 열기
    openEditModal(dataId) {
        const row = getRowData(dataId);
        if (!row) return;
        
        if (typeof AppState !== 'undefined') AppState.currentEditId = row.id;
        openModal('메모 수정');
        const body = document.getElementById('modalBody');
        body.innerHTML = this.getFormHtml(row.image_urls, row.folder_id);
        
        document.getElementById('memoContent').value = row.content || '';
        document.getElementById('memoColor').value = row.color || '#06b6d4';
    },

    // 5. 상세 보기 모달 (모든 이미지 리스트업)
    openDetailModal(dataId) {
        const row = getRowData(dataId);
        if (!row) return;

        openModal('메모 상세 내용'); 
        const body = document.getElementById('modalBody');
        const folderName = this.getFolderName(row.folder_id);
        
        const images = Array.isArray(row.image_urls) ? row.image_urls : [];
        const imagesHtml = images.map(url => `
            <div class="mb-3">
                <img src="${escapeAttr(url)}" class="w-full rounded-lg border shadow-sm cursor-zoom-in" onclick="window.open(this.src)">
            </div>
        `).join('');

        body.innerHTML = `
            <div class="flex flex-col h-full">
                <div class="flex justify-between items-center mb-2 gap-3">
                    <span class="text-xs px-2 py-1 rounded bg-slate-100 text-slate-600"><i class="fa-solid fa-folder mr-1 text-amber-500"></i>${escapeHtml(folderName)}</span>
                    <span class="text-xs text-slate-400">${row.created_at ? row.created_at.split('T')[0] : ''}</span>
                </div>
                <div class="flex-1 p-4 bg-slate-50 rounded-lg border border-slate-200 overflow-y-auto max-h-[65vh]">
                    ${imagesHtml}
                    <p class="text-slate-800 whitespace-pre-wrap leading-relaxed text-base">${escapeHtml(row.content)}</p>
                </div>
                <div class="mt-4 flex justify-end gap-2">
                    <button onclick="closeModal()" class="px-4 py-2 bg-slate-200 text-slate-700 rounded hover:bg-slate-300 transition">닫기</button>
                    <button onclick="MemosModule.openEditModal('${dataId}')" class="px-4 py-2 bg-slate-800 text-white rounded hover:bg-slate-900 transition">수정하기</button>
                </div>
            </div>
        `;
    },

    // 6. 입력 폼 HTML (multiple 속성 추가)
    getFormHtml(existingImages = [], selectedFolderId = null) {
        const hasImages = existingImages && existingImages.length > 0;
        return `
            <div class="space-y-4">
                <div>
                    <label class="text-xs font-bold text-slate-700 block mb-1">폴더</label>
                    ${this.folderFeatureReady ? `
                        <div class="flex gap-2">
                            <select id="memoFolder" class="input-box flex-1">${this.getFolderOptions(selectedFolderId)}</select>
                            <button type="button" onclick="runSaveOnce('memo-folder-create', this, () => MemosModule.createFolder(true))" class="w-10 h-[38px] inline-flex items-center justify-center border rounded text-slate-600 hover:bg-slate-50" title="새 폴더"><i class="fa-solid fa-folder-plus"></i></button>
                        </div>` : `
                        <div class="text-sm text-amber-700 bg-amber-50 border border-amber-200 p-3 rounded">폴더 기능을 사용하려면 먼저 Supabase SQL을 적용해 주세요.</div>`}
                </div>
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
                <button onclick="runSaveOnce('memo', this, () => MemosModule.save())" id="btnSaveMemo" class="w-full bg-slate-800 text-white py-3 rounded-lg font-bold hover:bg-slate-900 transition">
                    메모 저장
                </button>
            </div>`;
    },
    
    // 7. 저장 (에러 해결: 배열 데이터 전송 방식 수정)
    async save() {
        const content = document.getElementById('memoContent').value;
        const color = document.getElementById('memoColor').value;
        const folderInput = document.getElementById('memoFolder');
        const fileInput = document.getElementById('memoFiles');
        const btn = document.getElementById('btnSaveMemo');
        
        if (!content) return alert('내용을 입력해주세요.');
        
        btn.disabled = true;
        btn.innerText = "업로드 중...";

        let imageUrls = [];

        try {
            // 1. 이미지 업로드 처리
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

            // 2. DB에 저장할 데이터 구성 (image_urls를 항상 배열로 전달)
            const editingId = typeof AppState !== 'undefined' && AppState.currentEditId;
            const currentRow = editingId
                ? Object.values(AppState.globalDataStore || {}).find(row => row.id === AppState.currentEditId)
                : null;
            const existingImageUrls = Array.isArray(currentRow?.image_urls) ? currentRow.image_urls : [];

            const submitData = { 
                content: content, 
                color: color,
                image_urls: imageUrls.length > 0 ? imageUrls : existingImageUrls
            };

            if (this.folderFeatureReady) {
                submitData.folder_id = folderInput?.value ? Number(folderInput.value) : null;
            }
            
            let result;
            if (editingId) {
                // 수정 시: update는 단일 객체 전달
                result = await supabaseClient
                    .from(this.tableName)
                    .update(submitData)
                    .eq('id', AppState.currentEditId);
            } else {
                // 등록 시: insert는 배열 [] 안에 객체 전달 (말폼 에러 방지용)
                result = await supabaseClient
                    .from(this.tableName)
                    .insert([submitData]); 
            }
            
            if (result.error) throw result.error;
            
            closeModal();
            this.search();
        } catch (err) {
            console.error("저장 에러:", err);
            alert("저장 실패: " + err.message);
        } finally {
            btn.disabled = false;
            btn.innerText = "메모 저장";
        }
    },
    
    // 8. 삭제 (Storage 파일 일괄 삭제)
    async deleteByDataId(dataId) {
        const row = getRowData(dataId);
        if (!row) return alert('데이터 오류');
        return this.delete(row.id, row.image_urls || []);
    },

    async delete(id, imageUrls) {
        if (!confirm("삭제하시겠습니까?")) return;
        
        const { error } = await supabaseClient.from(this.tableName).delete().eq('id', id);
        if (error) return alert("삭제 실패");

        if (imageUrls && imageUrls.length > 0) {
            const paths = imageUrls.map(url => `uploads/${url.split('/').pop()}`);
            await supabaseClient.storage.from(this.bucketName).remove(paths);
        }
        
        this.search();
    }
};

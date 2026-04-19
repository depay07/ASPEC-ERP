// js/modules/projects.js - 프로젝트 관리 모듈

const ProjectsModule = {
    tableName: 'projects',
    
    // 프로젝트 탭 초기화
    init() {
        this.renderSearchContainer(); // 전용 체크박스 검색바 생성
        this.search(); // 데이터 조회
    },

    // 프로젝트 전용 검색바 (체크박스 형태)
    renderSearchContainer() {
        const container = document.getElementById('searchContainer');
        if (!container) return;

        container.innerHTML = `
            <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-6 no-print">
                <div class="flex flex-wrap items-end gap-4">
                    <div class="flex-1 min-w-[300px]">
                        <label class="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">프로젝트 상태 필터 (다중 선택)</label>
                        <div class="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                            ${['대기', '광학테스트', '개발중', '현장셋업', '완료', '보류'].map(status => `
                                <label class="flex items-center gap-1.5 cursor-pointer bg-white px-3 py-1.5 rounded-md border hover:border-cyan-500 transition shadow-sm text-sm">
                                    <input type="checkbox" name="search_pStatus" value="${status}" class="w-4 h-4 accent-cyan-600"> ${status}
                                </label>
                            `).join('')}
                        </div>
                    </div>

                    <div class="w-48">
                        <label class="block text-xs font-bold text-slate-500 mb-2 uppercase">프로젝트명</label>
                        <input type="text" id="search_pName" class="input-box w-full" placeholder="검색어 입력...">
                    </div>

                    <div class="w-48">
                        <label class="block text-xs font-bold text-slate-500 mb-2 uppercase">고객사</label>
                        <input type="text" id="search_pClient" class="input-box w-full" placeholder="고객사명 입력...">
                    </div>

                    <div class="flex gap-2">
                        <button onclick="ProjectsModule.search()" class="bg-slate-800 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-slate-700 transition flex items-center gap-2">
                            <i class="fa-solid fa-magnifying-glass"></i> 조회
                        </button>
                    </div>
                </div>
            </div>`;
    },

    async search() {
        if (typeof showTableLoading === 'function') showTableLoading(9);
        
        let query = supabaseClient
            .from(this.tableName)
            .select('*')
            .order('created_at', { ascending: false });
        
        // 1. 상태 필터 (체크박스 다중 선택 로직)
        const statusCheckboxes = document.querySelectorAll('input[name="search_pStatus"]:checked');
        const selectedStatuses = Array.from(statusCheckboxes).map(cb => cb.value);
        
        if (selectedStatuses.length > 0) {
            query = query.in('status', selectedStatuses);
        }
        
        // 2. 프로젝트명 필터
        const nameFilter = document.getElementById('search_pName')?.value;
        if (nameFilter) query = query.ilike('project_name', `%${nameFilter}%`);

        // 3. 고객사 필터
        const clientFilter = document.getElementById('search_pClient')?.value;
        if (clientFilter) query = query.ilike('client_name', `%${clientFilter}%`);
        
        const { data, error } = await query;
        if (error) return alert("검색 실패: " + error.message);
        
        this.renderTable(data);
    },
    
    renderTable(data) {
        const tbody = document.getElementById('listBody');
        if (!tbody) return;
        if (!data || data.length === 0) {
            if (typeof showEmptyTable === 'function') return showEmptyTable(9);
            tbody.innerHTML = '<tr><td colspan="9" class="text-center p-10 text-slate-400">조회된 데이터가 없습니다.</td></tr>';
            return;
        }
        
        tbody.innerHTML = data.map(row => {
            const dataId = storeRowData(row);
            return `
                <tr class="hover:bg-slate-50 border-b transition text-sm">
                    <td class="p-4 text-left font-bold text-slate-700">${row.project_name}</td>
                    <td class="p-4 text-center text-slate-600">${row.client_name || '-'}</td>
                    <td class="p-4 text-center">${this.getStatusBadge(row.status)}</td>
                    <td class="p-4">${this.getProgressBar(row.progress || 0)}</td>
                    <td class="p-4 text-center text-xs text-slate-500">${row.manager || '-'}</td>
                    <td class="p-4 text-center text-xs text-slate-600">${row.inspection_type || '-'}</td>
                    <td class="p-4 text-left text-xs truncate max-w-[150px] text-slate-600" title="${row.optical_condition || ''}">${row.optical_condition || '-'}</td>
                    <td class="p-4 text-left text-xs text-slate-400 truncate max-w-[100px]" title="${row.note || ''}">${row.note || '-'}</td>
                    <td class="p-4">
                        <div class="flex justify-center gap-1">
                            <button onclick="ProjectsModule.openViewModal('${dataId}')" class="text-green-600 hover:bg-green-50 p-1.5 rounded transition" title="상세보기"><i class="fa-solid fa-eye"></i></button>
                            <button onclick="ProjectsModule.openEditModal('${dataId}')" class="text-blue-500 hover:bg-blue-50 p-1.5 rounded transition" title="수정"><i class="fa-solid fa-pen-to-square"></i></button>
                            <button onclick="ProjectsModule.delete(${row.id})" class="text-red-400 hover:bg-red-50 p-1.5 rounded transition" title="삭제"><i class="fa-solid fa-trash-can"></i></button>
                        </div>
                    </td>
                </tr>`;
        }).join('');
    },

    getStatusBadge(status) {
        const styles = {
            '대기': 'bg-gray-100 text-gray-600 border-gray-200',
            '광학테스트': 'bg-purple-100 text-purple-700 border-purple-200',
            '개발중': 'bg-blue-100 text-blue-700 border-blue-200',
            '현장셋업': 'bg-orange-100 text-orange-700 border-orange-200',
            '완료': 'bg-green-100 text-green-700 border-green-200',
            '보류': 'bg-red-100 text-red-700 border-red-200'
        };
        const style = styles[status] || styles['대기'];
        return `<span class="px-2 py-1 rounded-full text-[11px] font-bold border ${style}">${status || '대기'}</span>`;
    },

    getProgressBar(progress) {
        return `
            <div class="flex items-center gap-2">
                <div class="w-full bg-gray-200 rounded-full h-1.5">
                    <div class="bg-cyan-600 h-1.5 rounded-full" style="width: ${progress}%"></div>
                </div>
                <span class="text-[10px] font-bold text-slate-500 w-7 text-right">${progress}%</span>
            </div>
        `;
    },
    
    openViewModal(dataId) {
        const row = getRowData(dataId);
        if (!row) return alert('데이터 오류');
        openModal('프로젝트 상세 정보');
        const body = document.getElementById('modalBody');
        body.innerHTML = `
            <div class="space-y-4 text-left">
                <div class="bg-white p-5 rounded-lg border shadow-sm">
                    <h4 class="text-sm font-bold text-slate-700 mb-4 border-b pb-2">기본 정보</h4>
                    <div class="grid grid-cols-2 gap-4">
                        <div class="col-span-2"><span class="text-xs text-slate-500">프로젝트명</span><div class="font-bold text-xl">${row.project_name}</div></div>
                        <div><span class="text-xs text-slate-500">고객사</span><div>${row.client_name || '-'}</div></div>
                        <div><span class="text-xs text-slate-500">EndUser</span><div>${row.manager || '-'}</div></div>
                    </div>
                </div>
                <div class="bg-white p-5 rounded-lg border shadow-sm">
                    <h4 class="text-sm font-bold text-slate-700 mb-4 border-b pb-2">진행 현황</h4>
                    <div class="grid grid-cols-2 gap-4">
                        <div><span class="text-xs text-slate-500">현재 상태</span><div>${this.getStatusBadge(row.status)}</div></div>
                        <div><span class="text-xs text-slate-500">진척도</span><div>${this.getProgressBar(row.progress || 0)}</div></div>
                    </div>
                </div>
            </div>
            <button onclick="closeModal()" class="w-full mt-6 bg-slate-700 text-white py-3 rounded font-bold">닫기</button>
        `;
    },
    
    openNewModal() {
        AppState.currentEditId = null;
        openModal('신규 프로젝트 등록');
        document.getElementById('modalBody').innerHTML = this.getFormHtml();
    },
    
    openEditModal(dataId) {
        const row = getRowData(dataId);
        if (!row) return alert('데이터 오류');
        AppState.currentEditId = row.id;
        openModal('프로젝트 정보 수정');
        document.getElementById('modalBody').innerHTML = this.getFormHtml();
        
        setTimeout(() => {
            document.getElementById('projName').value = row.project_name || '';
            document.getElementById('projClient').value = row.client_name || '';
            document.getElementById('projEndUser').value = row.manager || '';
            document.getElementById('projStatus').value = row.status || '대기';
            document.getElementById('projProgress').value = row.progress || 0;
            document.getElementById('projNote').value = row.note || '';
        }, 50);
    },
    
    getFormHtml() {
        return `
            <div class="space-y-4 text-left">
                <label class="block text-xs font-bold text-slate-500">프로젝트명</label>
                <input id="projName" class="input-box w-full" placeholder="프로젝트명">
                <div class="grid grid-cols-2 gap-4">
                    <div><label class="block text-xs font-bold text-slate-500">고객사</label><input id="projClient" class="input-box w-full"></div>
                    <div><label class="block text-xs font-bold text-slate-500">EndUser</label><input id="projEndUser" class="input-box w-full"></div>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div><label class="block text-xs font-bold text-slate-500">상태</label>
                        <select id="projStatus" class="input-box w-full">
                            <option value="대기">대기</option><option value="광학테스트">광학테스트</option><option value="개발중">개발중</option><option value="현장셋업">현장셋업</option><option value="완료">완료</option><option value="보류">보류</option>
                        </select>
                    </div>
                    <div><label class="block text-xs font-bold text-slate-500">진척도</label><input type="number" id="projProgress" class="input-box w-full" min="0" max="100"></div>
                </div>
                <label class="block text-xs font-bold text-slate-500">메모</label>
                <textarea id="projNote" class="input-box w-full h-20"></textarea>
                <button onclick="ProjectsModule.save()" class="w-full bg-cyan-600 text-white py-3 rounded font-bold">저장하기</button>
            </div>`;
    },

    async save() {
        const data = {
            project_name: document.getElementById('projName').value,
            client_name: document.getElementById('projClient').value,
            manager: document.getElementById('projEndUser').value,
            status: document.getElementById('projStatus').value,
            progress: parseInt(document.getElementById('projProgress').value) || 0,
            note: document.getElementById('projNote').value
        };
        const query = AppState.currentEditId 
            ? supabaseClient.from(this.tableName).update(data).eq('id', AppState.currentEditId)
            : supabaseClient.from(this.tableName).insert(data);
        
        const { error } = await query;
        if (error) return alert("저장 실패: " + error.message);
        closeModal();
        this.search();
    },

    async delete(id) {
        if (!confirm("정말 삭제하시겠습니까?")) return;
        const { error } = await supabaseClient.from(this.tableName).delete().eq('id', id);
        if (error) return alert("삭제 실패: " + error.message);
        this.search();
    }
};

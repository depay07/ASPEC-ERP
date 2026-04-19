// js/modules/projects.js - 프로젝트 관리 모듈

const ProjectsModule = {
    tableName: 'projects',
    
    // [추가] 프로젝트 페이지 진입 시 실행될 초기화 함수
    init() {
        this.renderSearchContainer(); // 검색바 그리기
        this.search(); // 데이터 조회
    },

    // [추가] 검색바를 체크박스 형태로 생성하는 함수
    renderSearchContainer() {
        const container = document.getElementById('searchContainer');
        if (!container) return;

        container.innerHTML = `
            <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-6 no-print">
                <div class="flex flex-wrap items-end gap-4">
                    <div class="flex-1 min-w-[300px]">
                        <label class="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">프로젝트 상태 필터 (다중 선택)</label>
                        <div class="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                            <label class="flex items-center gap-1.5 cursor-pointer bg-white px-3 py-1.5 rounded-md border hover:border-cyan-500 transition shadow-sm text-sm">
                                <input type="checkbox" name="search_pStatus" value="대기" class="w-4 h-4 accent-cyan-600"> 대기
                            </label>
                            <label class="flex items-center gap-1.5 cursor-pointer bg-white px-3 py-1.5 rounded-md border hover:border-cyan-500 transition shadow-sm text-sm">
                                <input type="checkbox" name="search_pStatus" value="광학테스트" class="w-4 h-4 accent-cyan-600"> 광학테스트
                            </label>
                            <label class="flex items-center gap-1.5 cursor-pointer bg-white px-3 py-1.5 rounded-md border hover:border-cyan-500 transition shadow-sm text-sm">
                                <input type="checkbox" name="search_pStatus" value="개발중" class="w-4 h-4 accent-cyan-600"> 개발중
                            </label>
                            <label class="flex items-center gap-1.5 cursor-pointer bg-white px-3 py-1.5 rounded-md border hover:border-cyan-500 transition shadow-sm text-sm">
                                <input type="checkbox" name="search_pStatus" value="현장셋업" class="w-4 h-4 accent-cyan-600"> 현장셋업
                            </label>
                            <label class="flex items-center gap-1.5 cursor-pointer bg-white px-3 py-1.5 rounded-md border hover:border-cyan-500 transition shadow-sm text-sm">
                                <input type="checkbox" name="search_pStatus" value="완료" class="w-4 h-4 accent-cyan-600"> 완료
                            </label>
                            <label class="flex items-center gap-1.5 cursor-pointer bg-white px-3 py-1.5 rounded-md border hover:border-cyan-500 transition shadow-sm text-sm">
                                <input type="checkbox" name="search_pStatus" value="보류" class="w-4 h-4 accent-cyan-600"> 보류
                            </label>
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
                        <button onclick="ProjectsModule.openNewModal()" class="bg-cyan-600 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-cyan-700 transition flex items-center gap-2">
                            <i class="fa-solid fa-plus"></i> 신규 등록
                        </button>
                    </div>
                </div>
            </div>
            
            <div id="contentArea">
                <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <table class="w-full text-left border-collapse">
                        <thead class="bg-slate-50 border-b border-slate-200">
                            <tr class="text-slate-600 text-xs uppercase font-bold">
                                <th class="p-4">프로젝트명</th>
                                <th class="p-4 text-center">고객사</th>
                                <th class="p-4 text-center">상태</th>
                                <th class="p-4" style="width:150px">진척도</th>
                                <th class="p-4 text-center">EndUser</th>
                                <th class="p-4 text-center">검사종류</th>
                                <th class="p-4">광학조건</th>
                                <th class="p-4">비고</th>
                                <th class="p-4 text-center">관리</th>
                            </tr>
                        </thead>
                        <tbody id="listBody"></tbody>
                    </table>
                </div>
            </div>
        `;
    },

    async search() {
        showTableLoading(9);
        
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
        if (!data || data.length === 0) return showEmptyTable(9);
        
        tbody.innerHTML = data.map(row => {
            const dataId = storeRowData(row);
            const statusBadge = this.getStatusBadge(row.status);
            const progressBar = this.getProgressBar(row.progress || 0);
            
            return `
                <tr class="hover:bg-slate-50 border-b transition text-sm">
                    <td class="p-4 text-left font-bold text-slate-700">${row.project_name}</td>
                    <td class="p-4 text-center text-slate-600">${row.client_name || '-'}</td>
                    <td class="p-4 text-center">${statusBadge}</td>
                    <td class="p-4">${progressBar}</td>
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
    
    // ======== 상세 보기/등록/수정 모달 로직 (기존과 동일하지만 UI 깔끔하게 유지) ========
    openViewModal(dataId) {
        const row = getRowData(dataId);
        if (!row) return alert('데이터 오류');

        openModal('프로젝트 상세 정보');
        const body = document.getElementById('modalBody');
        
        body.innerHTML = `
            <div class="space-y-4 text-left">
                <div class="bg-white p-5 rounded-lg border shadow-sm">
                    <h4 class="text-sm font-bold text-slate-700 mb-4 border-b pb-2"><i class="fa-solid fa-folder-open text-blue-500 mr-1"></i> 기본 정보</h4>
                    <div class="grid grid-cols-2 gap-4">
                        <div class="col-span-2">
                            <span class="text-xs text-slate-500 block mb-1">프로젝트명</span>
                            <div class="font-bold text-xl text-slate-800">${row.project_name}</div>
                        </div>
                        <div>
                            <span class="text-xs text-slate-500 block mb-1">고객사(업체명)</span>
                            <div class="font-medium text-slate-700">${row.client_name || '-'}</div>
                        </div>
                        <div>
                            <span class="text-xs text-slate-500 block mb-1">EndUser</span>
                            <div class="font-medium text-slate-700">${row.manager || '-'}</div>
                        </div>
                    </div>
                </div>

                <div class="bg-white p-5 rounded-lg border shadow-sm">
                    <h4 class="text-sm font-bold text-slate-700 mb-4 border-b pb-2"><i class="fa-solid fa-chart-line text-green-500 mr-1"></i> 진행 현황</h4>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <span class="text-xs text-slate-500 block mb-2">현재 상태</span>
                            <div>${this.getStatusBadge(row.status)}</div>
                        </div>
                        <div>
                            <span class="text-xs text-slate-500 block mb-2">진척도</span>
                            <div class="w-3/4">${this.getProgressBar(row.progress || 0)}</div>
                        </div>
                        <div>
                            <span class="text-xs text-slate-500 block mb-1">시작일</span>
                            <div class="font-medium text-slate-700">${row.start_date || '-'}</div>
                        </div>
                        <div>
                            <span class="text-xs text-slate-500 block mb-1">목표 완료일</span>
                            <div class="font-medium text-slate-700">${row.target_date || '-'}</div>
                        </div>
                    </div>
                </div>

                <div class="bg-blue-50 p-5 rounded-lg border border-blue-100 shadow-sm">
                    <h4 class="text-sm font-bold text-blue-800 mb-4 border-b border-blue-200 pb-2"><i class="fa-solid fa-camera text-blue-600 mr-1"></i> 머신비전 엔지니어링 스펙</h4>
                    <div class="space-y-4">
                        <div>
                            <span class="text-xs text-blue-700 block mb-1">검사 종류</span>
                            <div class="font-medium text-slate-800 whitespace-pre-wrap">${row.inspection_type || '-'}</div>
                        </div>
                        <div>
                            <span class="text-xs text-blue-700 block mb-1">광학 조건 (카메라/렌즈/조명)</span>
                            <div class="font-medium text-slate-800 whitespace-pre-wrap bg-white p-3 rounded border border-blue-100">${row.optical_condition || '-'}</div>
                        </div>
                        <div>
                            <span class="text-xs text-blue-700 block mb-1">S/W 툴 및 하드웨어</span>
                            <div class="font-medium text-slate-800 whitespace-pre-wrap">${row.sw_tool || '-'}</div>
                        </div>
                    </div>
                </div>

                <div>
                    <span class="text-xs text-slate-500 block mb-1 font-bold">메모 / 이슈사항</span>
                    <div class="bg-slate-50 p-4 rounded-lg border whitespace-pre-wrap min-h-[80px] text-sm text-slate-700 leading-relaxed">${row.note || '-'}</div>
                </div>
            </div>
            
            <div class="mt-6">
                <button onclick="closeModal()" class="w-full bg-slate-700 text-white py-3 rounded font-bold shadow-lg hover:bg-slate-800 transition">
                    닫기
                </button>
            </div>
        `;
    },
    
    openNewModal() {
        AppState.currentEditId = null;
        openModal('신규 프로젝트 등록');
        document.getElementById('modalBody').innerHTML = this.getFormHtml();
        if(typeof getToday === 'function') document.getElementById('projStart').value = getToday(); 
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
            this.updateProgressText(row.progress || 0);
            document.getElementById('projStart').value = row.start_date || '';
            document.getElementById('projTarget').value = row.target_date || '';
            document.getElementById('projType').value = row.inspection_type || '';
            document.getElementById('projOptics').value = row.optical_condition || '';
            document.getElementById('projSW').value = row.sw_tool || '';
            document.getElementById('projNote').value = row.note || '';
        }, 50);
    },
    
    getFormHtml() {
        return `
            <div class="space-y-4 text-left">
                <div class="bg-white p-4 rounded-lg border shadow-sm">
                    <h4 class="text-sm font-bold text-slate-700 mb-3 border-b pb-2">기본 정보</h4>
                    <div class="grid grid-cols-2 gap-4 mb-3">
                        <div class="col-span-2">
                            <label class="text-xs text-slate-500 font-bold">프로젝트명 <span class="text-red-500">*</span></label>
                            <input id="projName" class="input-box bg-slate-50 font-bold" placeholder="예: A사 2차전지 표면 검사기">
                        </div>
                        <div>
                            <label class="text-xs text-slate-500">고객사(업체명)</label>
                            <input id="projClient" class="input-box" placeholder="고객사 이름">
                        </div>
                        <div>
                            <label class="text-xs text-slate-500">EndUser</label>
                            <input id="projEndUser" class="input-box" placeholder="최종 사용처">
                        </div>
                    </div>
                </div>

                <div class="bg-white p-4 rounded-lg border shadow-sm">
                    <h4 class="text-sm font-bold text-slate-700 mb-3 border-b pb-2">진행 현황</h4>
                    <div class="grid grid-cols-2 gap-4 mb-3">
                        <div>
                            <label class="text-xs text-slate-500 font-bold">상태</label>
                            <select id="projStatus" class="input-box font-bold">
                                <option value="대기">대기</option>
                                <option value="광학테스트">광학테스트</option>
                                <option value="개발중">개발중</option>
                                <option value="현장셋업">현장셋업</option>
                                <option value="완료">완료</option>
                                <option value="보류">보류</option>
                            </select>
                        </div>
                        <div>
                            <label class="text-xs text-slate-500 font-bold">진척도 (<span id="progressText">0</span>%)</label>
                            <input type="range" id="projProgress" min="0" max="100" value="0" class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer mt-2" oninput="ProjectsModule.updateProgressText(this.value)">
                        </div>
                        <div>
                            <label class="text-xs text-slate-500">시작일</label>
                            <input type="date" id="projStart" class="input-box">
                        </div>
                        <div>
                            <label class="text-xs text-slate-500">목표 완료일</label>
                            <input type="date" id="projTarget" class="input-box">
                        </div>
                    </div>
                </div>

                <div class="bg-blue-50 p-4 rounded-lg border border-blue-100 shadow-sm">
                    <h4 class="text-sm font-bold text-blue-800 mb-3 border-b border-blue-200 pb-2">머신비전 엔지니어링 스펙</h4>
                    <div class="space-y-3">
                        <div>
                            <label class="text-xs text-blue-700 font-bold">검사 종류</label>
                            <input id="projType" class="input-box" placeholder="예: 치수 측정, 이물 검사, 얼라인먼트 등">
                        </div>
                        <div>
                            <label class="text-xs text-blue-700 font-bold">광학 조건 (카메라/렌즈/조명)</label>
                            <textarea id="projOptics" class="input-box min-h-[50px]" placeholder="예: 20M CoaXPress, 0.5x Telecentric, 동축조명"></textarea>
                        </div>
                        <div>
                            <label class="text-xs text-blue-700 font-bold">S/W 툴 및 하드웨어</label>
                            <input id="projSW" class="input-box" placeholder="예: Cognex In-Sight, 자체 PC 비전 등">
                        </div>
                    </div>
                </div>

                <div>
                    <label class="text-xs text-slate-500 font-bold">메모 / 이슈사항</label>
                    <textarea id="projNote" class="input-box min-h-[60px]" placeholder="특이사항이나 이슈를 기록하세요."></textarea>
                </div>
            </div>
            
            <button onclick="ProjectsModule.save()" class="w-full mt-6 bg-cyan-600 text-white py-3 rounded font-bold shadow-lg hover:bg-cyan-700 transition">
                저장하기
            </button>`;
    },

    updateProgressText(val) {
        const textEl = document.getElementById('progressText');
        if (textEl) textEl.innerText = val;
    },
    
    async save() {
        const projectName = document.getElementById('projName').value;
        if (!projectName) return alert("프로젝트명은 필수 입력입니다.");
        
        const data = {
            project_name: projectName,
            client_name: document.getElementById('projClient').value,
            manager: document.getElementById('projEndUser').value, 
            status: document.getElementById('projStatus').value,
            progress: parseInt(document.getElementById('projProgress').value) || 0,
            start_date: document.getElementById('projStart').value || null,
            target_date: document.getElementById('projTarget').value || null,
            inspection_type: document.getElementById('projType').value,
            optical_condition: document.getElementById('projOptics').value,
            sw_tool: document.getElementById('projSW').value,
            note: document.getElementById('projNote').value
        };
        
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
        if (!confirm("이 프로젝트를 정말 삭제하시겠습니까?")) return;
        const { error } = await supabaseClient.from(this.tableName).delete().eq('id', id);
        if (error) return alert("삭제 실패: " + error.message);
        this.search();
    }
};

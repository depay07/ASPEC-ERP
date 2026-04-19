// js/modules/projects.js - 프로젝트 관리 모듈

const ProjectsModule = {
    tableName: 'projects',
    
    async search() {
        showTableLoading(9);
        
        let query = supabaseClient
            .from(this.tableName)
            .select('*')
            .order('created_at', { ascending: false });
        
        // 1. 날짜 필터
        const startDate = document.getElementById('searchStartDate')?.value;
        const endDate = document.getElementById('searchEndDate')?.value;
        if (startDate && endDate) {
            query = query.gte('start_date', startDate).lte('start_date', endDate);
        }
        
        // 2. 상태 필터 (체크박스 다중 선택 로직으로 변경)
        // HTML에서 name="search_pStatus"를 가진 체크박스들을 가져옵니다.
        const statusCheckboxes = document.querySelectorAll('input[name="search_pStatus"]:checked');
        const selectedStatuses = Array.from(statusCheckboxes).map(cb => cb.value);
        
        // 체크된 항목이 있을 때만 필터링 (아무것도 체크 안 하면 전체 검색 혹은 조건 없음)
        if (selectedStatuses.length > 0) {
            query = query.in('status', selectedStatuses);
        }
        
        // 3. 프로젝트명 필터
        const nameFilter = document.getElementById('search_pName')?.value;
        if (nameFilter) query = query.ilike('project_name', `%${nameFilter}%`);

        // 4. 고객사 필터
        const clientFilter = document.getElementById('search_pClient')?.value;
        if (clientFilter) query = query.ilike('client_name', `%${clientFilter}%`);
        
        const { data, error } = await query;
        if (error) return alert("검색 실패: " + error.message);
        
        this.renderTable(data);
    },
    
    renderTable(data) {
        const tbody = document.getElementById('listBody');
        if (!data || data.length === 0) return showEmptyTable(9);
        
        tbody.innerHTML = data.map(row => {
            const dataId = storeRowData(row);
            const statusBadge = this.getStatusBadge(row.status);
            const progressBar = this.getProgressBar(row.progress || 0);
            
            return `
                <tr class="hover:bg-slate-50 border-b transition text-sm">
                    <td class="text-left font-bold text-slate-700">${row.project_name}</td>
                    <td class="text-center">${row.client_name || '-'}</td>
                    <td class="text-center">${statusBadge}</td>
                    <td class="px-2">${progressBar}</td>
                    <td class="text-center text-xs text-slate-500">${row.manager || '-'}</td>
                    <td class="text-center text-xs">${row.inspection_type || '-'}</td>
                    <td class="text-left text-xs truncate max-w-[150px]" title="${row.optical_condition || ''}">${row.optical_condition || '-'}</td>
                    <td class="text-left text-xs text-slate-500 truncate max-w-[100px]" title="${row.note || ''}">${row.note || '-'}</td>
                    <td>
                        <div class="flex justify-center gap-1">
                            <button onclick="ProjectsModule.openViewModal('${dataId}')" class="text-green-600 hover:bg-green-50 p-1.5 rounded" title="상세보기"><i class="fa-solid fa-eye"></i></button>
                            <button onclick="ProjectsModule.openEditModal('${dataId}')" class="text-blue-500 hover:bg-blue-50 p-1.5 rounded" title="수정"><i class="fa-solid fa-pen-to-square"></i></button>
                            <button onclick="ProjectsModule.delete(${row.id})" class="text-red-400 hover:bg-red-50 p-1.5 rounded" title="삭제"><i class="fa-solid fa-trash-can"></i></button>
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
        return `<span class="px-2 py-1 rounded-full text-xs font-bold border ${style}">${status || '대기'}</span>`;
    },

    getProgressBar(progress) {
        return `
            <div class="flex items-center gap-2">
                <div class="w-full bg-gray-200 rounded-full h-2">
                    <div class="bg-cyan-600 h-2 rounded-full" style="width: ${progress}%"></div>
                </div>
                <span class="text-xs font-bold text-slate-600 w-8 text-right">${progress}%</span>
            </div>
        `;
    },
    
    // ======== 상세 보기 창 ========
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
        // 등록/수정 시에는 여전히 단일 선택(select)을 유지하는 것이 데이터 정합성에 좋습니다.
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

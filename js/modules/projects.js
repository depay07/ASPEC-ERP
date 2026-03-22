// js/modules/projects.js - 프로젝트 관리 모듈

const ProjectsModule = {
    tableName: 'projects',
    
    async search() {
        showTableLoading(9);
        
        let query = supabaseClient
            .from(this.tableName)
            .select('*')
            .order('created_at', { ascending: false });
        
        // 날짜 필터 (ui.js에서 자동 생성되는 기간 조회 연동)
        const startDate = document.getElementById('searchStartDate')?.value;
        const endDate = document.getElementById('searchEndDate')?.value;
        if (startDate && endDate) {
            query = query.gte('start_date', startDate).lte('start_date', endDate);
        }
        
        const statusFilter = document.getElementById('search_pStatus')?.value;
        if (statusFilter) query = query.eq('status', statusFilter);
        
        const nameFilter = document.getElementById('search_pName')?.value;
        if (nameFilter) query = query.ilike('project_name', `%${nameFilter}%`);

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
            const dataId = storeRowData(row); // 공통 함수 사용 가정
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
                        <div class="flex justify-center gap-2">
                            <button onclick="ProjectsModule.openEditModal('${dataId}')" class="text-blue-500 hover:bg-blue-50 p-1.5 rounded" title="수정"><i class="fa-solid fa-pen-to-square"></i></button>
                            <button onclick="ProjectsModule.delete(${row.Id})" class="text-red-400 hover:bg-red-50 p-1.5 rounded" title="삭제"><i class="fa-solid fa-trash-can"></i></button>
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
    
    openNewModal() {
        AppState.currentEditId = null;
        openModal('신규 프로젝트 등록');
        document.getElementById('modalBody').innerHTML = this.getFormHtml();
        // getToday() 공통 함수 사용 가정
        if(typeof getToday === 'function') document.getElementById('projStart').value = getToday(); 
    },
    
    openEditModal(dataId) {
        const row = getRowData(dataId); // 공통 함수 사용
        if (!row) return alert('데이터 오류');
        
        AppState.currentEditId = row.id;
        openModal('프로젝트 상세/수정');
        document.getElementById('modalBody').innerHTML = this.getFormHtml();
        
        setTimeout(() => {
            document.getElementById('projName').value = row.project_name || '';
            document.getElementById('projClient').value = row.client_name || '';
            document.getElementById('projManager').value = row.manager || '';
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
                            <label class="text-xs text-slate-500">담당자</label>
                            <input id="projManager" class="input-box" value="이창현">
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
            manager: document.getElementById('projManager').value,
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

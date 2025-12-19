// js/modules/meeting-logs.js - 미팅 일지 모듈

const MeetingLogsModule = {
    tableName: 'meeting_logs',
    
    /**
     * 검색 실행
     */
    async search() {
        showTableLoading(6);
        
        let query = supabaseClient
            .from(this.tableName)
            .select('*')
            .order('date', { ascending: false });
        
        // 날짜 필터
        const startDate = el('searchStartDate');
        const endDate = el('searchEndDate');
        if (startDate && endDate) {
            query = query.gte('date', startDate).lte('date', endDate);
        }
        
        // 업체명 필터
        const partnerName = el('search_mlPartner');
        if (partnerName) query = query.ilike('partner_name', `%${partnerName}%`);
        
        // 내용 필터
        const content = el('search_mlContent');
        if (content) query = query.ilike('content', `%${content}%`);
        
        const { data, error } = await query;
        
        if (error) {
            alert("검색 실패: " + error.message);
            return;
        }
        
        this.renderTable(data);
    },
    
    /**
     * 테이블 렌더링
     */
    renderTable(data) {
        const tbody = document.getElementById('listBody');
        
        if (!data || data.length === 0) {
            showEmptyTable(6);
            return;
        }
        
        tbody.innerHTML = data.map(row => {
            const dataId = storeRowData(row);
            const summary = row.content && row.content.length > 30 
                ? row.content.substring(0, 30) + '...' 
                : row.content || '';
            
            return `
                <tr class="hover:bg-slate-50 border-b transition">
                    <td class="text-center font-bold text-slate-700">${row.date}</td>
                    <td class="text-center font-bold text-blue-600">${row.partner_name}</td>
                    <td class="text-center text-xs">${row.attendees || '-'}</td>
                    <td class="text-xs text-slate-600 cursor-pointer hover:text-blue-500" onclick="MeetingLogsModule.openEditModal('${dataId}')">
                        ${summary}
                    </td>
                    <td class="text-xs text-red-500">${row.next_step || ''}</td>
                    <td>${this.getActionButtons(dataId, row.id)}</td>
                </tr>`;
        }).join('');
    },
    
    /**
     * 액션 버튼 HTML
     */
    getActionButtons(dataId, rowId) {
        return `
            <div class="flex justify-center items-center gap-3">
                <button onclick="MeetingLogsModule.openEditModal('${dataId}')" class="text-blue-500 hover:text-blue-700 p-2 rounded hover:bg-blue-50 transition" title="수정">
                    <i class="fa-solid fa-pen-to-square fa-lg"></i>
                </button>
                <button onclick="MeetingLogsModule.delete(${rowId})" class="text-red-400 hover:text-red-600 p-2 rounded hover:bg-red-50 transition" title="삭제">
                    <i class="fa-solid fa-trash-can fa-lg"></i>
                </button>
            </div>`;
    },
    
    /**
     * 신규 등록 모달 열기
     */
    openNewModal() {
        AppState.currentEditId = null;
        openModal('미팅 일지 등록');
        
        const body = document.getElementById('modalBody');
        body.innerHTML = this.getFormHtml();
        
        // 오늘 날짜 설정 + datalist 채우기
        document.getElementById('mlDate').value = getToday();
        fillDatalist('dl_part_ml', AppState.partnerList);
    },
    
    /**
     * 수정 모달 열기
     */
    openEditModal(dataId) {
        const row = getRowData(dataId);
        if (!row) return alert('데이터 오류');
        
        AppState.currentEditId = row.id;
        openModal('미팅 일지 수정');
        
        const body = document.getElementById('modalBody');
        body.innerHTML = this.getFormHtml();
        
        // 데이터 채우기
        setTimeout(() => {
            document.getElementById('mlDate').value = row.date || '';
            document.getElementById('mlPartner').value = row.partner_name || '';
            document.getElementById('mlAttendees').value = row.attendees || '';
            document.getElementById('mlContent').value = row.content || '';
            document.getElementById('mlNextStep').value = row.next_step || '';
            fillDatalist('dl_part_ml', AppState.partnerList);
        }, 50);
    },
    
    /**
     * 폼 HTML
     */
    getFormHtml() {
        return `
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="text-xs font-bold text-slate-700">미팅 날짜 (필수)</label>
                    <input type="date" id="mlDate" class="input-box">
                </div>
                <div>
                    <label class="text-xs font-bold text-slate-700">업체명 (필수)</label>
                    <input id="mlPartner" class="input-box" list="dl_part_ml" placeholder="업체명 입력 또는 선택">
                </div>
                <div class="col-span-2">
                    <label class="text-xs font-bold text-slate-700">참석자</label>
                    <input id="mlAttendees" class="input-box" placeholder="예: 김철수 부장, 이영희 대리">
                </div>
                <div class="col-span-2">
                    <label class="text-xs font-bold text-slate-700">미팅 상세 내용</label>
                    <textarea id="mlContent" class="input-box h-40 resize-none p-3" placeholder="미팅 내용을 상세히 기록하세요."></textarea>
                </div>
                <div class="col-span-2">
                    <label class="text-xs font-bold text-slate-700 text-red-600">향후 계획 / 조치 사항</label>
                    <input id="mlNextStep" class="input-box" placeholder="다음 미팅 일정 혹은 확인해야 할 사항">
                </div>
            </div>
            <button onclick="MeetingLogsModule.save()" class="w-full mt-6 bg-slate-800 text-white py-3 rounded font-bold hover:bg-slate-900 transition">
                일지 저장
            </button>
            <datalist id="dl_part_ml"></datalist>`;
    },
    
    /**
     * 저장
     */
    async save() {
        const partnerName = el('mlPartner');
        const date = el('mlDate');
        const content = el('mlContent');
        
        if (!partnerName || !date || !content) {
            alert('날짜, 업체명, 내용은 필수입니다.');
            return;
        }
        
        const data = {
            date: date,
            partner_name: partnerName,
            attendees: el('mlAttendees'),
            content: content,
            next_step: el('mlNextStep')
        };
        
        // 저장 실행
        let result;
        if (AppState.currentEditId) {
            result = await supabaseClient
                .from(this.tableName)
                .update(data)
                .eq('id', AppState.currentEditId);
        } else {
            result = await supabaseClient
                .from(this.tableName)
                .insert(data);
        }
        
        if (result.error) {
            alert("저장 실패: " + result.error.message);
            return;
        }
        
        alert("저장되었습니다.");
        closeModal();
        this.search();
    },
    
    /**
     * 삭제
     */
    async delete(id) {
        if (!confirm("정말 삭제하시겠습니까?")) return;
        
        const { error } = await supabaseClient
            .from(this.tableName)
            .delete()
            .eq('id', id);
        
        if (error) {
            alert("삭제 실패: " + error.message);
            return;
        }
        
        this.search();
    }
};

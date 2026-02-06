// js/modules/products.js - 품목 관리 모듈

const ProductsModule = {
    tableName: 'products',
    
    /**
     * 검색 실행
     */
    async search() {
        showTableLoading(5);
        
        let query = supabaseClient
            .from(this.tableName)
            .select('*')
            .order('name');
        
        // 필터 적용
        const nameFilter = el('search_sName');
        const codeFilter = el('search_sCode');
        
        if (nameFilter) query = query.ilike('name', `%${nameFilter}%`);
        if (codeFilter) query = query.ilike('code', `%${codeFilter}%`);
        
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
            showEmptyTable(5);
            return;
        }
        
        tbody.innerHTML = data.map(row => {
            const dataId = storeRowData(row);
            
            return `
                <tr class="hover:bg-slate-50 border-b transition">
                    <td class="font-mono text-center text-cyan-600">${row.code}</td>
                    <td>${row.name}</td>
                    <td>${row.spec || '-'}</td>
                    <td class="text-center font-bold text-slate-600">${row.unit || 'EA'}</td>
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
                <button onclick="ProductsModule.openEditModal('${dataId}')" class="text-blue-500 hover:text-blue-700 p-2 rounded hover:bg-blue-50 transition" title="수정">
                    <i class="fa-solid fa-pen-to-square fa-lg"></i>
                </button>
                <button onclick="ProductsModule.delete(${rowId})" class="text-red-400 hover:text-red-600 p-2 rounded hover:bg-red-50 transition" title="삭제">
                    <i class="fa-solid fa-trash-can fa-lg"></i>
                </button>
            </div>`;
    },
    
    /**
     * 신규 등록 모달 열기
     */
    openNewModal() {
        AppState.currentEditId = null;
        openModal('품목 등록');
        
        const body = document.getElementById('modalBody');
        body.innerHTML = this.getFormHtml();
    },
    
    /**
     * 수정 모달 열기
     */
    openEditModal(dataId) {
        const row = getRowData(dataId);
        if (!row) return alert('데이터 오류');
        
        AppState.currentEditId = row.id;
        openModal('품목 수정');
        
        const body = document.getElementById('modalBody');
        body.innerHTML = this.getFormHtml();
        
        // 데이터 채우기
        setTimeout(() => {
            document.getElementById('prodName').value = row.name || '';
            document.getElementById('prodCode').value = row.code || '';
            document.getElementById('prodUnit').value = row.unit || '';
            document.getElementById('prodSpec').value = row.spec || '';
            document.getElementById('prodMaker').value = row.manufacturer || '';
        }, 50);
    },
    
    /**
     * 폼 HTML
     */
    getFormHtml() {
        return `
            <div class="grid grid-cols-2 gap-3">
                <div class="col-span-2">
                    <label class="text-xs">품목명 (필수)</label>
                    <input id="prodName" class="input-box" oninput="ProductsModule.autoGenCode(this.value)">
                </div>
                <div>
                    <label class="text-xs">품목코드 (자동)</label>
                    <input id="prodCode" class="input-box bg-slate-100" readonly>
                </div>
                <div>
                    <label class="text-xs">단위</label>
                    <input id="prodUnit" class="input-box" placeholder="EA">
                </div>
                <div class="col-span-2">
                    <label class="text-xs">규격</label>
                    <input id="prodSpec" class="input-box">
                </div>
                <div class="col-span-2">
                    <label class="text-xs">제조사</label>
                    <input id="prodMaker" class="input-box">
                </div>
            </div>
            <button onclick="ProductsModule.save()" class="w-full mt-4 bg-cyan-600 text-white py-3 rounded font-bold hover:bg-cyan-700 transition">
                저장
            </button>`;
    },
    
    /**
     * 품목코드 자동 생성
     */
    autoGenCode(val) {
        if (val && !AppState.currentEditId) {
            document.getElementById('prodCode').value = 'P-' + Date.now().toString().slice(-6);
        }
    },
    
    /**
     * 저장
     */
    async save() {
        const name = el('prodName');
        if (!name) {
            alert('품목명은 필수입니다.');
            return;
        }
        
        const data = {
            name: name,
            code: el('prodCode'),
            spec: el('prodSpec'),
            unit: el('prodUnit') || 'EA',
            manufacturer: el('prodMaker')
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
        await fetchMasterData(true);
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
        
        await fetchMasterData();
        this.search();
    }
};

// js/modules/bom.js - BOM(세트) 관리 모듈

const BOMModule = {
    tableName: 'bom',
    bomList: [],
    
    /**
     * BOM 관리 모달 열기
     */
    async openModal() {
        await this.loadBOM();
        
        openModal('세트(BOM) 관리');
        
        const body = document.getElementById('modalBody');
        body.innerHTML = this.getFormHtml();
        
        fillDatalist('dl_prod_bom_parent', AppState.productList);
        fillDatalist('dl_prod_bom_child', AppState.productList);
        
        this.renderBOMList();
    },
    
    /**
     * BOM 목록 로드
     */
    async loadBOM() {
        const { data, error } = await supabaseClient
            .from(this.tableName)
            .select('*')
            .order('parent_name');
        
        if (!error) {
            this.bomList = data || [];
        }
    },
    
    /**
     * 폼 HTML
     */
    getFormHtml() {
        return `
            <div class="bg-purple-50 p-4 rounded mb-4 border border-purple-200">
                <p class="text-sm text-purple-800">
                    <i class="fa-solid fa-info-circle mr-1"></i>
                    세트 품목을 구성하면, 판매 시 구성품의 재고가 자동으로 차감되고, 원가 계산 시 구성품별로 입력할 수 있습니다.
                </p>
            </div>
            
            <div class="bg-white border p-4 rounded mb-4">
                <h4 class="font-bold text-slate-700 mb-3">새 구성품 추가</h4>
                <div class="flex gap-3 items-end">
                    <div class="flex-1">
                        <label class="text-xs text-slate-500">세트(부모) 품목</label>
                        <input id="bomParent" class="input-box" list="dl_prod_bom_parent" placeholder="세트 품목 선택">
                    </div>
                    <div class="flex-1">
                        <label class="text-xs text-slate-500">구성(자식) 품목</label>
                        <input id="bomChild" class="input-box" list="dl_prod_bom_child" placeholder="구성품 선택">
                    </div>
                    <div class="w-24">
                        <label class="text-xs text-slate-500">수량 (EA/Set)</label>
                        <input type="number" id="bomQty" class="input-box" value="1" min="1">
                    </div>
                    <button onclick="BOMModule.addBOM()" class="bg-purple-600 text-white px-4 py-2 rounded font-bold hover:bg-purple-700 transition h-[38px]">
                        추가
                    </button>
                </div>
            </div>
            
            <div class="border rounded overflow-hidden">
                <table class="w-full text-sm">
                    <thead class="bg-slate-100">
                        <tr>
                            <th class="p-3 text-left">세트 품목</th>
                            <th class="p-3 text-left">구성품</th>
                            <th class="p-3 text-center">수량</th>
                            <th class="p-3 text-center w-20">삭제</th>
                        </tr>
                    </thead>
                    <tbody id="bomListBody"></tbody>
                </table>
            </div>
            
            <datalist id="dl_prod_bom_parent"></datalist>
            <datalist id="dl_prod_bom_child"></datalist>`;
    },
    
    /**
     * BOM 목록 렌더링
     */
    renderBOMList() {
        const tbody = document.getElementById('bomListBody');
        
        if (this.bomList.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-slate-400">등록된 세트 구성이 없습니다.</td></tr>';
            return;
        }
        
        // 부모 품목별 그룹화
        const grouped = {};
        this.bomList.forEach(item => {
            if (!grouped[item.parent_name]) {
                grouped[item.parent_name] = [];
            }
            grouped[item.parent_name].push(item);
        });
        
        let html = '';
        Object.keys(grouped).forEach(parentName => {
            const children = grouped[parentName];
            
            children.forEach((child, idx) => {
                html += `
                    <tr class="border-b hover:bg-slate-50">
                        <td class="p-3 ${idx === 0 ? 'font-bold text-purple-700' : 'text-slate-400 text-xs pl-8'}">
                            ${idx === 0 ? `<i class="fa-solid fa-layer-group mr-1"></i> ${parentName}` : '└'}
                        </td>
                        <td class="p-3">${child.child_name}</td>
                        <td class="p-3 text-center font-bold">${child.qty}</td>
                        <td class="p-3 text-center">
                            <button onclick="BOMModule.deleteBOM(${child.id})" class="text-red-400 hover:text-red-600">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </td>
                    </tr>`;
            });
        });
        
        tbody.innerHTML = html;
    },
    
    /**
     * BOM 추가
     */
    async addBOM() {
        const parentName = el('bomParent');
        const childName = el('bomChild');
        const qty = parseInt(el('bomQty')) || 1;
        
        if (!parentName || !childName) {
            alert('세트 품목과 구성품을 모두 선택해주세요.');
            return;
        }
        
        if (parentName === childName) {
            alert('세트 품목과 구성품이 같을 수 없습니다.');
            return;
        }
        
        // 중복 체크
        const exists = this.bomList.some(b => 
            b.parent_name === parentName && b.child_name === childName
        );
        
        if (exists) {
            alert('이미 등록된 구성입니다.');
            return;
        }
        
        const { error } = await supabaseClient
            .from(this.tableName)
            .insert({
                parent_name: parentName,
                child_name: childName,
                qty: qty
            });
        
        if (error) {
            alert('추가 실패: ' + error.message);
            return;
        }
        
        // 입력 필드 초기화
        document.getElementById('bomChild').value = '';
        document.getElementById('bomQty').value = '1';
        
        await this.loadBOM();
        this.renderBOMList();
    },
    
    /**
     * BOM 삭제
     */
    async deleteBOM(id) {
        if (!confirm('이 구성을 삭제하시겠습니까?')) return;
        
        const { error } = await supabaseClient
            .from(this.tableName)
            .delete()
            .eq('id', id);
        
        if (error) {
            alert('삭제 실패: ' + error.message);
            return;
        }
        
        await this.loadBOM();
        this.renderBOMList();
    }
};

// 전역 함수 연결
function openBOMModal() {
    BOMModule.openModal();
}

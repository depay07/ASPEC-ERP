// js/modules/partners.js - 거래처 관리 모듈 (멀티 파일 업로드 지원)

var PartnersModule = {
    tableName: 'partners',
    
    // 검색
    async search(forceRefresh) {
        var self = this;
        var query = supabaseClient
            .from(this.tableName)
            .select('*')
            .order('created_at', { ascending: false });
        
        var nameFilter = el('search_sName');
        var managerFilter = el('search_sManager');
        if (nameFilter) query = query.ilike('name', '%' + nameFilter + '%');
        if (managerFilter) query = query.ilike('manager_name', '%' + managerFilter + '%');
        
        await cachedSearch(
            this.tableName,
            query,
            function(data) { self.renderTable(data); },
            5,
            forceRefresh
        );
    },
    
    // 테이블 렌더링
    renderTable: function(data) {
        var tbody = document.getElementById('listBody');
        if (!data || data.length === 0) {
            showEmptyTable(5);
            return;
        }
        
        var html = '';
        data.forEach(function(row) {
            var dataId = storeRowData(row);
            
            // 파일 아이콘들 (파일이 있는 경우에만 표시)
            var bizIcons = '';
            if (row.biz_file_url) bizIcons += '<a href="' + row.biz_file_url + '" target="_blank" class="text-green-600 hover:text-green-800 ml-1" title="사업자1"><i class="fa-solid fa-file-pdf"></i></a>';
            if (row.biz_file_url2) bizIcons += '<a href="' + row.biz_file_url2 + '" target="_blank" class="text-green-500 hover:text-green-700 ml-1" title="사업자2"><i class="fa-solid fa-file-pdf"></i></a>';
            
            var bankIcons = '';
            if (row.bank_file_url1) bankIcons += '<a href="' + row.bank_file_url1 + '" target="_blank" class="text-blue-600 hover:text-blue-800 ml-1" title="통장1"><i class="fa-solid fa-building-columns"></i></a>';
            if (row.bank_file_url2) bankIcons += '<a href="' + row.bank_file_url2 + '" target="_blank" class="text-blue-500 hover:text-blue-700 ml-1" title="통장2"><i class="fa-solid fa-building-columns"></i></a>';
            
            html += '<tr class="hover:bg-slate-50 border-b transition">';
            html += '<td class="text-left pl-4 font-bold">' + (row.name || '') + bizIcons + bankIcons + '</td>';
            html += '<td class="text-center">' + (row.manager_name || '-') + '</td>';
            html += '<td class="text-center">' + (row.phone || '-') + '</td>';
            html += '<td class="text-left text-xs text-slate-500">' + (row.note || '') + '</td>';
            html += '<td>';
            html += '<div class="flex justify-center items-center gap-3">';
            html += '<button onclick="PartnersModule.openEditModal(\'' + dataId + '\')" class="text-blue-500 hover:text-blue-700 p-2"><i class="fa-solid fa-pen-to-square fa-lg"></i></button>';
            html += '<button onclick="PartnersModule.delete(' + row.id + ')" class="text-red-400 hover:text-red-600 p-2"><i class="fa-solid fa-trash-can fa-lg"></i></button>';
            html += '</div>';
            html += '</td>';
            html += '</tr>';
        });
        tbody.innerHTML = html;
    },
    
    openNewModal: function() {
        AppState.currentEditId = null;
        openModal('거래처 등록');
        document.getElementById('modalBody').innerHTML = this.getFormHtml();
    },
    
    openEditModal: function(dataId) {
        var row = getRowData(dataId);
        if (!row) return alert('데이터 오류');
        
        AppState.currentEditId = row.id;
        openModal('거래처 수정');
        document.getElementById('modalBody').innerHTML = this.getFormHtml();
        
        setTimeout(function() {
            document.getElementById('pName').value = row.name || '';
            document.getElementById('pBiz').value = row.biz_num || '';
            document.getElementById('pOwner').value = row.owner_name || '';
            document.getElementById('pManager').value = row.manager_name || '';
            document.getElementById('pPhone').value = row.phone || '';
            document.getElementById('pEmail').value = row.email || '';
            document.getElementById('pAddr').value = row.address || '';
            document.getElementById('pNote').value = row.note || '';
            
            // 기존 파일 링크 표시 로직
            var fileSlots = [
                { id: 'pLink_biz1', url: row.biz_file_url },
                { id: 'pLink_biz2', url: row.biz_file_url2 },
                { id: 'pLink_bank1', url: row.bank_file_url1 },
                { id: 'pLink_bank2', url: row.bank_file_url2 }
            ];
            
            fileSlots.forEach(function(slot) {
                var el = document.getElementById(slot.id);
                if (slot.url) {
                    el.innerHTML = '<a href="' + slot.url + '" target="_blank" class="text-blue-600 font-bold hover:underline">[기존파일]</a>';
                }
            });
        }, 50);
    },
    
    getFormHtml: function() {
        var html = '<div class="grid grid-cols-2 gap-3 text-left">';
        html += '<div><label class="text-xs font-bold">상호 (필수)</label><input id="pName" class="input-box"></div>';
        html += '<div><label class="text-xs font-bold">사업자번호</label><input id="pBiz" class="input-box"></div>';
        html += '<div><label class="text-xs font-bold">대표자</label><input id="pOwner" class="input-box"></div>';
        html += '<div><label class="text-xs font-bold">담당자</label><input id="pManager" class="input-box"></div>';
        html += '<div><label class="text-xs font-bold">전화번호</label><input id="pPhone" class="input-box"></div>';
        html += '<div><label class="text-xs font-bold">이메일</label><input id="pEmail" class="input-box"></div>';
        html += '<div class="col-span-2"><label class="text-xs font-bold">주소</label><input id="pAddr" class="input-box"></div>';
        
        // 사업자등록증 섹션
        html += '<div class="col-span-2 border-t pt-2 mt-2"><label class="text-[11px] font-bold text-slate-400">사업자등록증 업로드 (최대 2개)</label></div>';
        html += '<div class="bg-slate-50 p-2 rounded border flex flex-col gap-2">';
        html += '  <div class="flex items-center gap-2"><input type="file" id="p_file_biz1" class="text-xs flex-1" accept="image/*,.pdf"><div id="pLink_biz1"></div></div>';
        html += '  <div class="flex items-center gap-2"><input type="file" id="p_file_biz2" class="text-xs flex-1" accept="image/*,.pdf"><div id="pLink_biz2"></div></div>';
        html += '</div>';

        // 통장사본 섹션
        html += '<div class="col-span-2 border-t pt-2 mt-2"><label class="text-[11px] font-bold text-slate-400">통장사본 업로드 (최대 2개)</label></div>';
        html += '<div class="bg-slate-50 p-2 rounded border flex flex-col gap-2">';
        html += '  <div class="flex items-center gap-2"><input type="file" id="p_file_bank1" class="text-xs flex-1" accept="image/*,.pdf"><div id="pLink_bank1"></div></div>';
        html += '  <div class="flex items-center gap-2"><input type="file" id="p_file_bank2" class="text-xs flex-1" accept="image/*,.pdf"><div id="pLink_bank2"></div></div>';
        html += '</div>';

        html += '<div class="col-span-2 mt-2"><label class="text-xs font-bold">비고</label><input id="pNote" class="input-box"></div>';
        html += '</div>';
        html += '<button onclick="PartnersModule.save()" class="w-full mt-6 bg-slate-800 text-white py-3 rounded font-bold hover:bg-black transition">저장하기</button>';
        return html;
    },
    
    // 파일 업로드 헬퍼 함수
    uploadProcess: async function(inputId, prefix) {
        var fileInput = document.getElementById(inputId);
        if (fileInput && fileInput.files.length > 0) {
            var file = fileInput.files[0];
            var fileExt = file.name.split('.').pop();
            var fileName = prefix + '_' + Date.now() + '_' + Math.floor(Math.random() * 1000) + '.' + fileExt;
            
            var { data, error } = await supabaseClient.storage.from('erp').upload(fileName, file);
            if (error) throw error;
            
            return supabaseClient.storage.from('erp').getPublicUrl(fileName).data.publicUrl;
        }
        return null;
    },

    save: async function() {
        var name = el('pName');
        if (!name) return alert('상호명은 필수입니다.');
        
        showFullLoading(true); // 저장 중 로딩 표시 시작
        
        try {
            var data = {
                name: name.trim(),
                biz_num: el('pBiz'),
                owner_name: el('pOwner'),
                manager_name: el('pManager'),
                phone: el('pPhone'),
                email: el('pEmail'),
                address: el('pAddr'),
                note: el('pNote')
            };
            
            // 4개의 파일 업로드 처리
            var url1 = await this.uploadProcess('p_file_biz1', 'biz1');
            if (url1) data.biz_file_url = url1;

            var url2 = await this.uploadProcess('p_file_biz2', 'biz2');
            if (url2) data.biz_file_url2 = url2;

            var url3 = await this.uploadProcess('p_file_bank1', 'bank1');
            if (url3) data.bank_file_url1 = url3;

            var url4 = await this.uploadProcess('p_file_bank2', 'bank2');
            if (url4) data.bank_file_url2 = url4;
            
            var result;
            if (AppState.currentEditId) {
                result = await supabaseClient.from(this.tableName).update(data).eq('id', AppState.currentEditId);
            } else {
                result = await supabaseClient.from(this.tableName).insert(data);
            }
            
            if (result.error) throw result.error;
            
            alert("저장되었습니다.");
            await afterDataChange(this.tableName, true);
            
        } catch (e) {
            alert("오류 발생: " + e.message);
        } finally {
            showFullLoading(false);
        }
    },
    
    delete: async function(id) {
        if (!confirm("정말 삭제하시겠습니까?")) return;
        var result = await supabaseClient.from(this.tableName).delete().eq('id', id);
        if (result.error) return alert("삭제 실패");
        await afterDataChange(this.tableName, true);
    }
};

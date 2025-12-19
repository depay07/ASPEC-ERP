// js/modules/partners.js - 거래처 관리 모듈

const PartnersModule = {
    tableName: 'partners',
    
    async search() {
        showTableLoading(5);
        
        try {
            var query = supabaseClient
                .from(this.tableName)
                .select('*')
                .order('created_at', { ascending: false });
            
            var nameFilter = el('search_sName');
            var managerFilter = el('search_sManager');
            
            if (nameFilter) query = query.ilike('name', '%' + nameFilter + '%');
            if (managerFilter) query = query.ilike('manager_name', '%' + managerFilter + '%');
            
            var result = await query;
            
            if (result.error) {
                alert("검색 실패: " + result.error.message);
                return;
            }
            
            // 캐시 저장
            setCache('partners', result.data);
            
            this.renderTable(result.data);
        } catch (e) {
            console.error('Partners search error:', e);
        }
    },
    
    renderTable(data) {
        var tbody = document.getElementById('listBody');
        
        if (!data || data.length === 0) {
            showEmptyTable(5);
            return;
        }
        
        var html = '';
        data.forEach(function(row) {
            var dataId = storeRowData(row);
            var fileIcon = row.biz_file_url 
                ? '<a href="' + row.biz_file_url + '" target="_blank" class="text-green-600 hover:text-green-800 ml-2"><i class="fa-solid fa-file-pdf"></i></a>' 
                : '';
            
            html += '<tr class="hover:bg-slate-50 border-b transition">';
            html += '<td class="text-left pl-4">' + (row.name || '') + ' ' + fileIcon + '</td>';
            html += '<td class="text-center">' + (row.manager_name || '-') + '</td>';
            html += '<td class="text-center">' + (row.phone || '-') + '</td>';
            html += '<td class="text-left">' + (row.note || '') + '</td>';
            html += '<td>';
            html += '<div class="flex justify-center items-center gap-3">';
            html += '<button onclick="PartnersModule.openEditModal(\'' + dataId + '\')" class="text-blue-500 hover:text-blue-700 p-2 rounded hover:bg-blue-50 transition" title="수정"><i class="fa-solid fa-pen-to-square fa-lg"></i></button>';
            html += '<button onclick="PartnersModule.delete(' + row.id + ')" class="text-red-400 hover:text-red-600 p-2 rounded hover:bg-red-50 transition" title="삭제"><i class="fa-solid fa-trash-can fa-lg"></i></button>';
            html += '</div>';
            html += '</td>';
            html += '</tr>';
        });
        
        tbody.innerHTML = html;
    },
    
    openNewModal() {
        AppState.currentEditId = null;
        openModal('거래처 등록');
        document.getElementById('modalBody').innerHTML = this.getFormHtml();
    },
    
    openEditModal(dataId) {
        var row = getRowData(dataId);
        if (!row) {
            alert('데이터를 찾을 수 없습니다.');
            return;
        }
        
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
            
            var linkDiv = document.getElementById('pCurrentFileLink');
            if (row.biz_file_url) {
                linkDiv.innerHTML = '<a href="' + row.biz_file_url + '" target="_blank" class="text-blue-600 hover:underline font-bold ml-2">[기존 파일 보기]</a>';
            } else {
                linkDiv.innerHTML = '<span class="text-slate-400 ml-2">(파일 없음)</span>';
            }
        }, 50);
    },
    
    getFormHtml() {
        var html = '';
        html += '<div class="grid grid-cols-2 gap-3">';
        html += '<div><label class="text-xs font-bold text-slate-600">상호 (필수)</label><input id="pName" class="input-box" placeholder="거래처명 입력"></div>';
        html += '<div><label class="text-xs font-bold text-slate-600">사업자번호</label><input id="pBiz" class="input-box" placeholder="000-00-00000"></div>';
        html += '<div><label class="text-xs font-bold text-slate-600">대표자</label><input id="pOwner" class="input-box"></div>';
        html += '<div><label class="text-xs font-bold text-slate-600">담당자</label><input id="pManager" class="input-box"></div>';
        html += '<div><label class="text-xs font-bold text-slate-600">전화번호</label><input id="pPhone" class="input-box" placeholder="010-0000-0000"></div>';
        html += '<div><label class="text-xs font-bold text-slate-600">이메일</label><input id="pEmail" class="input-box" placeholder="email@example.com"></div>';
        html += '<div class="col-span-2"><label class="text-xs font-bold text-slate-600">주소</label><input id="pAddr" class="input-box" placeholder="주소를 입력하세요"></div>';
        html += '<div class="col-span-2 border p-3 rounded bg-slate-50">';
        html += '<label class="text-xs font-bold text-slate-600">사업자등록증 (PDF/이미지)</label>';
        html += '<div class="flex gap-2 mt-2 items-center">';
        html += '<input type="file" id="pFile" class="text-xs flex-1" accept=".pdf,.jpg,.png,.jpeg">';
        html += '<div id="pCurrentFileLink" class="text-xs"></div>';
        html += '</div></div>';
        html += '<div class="col-span-2"><label class="text-xs font-bold text-slate-600">비고</label><input id="pNote" class="input-box" placeholder="메모"></div>';
        html += '</div>';
        html += '<button onclick="PartnersModule.save()" class="w-full mt-6 bg-cyan-600 text-white py-3 rounded font-bold hover:bg-cyan-700 transition">저장</button>';
        return html;
    },
    
    async save() {
        var name = el('pName');
        if (!name || name.trim() === '') {
            alert('상호명은 필수입니다.');
            return;
        }
        
        try {
            var data = {
                name: name.trim(),
                biz_num: el('pBiz') || null,
                owner_name: el('pOwner') || null,
                manager_name: el('pManager') || null,
                phone: el('pPhone') || null,
                email: el('pEmail') || null,
                address: el('pAddr') || null,
                note: el('pNote') || null
            };
            
            var fileInput = document.getElementById('pFile');
            if (fileInput && fileInput.files && fileInput.files.length > 0) {
                var file = fileInput.files[0];
                var fileExt = file.name.split('.').pop();
                var fileName = 'biz_' + Date.now() + '.' + fileExt;
                
                var uploadResult = await supabaseClient.storage
                    .from('erp')
                    .upload(fileName, file);
                
                if (uploadResult.error) {
                    alert("파일 업로드 실패: " + uploadResult.error.message);
                    return;
                }
                
                var urlResult = supabaseClient.storage
                    .from('erp')
                    .getPublicUrl(fileName);
                
                data.biz_file_url = urlResult.data.publicUrl;
            }
            
            var result;
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
            
            // 캐시 삭제 후 새로 로드
            clearCache('partners');
            await fetchMasterData(true);
            this.search();
            
        } catch (e) {
            console.error('Save error:', e);
            alert("저장 중 오류 발생: " + e.message);
        }
    },
    
    async delete(id) {
        if (!confirm("정말 삭제하시겠습니까?")) return;
        
        try {
            var result = await supabaseClient
                .from(this.tableName)
                .delete()
                .eq('id', id);
            
            if (result.error) {
                alert("삭제 실패: " + result.error.message);
                return;
            }
            
            // 캐시 삭제 후 새로 로드
            clearCache('partners');
            await fetchMasterData(true);
            this.search();
            
        } catch (e) {
            console.error('Delete error:', e);
            alert("삭제 중 오류 발생: " + e.message);
        }
    }
};

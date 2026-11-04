var WebsiteInquiriesModule = {
    tableName: 'website_inquiries',

    escape: function(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, function(char) {
            return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char];
        });
    },

    statusLabel: function(status) {
        return {new:'신규', in_progress:'처리 중', completed:'완료', spam:'스팸'}[status] || status;
    },

    async search() {
        showTableLoading(7);
        var query = supabaseClient.from(this.tableName).select('*').order('created_at', {ascending:false}).limit(500);
        var status = document.getElementById('search_wiStatus');
        var keyword = document.getElementById('search_wiKeyword');
        if (status && status.value) query = query.eq('status', status.value);
        if (keyword && keyword.value.trim()) {
            var term = keyword.value.trim().replace(/[%_,()]/g, ' ');
            query = query.or('contact.ilike.%' + term + '%,message.ilike.%' + term + '%,inquiry_type.ilike.%' + term + '%');
        }
        var result = await query;
        if (result.error) {
            showEmptyTable(7);
            alert('홈페이지 문의를 불러오지 못했습니다: ' + result.error.message);
            return;
        }
        this.renderTable(result.data || []);
    },

    renderTable: function(rows) {
        var tbody = document.getElementById('listBody');
        if (!rows.length) return showEmptyTable(7);
        tbody.innerHTML = rows.map(function(row) {
            var received = new Date(row.created_at).toLocaleString('ko-KR');
            var preview = row.message.length > 80 ? row.message.slice(0, 80) + '…' : row.message;
            var dataId = storeRowData(row);
            var notify = row.notification_status === 'sent' ? '이메일 전송' :
                (row.notification_status === 'failed' ? '이메일 실패' :
                (row.notification_status === 'not_configured' ? 'ERP 저장' : '전송 대기'));
            return '<tr class="hover:bg-slate-50 border-b">' +
                '<td class="text-center text-xs">' + WebsiteInquiriesModule.escape(received) + '</td>' +
                '<td class="font-bold">' + WebsiteInquiriesModule.escape(row.inquiry_type) + '</td>' +
                '<td>' + WebsiteInquiriesModule.escape(row.contact || '-') + '</td>' +
                '<td class="text-left text-sm">' + WebsiteInquiriesModule.escape(preview) + '</td>' +
                '<td class="text-center"><span class="text-xs font-bold">' + WebsiteInquiriesModule.escape(WebsiteInquiriesModule.statusLabel(row.status)) + '</span></td>' +
                '<td class="text-center text-xs">' + WebsiteInquiriesModule.escape(notify) + '</td>' +
                '<td class="text-center"><button type="button" onclick="WebsiteInquiriesModule.openDetail(\'' + dataId + '\')" class="text-blue-600 hover:text-blue-800 p-2" title="문의 상세"><i class="fa-solid fa-magnifying-glass"></i></button></td>' +
                '</tr>';
        }).join('');
    },

    openDetail: function(dataId) {
        var row = getRowData(dataId);
        if (!row) return;
        AppState.currentEditId = row.id;
        openModal('홈페이지 문의 상세');
        document.getElementById('modalBody').innerHTML =
            '<div class="space-y-4 text-left">' +
            '<div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">' +
            '<p><strong>접수:</strong> ' + this.escape(new Date(row.created_at).toLocaleString('ko-KR')) + '</p>' +
            '<p><strong>문의 유형:</strong> ' + this.escape(row.inquiry_type) + '</p>' +
            '<p class="md:col-span-2"><strong>연락처:</strong> ' + this.escape(row.contact || '미입력') + '</p></div>' +
            '<div><label class="text-xs font-bold text-slate-500">문의 원문</label><div class="mt-1 whitespace-pre-wrap rounded border bg-slate-50 p-4 text-sm leading-6">' + this.escape(row.message) + '</div></div>' +
            '<div><label class="text-xs font-bold">처리 상태</label><select id="wiStatus" class="input-box"><option value="new">신규</option><option value="in_progress">처리 중</option><option value="completed">완료</option><option value="spam">스팸</option></select></div>' +
            '<div><label class="text-xs font-bold">내부 메모</label><textarea id="wiNote" class="input-box" rows="4" maxlength="5000"></textarea></div>' +
            '<button type="button" onclick="runSaveOnce(\'website-inquiry\', this, () => WebsiteInquiriesModule.save())" class="w-full bg-slate-800 text-white py-3 rounded font-bold hover:bg-black">저장</button></div>';
        document.getElementById('wiStatus').value = row.status;
        document.getElementById('wiNote').value = row.internal_note || '';
    },

    async save() {
        var nextStatus = document.getElementById('wiStatus').value;
        var note = document.getElementById('wiNote').value.trim() || null;
        var session = await supabaseClient.auth.getSession();
        var values = {
            status: nextStatus,
            internal_note: note,
            updated_at: new Date().toISOString()
        };
        if (nextStatus !== 'new') {
            values.handled_at = new Date().toISOString();
            values.handled_by = session.data.session && session.data.session.user ? session.data.session.user.id : null;
        } else {
            values.handled_at = null;
            values.handled_by = null;
        }
        var result = await supabaseClient.from(this.tableName).update(values).eq('id', AppState.currentEditId);
        if (result.error) return alert('저장 실패: ' + result.error.message);
        closeModal();
        await this.search();
    }
};

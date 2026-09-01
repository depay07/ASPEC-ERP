// js/modules/rentals.js - 대여 관리 모듈

const RentalsModule = {
    tableName: 'rentals',
    currentItems: [],

    purposes: {
        test: '테스트',
        demo: '데모',
        temporary_replacement: '임시대체',
        project: '프로젝트',
        other: '기타'
    },

    statuses: {
        on_loan: '대여중',
        return_due: '회수예정',
        returned: '회수완료',
        long_term: '장기대여'
    },

    itemStatuses: {
        normal: '정상',
        damaged: '파손',
        lost: '분실',
        repair_needed: '수리필요',
        other: '기타'
    },

    async search() {
        showTableLoading(12);

        let query = supabaseClient
            .from(this.tableName)
            .select(`
                *,
                partner:partners!rentals_partner_id_fkey(id, name, manager_name, phone, email, address),
                rental_items(*)
            `)
            .order('rental_date', { ascending: false, nullsFirst: false })
            .order('created_at', { ascending: false });

        const startDate = el('searchStartDate');
        const endDate = el('searchEndDate');
        const status = el('search_rStatus');

        if (startDate) query = query.gte('rental_date', startDate);
        if (endDate) query = query.lte('rental_date', endDate);
        if (status) query = query.eq('status', status);

        const { data, error } = await query;
        if (error) {
            alert('대여관리 조회 실패: ' + error.message);
            return;
        }

        const rentalNo = el('search_rRentalNo').trim().toLowerCase();
        const partner = el('search_rPartner').trim().toLowerCase();
        const contact = el('search_rContact').trim().toLowerCase();
        const itemName = el('search_rItem').trim().toLowerCase();

        const filtered = (data || []).filter(row => {
            const items = row.rental_items || [];
            return (!rentalNo || String(row.rental_no || '').toLowerCase().includes(rentalNo))
                && (!partner || String(row.partner_name || row.partner?.name || '').toLowerCase().includes(partner))
                && (!contact || String(row.contact_name || '').toLowerCase().includes(contact))
                && (!itemName || items.some(item => String(item.item_name || '').toLowerCase().includes(itemName)));
        });

        this.renderTable(filtered);
    },

    renderTable(data) {
        const tbody = document.getElementById('listBody');
        if (!tbody) return;

        if (!data || data.length === 0) {
            showEmptyTable(12);
            return;
        }

        tbody.innerHTML = data.map(row => {
            row.rental_items = (row.rental_items || []).sort((a, b) => a.display_order - b.display_order);
            const dataId = storeRowData(row);
            const itemSummary = this.getItemSummary(row.rental_items);
            const totalQuantity = row.rental_items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
            const remainingQuantity = row.rental_items.reduce(
                (sum, item) => sum + Math.max(0, Number(item.quantity || 0) - Number(item.returned_quantity || 0)),
                0
            );
            const dueState = this.getDueState(row.expected_return_date, row.status);
            const purpose = this.getPurposeLabel(row);

            return `
                <tr class="hover:bg-slate-50 border-b transition cursor-pointer" ondblclick="RentalsModule.openViewModal('${dataId}')">
                    <td class="font-mono text-cyan-700 font-semibold" title="${escapeAttr(row.rental_no)}">${escapeHtml(row.rental_no)}</td>
                    <td>${escapeHtml(row.rental_date)}</td>
                    <td class="text-left font-semibold" title="${escapeAttr(row.partner_name || row.partner?.name || '')}">${escapeHtml(row.partner_name || row.partner?.name || '-')}</td>
                    <td title="${escapeAttr(row.contact_name || '')}">${escapeHtml(row.contact_name || '-')}</td>
                    <td title="${escapeAttr(purpose)}">${escapeHtml(purpose)}</td>
                    <td class="text-left" title="${escapeAttr(itemSummary)}">${escapeHtml(itemSummary)}</td>
                    <td><strong>${formatNumber(totalQuantity)}</strong><span class="text-xs text-slate-400"> EA</span>${remainingQuantity > 0 ? `<div class="text-xs text-red-500">미회수 ${formatNumber(remainingQuantity)}</div>` : ''}</td>
                    <td class="${dueState.cellClass}" title="${escapeAttr(dueState.title)}">${dueState.icon}${escapeHtml(row.expected_return_date || '-')}</td>
                    <td>${this.getStatusBadge(row.status, dueState.type)}</td>
                    <td>${escapeHtml(row.actual_return_date || '-')}</td>
                    <td class="text-left" title="${escapeAttr(row.memo || '')}">${escapeHtml(row.memo || '-')}</td>
                    <td class="action-cell">${this.getActionButtons(dataId, row.id)}</td>
                </tr>`;
        }).join('');
    },

    getItemSummary(items) {
        if (!items || items.length === 0) return '-';
        const first = items[0].item_name || '-';
        return items.length > 1 ? `${first} 외 ${items.length - 1}건` : first;
    },

    getPurposeLabel(row) {
        const label = this.purposes[row.rental_purpose] || row.rental_purpose || '-';
        return row.rental_purpose === 'other' && row.rental_purpose_detail
            ? `${label}: ${row.rental_purpose_detail}`
            : label;
    },

    getDueState(expectedDate, status, today = getToday()) {
        if (!expectedDate || status === 'returned') {
            return { type: 'normal', cellClass: '', icon: '', title: '' };
        }

        const toUtcDay = value => {
            const parts = parseDateString(value);
            return Date.UTC(parts.year, parts.month - 1, parts.day);
        };
        const days = Math.round((toUtcDay(expectedDate) - toUtcDay(today)) / 86400000);

        if (days < 0) {
            return {
                type: 'overdue',
                cellClass: 'bg-red-50 text-red-700 font-bold',
                icon: '<i class="fa-solid fa-triangle-exclamation mr-1"></i>',
                title: `${Math.abs(days)}일 초과`
            };
        }
        if (days <= 7) {
            return {
                type: 'soon',
                cellClass: 'bg-amber-50 text-amber-700 font-bold',
                icon: '<i class="fa-solid fa-clock mr-1"></i>',
                title: days === 0 ? '오늘 회수 예정' : `${days}일 후 회수 예정`
            };
        }
        return { type: 'normal', cellClass: '', icon: '', title: '' };
    },

    getStatusBadge(status, dueType = 'normal') {
        const styles = {
            on_loan: 'bg-blue-100 text-blue-700',
            return_due: 'bg-amber-100 text-amber-700',
            returned: 'bg-emerald-100 text-emerald-700',
            long_term: 'bg-purple-100 text-purple-700'
        };
        const warning = dueType === 'overdue' && status !== 'returned'
            ? '<div class="text-[11px] text-red-600 font-bold mt-1">기한 초과</div>'
            : '';
        return `<span class="inline-flex px-2 py-1 rounded font-bold ${styles[status] || 'bg-slate-100 text-slate-700'}">${escapeHtml(this.statuses[status] || status || '-')}</span>${warning}`;
    },

    getActionButtons(dataId, rowId) {
        return `
            <div class="flex justify-center items-center gap-1">
                <button onclick="RentalsModule.openViewModal('${dataId}')" class="text-slate-500 hover:text-cyan-700 p-2 rounded hover:bg-cyan-50" title="상세보기">
                    <i class="fa-solid fa-eye"></i>
                </button>
                <button onclick="printDocument('rentals', '${dataId}')" class="text-slate-600 hover:text-black p-2 rounded hover:bg-slate-200" title="대여확인증 인쇄">
                    <i class="fa-solid fa-print"></i>
                </button>
                <button onclick="RentalsModule.openEditModal('${dataId}')" class="text-blue-500 hover:text-blue-700 p-2 rounded hover:bg-blue-50" title="수정">
                    <i class="fa-solid fa-pen-to-square"></i>
                </button>
                <button onclick="RentalsModule.delete(${rowId})" class="text-red-400 hover:text-red-600 p-2 rounded hover:bg-red-50" title="삭제">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </div>`;
    },

    openNewModal() {
        AppState.currentEditId = null;
        this.currentItems = [this.getBlankItem()];
        this.openFormModal('대여 등록', {
            rental_no: '자동 생성',
            rental_date: getToday(),
            expected_return_date: getToday(),
            rental_purpose: 'test',
            status: 'on_loan'
        });
    },

    openEditModal(dataId) {
        const row = getRowData(dataId);
        if (!row) return alert('대여 데이터를 찾지 못했습니다.');

        AppState.currentEditId = row.id;
        this.currentItems = (row.rental_items || []).map(item => ({ ...item }));
        this.openFormModal('대여 수정', row);
    },

    openFormModal(title, row) {
        const modal = document.getElementById('genericModal');
        modal.classList.add('rental-modal');
        openModal(title);
        document.getElementById('modalBody').innerHTML = this.getFormHtml(row);
        fillDatalist('dl_rental_partners', AppState.partnerList);
        fillDatalist('dl_rental_products', AppState.productList);
        this.renderItemRows();
    },

    getFormHtml(row) {
        const purposeOptions = Object.entries(this.purposes).map(([value, label]) =>
            `<option value="${value}" ${row.rental_purpose === value ? 'selected' : ''}>${label}</option>`
        ).join('');
        const statusOptions = Object.entries(this.statuses).map(([value, label]) =>
            `<option value="${value}" ${row.status === value ? 'selected' : ''}>${label}</option>`
        ).join('');

        return `
            <section class="rental-form-section">
                <h3 class="font-bold text-slate-700 mb-3 flex items-center gap-2"><i class="fa-solid fa-circle-info text-cyan-600"></i> 기본정보</h3>
                <div class="grid grid-cols-3 gap-3">
                    <div>
                        <label class="text-xs">대여번호</label>
                        <input id="rentalNo" class="input-box bg-slate-100" value="${escapeAttr(row.rental_no || '자동 생성')}" readonly>
                    </div>
                    <div>
                        <label class="text-xs">대여일자 <span class="text-red-500">*</span></label>
                        <input id="rentalDate" type="date" class="input-box" value="${escapeAttr(row.rental_date || getToday())}">
                    </div>
                    <div>
                        <label class="text-xs">회수예정일 <span class="text-red-500">*</span></label>
                        <input id="rentalExpectedDate" type="date" class="input-box" value="${escapeAttr(row.expected_return_date || getToday())}">
                    </div>
                    <div>
                        <label class="text-xs">거래처 <span class="text-red-500">*</span></label>
                        <input id="rentalPartner" class="input-box" list="dl_rental_partners" value="${escapeAttr(row.partner_name || row.partner?.name || '')}" onchange="RentalsModule.selectPartner(this.value)">
                        <input id="rentalPartnerId" type="hidden" value="${escapeAttr(row.partner_id || '')}">
                        <datalist id="dl_rental_partners"></datalist>
                    </div>
                    <div>
                        <label class="text-xs">담당자</label>
                        <input id="rentalContact" class="input-box" value="${escapeAttr(row.contact_name || '')}">
                    </div>
                    <div>
                        <label class="text-xs">연락처</label>
                        <input id="rentalPhone" class="input-box" value="${escapeAttr(row.contact_phone || '')}">
                    </div>
                    <div>
                        <label class="text-xs">대여 목적</label>
                        <select id="rentalPurpose" class="input-box">${purposeOptions}</select>
                    </div>
                    <div>
                        <label class="text-xs">기타 목적 상세</label>
                        <input id="rentalPurposeDetail" class="input-box" value="${escapeAttr(row.rental_purpose_detail || '')}" placeholder="필요한 경우 입력">
                    </div>
                    <div>
                        <label class="text-xs">상태</label>
                        <select id="rentalStatus" class="input-box">${statusOptions}</select>
                    </div>
                    <div>
                        <label class="text-xs">실제 회수일</label>
                        <input id="rentalActualDate" type="date" class="input-box" value="${escapeAttr(row.actual_return_date || '')}">
                    </div>
                    <div class="col-span-2">
                        <label class="text-xs">프로젝트명 / 현장명</label>
                        <input id="rentalProject" class="input-box" value="${escapeAttr(row.project_name || '')}">
                    </div>
                    <div class="col-span-3">
                        <label class="text-xs">비고</label>
                        <textarea id="rentalMemo" class="input-box" rows="3">${escapeHtml(row.memo || '')}</textarea>
                    </div>
                </div>
            </section>

            <section class="rental-form-section mt-6">
                <div class="flex justify-between items-center mb-3">
                    <h3 class="font-bold text-slate-700 flex items-center gap-2"><i class="fa-solid fa-boxes-stacked text-cyan-600"></i> 대여 품목</h3>
                    <button type="button" onclick="RentalsModule.addItem()" class="bg-slate-700 hover:bg-slate-800 text-white px-4 py-2 rounded font-bold text-sm flex items-center gap-2">
                        <i class="fa-solid fa-plus"></i> 품목 추가
                    </button>
                </div>
                <datalist id="dl_rental_products"></datalist>
                <div class="rental-items-wrap overflow-x-auto border border-slate-200 rounded">
                    <table class="rental-items-table min-w-[1750px] w-full text-xs">
                        <thead><tr>
                            <th>품목명 *</th><th>모델명</th><th>제조사</th><th>S/N</th>
                            <th>대여수량 *</th><th>회수수량</th><th>미회수</th><th>단위</th>
                            <th>자산/관리번호</th><th>회수일</th><th>품목 상태</th><th>비고</th><th>삭제</th>
                        </tr></thead>
                        <tbody id="rentalItemRows"></tbody>
                    </table>
                </div>
                <p class="mt-2 text-xs text-slate-500">회수수량을 입력한 품목은 회수일도 함께 입력해야 합니다. 모든 품목의 미회수수량이 0이면 회수완료로 자동 처리됩니다.</p>
            </section>

            <div class="flex justify-end gap-2 mt-5 border-t pt-4">
                <button type="button" onclick="closeModal()" class="px-6 py-3 bg-slate-200 rounded font-bold hover:bg-slate-300">취소</button>
                <button type="button" onclick="runSaveOnce('rental-' + (AppState.currentEditId || 'new'), this, () => RentalsModule.save())" class="px-8 py-3 bg-cyan-600 text-white rounded font-bold hover:bg-cyan-700">
                    저장
                </button>
            </div>`;
    },

    getBlankItem() {
        return {
            product_id: null,
            item_name: '',
            model_name: '',
            manufacturer: '',
            serial_number: '',
            quantity: 1,
            returned_quantity: 0,
            unit: 'EA',
            asset_number: '',
            return_date: '',
            item_status: 'normal',
            memo: ''
        };
    },

    addItem() {
        this.syncItemsFromDom();
        this.currentItems.push(this.getBlankItem());
        this.renderItemRows();
    },

    removeItem(index) {
        this.syncItemsFromDom();
        if (this.currentItems.length === 1) {
            alert('대여 품목은 한 개 이상 있어야 합니다.');
            return;
        }
        this.currentItems.splice(index, 1);
        this.renderItemRows();
    },

    renderItemRows() {
        const tbody = document.getElementById('rentalItemRows');
        if (!tbody) return;

        const itemStatusOptions = item => Object.entries(this.itemStatuses).map(([value, label]) =>
            `<option value="${value}" ${item.item_status === value ? 'selected' : ''}>${label}</option>`
        ).join('');

        tbody.innerHTML = this.currentItems.map((item, index) => {
            const remaining = Math.max(0, Number(item.quantity || 0) - Number(item.returned_quantity || 0));
            return `
                <tr data-rental-item-index="${index}">
                    <td><input data-field="item_name" class="input-box min-w-[160px]" list="dl_rental_products" value="${escapeAttr(item.item_name || '')}" onchange="RentalsModule.selectProduct(${index}, this.value)"></td>
                    <td><input data-field="model_name" class="input-box min-w-[130px]" value="${escapeAttr(item.model_name || '')}"></td>
                    <td><input data-field="manufacturer" class="input-box min-w-[110px]" value="${escapeAttr(item.manufacturer || '')}"></td>
                    <td><input data-field="serial_number" class="input-box min-w-[125px]" value="${escapeAttr(item.serial_number || '')}"></td>
                    <td><input data-field="quantity" type="number" min="1" step="1" inputmode="numeric" class="input-box min-w-[80px] text-right" value="${escapeAttr(item.quantity ?? 1)}" oninput="RentalsModule.updateRemaining(${index})"></td>
                    <td><input data-field="returned_quantity" type="number" min="0" step="1" inputmode="numeric" class="input-box min-w-[80px] text-right" value="${escapeAttr(item.returned_quantity ?? 0)}" oninput="RentalsModule.updateRemaining(${index})"></td>
                    <td class="text-center font-bold text-red-600 min-w-[65px]" id="rentalRemaining_${index}">${remaining}</td>
                    <td><input data-field="unit" class="input-box min-w-[65px]" value="${escapeAttr(item.unit || 'EA')}"></td>
                    <td><input data-field="asset_number" class="input-box min-w-[120px]" value="${escapeAttr(item.asset_number || '')}"></td>
                    <td><input data-field="return_date" type="date" class="input-box min-w-[135px]" value="${escapeAttr(item.return_date || '')}"></td>
                    <td><select data-field="item_status" class="input-box min-w-[95px]">${itemStatusOptions(item)}</select></td>
                    <td><input data-field="memo" class="input-box min-w-[150px]" value="${escapeAttr(item.memo || '')}"></td>
                    <td class="text-center"><button type="button" onclick="RentalsModule.removeItem(${index})" class="text-red-500 hover:text-red-700 p-2" title="품목 삭제"><i class="fa-solid fa-trash-can"></i></button></td>
                </tr>`;
        }).join('');
    },

    syncItemsFromDom() {
        const rows = document.querySelectorAll('#rentalItemRows tr[data-rental-item-index]');
        rows.forEach(row => {
            const index = Number(row.dataset.rentalItemIndex);
            const current = this.currentItems[index] || this.getBlankItem();
            row.querySelectorAll('[data-field]').forEach(input => {
                current[input.dataset.field] = input.value;
            });
            this.currentItems[index] = current;
        });
    },

    updateRemaining(index) {
        const row = document.querySelector(`#rentalItemRows tr[data-rental-item-index="${index}"]`);
        if (!row) return;
        const quantity = Number(row.querySelector('[data-field="quantity"]').value || 0);
        const returned = Number(row.querySelector('[data-field="returned_quantity"]').value || 0);
        const target = document.getElementById(`rentalRemaining_${index}`);
        if (target) target.textContent = String(Math.max(0, quantity - returned));
    },

    selectPartner(name) {
        const partner = AppState.partnerList.find(item => item.name === name);
        document.getElementById('rentalPartnerId').value = partner ? partner.id : '';
        if (!partner) return;
        document.getElementById('rentalContact').value = partner.manager_name || '';
        document.getElementById('rentalPhone').value = partner.phone || '';
    },

    selectProduct(index, name) {
        this.syncItemsFromDom();
        const product = AppState.productList.find(item => item.name === name);
        const item = this.currentItems[index];
        item.item_name = name;
        item.product_id = product ? product.id : null;
        if (product) {
            item.model_name = product.spec || '';
            item.manufacturer = product.manufacturer || '';
            item.unit = product.unit || 'EA';
        }
        this.renderItemRows();
    },

    collectFormData() {
        this.syncItemsFromDom();
        const partnerName = el('rentalPartner').trim();
        const partner = AppState.partnerList.find(item => item.name === partnerName);

        const rental = {
            rental_date: el('rentalDate'),
            partner_id: partner ? partner.id : null,
            partner_name: partnerName,
            contact_name: el('rentalContact').trim(),
            contact_phone: el('rentalPhone').trim(),
            expected_return_date: el('rentalExpectedDate'),
            actual_return_date: el('rentalActualDate') || null,
            rental_purpose: el('rentalPurpose') || 'test',
            rental_purpose_detail: el('rentalPurposeDetail').trim(),
            project_name: el('rentalProject').trim(),
            status: el('rentalStatus') || 'on_loan',
            memo: el('rentalMemo').trim()
        };

        const items = this.currentItems.map(item => ({
            product_id: item.product_id || null,
            item_name: String(item.item_name || '').trim(),
            model_name: String(item.model_name || '').trim(),
            manufacturer: String(item.manufacturer || '').trim(),
            serial_number: String(item.serial_number || '').trim(),
            quantity: Number(item.quantity),
            returned_quantity: Number(item.returned_quantity || 0),
            unit: String(item.unit || 'EA').trim() || 'EA',
            asset_number: String(item.asset_number || '').trim(),
            return_date: item.return_date || null,
            item_status: item.item_status || 'normal',
            memo: String(item.memo || '').trim()
        }));

        return { rental, items, partnerName };
    },

    validateData(rental, items, partnerName = '') {
        if (!rental.rental_date) return '대여일자를 입력해 주세요.';
        if (!rental.partner_name) return '거래처를 입력해 주세요.';
        if (!rental.expected_return_date) return '회수예정일을 입력해 주세요.';
        if (rental.expected_return_date < rental.rental_date) return '회수예정일은 대여일자보다 빠를 수 없습니다.';
        if (rental.actual_return_date && rental.actual_return_date < rental.rental_date) return '실제 회수일은 대여일자보다 빠를 수 없습니다.';
        if (rental.rental_purpose === 'other' && !rental.rental_purpose_detail) return '기타 대여 목적을 입력해 주세요.';
        if (!items.length) return '대여 품목을 한 개 이상 입력해 주세요.';

        for (let index = 0; index < items.length; index += 1) {
            const item = items[index];
            const prefix = `${index + 1}번째 품목`;
            if (!item.item_name) return `${prefix}의 품목명을 입력해 주세요.`;
            if (!Number.isInteger(item.quantity) || item.quantity <= 0) return `${prefix}의 대여수량은 1 이상의 정수여야 합니다.`;
            if (!Number.isInteger(item.returned_quantity) || item.returned_quantity < 0) return `${prefix}의 회수수량은 0 이상의 정수여야 합니다.`;
            if (item.returned_quantity > item.quantity) return `${prefix}의 회수수량은 대여수량을 초과할 수 없습니다.`;
            if (item.returned_quantity > 0 && !item.return_date) return `${prefix}의 회수일을 입력해 주세요.`;
            if (item.returned_quantity === 0 && item.return_date) return `${prefix}의 회수수량을 입력하거나 회수일을 지워 주세요.`;
            if (item.return_date && item.return_date < rental.rental_date) return `${prefix}의 회수일은 대여일자보다 빠를 수 없습니다.`;
        }

        const remaining = items.reduce((sum, item) => sum + item.quantity - item.returned_quantity, 0);
        if (remaining > 0 && rental.status === 'returned') return '미회수 품목이 남아 있어 회수완료 상태로 저장할 수 없습니다.';
        if (remaining > 0 && rental.actual_return_date) return '미회수 품목이 남아 있어 실제 회수일을 입력할 수 없습니다.';
        if (remaining === 0) {
            rental.status = 'returned';
            rental.actual_return_date = rental.actual_return_date
                || items.map(item => item.return_date).filter(Boolean).sort().at(-1)
                || getToday();
        }

        return '';
    },

    async save() {
        const { rental, items, partnerName } = this.collectFormData();
        const validationMessage = this.validateData(rental, items, partnerName);
        if (validationMessage) {
            alert(validationMessage);
            return false;
        }

        const { error } = await supabaseClient.rpc('save_rental', {
            p_rental: rental,
            p_items: items,
            p_rental_id: AppState.currentEditId || null
        });

        if (error) {
            alert('대여 정보 저장 실패: ' + error.message);
            return false;
        }

        closeModal();
        await this.search();
        return true;
    },

    openViewModal(dataId) {
        const row = getRowData(dataId);
        if (!row) return alert('대여 데이터를 찾지 못했습니다.');

        const items = (row.rental_items || []).sort((a, b) => a.display_order - b.display_order);
        const total = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
        const returned = items.reduce((sum, item) => sum + Number(item.returned_quantity || 0), 0);
        const modal = document.getElementById('genericModal');
        modal.classList.add('rental-modal');
        openModal('대여 상세');
        document.getElementById('modalBody').innerHTML = `
            <div class="grid grid-cols-3 gap-3 bg-slate-50 border-y border-slate-200 p-4">
                ${this.getDetailField('대여번호', row.rental_no)}
                ${this.getDetailField('대여일자', row.rental_date)}
                ${this.getDetailField('상태', this.statuses[row.status] || row.status)}
                ${this.getDetailField('거래처', row.partner_name || row.partner?.name)}
                ${this.getDetailField('담당자', row.contact_name)}
                ${this.getDetailField('연락처', row.contact_phone)}
                ${this.getDetailField('회수예정일', row.expected_return_date)}
                ${this.getDetailField('실제 회수일', row.actual_return_date || '-')}
                ${this.getDetailField('대여 목적', this.getPurposeLabel(row))}
                ${this.getDetailField('프로젝트 / 현장', row.project_name || '-', 'col-span-2')}
                ${this.getDetailField('비고', row.memo || '-', 'col-span-3')}
            </div>
            <div class="flex items-center justify-between mt-5 mb-2">
                <h3 class="font-bold text-slate-700">대여 품목</h3>
                <span class="text-sm font-bold text-slate-600">총 ${formatNumber(total)} / 회수 ${formatNumber(returned)} / 미회수 <span class="text-red-600">${formatNumber(total - returned)}</span></span>
            </div>
            <div class="overflow-x-auto border border-slate-200 rounded">
                <table class="rental-items-table min-w-[1300px] w-full text-sm">
                    <thead><tr><th>품목명</th><th>모델명</th><th>제조사</th><th>S/N</th><th>대여</th><th>회수</th><th>미회수</th><th>단위</th><th>자산번호</th><th>회수일</th><th>상태</th><th>비고</th></tr></thead>
                    <tbody>${items.map(item => `
                        <tr>
                            <td class="font-semibold">${escapeHtml(item.item_name)}</td>
                            <td>${escapeHtml(item.model_name || '-')}</td>
                            <td>${escapeHtml(item.manufacturer || '-')}</td>
                            <td>${escapeHtml(item.serial_number || '-')}</td>
                            <td>${formatNumber(item.quantity)}</td>
                            <td>${formatNumber(item.returned_quantity)}</td>
                            <td class="font-bold ${item.quantity - item.returned_quantity > 0 ? 'text-red-600' : 'text-emerald-600'}">${formatNumber(item.quantity - item.returned_quantity)}</td>
                            <td>${escapeHtml(item.unit || 'EA')}</td>
                            <td>${escapeHtml(item.asset_number || '-')}</td>
                            <td>${escapeHtml(item.return_date || '-')}</td>
                            <td>${escapeHtml(this.itemStatuses[item.item_status] || item.item_status)}</td>
                            <td>${escapeHtml(item.memo || '-')}</td>
                        </tr>`).join('')}</tbody>
                </table>
            </div>
            <div class="flex justify-end gap-2 mt-5">
                <button onclick="closeModal()" class="px-6 py-3 bg-slate-200 rounded font-bold">닫기</button>
                <button onclick="printDocument('rentals', '${dataId}')" class="px-6 py-3 bg-slate-700 text-white rounded font-bold"><i class="fa-solid fa-print mr-2"></i>인쇄</button>
                <button onclick="closeModal(); RentalsModule.openEditModal('${dataId}')" class="px-6 py-3 bg-blue-600 text-white rounded font-bold"><i class="fa-solid fa-pen-to-square mr-2"></i>수정</button>
            </div>`;
    },

    getDetailField(label, value, className = '') {
        return `<div class="${className}"><div class="text-xs text-slate-500 mb-1">${label}</div><div class="font-semibold text-slate-800 whitespace-pre-wrap">${escapeHtml(value || '-')}</div></div>`;
    },

    async delete(id) {
        if (!confirm('이 대여 건을 삭제하시겠습니까? 등록된 대여 품목과 회수 내역도 함께 삭제됩니다.')) return;

        const { error } = await supabaseClient.from(this.tableName).delete().eq('id', id);
        if (error) {
            alert('대여 건 삭제 실패: ' + error.message);
            return;
        }
        await this.search();
    }
};

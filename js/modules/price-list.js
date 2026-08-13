// js/modules/price-list.js - 가격표 관리 모듈

const PriceListModule = {
    tableName: 'price_list_items',
    currencies: {
        KRW: { label: '원화', symbol: '₩' },
        USD: { label: '달러', symbol: '$' },
        CNY: { label: '위안화', symbol: 'CN¥' },
        JPY: { label: '엔화', symbol: '¥' },
        EUR: { label: '유로', symbol: '€' },
        GBP: { label: '파운드', symbol: '£' }
    },

    async search() {
        showTableLoading(8);

        let query = supabaseClient
            .from(this.tableName)
            .select('*')
            .order('name');

        const nameFilter = el('search_sName');
        const codeFilter = el('search_sCode');
        const currencyFilter = el('search_sCurrency');

        if (nameFilter) query = query.ilike('name', `%${nameFilter}%`);
        if (codeFilter) query = query.ilike('code', `%${codeFilter}%`);
        if (currencyFilter) query = query.eq('currency', currencyFilter);

        const { data, error } = await query;

        if (error) {
            alert('가격표 조회 실패: ' + error.message);
            return;
        }

        this.renderTable(data);
    },

    renderTable(data) {
        const tbody = document.getElementById('listBody');
        if (!tbody) return;

        if (!data || data.length === 0) {
            showEmptyTable(8);
            return;
        }

        tbody.innerHTML = data.map(row => {
            const dataId = storeRowData(row);
            const currency = this.currencies[row.currency] || { label: row.currency, symbol: row.currency };

            return `
                <tr class="hover:bg-slate-50 border-b transition">
                    <td class="font-mono text-center text-cyan-600">${escapeHtml(row.code || '-')}</td>
                    <td class="text-left font-semibold">${escapeHtml(row.name)}</td>
                    <td class="text-left">${escapeHtml(row.spec || '-')}</td>
                    <td>${escapeHtml(row.manufacturer || '-')}</td>
                    <td class="text-center">${escapeHtml(row.unit || 'EA')}</td>
                    <td class="text-right font-bold text-slate-800">${escapeHtml(currency.symbol)} ${this.formatPrice(row.price)}</td>
                    <td class="text-center"><span class="inline-flex px-2 py-1 rounded bg-slate-100 text-slate-700 font-bold">${escapeHtml(row.currency)} · ${escapeHtml(currency.label)}</span></td>
                    <td>${this.getActionButtons(dataId, row.id)}</td>
                </tr>`;
        }).join('');
    },

    formatPrice(value) {
        const price = Number(value) || 0;
        return new Intl.NumberFormat('ko-KR', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 4
        }).format(price);
    },

    getActionButtons(dataId, rowId) {
        return `
            <div class="flex justify-center items-center gap-3">
                <button onclick="PriceListModule.openEditModal('${dataId}')" class="text-blue-500 hover:text-blue-700 p-2 rounded hover:bg-blue-50 transition" title="수정">
                    <i class="fa-solid fa-pen-to-square fa-lg"></i>
                </button>
                <button onclick="PriceListModule.delete(${rowId})" class="text-red-400 hover:text-red-600 p-2 rounded hover:bg-red-50 transition" title="삭제">
                    <i class="fa-solid fa-trash-can fa-lg"></i>
                </button>
            </div>`;
    },

    openNewModal() {
        AppState.currentEditId = null;
        openModal('가격표 품목 등록');
        document.getElementById('modalBody').innerHTML = this.getFormHtml();
        fillDatalist('dl_price_products', AppState.productList);
    },

    openEditModal(dataId) {
        const row = getRowData(dataId);
        if (!row) return alert('가격표 데이터를 찾지 못했습니다.');

        AppState.currentEditId = row.id;
        openModal('가격표 품목 수정');
        document.getElementById('modalBody').innerHTML = this.getFormHtml();
        fillDatalist('dl_price_products', AppState.productList);

        document.getElementById('priceName').value = row.name || '';
        document.getElementById('priceCode').value = row.code || '';
        document.getElementById('priceSpec').value = row.spec || '';
        document.getElementById('priceUnit').value = row.unit || 'EA';
        document.getElementById('priceMaker').value = row.manufacturer || '';
        document.getElementById('priceAmount').value = row.price ?? 0;
        document.getElementById('priceCurrency').value = row.currency || 'KRW';
    },

    getFormHtml() {
        const currencyOptions = Object.entries(this.currencies).map(([code, item]) =>
            `<option value="${code}">${item.label} (${code})</option>`
        ).join('');

        return `
            <div class="grid grid-cols-2 gap-3">
                <div class="col-span-2">
                    <label class="text-xs">품목명 (필수)</label>
                    <input id="priceName" class="input-box" list="dl_price_products" onchange="PriceListModule.fillFromProduct(this.value)">
                    <datalist id="dl_price_products"></datalist>
                </div>
                <div>
                    <label class="text-xs">품목코드</label>
                    <input id="priceCode" class="input-box">
                </div>
                <div>
                    <label class="text-xs">제조사</label>
                    <input id="priceMaker" class="input-box">
                </div>
                <div class="col-span-2">
                    <label class="text-xs">규격</label>
                    <input id="priceSpec" class="input-box">
                </div>
                <div>
                    <label class="text-xs">단위</label>
                    <input id="priceUnit" class="input-box" placeholder="EA">
                </div>
                <div>
                    <label class="text-xs">통화</label>
                    <select id="priceCurrency" class="input-box">${currencyOptions}</select>
                </div>
                <div class="col-span-2">
                    <label class="text-xs">단가</label>
                    <input id="priceAmount" type="number" min="0" step="0.0001" inputmode="decimal" class="input-box text-right" value="0">
                </div>
            </div>
            <button onclick="runSaveOnce('price-list', this, () => PriceListModule.save())" class="w-full mt-4 bg-cyan-600 text-white py-3 rounded font-bold hover:bg-cyan-700 transition">
                저장
            </button>`;
    },

    fillFromProduct(name) {
        if (AppState.currentEditId) return;

        const product = AppState.productList.find(item => item.name === name);
        if (!product) return;

        document.getElementById('priceCode').value = product.code || '';
        document.getElementById('priceSpec').value = product.spec || '';
        document.getElementById('priceUnit').value = product.unit || 'EA';
        document.getElementById('priceMaker').value = product.manufacturer || '';
    },

    async save() {
        const name = el('priceName').trim();
        const price = Number(el('priceAmount'));

        if (!name) {
            alert('품목명은 필수입니다.');
            return false;
        }

        if (!Number.isFinite(price) || price < 0) {
            alert('단가는 0 이상의 숫자로 입력해 주세요.');
            return false;
        }

        const data = {
            name,
            code: el('priceCode').trim() || null,
            spec: el('priceSpec').trim() || null,
            unit: el('priceUnit').trim() || 'EA',
            manufacturer: el('priceMaker').trim() || null,
            price,
            currency: el('priceCurrency') || 'KRW',
            updated_at: new Date().toISOString()
        };

        let result;
        if (AppState.currentEditId) {
            result = await supabaseClient
                .from(this.tableName)
                .update(data)
                .eq('id', AppState.currentEditId);
        } else {
            const sourceProduct = AppState.productList.find(item => item.name === name);
            data.source_product_id = sourceProduct ? sourceProduct.id : null;
            result = await supabaseClient.from(this.tableName).insert(data);
        }

        if (result.error) {
            if (result.error.code === '23505') {
                alert('이미 가격표에 등록된 품목입니다. 기존 품목을 수정해 주세요.');
            } else {
                alert('가격표 저장 실패: ' + result.error.message);
            }
            return false;
        }

        closeModal();
        await this.search();
        return true;
    },

    async delete(id) {
        if (!confirm('가격표에서 이 품목을 삭제하시겠습니까? 품목관리의 원본 품목은 삭제되지 않습니다.')) return;

        const { error } = await supabaseClient
            .from(this.tableName)
            .delete()
            .eq('id', id);

        if (error) {
            alert('가격표 삭제 실패: ' + error.message);
            return;
        }

        await this.search();
    }
};

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

function loadPurchaseOrders(rows = [], itemFilter = '') {
    const summary = {
        innerHTML: '',
        hidden: true,
        classList: {
            add() { summary.hidden = true; },
            remove() { summary.hidden = false; }
        }
    };
    const listBody = { innerHTML: '' };
    const inputs = {
        searchStartDate: '2026-10-01',
        searchEndDate: '2026-10-31',
        search_sItem: itemFilter
    };
    const query = {
        select() { return this; },
        order() { return this; },
        gte() { return this; },
        lte() { return this; },
        then(resolve) { return Promise.resolve({ data: rows, error: null }).then(resolve); }
    };
    const context = vm.createContext({
        document: { getElementById: id => id === 'purchaseOrdersSummary' ? summary : listBody },
        el: id => inputs[id] || '',
        formatNumber: value => Number(value).toLocaleString('ko-KR'),
        showTableLoading() {},
        showEmptyTable() {},
        storeRowData: row => `row-${row.id}`,
        getToday: () => '2026-10-14',
        supabaseClient: { from: () => query }
    });
    const source = readFileSync(path.join(__dirname, '../js/modules/purchase-orders.js'), 'utf8');
    vm.runInContext(`${source}\nthis.PurchaseOrdersModule = PurchaseOrdersModule;`, context);
    return { module: context.PurchaseOrdersModule, summary, listBody };
}

test('송금예정금액은 미송금 전액과 부분 송금 잔액을 합산하고 완료 및 초과 송금은 제외한다', () => {
    const h = loadPurchaseOrders();
    const rows = [
        { total_amount: 110000, remitted_amount: null },
        { total_amount: '220000', remitted_amount: '200000' },
        { total_amount: 50000, remitted_amount: 50000 },
        { total_amount: 50000, remitted_amount: 60000 },
        { total_amount: 0 },
        {}
    ];
    assert.equal(h.module.calculateScheduledRemittance(rows), 130000);
    assert.equal(h.module.calculateScheduledRemittance([]), 0);
    assert.equal(h.module.calculateScheduledRemittance(null), 0);
    h.module.renderSummary(rows);
    assert.equal(h.summary.hidden, false);
    assert.match(h.summary.innerHTML, /송금예정금액/);
    assert.match(h.summary.innerHTML, /130,000원/);
    assert.match(h.summary.innerHTML, /430,000원/);
});

test('조회 버튼의 합계는 품목 필터를 적용한 결과의 잔액만 표시한다', async () => {
    const rows = [
        { id: 1, total_amount: 100000, remitted_amount: 30000, items: [{ name: 'Motor' }] },
        { id: 2, total_amount: 200000, items: [{ name: 'Cable' }] }
    ];
    const h = loadPurchaseOrders(rows, 'motor');
    await h.module.search(false, true);
    assert.equal(h.summary.hidden, false);
    assert.match(h.summary.innerHTML, /70,000원/);
    assert.match(h.summary.innerHTML, /2026-10-01 ~ 2026-10-31 · 1건/);
    assert.doesNotMatch(h.listBody.innerHTML, /Cable/);

    await h.module.search(false, false);
    assert.equal(h.summary.hidden, true);
    assert.equal(h.summary.innerHTML, '');
});

test('조회 결과가 없으면 송금예정금액을 0원으로 표시한다', async () => {
    const h = loadPurchaseOrders();
    await h.module.search(false, true);
    assert.equal(h.summary.hidden, false);
    assert.match(h.summary.innerHTML, /송금예정금액/);
    assert.match(h.summary.innerHTML, /0원/);
});

test('문자열 금액도 숫자로 비교해 송금완료 아이콘과 잔액 계산을 일치시킨다', () => {
    const h = loadPurchaseOrders();
    h.module.renderTable([
        { id: 1, total_amount: '100000', remitted_amount: '90000' },
        { id: 2, total_amount: '100000', remitted_amount: '100000' }
    ]);
    assert.equal((h.listBody.innerHTML.match(/text-orange-500/g) || []).length, 1);
    assert.equal((h.listBody.innerHTML.match(/text-green-500/g) || []).length, 1);
});

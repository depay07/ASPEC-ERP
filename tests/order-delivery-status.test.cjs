const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');

const root = path.resolve(__dirname, '..');

function loadOrders(deliveryFilter = '') {
    const listBody = { innerHTML: '' };
    let emptyColspan = null;
    const context = vm.createContext({
        AppState: {},
        DocumentBaseModule: {},
        document: { getElementById: () => listBody },
        el: id => id === 'search_oDeliveryStatus' ? deliveryFilter : '',
        formatNumber: String,
        showEmptyTable: colspan => { emptyColspan = colspan; },
        storeRowData: row => `row-${row.id}`
    });
    const source = readFileSync(path.join(root, 'js/modules/orders.js'), 'utf8');
    vm.runInContext(`${source}\nthis.OrdersModule = OrdersModule;`, context);
    return { module: context.OrdersModule, listBody, getEmptyColspan: () => emptyColspan };
}

test('orders render green for delivered and orange for undelivered', () => {
    const h = loadOrders();
    h.module.renderTable([
        { id: 1, date: '2026-09-01', partner_name: 'A', status: 'completed' },
        { id: 2, date: '2026-09-02', partner_name: 'B', status: 'pending' }
    ]);
    assert.match(h.listBody.innerHTML, /납품완료 \(판매등록됨\).*text-green-500/);
    assert.match(h.listBody.innerHTML, /미납품 \(판매 미등록\).*text-orange-500/);
    assert.equal((h.listBody.innerHTML.match(/<tr /g) || []).length, 2);
});

test('orders delivery filter keeps only the selected state', () => {
    const rows = [{ id: 1, status: 'completed' }, { id: 2 }, { id: 3, status: 'pending' }];
    const completed = loadOrders('completed').module.filterByDeliveryStatus(rows);
    const pending = loadOrders('pending').module.filterByDeliveryStatus(rows);
    assert.deepEqual(Array.from(completed, row => row.id), [1]);
    assert.deepEqual(Array.from(pending, row => row.id), [2, 3]);

    const h = loadOrders();
    h.module.renderTable([]);
    assert.equal(h.getEmptyColspan(), 9);
});

test('sales save persists the order that was loaded', async () => {
    let inserted = null;
    const context = vm.createContext({
        AppState: { currentEditId: null },
        DocumentBaseModule: { buildSaveData: () => ({ items: [] }) },
        supabaseClient: {
            from(table) {
                assert.equal(table, 'sales');
                return {
                    insert(data) {
                        inserted = data;
                        return Promise.resolve({ error: null });
                    }
                };
            }
        },
        document: { getElementById: () => ({ checked: false }) },
        crypto: webcrypto,
        alert() {},
        closeModal() {},
        fetchMasterData: async () => {},
        escapeAttr: String,
        escapeHtml: String,
        formatNumber: String,
        getToday: () => '2026-09-03',
        window: { location: { href: 'https://erp.aspec-tech.co.kr/erp.html' } }
    });
    const source = readFileSync(path.join(root, 'js/modules/sales.js'), 'utf8');
    vm.runInContext(`${source}\nthis.SalesModule = SalesModule;`, context);
    context.SalesModule.currentLoadedOrderId = 77;
    context.SalesModule.applyStockDifference = async () => ({ error: null });
    context.SalesModule.search = async () => {};

    await context.SalesModule.save();

    assert.equal(inserted.source_order_id, 77);
    assert.equal(context.SalesModule.currentLoadedOrderId, null);
});

test('router and search panel expose the delivery column and filter', () => {
    const router = readFileSync(path.join(root, 'js/router.js'), 'utf8');
    const ui = readFileSync(path.join(root, 'js/ui.js'), 'utf8');
    assert.match(router, /orders: .*납품/);
    assert.match(ui, /id="search_oDeliveryStatus"/);
    assert.match(ui, /<option value="pending">미납품<\/option>/);
    assert.match(ui, /<option value="completed">납품완료<\/option>/);
});

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

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
    assert.match(h.listBody.innerHTML, /납품완료.*text-green-500/);
    assert.match(h.listBody.innerHTML, /미납품.*text-orange-500/);
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

test('order edit saves only the manually checked delivery state', async () => {
    let updated = null;
    let checked = true;
    const context = vm.createContext({
        AppState: { currentEditId: 7 },
        DocumentBaseModule: { buildSaveData: () => ({ items: [] }) },
        supabaseClient: {
            from(table) {
                assert.equal(table, 'orders');
                return {
                    update(data) { updated = data; return this; },
                    eq() { return Promise.resolve({ error: null }); }
                };
            }
        },
        document: { getElementById: id => id === 'chkDeliveryCompleted' ? { checked } : null },
        alert() {},
        closeModal() {},
        el: () => '',
        getToday: () => '2026-09-03'
    });
    const source = readFileSync(path.join(root, 'js/modules/orders.js'), 'utf8');
    vm.runInContext(`${source}\nthis.OrdersModule = OrdersModule;`, context);
    context.OrdersModule.search = async () => {};

    await context.OrdersModule.save();
    assert.equal(updated.status, 'completed');

    checked = false;
    await context.OrdersModule.save();
    assert.equal(updated.status, 'pending');
});

test('sales no longer changes or links order delivery state', () => {
    const sales = readFileSync(path.join(root, 'js/modules/sales.js'), 'utf8');
    assert.doesNotMatch(sales, /source_order_id/);
    assert.doesNotMatch(sales, /currentLoadedOrderId/);
});

test('router and search panel expose the delivery column and filter', () => {
    const router = readFileSync(path.join(root, 'js/router.js'), 'utf8');
    const ui = readFileSync(path.join(root, 'js/ui.js'), 'utf8');
    assert.match(router, /orders: .*납품/);
    assert.match(ui, /id="search_oDeliveryStatus"/);
    assert.match(ui, /<option value="pending">미납품<\/option>/);
    assert.match(ui, /<option value="completed">납품완료<\/option>/);
});

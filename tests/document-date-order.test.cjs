const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const modules = [
    ['quotes', 'QuotesModule'],
    ['orders', 'OrdersModule'],
    ['sales', 'SalesModule'],
    ['purchases', 'PurchasesModule'],
    ['purchase-orders', 'PurchaseOrdersModule'],
    ['collections', 'CollectionsModule'],
    ['cost-management', 'CostManagementModule']
];

// Execute the real search/save functions against a chainable, in-memory Data API.
function createHarness(file, name) {
    const rows = [29, 27, 25, 24, 22].map((day, index) => ({
        id: index + 1,
        date: `2026-08-${day}`,
        created_at: `2026-08-${day}T00:00:00Z`,
        partner_name: 'Test Partner',
        item_name: 'Test Item',
        items: [{ name: 'Test Item', qty: 1, supply: 100, vat: 10, total: 110 }],
        qty: 1,
        total_amount: 110
    }));
    const queries = [];
    const inputs = {};
    const elements = new Map();
    const result = { rows, queries, inputs, elements, rendered: null, updateError: null };

    class Query {
        constructor(table) {
            this.table = table;
            this.orders = [];
            this.filters = [];
            this.maximum = Infinity;
            queries.push(this);
        }
        select() { return this; }
        order(column, options) { this.orders.push({ column, ...options }); return this; }
        limit(maximum) { this.maximum = maximum; return this; }
        eq(key, value) { this.filters.push(row => row[key] === value); return this; }
        gte(key, value) { this.filters.push(row => row[key] != null && row[key] >= value); return this; }
        lte(key, value) { this.filters.push(row => row[key] != null && row[key] <= value); return this; }
        ilike(key, value) {
            this.filters.push(row => String(row[key] || '').toLowerCase().includes(value.replaceAll('%', '').toLowerCase()));
            return this;
        }
        update(data) { this.patch = data; return this; }
        single() { this.one = true; return this; }
        then(resolve, reject) {
            let data = rows.filter(row => this.filters.every(filter => filter(row)));
            if (this.patch) {
                if (result.updateError) return Promise.resolve({ error: result.updateError }).then(resolve, reject);
                data.forEach(row => Object.assign(row, this.patch));
            }
            data.sort((left, right) => {
                for (const order of this.orders) {
                    const a = left[order.column];
                    const b = right[order.column];
                    if (a === b) continue;
                    const nullsFirst = order.nullsFirst ?? !order.ascending;
                    if (a == null) return nullsFirst ? -1 : 1;
                    if (b == null) return nullsFirst ? 1 : -1;
                    const compared = a < b ? -1 : 1;
                    return order.ascending ? compared : -compared;
                }
                return 0;
            });
            data = data.slice(0, this.maximum);
            return Promise.resolve({ data: this.one ? data[0] : data, error: null }).then(resolve, reject);
        }
    }

    const context = vm.createContext({
        supabaseClient: { from: table => new Query(table) },
        AppState: { currentEditId: 4, tempItems: structuredClone(rows[3].items) },
        document: {
            getElementById(id) {
                if (!elements.has(id)) elements.set(id, {
                    value: '', innerHTML: '', checked: false,
                    classList: { add() {}, remove() {} }
                });
                return elements.get(id);
            }
        },
        el: id => inputs[id] || '',
        ensureActiveSession: async () => true,
        fetchMasterData: async () => true,
        showTableLoading() {},
        showConnectionWarning: message => { throw new Error(message); },
        isTransientAuthError: () => false,
        closeModal() {},
        alert() {},
        formatNumber: String,
        getToday: () => '2026-08-31'
    });
    for (const [moduleFile, moduleName] of [['document-base', 'DocumentBaseModule'], [file, name]]) {
        const source = readFileSync(path.join(root, 'js/modules', `${moduleFile}.js`), 'utf8');
        vm.runInContext(`${source}\nthis.${moduleName} = ${moduleName};`, context);
    }
    result.context = context;
    result.module = context[name];
    result.module.renderTable = data => { result.rendered = data; };
    return result;
}

for (const [file, name] of modules) {
    test(`${name}: document date precedes creation time, ties and nulls`, async () => {
        const h = createHarness(file, name);
        h.rows[3].date = '2026-08-31';
        h.rows.push({ ...h.rows[3], id: 6, created_at: '2026-08-26T00:00:00Z' });
        h.rows.push({ ...h.rows[0], id: 7, date: null, created_at: '2026-09-01T00:00:00Z' });
        await h.module.search();
        assert.deepEqual(Array.from(h.rendered, row => row.id), [6, 4, 1, 2, 3, 5, 7]);
        assert.deepEqual(h.queries[0].orders, [
            { column: 'date', ascending: false, nullsFirst: false },
            { column: 'created_at', ascending: false }
        ]);
        h.rows[3].date = '2026-01-01';
        await h.module.search();
        assert.deepEqual(Array.from(h.rendered, row => row.id), [6, 1, 2, 3, 5, 4, 7]);
    });

    test(`${name}: existing date and partner filters remain effective`, async () => {
        const h = createHarness(file, name);
        h.rows[3].date = '2026-08-31';
        Object.assign(h.inputs, {
            searchStartDate: '2026-08-27', searchEndDate: '2026-08-31', search_sPartner: 'Test'
        });
        await h.module.search();
        assert.deepEqual(Array.from(h.rendered, row => row.id), [4, 1, 2]);
        h.inputs.searchEndDate = '2026-08-29';
        await h.module.search();
        assert.deepEqual(Array.from(h.rendered, row => row.id), [1, 2]);
        h.inputs.search_sPartner = 'No Match';
        await h.module.search();
        assert.equal(h.rendered.length, 0);
    });
}

for (const [file, name] of modules.slice(0, 5)) {
    test(`${name}: saving an edited date automatically reloads in date order`, async () => {
        const h = createHarness(file, name);
        const originalCreatedAt = h.rows[3].created_at;
        Object.assign(h.inputs, {
            sDate: '2026-08-31', sPartner: 'Test Partner',
            poDate: '2026-08-31', poPartner: 'Test Partner',
            purDate: '2026-08-31', purPartner: 'Test Partner', purItem: 'Test Item', purQty: '1'
        });
        h.module.applyStockDifference = async () => ({ error: null });
        h.module.applyStockDelta = async () => ({ error: null });
        let reload;
        const search = h.module.search.bind(h.module);
        h.module.search = (...args) => { reload = search(...args); return reload; };
        await h.module[file === 'purchases' ? 'saveEdit' : 'save']();
        assert.ok(reload, 'save must trigger a new search');
        await reload;
        assert.equal(h.rows[3].date, '2026-08-31');
        assert.equal(h.rows[3].created_at, originalCreatedAt);
        assert.deepEqual(Array.from(h.rendered, row => row.id), [4, 1, 2, 3, 5]);
    });
}

for (const [file, name] of [['orders', 'OrdersModule'], ['sales', 'SalesModule']]) {
    test(`${name}: import picker sorts before applying its 50-row limit`, async () => {
        const h = createHarness(file, name);
        h.rows.splice(0, h.rows.length, ...Array.from({ length: 60 }, (_, index) => ({
            id: index + 1,
            date: index === 0 ? '2026-08-31' : '2026-08-29',
            created_at: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
            partner_name: 'Test Partner', total_amount: 110
        })));
        await h.module.openLoadModal();
        const html = h.elements.get('loadDataBody').innerHTML;
        assert.equal((html.match(/<tr /g) || []).length, 50);
        assert.ok(html.indexOf('2026-08-31') < html.indexOf('2026-08-29'));
        assert.equal(h.queries[0].orders[0].column, 'date');
        assert.equal(h.queries[0].maximum, 50);
    });
}

for (const [file, name] of [['bookkeeping', 'BookkeepingModule'], ['meeting-logs', 'MeetingLogsModule']]) {
    test(`${name}: already-correct date ordering is preserved`, async () => {
        const h = createHarness(file, name);
        h.rows[3].date = '2026-08-31';
        await h.module.search();
        assert.deepEqual(Array.from(h.rendered, row => row.id), [4, 1, 2, 3, 5]);
    });
}

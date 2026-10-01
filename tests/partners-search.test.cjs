const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

function loadPartners(filters = {}) {
    const calls = { cachedSearch: [], clearCache: [] };

    class Query {
        select() { return this; }
        order() { return this; }
        ilike(column, value) {
            this.filter = { column, value };
            return this;
        }
    }

    const context = vm.createContext({
        supabaseClient: { from: () => new Query() },
        el: id => filters[id] || '',
        cachedSearch: async (...args) => { calls.cachedSearch.push(args); },
        clearCache: table => { calls.clearCache.push(table); }
    });
    const source = readFileSync(path.join(root, 'js/modules/partners.js'), 'utf8');
    vm.runInContext(`${source}\nthis.PartnersModule = PartnersModule;`, context);
    return { module: context.PartnersModule, calls };
}

test('거래처 검색어가 있으면 전체 목록 캐시를 우회한다', async () => {
    const h = loadPartners({ search_sName: '아스펙' });
    await h.module.search(false);

    const [tableName, query, , colspan, forceRefresh] = h.calls.cachedSearch[0];
    assert.equal(tableName, 'partners');
    assert.deepEqual(query.filter, { column: 'name', value: '%아스펙%' });
    assert.equal(colspan, 5);
    assert.equal(forceRefresh, true);
    assert.deepEqual(h.calls.clearCache, ['partners']);
});

test('검색어가 없으면 기존 거래처 전체 목록 캐시를 유지한다', async () => {
    const h = loadPartners();
    await h.module.search(false);

    assert.equal(h.calls.cachedSearch[0][4], false);
    assert.deepEqual(h.calls.clearCache, []);
});

test('발주관리 검색 라벨은 발주업체로 표시한다', () => {
    const ui = readFileSync(path.join(root, 'js/ui.js'), 'utf8');
    const purchaseOrderCase = ui.slice(ui.indexOf("case 'purchase_orders':"), ui.indexOf("case 'orders':"));
    assert.match(purchaseOrderCase, />발주업체</);
    assert.match(purchaseOrderCase, /placeholder="발주업체명"/);
    assert.doesNotMatch(purchaseOrderCase, />납품업체</);
});

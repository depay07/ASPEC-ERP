const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

function loadCollections() {
    const summary = {
        innerHTML: '',
        hidden: true,
        classList: {
            add() { summary.hidden = true; },
            remove() { summary.hidden = false; }
        }
    };
    const inputs = {
        searchStartDate: '2026-09-01',
        searchEndDate: '2026-09-22'
    };
    const context = vm.createContext({
        document: { getElementById: id => id === 'collectionsSummary' ? summary : null },
        el: id => inputs[id] || '',
        formatNumber: value => Number(value).toLocaleString('ko-KR')
    });
    const source = readFileSync(path.join(root, 'js/modules/collections.js'), 'utf8');
    vm.runInContext(`${source}\nthis.CollectionsModule = CollectionsModule;`, context);
    return { module: context.CollectionsModule, summary };
}

test('수금관리 미수금 합계는 조회된 행의 잔액을 모두 더한다', () => {
    const h = loadCollections();
    const rows = [
        { total_amount: 110000, collected_amount: 10000 },
        { total_amount: '220000', collected_amount: '200000' },
        { total_amount: 50000, collected_amount: 60000 }
    ];

    assert.equal(h.module.calculateOutstandingBalance(rows), 110000);
    h.module.renderSummary(rows);
    assert.equal(h.summary.hidden, false);
    assert.match(h.summary.innerHTML, /미수금\(잔액\) 합계/);
    assert.match(h.summary.innerHTML, /110,000원/);
    assert.match(h.summary.innerHTML, /2026-09-01 ~ 2026-09-22 · 3건/);
});

test('수금관리 합계는 조회 버튼을 누른 경우에만 표시하도록 연결한다', () => {
    const router = readFileSync(path.join(root, 'js/router.js'), 'utf8');
    assert.match(router, /CollectionsModule\.search\(forceRefresh, userInitiated\)/);
    assert.match(router, /id="collectionsSummary"/);
});

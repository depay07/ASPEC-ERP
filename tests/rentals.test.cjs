const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

function createModule(overrides = {}) {
    const alerts = [];
    const context = vm.createContext({
        getToday: () => '2026-09-02',
        parseDateString: value => {
            const [year, month, day] = String(value || '').split('-').map(Number);
            return { year, month, day };
        },
        escapeHtml: String,
        escapeAttr: String,
        formatNumber: String,
        alert: message => alerts.push(message),
        AppState: { currentEditId: null, partnerList: [], productList: [], globalDataStore: {} },
        document: {
            getElementById: () => null,
            querySelectorAll: () => []
        },
        el: () => '',
        closeModal() {},
        showTableLoading() {},
        showEmptyTable() {},
        storeRowData: () => 'row_1',
        getRowData: () => null,
        ...overrides
    });
    const source = readFileSync(path.join(root, 'js/modules/rentals.js'), 'utf8');
    vm.runInContext(`${source}\nthis.RentalsModule = RentalsModule;`, context);
    return { module: context.RentalsModule, context, alerts };
}

function validRental() {
    return {
        rental_date: '2026-09-02',
        partner_id: 1,
        partner_name: 'ABC테크',
        expected_return_date: '2026-09-10',
        actual_return_date: null,
        rental_purpose: 'test',
        rental_purpose_detail: '',
        status: 'on_loan'
    };
}

function validItem(overrides = {}) {
    return {
        item_name: '카메라',
        quantity: 2,
        returned_quantity: 1,
        return_date: '2026-09-05',
        ...overrides
    };
}

test('회수수량은 대여수량을 초과할 수 없다', () => {
    const { module } = createModule();
    const message = module.validateData(validRental(), [validItem({ returned_quantity: 3 })], 'ABC테크');
    assert.match(message, /회수수량은 대여수량을 초과/);
});

test('부분 회수는 미회수 상태를 유지한다', () => {
    const { module } = createModule();
    const rental = validRental();
    const message = module.validateData(rental, [validItem()], 'ABC테크');
    assert.equal(message, '');
    assert.equal(rental.status, 'on_loan');
    assert.equal(rental.actual_return_date, null);
});

test('거래처 관리에 없는 거래처도 이름을 직접 입력해 저장할 수 있다', () => {
    const { module } = createModule();
    const rental = validRental();
    rental.partner_id = null;
    rental.partner_name = '직접 입력 거래처';
    const message = module.validateData(rental, [validItem()], rental.partner_name);
    assert.equal(message, '');
});

test('모든 품목 회수 시 마지막 품목 회수일로 자동 완료된다', () => {
    const { module } = createModule();
    const rental = validRental();
    const items = [
        validItem({ quantity: 1, returned_quantity: 1, return_date: '2026-09-04' }),
        validItem({ item_name: '렌즈', quantity: 2, returned_quantity: 2, return_date: '2026-09-06' })
    ];
    const message = module.validateData(rental, items, 'ABC테크');
    assert.equal(message, '');
    assert.equal(rental.status, 'returned');
    assert.equal(rental.actual_return_date, '2026-09-06');
});

test('회수일은 회수수량과 함께 입력해야 한다', () => {
    const { module } = createModule();
    assert.match(
        module.validateData(validRental(), [validItem({ returned_quantity: 1, return_date: null })]),
        /회수일을 입력/
    );
    assert.match(
        module.validateData(validRental(), [validItem({ returned_quantity: 0, return_date: '2026-09-05' })]),
        /회수수량을 입력하거나 회수일을 지워/
    );
});

test('회수예정일 경고는 날짜 문자열을 KST 날짜 그대로 비교한다', () => {
    const { module } = createModule();
    assert.equal(module.getDueState('2026-09-01', 'on_loan', '2026-09-02').type, 'overdue');
    assert.equal(module.getDueState('2026-09-09', 'on_loan', '2026-09-02').type, 'soon');
    assert.equal(module.getDueState('2026-09-10', 'on_loan', '2026-09-02').type, 'normal');
    assert.equal(module.getDueState('2026-09-01', 'returned', '2026-09-02').type, 'normal');
});

test('저장은 부모와 품목을 save_rental RPC 한 번으로 전달하고 목록을 갱신한다', async () => {
    const calls = [];
    let closed = false;
    const { module } = createModule({
        AppState: { currentEditId: 17, partnerList: [], productList: [], globalDataStore: {} },
        closeModal: () => { closed = true; },
        supabaseClient: {
            rpc: async (name, args) => {
                calls.push({ name, args });
                return { error: null };
            }
        }
    });
    const rental = validRental();
    const items = [validItem()];
    module.collectFormData = () => ({ rental, items, partnerName: 'ABC테크' });
    let searched = false;
    module.search = async () => { searched = true; };

    assert.equal(await module.save(), true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].name, 'save_rental');
    assert.equal(calls[0].args.p_rental_id, 17);
    assert.deepEqual(JSON.parse(JSON.stringify(calls[0].args.p_items)), items);
    assert.equal(closed, true);
    assert.equal(searched, true);
});

function createPrintModule() {
    const context = vm.createContext({
        getToday: () => '2026-09-02',
        parseDateString: value => {
            const [year, month, day] = String(value).split('-').map(Number);
            return { year, month, day };
        },
        escapeHtml: value => String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;'),
        formatNumber: value => Number(value || 0).toLocaleString('en-US'),
        document: {},
        window: {},
        AppState: { currentUserEmail: 'test@aspec-tech.co.kr', productList: [] },
        getRowData: () => null,
        alert() {}
    });
    const source = readFileSync(path.join(root, 'js/modules/print.js'), 'utf8');
    vm.runInContext(`${source}\nthis.PrintModule = PrintModule;`, context);
    return context.PrintModule;
}

test('대여확인증 PDF 기본 파일명은 날짜와 직접 입력 거래처명을 사용한다', () => {
    const printModule = createPrintModule();
    assert.equal(
        printModule.getPdfDocumentTitle('rentals', { partner_name: 'ABC/테크' }),
        '[26.09.02] ABC 테크_대여확인증'
    );
});

test('대여확인증에는 품목별 대여·회수·미회수 정보가 출력된다', () => {
    const printModule = createPrintModule();
    const html = printModule.getRentalItemsTableHtml({
        rental_purpose: 'test',
        expected_return_date: '2026-09-10',
        project_name: '검사 현장',
        memo: '확인용',
        rental_items: [{
            item_name: '카메라 <IS2800>', model_name: 'IS2802M', manufacturer: 'Cognex',
            serial_number: 'SN123', asset_number: 'AS-01', quantity: 2,
            returned_quantity: 1, unit: 'EA', item_status: 'normal', memo: '테스트용'
        }]
    });
    assert.match(html, /대여/);
    assert.match(html, /회수/);
    assert.match(html, /미회수/);
    assert.match(html, /카메라 &lt;IS2800&gt;/);
    assert.match(html, /상기 물품을 대여하였음을 확인합니다/);
    assert.doesNotMatch(html, /부가세|공급가액/);
});

test('대여 목록 관리 버튼에 대여확인증 인쇄 버튼이 포함된다', () => {
    const { module } = createModule();
    const html = module.getActionButtons('row_1', 1);
    assert.match(html, /printDocument\('rentals', 'row_1'\)/);
    assert.match(html, /대여확인증 인쇄/);
});

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

async function loadCloud(quick = false) {
    const elements = new Map();
    function element(id) {
        if (!elements.has(id)) elements.set(id, {
            innerHTML: '', textContent: '', value: '',
            classList: { add() {}, remove() {} },
            addEventListener() {}, focus() {}, select() { this.selected = true; }
        });
        return elements.get(id);
    }
    const calls = [], clipboard = [];
    let clipboardFails = false, shareFails = false, closed = false;
    const sharedPath = '/s/abcd2345efgh6789';
    const context = vm.createContext({
        Headers, URL,
        document: { getElementById: element, querySelectorAll: () => [] },
        supabaseClient: { auth: { getSession: async () => ({ data: { session: { access_token: 'owner-token' } } }) } },
        navigator: { clipboard: { writeText: async value => { if (clipboardFails) throw new Error('denied'); clipboard.push(value); } } },
        openModal() {}, closeModal() { closed = true; },
        fetch: async (url, options) => {
            calls.push({ url, options });
            let data = {};
            if (url.includes('/files?')) data = { items: [
                { id: 'file-id', name: '<자료>.zip', kind: 'file', size: 10 },
                { id: 'folder-id', name: '폴더', kind: 'folder' }
            ] };
            if (url.endsWith('/storage')) data = { used: 10, total: 100, uploadAvailable: 90 };
            if (url.endsWith('/uploads')) data = [];
            if (url.endsWith('/shares')) data = shareFails ? { error: '공유 서버 오류' } : { url: sharedPath, ...(quick?{code:'abcd2345',codeUrl:'/s/abcd2345',codeExpiresAt:'2026-11-08T03:00:00Z'}:{}) };
            return { ok: !shareFails, status: shareFails ? 500 : 200, headers: new Headers({ 'content-type': 'application/json' }), json: async () => data };
        }
    });
    const source = readFileSync(path.join(__dirname, '../js/modules/cloud.js'), 'utf8');
    vm.runInContext(`${source}\nthis.CloudModule = CloudModule;`, context);
    await context.CloudModule.init({ innerHTML: '' });
    return { module: context.CloudModule, element, calls, clipboard, sharedPath,
        failClipboard: () => { clipboardFails = true; },
        failShare: () => { shareFails = true; },
        isClosed: () => closed };
}

test('파일에만 공유 버튼을 표시하고 인증된 요청으로 만든 공개 링크를 복사 및 중지한다', async () => {
    const h = await loadCloud();
    assert.equal((h.element('cloudList').innerHTML.match(/CloudModule\.share\(/g) || []).length, 1);
    await h.module.share('file-id');
    assert.match(h.element('modalBody').innerHTML, /로그인 없이/);
    assert.match(h.element('modalBody').innerHTML, /&lt;자료&gt;\.zip/);
    assert.ok(h.element('modalBody').innerHTML.includes('https://api.aspec-tech.co.kr' + h.sharedPath));
    const request = h.calls.find(c => c.url.endsWith('/shares'));
    assert.equal(request.options.method, 'POST');
    assert.equal(request.options.headers.get('Authorization'), 'Bearer owner-token');
    assert.equal(request.options.body, JSON.stringify({ id: 'file-id' }));
    h.element('cloudShareLink').value = 'https://api.aspec-tech.co.kr' + h.sharedPath;
    await h.module.copyShareLink();
    assert.deepEqual(h.clipboard, [h.element('cloudShareLink').value]);
    h.failClipboard();await h.module.copyShareLink();
    assert.equal(h.element('cloudShareLink').selected, true);
    assert.match(h.element('cloudShareStatus').textContent, /Ctrl\+C/);
    const button = { disabled: false };
    await h.module.revokeShare('file-id', button);
    assert.equal(h.calls.at(-1).options.method, 'DELETE');
    assert.ok(h.calls.at(-1).url.endsWith('/shares/file-id'));
    assert.equal(h.isClosed(), true);
    assert.equal(button.disabled, false);
});

test('공유 생성에 실패하면 링크 생성 성공으로 표시하지 않는다', async () => {
    const h = await loadCloud();h.failShare();
    await h.module.share('file-id');
    assert.equal(h.element('modalBody').innerHTML, '');
    assert.equal(h.element('cloudNotice').textContent, '공유 서버 오류');
});

test('공유 코드를 크게 표시하고 간편 링크와 만료 없는 링크를 함께 제공한다', async () => {
    const h = await loadCloud(true); await h.module.share('file-id');
    const html=h.element('modalBody').innerHTML;
    assert.match(html,/abcd2345/);assert.match(html,/간편 링크 \(24시간\)/);assert.match(html,/만료 없는 링크/);
    assert.ok(html.includes('https://api.aspec-tech.co.kr/s/abcd2345'));
    assert.ok(html.includes('https://api.aspec-tech.co.kr'+h.sharedPath));
});

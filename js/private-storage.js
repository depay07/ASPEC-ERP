// Keep durable object references in the DB; issue short-lived URLs only after RLS checks.
var PrivateStorage = (() => {
    const buckets = new Set(['erp', 'memos']);
    function pathFor(bucket, reference) {
        if (!buckets.has(bucket) || typeof reference !== 'string') throw new Error('첨부파일 주소를 확인하세요.');
        const prefix = 'storage://' + bucket + '/';
        let path;
        if (reference.startsWith(prefix)) path = reference.slice(prefix.length);
        else {
            const url = new URL(reference);
            const base = new URL(SUPABASE_URL);
            const legacyPrefix = '/storage/v1/object/public/' + bucket + '/';
            if (url.origin !== base.origin || !url.pathname.startsWith(legacyPrefix) || url.search || url.hash) {
                throw new Error('허용되지 않은 첨부파일 주소입니다.');
            }
            path = decodeURIComponent(url.pathname.slice(legacyPrefix.length));
        }
        if (!path || path.split('/').some(part => !part || part === '.' || part === '..') || /[\\\x00-\x1f\x7f]/.test(path)) {
            throw new Error('첨부파일 경로를 확인하세요.');
        }
        return path;
    }
    function reference(bucket, path) {
        const value = 'storage://' + bucket + '/' + path;
        pathFor(bucket, value);
        return value;
    }
    async function signedUrl(bucket, value) {
        const path = pathFor(bucket, value);
        const { data, error } = await supabaseClient.storage.from(bucket).createSignedUrl(path, 60);
        if (error) throw error;
        const url = new URL(data.signedUrl);
        if (url.origin !== new URL(SUPABASE_URL).origin) throw new Error('첨부파일 응답 주소를 확인하세요.');
        return url.href;
    }
    function link(bucket, value, label, className) {
        try { pathFor(bucket, value); } catch { return ''; }
        return '<a href="#" data-private-bucket="' + escapeAttr(bucket) + '" data-private-file="' + escapeAttr(value) +
            '" onclick="event.preventDefault(); PrivateStorage.open(this.dataset.privateBucket, this.dataset.privateFile)" class="' +
            escapeAttr(className || '') + '">' + label + '</a>';
    }
    async function open(bucket, value) {
        const popup = window.open('about:blank', '_blank');
        if (popup) popup.opener = null;
        try {
            const url = await signedUrl(bucket, value);
            if (popup) popup.location.replace(url);
            else alert('첨부파일을 열려면 이 사이트의 팝업을 허용하세요.');
        } catch (error) {
            if (popup) popup.close();
            alert('첨부파일 열기 실패: ' + error.message);
        }
    }
    async function hydrateImages(container) {
        await Promise.all(Array.from(container.querySelectorAll('img[data-private-file]')).map(async image => {
            try { image.src = await signedUrl('memos', image.dataset.privateFile); }
            catch { image.alt = '첨부파일을 불러오지 못했습니다.'; }
        }));
    }
    return { pathFor, reference, signedUrl, link, open, hydrateImages };
})();

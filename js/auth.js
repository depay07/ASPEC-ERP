// js/auth.js - 인증 관련

var SESSION_IDLE_LIMIT_MS = 30 * 60 * 1000;
var SESSION_ACTIVITY_SAVE_INTERVAL_MS = 15 * 1000;
var SESSION_ACTIVITY_KEY = 'aspec_erp_last_activity_at';
var SESSION_REFRESH_MARGIN_MS = 2 * 60 * 1000;

/**
 * 초기 인증 체크 및 앱 시작
 */
async function initializeApp() {
    try {
        var sessionReady = await ensureActiveSession({ context: 'ERP 시작', notifyNetworkError: true });
        if (!sessionReady) return false;

        var sessionResult = await supabaseClient.auth.getSession();
        var session = sessionResult.data?.session;
        var user = session?.user || null;

        // 일시적인 네트워크 오류만으로 브라우저에 저장된 세션을 폐기하지 않습니다.
        var userResult = await supabaseClient.auth.getUser();
        if (userResult.error) {
            if (!isTransientAuthError(userResult.error)) {
                redirectToLogin('로그인 정보가 만료되었습니다.\n확인을 누르면 로그인 화면으로 이동합니다.');
                return false;
            }
            console.warn('사용자 정보 확인이 지연되어 저장된 세션으로 시작합니다.', userResult.error);
        } else {
            user = userResult.data.user;
        }

        if (!user) {
            redirectToLogin('로그인이 필요합니다.\n확인을 누르면 로그인 화면으로 이동합니다.');
            return false;
        }

        AppState.currentUserEmail = user.email || '';
        startSessionTimer();
        await fetchMasterData(true);
        return true;
    } catch (error) {
        console.error('초기화 오류:', error);
        if (isTransientAuthError(error)) {
            showConnectionWarning('네트워크 연결이 불안정하여 ERP를 시작하지 못했습니다.\n로그인은 유지됩니다. 잠시 후 새로고침해 주세요.');
        } else {
            redirectToLogin('로그인 상태를 확인할 수 없습니다.\n확인을 누르면 로그인 화면으로 이동합니다.');
        }
        return false;
    }
}

/**
 * 저장된 세션을 확인하고 만료가 가까우면 갱신합니다.
 */
async function ensureActiveSession(options) {
    options = options || {};

    if (AppState.authRedirecting) return false;
    if (AppState.authCheckPromise) return AppState.authCheckPromise;

    AppState.authCheckPromise = (async function() {
        try {
            var sessionResult = await supabaseClient.auth.getSession();
            if (sessionResult.error) throw sessionResult.error;

            var session = sessionResult.data?.session;
            if (!session) {
                redirectToLogin('로그인 시간이 만료되었습니다.\n확인을 누르면 로그인 화면으로 이동합니다.');
                return false;
            }

            var expiresAt = Number(session.expires_at || 0) * 1000;
            var needsRefresh = options.forceRefresh || !expiresAt || expiresAt - Date.now() <= SESSION_REFRESH_MARGIN_MS;
            if (!needsRefresh) return true;

            var refreshResult = await supabaseClient.auth.refreshSession();
            if (refreshResult.error) throw refreshResult.error;

            if (!refreshResult.data?.session) {
                redirectToLogin('로그인 시간이 만료되었습니다.\n확인을 누르면 로그인 화면으로 이동합니다.');
                return false;
            }

            return true;
        } catch (error) {
            console.error((options.context || '세션 확인') + ' 오류:', error);

            if (isTransientAuthError(error)) {
                if (options.notifyNetworkError !== false) {
                    showConnectionWarning('네트워크 연결이 불안정하여 데이터를 불러오지 못했습니다.\n로그인은 유지됩니다. 잠시 후 다시 조회해 주세요.');
                }
                return false;
            }

            redirectToLogin('로그인 정보가 만료되었습니다.\n확인을 누르면 로그인 화면으로 이동합니다.');
            return false;
        } finally {
            AppState.authCheckPromise = null;
        }
    })();

    return AppState.authCheckPromise;
}

function isTransientAuthError(error) {
    if (!error) return false;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;

    var status = Number(error.status || error.statusCode || 0);
    var name = String(error.name || '').toLowerCase();
    var message = String(error.message || error).toLowerCase();

    return status === 0 || status >= 500 ||
        name.includes('retryable') || name.includes('fetch') ||
        message.includes('fetch') || message.includes('network') ||
        message.includes('timeout') || message.includes('timed out') ||
        message.includes('load failed');
}

function showConnectionWarning(message) {
    var now = Date.now();
    if (now - AppState.lastConnectionWarningAt < 3000) return;

    AppState.lastConnectionWarningAt = now;
    alert(message);
}

function redirectToLogin(message) {
    if (AppState.authRedirecting) return;

    AppState.authRedirecting = true;
    clearTimeout(AppState.sessionTimer);
    alert(message || '로그인이 필요합니다.');
    window.location.replace('index.html');
}

/**
 * 마스터 데이터 로드 (거래처, 품목) - 캐싱 적용
 */
async function fetchMasterData(forceRefresh) {
    forceRefresh = forceRefresh || false;

    if (!forceRefresh && AppState.partnerList.length > 0 && AppState.productList.length > 0) {
        console.log('마스터 데이터 캐시 사용');
        return true;
    }

    try {
        console.log('마스터 데이터 로드 중...');

        var sessionReady = await ensureActiveSession({ context: '기초 데이터 조회', notifyNetworkError: true });
        if (!sessionReady) return false;

        var results = await Promise.all([
            supabaseClient.from('partners').select('*'),
            supabaseClient.from('products').select('*').order('name')
        ]);

        var partnersRes = results[0];
        var productsRes = results[1];
        var error = partnersRes.error || productsRes.error;

        if (error) {
            if (isTransientAuthError(error)) {
                showConnectionWarning('네트워크 연결이 불안정하여 거래처·품목 정보를 불러오지 못했습니다.\n로그인은 유지되며 잠시 후 다시 조회할 수 있습니다.');
            } else {
                alert('기초 데이터 조회 실패: ' + error.message);
            }
            return false;
        }

        AppState.partnerList = partnersRes.data || [];
        AppState.productList = productsRes.data || [];
        console.log('마스터 데이터 로드 완료');
        return true;
    } catch (error) {
        console.error('fetchMasterData 오류:', error);
        showConnectionWarning('네트워크 연결이 불안정하여 거래처·품목 정보를 불러오지 못했습니다.\n로그인은 유지되며 잠시 후 다시 조회할 수 있습니다.');
        return false;
    }
}

/**
 * 30분 비활동 타이머를 시작합니다. 여러 ERP 탭은 마지막 활동 시각을 공유합니다.
 */
function startSessionTimer() {
    setupSessionActivityListeners();
    recordSessionActivity(true);
}

function setupSessionActivityListeners() {
    if (AppState.sessionActivityListenersReady) return;
    AppState.sessionActivityListenersReady = true;

    ['pointerdown', 'keydown', 'touchstart'].forEach(function(eventName) {
        window.addEventListener(eventName, function() {
            recordSessionActivity(false);
        }, { passive: true });
    });

    window.addEventListener('storage', function(event) {
        if (event.key !== SESSION_ACTIVITY_KEY || !event.newValue) return;

        var sharedActivityAt = Number(event.newValue) || 0;
        if (sharedActivityAt > AppState.lastActivityAt) {
            AppState.lastActivityAt = sharedActivityAt;
            scheduleSessionWarning();
        }
    });

    window.addEventListener('online', function() {
        ensureActiveSession({ context: '네트워크 복구', notifyNetworkError: false });
    });
}

function recordSessionActivity(forceSave) {
    if (AppState.sessionWarningVisible || AppState.authRedirecting) return;

    var now = Date.now();
    AppState.lastActivityAt = now;

    if (forceSave || now - AppState.lastActivitySavedAt >= SESSION_ACTIVITY_SAVE_INTERVAL_MS) {
        AppState.lastActivitySavedAt = now;
        try {
            localStorage.setItem(SESSION_ACTIVITY_KEY, String(now));
        } catch (error) {
            console.warn('세션 활동 시각 저장 실패:', error);
        }
    }

    scheduleSessionWarning();
}

function getLastSessionActivityAt() {
    var sharedActivityAt = 0;
    try {
        sharedActivityAt = Number(localStorage.getItem(SESSION_ACTIVITY_KEY)) || 0;
    } catch (error) {
        console.warn('세션 활동 시각 조회 실패:', error);
    }

    return Math.max(AppState.lastActivityAt || 0, sharedActivityAt);
}

function scheduleSessionWarning() {
    clearTimeout(AppState.sessionTimer);

    var lastActivityAt = getLastSessionActivityAt() || Date.now();
    var remaining = SESSION_IDLE_LIMIT_MS - (Date.now() - lastActivityAt);
    AppState.sessionTimer = setTimeout(handleSessionIdleTimeout, Math.max(1000, remaining));
}

async function handleSessionIdleTimeout() {
    var idleTime = Date.now() - getLastSessionActivityAt();
    if (idleTime < SESSION_IDLE_LIMIT_MS) {
        scheduleSessionWarning();
        return;
    }

    if (AppState.sessionWarningVisible || AppState.authRedirecting) return;
    AppState.sessionWarningVisible = true;

    try {
        if (confirm('30분 동안 사용 기록이 없습니다.\n로그인을 연장하시겠습니까?')) {
            var renewed = await ensureActiveSession({
                context: '로그인 연장',
                forceRefresh: true,
                notifyNetworkError: true
            });

            if (renewed) {
                AppState.sessionWarningVisible = false;
                recordSessionActivity(true);
            } else if (!AppState.authRedirecting) {
                // 네트워크가 복구되면 다시 확인할 수 있도록 로그인 상태는 지우지 않습니다.
                AppState.sessionWarningVisible = false;
                recordSessionActivity(true);
            }
        } else {
            await logout();
        }
    } finally {
        AppState.sessionWarningVisible = false;
    }
}

/**
 * 현재 브라우저의 세션만 로그아웃합니다.
 */
async function logout() {
    if (AppState.intentionalLogout) return;

    AppState.intentionalLogout = true;
    clearTimeout(AppState.sessionTimer);
    try {
        localStorage.removeItem(SESSION_ACTIVITY_KEY);
    } catch (error) {
        console.warn('세션 활동 시각 삭제 실패:', error);
    }

    await supabaseClient.auth.signOut({ scope: 'local' });
    window.location.replace('index.html');
}

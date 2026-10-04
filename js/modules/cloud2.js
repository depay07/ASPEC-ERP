// js/modules/cloud2.js - Teldrive 기반 대용량 파일 클라우드
const Cloud2Module = (() => {
    const DRIVE_URL = 'https://drive.aspec-tech.co.kr';

    function shell() {
        return `
        <div class="flex flex-col gap-4">
          <div class="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
            <div>
              <h2 class="text-3xl font-bold text-slate-800 border-l-8 border-cyan-500 pl-4">파일 클라우드2</h2>
              <p class="text-sm text-slate-500 mt-2 ml-6">Teldrive / Telegram 기반 대용량 파일 저장소입니다.</p>
            </div>
            <a href="${DRIVE_URL}" target="_blank" rel="noopener noreferrer"
               class="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2.5 rounded font-bold text-sm inline-flex items-center gap-2">
              <i class="fa-solid fa-arrow-up-right-from-square"></i> 새 창에서 열기
            </a>
          </div>

          <div class="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
            <div class="p-4 border-b border-slate-200 flex items-center justify-between gap-3">
              <div>
                <div class="font-bold text-slate-800">ASPEC Drive</div>
                <div class="text-xs text-slate-500 mt-1">${DRIVE_URL}</div>
              </div>
              <button type="button" onclick="Cloud2Module.reload()"
                      class="bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded text-sm font-bold">
                <i class="fa-solid fa-rotate mr-1"></i> 새로고침
              </button>
            </div>
            <div id="cloud2FrameWrap" class="relative bg-slate-50" style="height: calc(100vh - 235px); min-height: 520px;">
              <iframe id="cloud2Frame" src="${DRIVE_URL}" title="ASPEC Drive"
                      class="w-full h-full border-0 bg-white"
                      referrerpolicy="strict-origin-when-cross-origin"></iframe>
              <div id="cloud2Help" class="absolute inset-x-0 bottom-0 p-2 text-center text-xs text-slate-500 bg-white/90 border-t">
                화면이 표시되지 않으면 Teldrive 설치 완료 후 Nginx의 frame-ancestors/X-Frame-Options 설정을 확인하거나 ‘새 창에서 열기’를 사용하세요.
              </div>
            </div>
          </div>
        </div>`;
    }

    function init(container) {
        container.innerHTML = shell();
    }

    function reload() {
        const frame = document.getElementById('cloud2Frame');
        if (frame) frame.src = DRIVE_URL;
    }

    return { init, reload };
})();

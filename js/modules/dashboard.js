// js/modules/dashboard.js - 대시보드 모듈

const DashboardModule = {
    /**
     * 대시보드 렌더링
     */
    render(container) {
        const randomQuote = QUOTES[Math.floor(Math.random() * QUOTES.length)];
        
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center h-[80vh] animate-fade-in">
                <div class="bg-white p-10 rounded-2xl shadow-xl text-center border-l-8 border-blue-500 max-w-2xl">
                    <h1 class="text-4xl font-extrabold text-slate-800 mb-6">ASPEC ERP System</h1>
                    <p class="text-2xl font-medium text-slate-600 italic leading-relaxed">"${randomQuote}"</p>
                </div>
                <p class="mt-8 text-slate-400 text-sm">오늘도 좋은 하루 되세요!</p>
            </div>`;
    }
};

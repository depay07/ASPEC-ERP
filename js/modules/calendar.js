// js/modules/calendar.js - 캘린더/일정 관리 모듈

const CalendarModule = {
    
    /**
     * 캘린더 렌더링 (메인)
     */
    async render() {
        if (AppState.calendar.events.length === 0) {
            await this.loadEvents();
        }
        
        const container = document.getElementById('contentArea');
        const { currentYear, currentMonth } = AppState.calendar;
        const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
        const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
        
        const existingSearch = document.getElementById('calendarSearchInput')?.value || '';
        
        let html = `
            <div class="calendar-container h-full flex flex-col">
                <div class="calendar-header flex-none">
                    <h2 class="text-2xl font-bold text-slate-800">${currentYear}년 ${monthNames[currentMonth]}</h2>
                    <div class="flex items-center gap-3">
                        <div class="relative group">
                            <i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 group-hover:text-blue-500 transition"></i>
                            <input type="text" id="calendarSearchInput" value="${existingSearch}"
                                placeholder="일정 검색" 
                                onkeyup="if(event.keyCode==13){ CalendarModule.search(this.value) } else if(this.value==''){ CalendarModule.search('') }"
                                class="pl-10 pr-4 py-2 bg-slate-100 border-transparent focus:bg-white border focus:border-blue-500 rounded-full text-sm transition-all w-64 focus:w-80 outline-none shadow-sm">
                            ${existingSearch ? '<button onclick="CalendarModule.clearSearch()" class="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"><i class="fa-solid fa-xmark"></i></button>' : ''}
                        </div>
                        <div class="flex gap-1 ml-2">
                            <button onclick="CalendarModule.changeMonth(-1)" class="px-3 py-2 bg-white border border-slate-300 text-slate-600 rounded hover:bg-slate-50 font-semibold shadow-sm">
                                <i class="fa-solid fa-chevron-left"></i>
                            </button>
                            <button onclick="CalendarModule.goToToday()" class="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded hover:bg-slate-50 font-semibold shadow-sm text-sm">오늘</button>
                            <button onclick="CalendarModule.changeMonth(1)" class="px-3 py-2 bg-white border border-slate-300 text-slate-600 rounded hover:bg-slate-50 font-semibold shadow-sm">
                                <i class="fa-solid fa-chevron-right"></i>
                            </button>
                        </div>
                    </div>
                </div>`;
        
        if (existingSearch.trim() !== '') {
            html += this.renderSearchResults(existingSearch);
        } else {
            html += `
                <div class="calendar-grid flex-1 overflow-auto">
                    ${dayNames.map(day => `<div class="calendar-day-header sticky top-0 bg-slate-50 z-10">${day}</div>`).join('')}
                    ${this.renderDays()}
                </div>`;
        }
        
        html += `</div>`;
        container.innerHTML = html;
        
        if (existingSearch) {
            document.getElementById('calendarSearchInput')?.focus();
        }
    },
    
    /**
     * 이벤트 로드
     */
    async loadEvents() {
        try {
            const { data, error } = await supabaseClient
                .from('calendar_events')
                .select('*')
                .order('start_date', { ascending: true });
            
            if (error) throw error;
            AppState.calendar.events = data || [];
        } catch (e) {
            console.error('일정 로드 오류:', e);
            AppState.calendar.events = [];
        }
    },
    
    /**
     * 날짜 그리드 렌더링
     */
    renderDays() {
        const { currentYear, currentMonth } = AppState.calendar;
        const firstDay = new Date(currentYear, currentMonth, 1);
        const lastDay = new Date(currentYear, currentMonth + 1, 0);
        const prevLastDay = new Date(currentYear, currentMonth, 0);
        const firstDayOfWeek = firstDay.getDay();
        const lastDate = lastDay.getDate();
        const prevLastDate = prevLastDay.getDate();
        const todayStr = new Date().toISOString().split('T')[0];
        
        let html = '';
        
        // 이전 달 날짜
        for (let i = firstDayOfWeek - 1; i >= 0; i--) {
            const date = prevLastDate - i;
            html += `<div class="calendar-day other-month"><div class="calendar-day-number">${date}</div></div>`;
        }
        
        // 현재 달 날짜
        for (let date = 1; date <= lastDate; date++) {
            const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
            const dayEvents = this.getEventsForDate(dateStr);
            const isToday = dateStr === todayStr;
            const visibleEvents = dayEvents.slice(0, 2);
            const hiddenCount = dayEvents.length - 2;
            
            html += `
                <div class="calendar-day ${isToday ? 'today' : ''}" onclick="CalendarModule.openEventModal('${dateStr}')">
                    <div class="calendar-day-number">${date}</div>
                    ${visibleEvents.map(evt => `
                        <div class="calendar-event event-${evt.color} ${evt.all_day ? 'allday' : ''}" 
                             onclick="CalendarModule.editEvent(${evt.id}); event.stopPropagation();" 
                             title="${evt.title}">
                            ${evt.all_day ? '' : evt.start_time.substring(0, 5) + ' '}${evt.title}
                        </div>
                    `).join('')}
                    ${hiddenCount > 0 ? `
                        <div class="calendar-more-events" onclick="CalendarModule.showAllEvents('${dateStr}'); event.stopPropagation();">
                            +${hiddenCount}개 더보기
                        </div>
                    ` : ''}
                </div>`;
        }
        
        // 다음 달 날짜
        const totalCells = firstDayOfWeek + lastDate;
        const remainingCells = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
        for (let date = 1; date <= remainingCells; date++) {
            html += `<div class="calendar-day other-month"><div class="calendar-day-number">${date}</div></div>`;
        }
        
        return html;
    },
    
    /**
     * 특정 날짜의 이벤트 가져오기
     */
    getEventsForDate(dateStr) {
        return AppState.calendar.events
            .filter(evt => dateStr >= evt.start_date && dateStr <= evt.end_date)
            .sort((a, b) => {
                if (a.all_day && !b.all_day) return -1;
                if (!a.all_day && b.all_day) return 1;
                if (a.start_time && b.start_time) return a.start_time.localeCompare(b.start_time);
                return 0;
            });
    },
    
    /**
     * 검색 결과 렌더링
     */
    renderSearchResults(keyword) {
        const lowerKey = keyword.toLowerCase();
        const filtered = AppState.calendar.events.filter(e => 
            (e.title && e.title.toLowerCase().includes(lowerKey)) || 
            (e.description && e.description.toLowerCase().includes(lowerKey))
        );
        filtered.sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
        
        if (filtered.length === 0) {
            return `
                <div class="flex flex-col items-center justify-center h-96 text-slate-400">
                    <i class="fa-solid fa-magnifying-glass text-4xl mb-4"></i>
                    <p>검색 결과가 없습니다.</p>
                </div>`;
        }
        
        const days = ['일', '월', '화', '수', '목', '금', '토'];
        
        return `
            <div class="overflow-y-auto flex-1 p-4">
                <div class="max-w-4xl mx-auto bg-white rounded-lg shadow-sm border border-slate-200 divide-y divide-slate-100">
                    ${filtered.map(evt => {
                        const dateObj = new Date(evt.start_date);
                        const dayNum = dateObj.getDate();
                        const dayStr = days[dateObj.getDay()];
                        const yearMonth = `${dateObj.getFullYear()}년 ${dateObj.getMonth() + 1}월`;
                        const timeHtml = evt.all_day 
                            ? `<span class="inline-block w-2 h-2 rounded-full bg-${evt.color}-500 mr-2"></span>종일`
                            : `<span class="inline-block w-2 h-2 rounded-full bg-${evt.color}-500 mr-2"></span>${evt.start_time.substring(0,5)} ~ ${evt.end_time.substring(0,5)}`;
                        
                        return `
                            <div class="flex hover:bg-slate-50 transition cursor-pointer group" onclick="CalendarModule.editEvent(${evt.id})">
                                <div class="w-48 p-4 flex flex-col justify-center border-r border-transparent group-hover:border-slate-100 shrink-0">
                                    <div class="flex items-baseline gap-2">
                                        <span class="text-2xl font-bold text-slate-700">${dayNum}</span>
                                        <span class="text-xs text-slate-500 font-medium">${yearMonth}, ${dayStr}</span>
                                    </div>
                                </div>
                                <div class="flex-1 p-4 flex flex-col justify-center">
                                    <div class="flex items-center text-sm font-bold text-slate-600 mb-1">${timeHtml}</div>
                                    <div class="text-base font-bold text-slate-800 mb-1">${evt.title}</div>
                                    ${evt.description ? `<div class="text-sm text-slate-400 truncate">${evt.description}</div>` : ''}
                                </div>
                                <div class="w-12 flex items-center justify-center text-slate-300 opacity-0 group-hover:opacity-100 transition">
                                    <i class="fa-solid fa-chevron-right"></i>
                                </div>
                            </div>`;
                    }).join('')}
                </div>
            </div>`;
    },
    
    /**
     * 검색
     */
    search(keyword) {
        this.render();
    },
    
    /**
     * 검색 초기화
     */
    clearSearch() {
        const input = document.getElementById('calendarSearchInput');
        if (input) input.value = '';
        this.render();
    },
    
    /**
     * 월 변경
     */
    changeMonth(delta) {
        AppState.calendar.currentMonth += delta;
        
        if (AppState.calendar.currentMonth < 0) {
            AppState.calendar.currentMonth = 11;
            AppState.calendar.currentYear--;
        } else if (AppState.calendar.currentMonth > 11) {
            AppState.calendar.currentMonth = 0;
            AppState.calendar.currentYear++;
        }
        
        this.render();
    },
    
    /**
     * 오늘로 이동
     */
    goToToday() {
        const today = new Date();
        AppState.calendar.currentYear = today.getFullYear();
        AppState.calendar.currentMonth = today.getMonth();
        this.render();
    },
    
    /**
     * 이벤트 모달 열기 (신규)
     */
    openEventModal(dateStr = null) {
        AppState.calendar.editingEventId = null;
        AppState.calendar.selectedColor = 'green';
        
        const today = dateStr || getToday();
        
        document.getElementById('eventModalTitle').innerText = '일정 추가';
        document.getElementById('eventTitle').value = '';
        document.getElementById('eventAllDay').checked = false;
        document.getElementById('eventStartDate').value = today;
        document.getElementById('eventEndDate').value = today;
        document.getElementById('eventStartTime').value = '09:00';
        document.getElementById('eventEndTime').value = '10:00';
        document.getElementById('eventDescription').value = '';
        document.getElementById('deleteEventBtn').style.display = 'none';
        
        this.toggleAllDay();
        this.selectColor('green');
        document.getElementById('eventModal').classList.add('active');
    },
    
    /**
     * 이벤트 수정 모달
     */
    editEvent(eventId) {
        const event = AppState.calendar.events.find(e => e.id === eventId);
        if (!event) return;
        
        AppState.calendar.editingEventId = eventId;
        AppState.calendar.selectedColor = event.color || 'green';
        
        document.getElementById('eventModalTitle').innerText = '일정 수정';
        document.getElementById('eventTitle').value = event.title || '';
        document.getElementById('eventAllDay').checked = event.all_day || false;
        document.getElementById('eventStartDate').value = event.start_date || '';
        document.getElementById('eventEndDate').value = event.end_date || '';
        document.getElementById('eventStartTime').value = event.start_time || '09:00';
        document.getElementById('eventEndTime').value = event.end_time || '10:00';
        document.getElementById('eventDescription').value = event.description || '';
        document.getElementById('deleteEventBtn').style.display = 'block';
        
        this.toggleAllDay();
        this.selectColor(event.color || 'green');
        document.getElementById('eventModal').classList.add('active');
    },
    
    /**
     * 종일 토글
     */
    toggleAllDay() {
        const allDay = document.getElementById('eventAllDay').checked;
        const startTime = document.getElementById('eventStartTime');
        const endTime = document.getElementById('eventEndTime');
        
        startTime.disabled = allDay;
        endTime.disabled = allDay;
        startTime.style.opacity = allDay ? '0.5' : '1';
        endTime.style.opacity = allDay ? '0.5' : '1';
    },
    
    /**
     * 색상 선택
     */
    selectColor(color) {
        AppState.calendar.selectedColor = color;
        document.querySelectorAll('.color-option').forEach(opt => opt.classList.remove('selected'));
        document.querySelector(`[data-color="${color}"]`)?.classList.add('selected');
    },
    
    /**
     * 이벤트 저장
     */
    async saveEvent() {
        const title = document.getElementById('eventTitle').value.trim();
        if (!title) return alert('일정 제목을 입력해주세요.');
        
        const startDate = document.getElementById('eventStartDate').value;
        let endDate = document.getElementById('eventEndDate').value;
        if (startDate > endDate) endDate = startDate;
        
        const isAllDay = document.getElementById('eventAllDay').checked;
        
        const eventData = {
            title: title,
            start_date: startDate,
            end_date: endDate,
            start_time: isAllDay ? '00:00' : document.getElementById('eventStartTime').value,
            end_time: isAllDay ? '23:59' : document.getElementById('eventEndTime').value,
            all_day: isAllDay,
            description: document.getElementById('eventDescription').value.trim(),
            color: AppState.calendar.selectedColor
        };
        
        try {
            if (AppState.calendar.editingEventId) {
                const { error } = await supabaseClient
                    .from('calendar_events')
                    .update(eventData)
                    .eq('id', AppState.calendar.editingEventId);
                if (error) throw error;
                alert('수정되었습니다.');
            } else {
                const { error } = await supabaseClient
                    .from('calendar_events')
                    .insert([eventData]);
                if (error) throw error;
                alert('추가되었습니다.');
            }
            
            this.closeEventModal();
            await this.loadEvents();
            this.render();
        } catch (e) {
            alert('저장 오류: ' + e.message);
        }
    },
    
    /**
     * 이벤트 삭제
     */
    async deleteEvent() {
        if (!AppState.calendar.editingEventId || !confirm('삭제하시겠습니까?')) return;
        
        try {
            const { error } = await supabaseClient
                .from('calendar_events')
                .delete()
                .eq('id', AppState.calendar.editingEventId);
            
            if (error) throw error;
            
            alert('삭제되었습니다.');
            this.closeEventModal();
            await this.loadEvents();
            this.render();
        } catch (e) {
            alert('삭제 오류: ' + e.message);
        }
    },
    
    /**
     * 이벤트 모달 닫기
     */
    closeEventModal() {
        document.getElementById('eventModal').classList.remove('active');
        AppState.calendar.editingEventId = null;
    },
    
    /**
     * 특정 날짜의 모든 이벤트 보기
     */
    showAllEvents(dateStr) {
        const events = this.getEventsForDate(dateStr);
        const modal = document.getElementById('allEventsModal');
        const body = document.getElementById('allEventsModalBody');
        const title = document.getElementById('allEventsModalTitle');
        
        const [y, m, d] = dateStr.split('-');
        title.innerText = `${y}년 ${parseInt(m)}월 ${parseInt(d)}일 일정`;
        
        if (events.length === 0) {
            body.innerHTML = '<p class="text-center text-slate-500 py-8">일정이 없습니다.</p>';
        } else {
            body.innerHTML = events.map(evt => `
                <div class="calendar-event event-${evt.color} mb-2 cursor-pointer hover:opacity-80 transition" 
                     onclick="CalendarModule.editEvent(${evt.id}); CalendarModule.closeAllEventsModal();" 
                     style="padding:10px; font-size:14px; border-radius:4px;">
                    <div class="font-bold flex justify-between">
                        <span>${evt.title}</span>
                        <span class="text-xs font-normal opacity-70"><i class="fa-solid fa-pen"></i></span>
                    </div>
                    ${evt.all_day 
                        ? '<div class="text-xs mt-1 font-semibold opacity-90">종일</div>' 
                        : `<div class="text-xs mt-1 font-semibold opacity-90">${evt.start_time.substring(0,5)}</div>`}
                    ${evt.description ? `<div class="text-xs mt-1 opacity-80 border-t border-black/10 pt-1 mt-1">${evt.description}</div>` : ''}
                </div>
            `).join('');
        }
        
        modal.classList.add('active');
    },
    
    /**
     * 모든 이벤트 모달 닫기
     */
    closeAllEventsModal() {
        document.getElementById('allEventsModal').classList.remove('active');
    }
};

// 전역 함수 연결 (HTML에서 호출용)
function toggleAllDay() { CalendarModule.toggleAllDay(); }
function selectColor(color) { CalendarModule.selectColor(color); }
function saveEvent() { CalendarModule.saveEvent(); }
function deleteEvent() { CalendarModule.deleteEvent(); }
function closeEventModal() { CalendarModule.closeEventModal(); }
function closeAllEventsModal() { CalendarModule.closeAllEventsModal(); }

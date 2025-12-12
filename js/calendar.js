// ============= 캘린더 관련 변수 및 함수 =============
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth();
let calendarEvents = [];
let selectedColor = 'green';
let editingEventId = null;

// 1. 캘린더 렌더링 (메인 함수)
async function renderCalendar() {
    if(calendarEvents.length === 0) await loadCalendarEvents();
    
    const contentArea = document.getElementById('contentArea');
    const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    
    const existingSearch = document.getElementById('calendarSearchInput') ? document.getElementById('calendarSearchInput').value : '';

    let html = `
        <div class="calendar-container h-full flex flex-col">
            <div class="calendar-header flex-none">
                <h2 class="text-2xl font-bold text-slate-800">${currentYear}년 ${monthNames[currentMonth]}</h2>
                <div class="flex items-center gap-3">
                    <div class="relative group">
                        <i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 group-hover:text-blue-500 transition"></i>
                        <input type="text" id="calendarSearchInput" value="${existingSearch}"
                            placeholder="일정 검색" 
                            onkeyup="if(window.event.keyCode==13){ runCalendarSearch(this.value) } else if(this.value==''){ runCalendarSearch('') }"
                            class="pl-10 pr-4 py-2 bg-slate-100 border-transparent focus:bg-white border focus:border-blue-500 rounded-full text-sm transition-all w-64 focus:w-80 outline-none shadow-sm"
                        >
                        ${existingSearch ? '<button onclick="clearCalendarSearch()" class="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"><i class="fa-solid fa-xmark"></i></button>' : ''}
                    </div>
                    <div class="flex gap-1 ml-2">
                        <button onclick="changeMonth(-1)" class="px-3 py-2 bg-white border border-slate-300 text-slate-600 rounded hover:bg-slate-50 font-semibold shadow-sm"><i class="fa-solid fa-chevron-left"></i></button>
                        <button onclick="goToToday()" class="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded hover:bg-slate-50 font-semibold shadow-sm text-sm">오늘</button>
                        <button onclick="changeMonth(1)" class="px-3 py-2 bg-white border border-slate-300 text-slate-600 rounded hover:bg-slate-50 font-semibold shadow-sm"><i class="fa-solid fa-chevron-right"></i></button>
                    </div>
                </div>
            </div>`;

    if (existingSearch.trim() !== '') {
        html += renderSearchResultsView(existingSearch);
    } else {
        html += `<div class="calendar-grid flex-1 overflow-auto">
                ${dayNames.map(day => `<div class="calendar-day-header sticky top-0 bg-slate-50 z-10">${day}</div>`).join('')}
                ${renderCalendarDays()}
            </div>`;
    }
    html += `</div>`;
    contentArea.innerHTML = html;
    
    if(existingSearch) {
        const input = document.getElementById('calendarSearchInput');
        if(input) input.focus();
    }
}

// 2. 캘린더 검색 및 뷰
function runCalendarSearch(keyword) { renderCalendar(); }
function clearCalendarSearch() {
    const input = document.getElementById('calendarSearchInput');
    if(input) input.value = '';
    renderCalendar();
}
function renderSearchResultsView(keyword) {
    if (!keyword) return '';
    const lowerKey = keyword.toLowerCase();
    const filtered = calendarEvents.filter(e => (e.title && e.title.toLowerCase().includes(lowerKey)) || (e.description && e.description.toLowerCase().includes(lowerKey)));
    filtered.sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
    if (filtered.length === 0) return `<div class="flex flex-col items-center justify-center h-96 text-slate-400"><i class="fa-solid fa-magnifying-glass text-4xl mb-4"></i><p>검색 결과가 없습니다.</p></div>`;
    let listHtml = `<div class="overflow-y-auto flex-1 p-4"><div class="max-w-4xl mx-auto bg-white rounded-lg shadow-sm border border-slate-200 divide-y divide-slate-100">`;
    filtered.forEach(evt => {
        const dateObj = new Date(evt.start_date);
        const dayNum = dateObj.getDate();
        const days = ['일', '월', '화', '수', '목', '금', '토'];
        const dayStr = days[dateObj.getDay()];
        const yearMonth = `${dateObj.getFullYear()}년 ${dateObj.getMonth() + 1}월`;
        let timeHtml = evt.all_day ? `<span class="inline-block w-2 h-2 rounded-full bg-${evt.color}-500 mr-2"></span>종일` : `<span class="inline-block w-2 h-2 rounded-full bg-${evt.color}-500 mr-2"></span>${evt.start_time.substring(0,5)} ~ ${evt.end_time.substring(0,5)}`;
        listHtml += `<div class="flex hover:bg-slate-50 transition cursor-pointer group" onclick="editEvent(${evt.id})"><div class="w-48 p-4 flex flex-col justify-center border-r border-transparent group-hover:border-slate-100 shrink-0"><div class="flex items-baseline gap-2"><span class="text-2xl font-bold text-slate-700">${dayNum}</span><span class="text-xs text-slate-500 font-medium">${yearMonth}, ${dayStr}</span></div></div><div class="flex-1 p-4 flex flex-col justify-center"><div class="flex items-center text-sm font-bold text-slate-600 mb-1">${timeHtml}</div><div class="text-base font-bold text-slate-800 mb-1">${evt.title}</div>${evt.description ? `<div class="text-sm text-slate-400 truncate">${evt.description}</div>` : ''}</div><div class="w-12 flex items-center justify-center text-slate-300 opacity-0 group-hover:opacity-100 transition"><i class="fa-solid fa-chevron-right"></i></div></div>`;
    });
    return listHtml + `</div></div>`;
}

// 3. 날짜 그리드 생성
function renderCalendarDays() {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const prevLastDay = new Date(currentYear, currentMonth, 0);
    const firstDayOfWeek = firstDay.getDay();
    const lastDate = lastDay.getDate();
    const prevLastDate = prevLastDay.getDate();
    const todayStr = new Date().toISOString().split('T')[0];
    let html = '';
    for (let i = firstDayOfWeek - 1; i >= 0; i--) { const date = prevLastDate - i; html += `<div class="calendar-day other-month"><div class="calendar-day-number">${date}</div></div>`; }
    for (let date = 1; date <= lastDate; date++) {
        const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
        const dayEvents = getEventsForDate(dateStr);
        const isToday = dateStr === todayStr;
        const visibleEvents = dayEvents.slice(0, 2);
        const hiddenCount = dayEvents.length - 2;
        html += `<div class="calendar-day ${isToday ? 'today' : ''}" onclick="openEventModal('${dateStr}')"><div class="calendar-day-number">${date}</div>${visibleEvents.map(evt => `<div class="calendar-event event-${evt.color} ${evt.all_day ? 'allday' : ''}" onclick="editEvent(${evt.id}); event.stopPropagation();" title="${evt.title}">${evt.all_day ? '' : evt.start_time.substring(0, 5) + ' '}${evt.title}</div>`).join('')}${hiddenCount > 0 ? `<div class="calendar-more-events" onclick="showAllEvents('${dateStr}'); event.stopPropagation();">+${hiddenCount}개 더보기</div>` : ''}</div>`;
    }
    const totalCells = firstDayOfWeek + lastDate;
    const remainingCells = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (let date = 1; date <= remainingCells; date++) { html += `<div class="calendar-day other-month"><div class="calendar-day-number">${date}</div></div>`; }
    return html;
}

// 4. 유틸리티 함수들
function getEventsForDate(dateStr) {
    return calendarEvents.filter(evt => dateStr >= evt.start_date && dateStr <= evt.end_date).sort((a, b) => { if (a.all_day && !b.all_day) return -1; if (!a.all_day && b.all_day) return 1; if (a.start_time && b.start_time) return a.start_time.localeCompare(b.start_time); return 0; });
}
function changeMonth(delta) { currentMonth += delta; if (currentMonth < 0) { currentMonth = 11; currentYear--; } else if (currentMonth > 11) { currentMonth = 0; currentYear++; } renderCalendar(); }
function goToToday() { const today = new Date(); currentYear = today.getFullYear(); currentMonth = today.getMonth(); renderCalendar(); }
async function loadCalendarEvents() { try { const { data, error } = await supabase.from('calendar_events').select('*').order('start_date', { ascending: true }); if (error) throw error; calendarEvents = data || []; } catch (e) { console.error('일정 로드 오류:', e); calendarEvents = []; } }

// 5. 모달 및 이벤트 처리
function openEventModal(dateStr = null) {
    editingEventId = null; selectedColor = 'green';
    const today = dateStr || new Date().toISOString().split('T')[0];
    document.getElementById('eventModalTitle').innerText = '일정 추가'; document.getElementById('eventTitle').value = '';
    document.getElementById('eventAllDay').checked = false; document.getElementById('eventStartDate').value = today; document.getElementById('eventEndDate').value = today;
    document.getElementById('eventStartTime').value = '09:00'; document.getElementById('eventEndTime').value = '10:00'; document.getElementById('eventDescription').value = '';
    document.getElementById('deleteEventBtn').style.display = 'none';
    toggleAllDay(); selectColor('green'); document.getElementById('eventModal').classList.add('active');
}
function editEvent(eventId) {
    const event = calendarEvents.find(e => e.id === eventId); if (!event) return;
    editingEventId = eventId; selectedColor = event.color || 'green';
    document.getElementById('eventModalTitle').innerText = '일정 수정'; document.getElementById('eventTitle').value = event.title || '';
    document.getElementById('eventAllDay').checked = event.all_day || false; document.getElementById('eventStartDate').value = event.start_date || '';
    document.getElementById('eventEndDate').value = event.end_date || ''; document.getElementById('eventStartTime').value = event.start_time || '09:00';
    document.getElementById('eventEndTime').value = event.end_time || '10:00'; document.getElementById('eventDescription').value = event.description || '';
    document.getElementById('deleteEventBtn').style.display = 'block';
    toggleAllDay(); selectColor(event.color || 'green'); document.getElementById('eventModal').classList.add('active');
}
function toggleAllDay() { const allDay = document.getElementById('eventAllDay').checked; document.getElementById('eventStartTime').disabled = allDay; document.getElementById('eventEndTime').disabled = allDay; if (allDay) { document.getElementById('eventStartTime').style.opacity = '0.5'; document.getElementById('eventEndTime').style.opacity = '0.5'; } else { document.getElementById('eventStartTime').style.opacity = '1'; document.getElementById('eventEndTime').style.opacity = '1'; } }
function selectColor(color) { selectedColor = color; document.querySelectorAll('.color-option').forEach(opt => { opt.classList.remove('selected'); }); const colorOpt = document.querySelector(`[data-color="${color}"]`); if (colorOpt) colorOpt.classList.add('selected'); }

async function saveEvent() {
    const title = document.getElementById('eventTitle').value.trim(); if (!title) return alert('일정 제목을 입력해주세요.');
    const startDate = document.getElementById('eventStartDate').value; let endDate = document.getElementById('eventEndDate').value;
    if (startDate > endDate) endDate = startDate;
    const isAllDay = document.getElementById('eventAllDay').checked;
    const eventData = { title: title, start_date: startDate, end_date: endDate, start_time: isAllDay ? '00:00' : document.getElementById('eventStartTime').value, end_time: isAllDay ? '23:59' : document.getElementById('eventEndTime').value, all_day: isAllDay, description: document.getElementById('eventDescription').value.trim(), color: selectedColor };
    try {
        if (editingEventId) { const { error } = await supabase.from('calendar_events').update(eventData).eq('id', editingEventId); if (error) throw error; alert('수정되었습니다.'); } 
        else { const { error } = await supabase.from('calendar_events').insert([eventData]); if (error) throw error; alert('추가되었습니다.'); }
        closeEventModal(); await loadCalendarEvents(); renderCalendar();
    } catch (e) { alert('저장 오류: ' + e.message); }
}
async function deleteEvent() { if (!editingEventId || !confirm('삭제하시겠습니까?')) return; try { const { error } = await supabase.from('calendar_events').delete().eq('id', editingEventId); if (error) throw error; alert('삭제되었습니다.'); closeEventModal(); await loadCalendarEvents(); renderCalendar(); } catch (e) { alert('삭제 오류: ' + e.message); } }
function closeEventModal() { document.getElementById('eventModal').classList.remove('active'); editingEventId = null; }

function showAllEvents(dateStr) {
    const events = getEventsForDate(dateStr); const modal = document.getElementById('allEventsModal'); const body = document.getElementById('allEventsModalBody'); const title = document.getElementById('allEventsModalTitle');
    const [y, m, d] = dateStr.split('-'); title.innerText = `${y}년 ${parseInt(m)}월 ${parseInt(d)}일 일정`;
    if (events.length === 0) body.innerHTML = '<p class="text-center text-slate-500 py-8">일정이 없습니다.</p>';
    else body.innerHTML = events.map(evt => `<div class="calendar-event event-${evt.color} mb-2 cursor-pointer hover:opacity-80 transition" onclick="editEvent(${evt.id}); closeAllEventsModal();" style="padding:10px; font-size:14px; border-radius:4px;"><div class="font-bold flex justify-between"><span>${evt.title}</span><span class="text-xs font-normal opacity-70"><i class="fa-solid fa-pen"></i></span></div>${evt.all_day ? '<div class="text-xs mt-1 font-semibold opacity-90">종일</div>' : `<div class="text-xs mt-1 font-semibold opacity-90">${evt.start_time.substring(0,5)}</div>`}${evt.description ? `<div class="text-xs mt-1 opacity-80 border-t border-black/10 pt-1 mt-1">${evt.description}</div>` : ''}</div>`).join('');
    modal.classList.add('active');
}
function closeAllEventsModal() { document.getElementById('allEventsModal').classList.remove('active'); }

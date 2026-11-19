'use strict';

let currentUserId = null;
let authBusy = true;
let authMessage = '';
function storageKey(key) { return `campus-user-${currentUserId ?? 'anonymous'}:${key}`; }

const $ = selector => document.querySelector(selector);

// Мягкая реакция виджетов на наведение и касание.
if (!document.getElementById('campus-polish-styles')) {
  const polish = document.createElement('style');
  polish.id = 'campus-polish-styles';
  polish.textContent = `
    .hero, .semester-module, .main-grid > .card, .news-item {
      transition: transform .22s ease, filter .22s ease, box-shadow .22s ease;
      will-change: transform, filter;
    }
    @media (hover: hover) {
      .hero:hover, .semester-module:hover, .main-grid > .card:hover, .news-item:hover {
        transform: translateY(-3px);
        filter: blur(.35px);
      }
    }
    .hero:active, .semester-module:active, .main-grid > .card:active, .news-item:active {
      transform: translateY(-1px) scale(.995);
      filter: blur(.55px);
    }
    .personal-documents-card { border: 0 !important; box-shadow: none !important; background: transparent !important; padding-left: 0 !important; padding-right: 0 !important; }
    .personal-documents-card .personal-doc-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
    .personal-documents-card .personal-doc { min-height: 118px; border: 0 !important; border-radius: 18px; box-shadow: 0 8px 22px rgba(20, 34, 56, .07); background: rgba(28, 52, 72, .055) !important; display: flex; flex-direction: column; align-items: flex-start; justify-content: space-between; gap: 8px; text-align: left; }
    .personal-documents-card .personal-doc:hover, .personal-documents-card .personal-doc:focus-visible { transform: translateY(-3px); filter: blur(.25px); }
    .personal-documents-card .personal-doc small { color: var(--muted, #6d7480); }
    .personal-documents-card .doc-symbol { min-width: 48px; max-width: 100%; padding: 0 10px; height: 42px; display: inline-flex; align-items: center; justify-content: center; border-radius: 14px; color: #fff; background: linear-gradient(135deg, #173f68 0%, #327ba3 55%, #d59a5b 100%); box-shadow: 0 8px 18px rgba(23, 63, 104, .22); font-size: 12px; font-weight: 800; letter-spacing: .03em; }
    .personal-documents-card .personal-doc:nth-child(3n+2) .doc-symbol { background: linear-gradient(135deg, #3e2b68, #8661a8 58%, #e0a35e); }
    .personal-documents-card .personal-doc:nth-child(3n) .doc-symbol { background: linear-gradient(135deg, #155b59, #3b9d8b 58%, #d6a45d); }
    @media (max-width: 760px) { .personal-documents-card .personal-doc-grid { grid-template-columns: 1fr; } }
    .lunch-row .subject h3 { margin-bottom: 4px; }
    .lunch-row.finished { opacity: .5; }
    .personal-documents-card { background: transparent !important; }
    .personal-documents-card .personal-doc { background: #fff !important; }
    .personal-documents-card .add-document-row { position: relative; clear: both; margin-top: 28px; padding-top: 22px; display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: end; gap: 16px; border-top: 1px solid rgba(100, 112, 128, .12); }
    .personal-documents-card .add-document-row > div { min-width: 0; }
    .personal-documents-card .add-document-row .button { white-space: nowrap; }
    @media (max-width: 560px) { .personal-documents-card .add-document-row { grid-template-columns: 1fr; } }
  `;
  document.head.appendChild(polish);
}
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[character]));
function readStore(key, fallback) {
  try { return JSON.parse(localStorage.getItem(storageKey(key))) ?? fallback; } catch { return fallback; }
}
function saveStore(key, value) {
  try { localStorage.setItem(storageKey(key), JSON.stringify(value)); return true; }
  catch { showToast('Не удалось сохранить данные. Проверьте свободное место в браузере.'); return false; }
}
function showToast(message) {
  $('#toast').textContent = message;
  $('#toast').style.display = 'block';
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => $('#toast').style.display = 'none', 4500);
}
const student = { name:'', faculty:'', direction:'', course:'', group:'', email:'' };
const sections = [ ['home','⌂','Главная'], ['schedule','▦','Расписание'], ['study','◷','Успеваемость'], ['docs','▤','Документы'], ['messages','✉','Связь с деканатом'], ['notifications','♧','Уведомления'], ['profile','○','Профиль'] ];
const disciplines = [
  { id:'english', name:'Английский язык', teacher:'Е. А. Смирнова', room:'314', grades:[['5','05.10'],['4','19.10'],['5','09.11']], examDate:'2027-01-12T09:00:00+03:00', examGrade:null, credit:'Зачёт', creditDate:'2026-11-09T12:00:00+03:00' },
  { id:'theory', name:'Теория международных отношений', teacher:'Д. В. Соколов', room:'211', grades:[['4','06.10'],['5','20.10'],['4','10.11']], examDate:'2027-01-16T10:00:00+03:00', examGrade:null, credit:'Зачёт', creditDate:'2026-11-10T10:35:00+03:00' },
  { id:'history', name:'История дипломатии', teacher:'И. Н. Петров', room:'408', grades:[['5','07.10'],['5','21.10'],['5','11.11']], examDate:'2027-01-21T09:00:00+03:00', examGrade:null, credit:null, creditDate:'2026-12-18T13:00:00+03:00' },
  { id:'economics', name:'Мировая экономика', teacher:'М. С. Орлова', room:'302', grades:[['4','08.10'],['3','22.10'],['4','05.11']], examDate:null, examGrade:null, credit:'Незачёт', creditDate:'2026-11-06T14:35:00+03:00', retakeDate:'2026-11-20T10:00:00+03:00' },
  { id:'french', name:'Второй иностранный язык', teacher:'А. В. Белова', room:'215', grades:[['4','09.10'],['5','23.10']], examDate:null, examGrade:null, credit:null, creditDate:null },
  { id:'law', name:'Международное право', teacher:'С. П. Козлов', room:'407', grades:[['5','12.10'],['4','26.10']], examDate:null, examGrade:null, credit:'Зачёт', creditDate:'2026-11-11T09:00:00+03:00' }
];
const pastExams = [ { name:'Политология', grade:'5', date:'2026-06-15' }, { name:'Философия', grade:'4', date:'2026-06-20' }, { name:'Статистика', grade:'Пересдача', date:null } ];
const news = [
  ['11.11.2026','Дипломатия','Посол Ливана посетил Дипломатическую академию МГИМО','https://dipacademy.ru/','Дипломатическая академия'],
  ['10.11.2026','Культура','В Академии открылась художественная выставка об Угличе','https://www.dipacademy.ru/press/category/kdm/','Дипломатическая академия'],
  ['09.11.2026','Образование','В МГИМО проходит третий московский модуль программ со СтГАУ и КубГАУ','https://mgimo.travel/news','МГИМО · Туризм'],
  ['07.11.2026','Кампус','Колледж и университет встретились в рамках «Образовательного моста»','https://itclub.mgimo.ru/news','IT-клуб МГИМО'],
  ['06.11.2026','Наука','На Днях науки обсудили ИИ и цифровую безопасность','https://itclub.mgimo.ru/news','IT-клуб МГИМО'],
  ['05.11.2026','Конференции','Центр ИИ анонсировал AI Global Dimension на 12 ноября','https://aicentre.mgimo.ru/','Центр ИИ МГИМО'],
  ['05.11.2026','Студенческая жизнь','Команда IT-клуба по CS2 прошла отбор турнира','https://itclub.mgimo.ru/news','IT-клуб МГИМО'],
  ['02.11.2026','Технологии','В Одинцове подвели итоги межвузовского Цифрового триатлона','https://itclub.mgimo.ru/news','IT-клуб МГИМО'],
  ['29.10.2026','Международные проекты','Завершилась студенческая модель конференции МСЭ','https://aicentre.mgimo.ru/','Центр ИИ МГИМО']
];
const offices = [
  { id:'reception', name:'Приёмная деканата', hours:'Пн–пт · 10:00–17:00', pickup:'Ответ в кабинете в течение 3 рабочих дней', location:'Деканат факультета · кабинет 201', requirements:['ФИО, группа и тема обращения','Краткое описание ситуации','Подтверждающие файлы — при наличии'], types:['Общий вопрос','Индивидуальный график','Запись на приём','Исправление данных'], intro:'Прошу рассмотреть моё обращение по вопросу', ending:'Прошу направить ответ в личный кабинет.' },
  { id:'certificates', name:'Учебные заявки', hours:'Пн–чт · 10:00–16:00, пт · 10:00–15:00', pickup:'Ответ появится в личном кабинете в течение 3 рабочих дней.', location:'Учебный отдел · кабинет 105', requirements:['Опишите вопрос и желаемый результат','Укажите место или срок, если это важно','Приложите подтверждающие файлы — при наличии'], types:['Подать учебную заявку','Уточнить учебные данные','Записаться на консультацию'], intro:'Прошу рассмотреть учебную заявку по вопросу', ending:'Прошу направить ответ в личный кабинет.' },
  { id:'exams', name:'Секретарь по учебной работе', hours:'Пн, ср, пт · 11:00–16:00', pickup:'Решение в течение 5 рабочих дней', location:'Деканат факультета · кабинет 203', requirements:['Дисциплина и причина обращения','Предпочтительные даты','Подтверждающий документ — если применимо'], types:['Запись на пересдачу','Перенос экзамена','Уточнение даты зачёта'], intro:'Прошу рассмотреть заявление по вопросу', ending:'Прошу согласовать порядок дальнейших действий и направить ответ в кабинет.' }
];
const seededRequests = [
  { id:'sample-1', number:'Д-1024', title:'Уточнение индивидуального графика', office:'reception', type:'msg', status:'В работе', date:'11.11.2026', text:'Прошу уточнить порядок согласования индивидуального графика в период учебной практики.', response:'Обращение передано специалисту по учебной работе.', sample:true },
  { id:'sample-2', number:'Д-1021', title:'Исправление данных в профиле', office:'reception', type:'msg', status:'Ответ получен', date:'10.11.2026', text:'Прошу уточнить порядок исправления названия моей учебной группы.', response:'Укажите корректное название группы в ответном обращении. Приёмная проверит данные в учебной системе.', sample:true },
];
const defaultNotifications = [
  {id:'n-schedule',category:'schedule',title:'История дипломатии перенесена в аудиторию 305',text:'12 ноября, 10:35. Ранее — аудитория 211. Преподаватель И. Н. Петров. Время занятия прежнее.',date:'12.11.2026 · 08:15',target:'schedule'},
  {id:'n-reply',category:'requests',title:'Ответ на обращение Д-1021',text:'Приёмная деканата ответила на вопрос об исправлении данных в профиле.',date:'12.11.2026 · 10:00',target:'request',requestId:'sample-2'},
  {id:'n-exam',category:'grades',title:'Назначен экзамен по английскому языку',text:'12 января 2027, 09:00 · аудитория 314. Дата добавлена в раздел «Успеваемость».',date:'11.11.2026 · 15:00',target:'study'},
  {id:'n-grade',category:'grades',title:'Новая оценка по истории дипломатии',text:'За семинар 11 ноября преподаватель поставил 5. Оценка добавлена в журнал.',date:'11.11.2026 · 14:20',target:'study'},
];
const documentTypes = ['Паспорт','СНИЛС','Студенческий билет','Регистрация','Аттестат','Личные достижения','Медицинская справка','Полис ОМС','Военный билет','Договор обучения','Фото 3×4'];
let page = 'home';
let entered = false;
let requests = readStore('campus-requests', []);
requests = Array.isArray(requests) ? requests.map(r => ({...r,id:r.id || crypto.randomUUID(),office:r.office || (r.type==='doc'?'certificates':'reception')})) : [];
let notifications = readStore('campus-notifications-v2', defaultNotifications);
let readIds = new Set(readStore('campus-read-v2', []));
let notificationFilter = 'all';
let studyTab = null;
let sessionTerm = 'winter';
let selectedWeek = 0;
let selectedDay = Math.min(5,(new Date().getUTCDay()+6)%7);
let scheduleView = 'day';
let scheduleMode = 'today';
let selectedDocumentId = null;
let pageStack = ['home'];
let activeOffice = 'reception';
let activeRequest = null;
let letterDraft = null;
let selectedAttachments = [];
let storedFiles = [];
let uploadBusy = false;
const startOfWeeks = '2026-11-09';
selectedDay = moscowDateParts().weekday;
selectedWeek = Math.max(0,Math.min(5,Math.floor(moscowDayOffset()/7)));
const dayNames = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
const timeSlots = [['09:00','10:20'],['10:35','11:55'],['12:10','13:30'],['14:00','15:20'],['15:35','16:55'],['17:10','18:30']];
const content = $('#content');

function moscowDateParts(date=new Date()) {
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit',weekday:'short'}).formatToParts(date);
  const get=type=>parts.find(part=>part.type===type)?.value;
  const weekdayMap={Mon:0,Tue:1,Wed:2,Thu:3,Fri:4,Sat:5,Sun:6};
  return {date:`${get('year')}-${get('month')}-${get('day')}`,weekday:weekdayMap[get('weekday')]??0};
}
function moscowDayOffset() {
  const today=moscowDateParts().date;
  return Math.round((Date.parse(today+'T12:00:00+03:00')-Date.parse(startOfWeeks+'T12:00:00+03:00'))/86400000);
}
function dateLabel(value, withTime=false) {
  if (!value) return 'Не назначено';
  return new Intl.DateTimeFormat('ru-RU',{ timeZone:'Europe/Moscow', day:'numeric',month:'long',year:'numeric',...(withTime?{hour:'2-digit',minute:'2-digit'}:{}) }).format(new Date(value));
}
function dateAt(offset) {
  const date = new Date(startOfWeeks+'T12:00:00+03:00');
  date.setUTCDate(date.getUTCDate()+offset);
  return date.toISOString().slice(0,10);
}
function nowLabel() {
  return new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date());
}
function allRequests() { return [...requests, ...seededRequests]; }
function unreadCount() { return notifications.filter(item => !readIds.has(item.id)).length; }
function persistRequests(next) { if (saveStore('campus-requests', next)) requests = next; }
function addNotification(item) {
  const next = {...item,id:crypto.randomUUID(),date:nowLabel()};
  notifications.unshift(next);
  saveStore('campus-notifications-v2', notifications);
  renderNavigation();
  if (readStore('campus-notification-choice',null)==='enabled' && 'Notification' in window && Notification.permission==='granted') {
    try { new Notification('Мой кампус',{body:next.title}); } catch { /* Центр уведомлений доступен и без системного уведомления. */ }
  }
}
function renderNavigation() {
  const count = unreadCount();
  $('nav').innerHTML = sections.map(([id,icon,title])=>`<button data-page="${id}" class="${page===id?'active':''}"><span class="nav-icon">${icon}</span><span>${title}</span>${id==='notifications'&&count?`<span class="count" aria-label="${count} непрочитанных">${count}</span>`:''}</button>`).join('');
  $('#headerCount').innerHTML = count ? `<span class="count">${count}</span>` : '';
  renderMobileNavigation();
}
function go(next, options={}) {
  if (page !== next && options.fromPop !== true) pageStack.push(next);
  page = next;
  if (options.fromPop !== true) history.pushState({campusPage:next},'',`#${next}`);
  render();
  window.scrollTo({top:0,behavior:'instant'});
}
function goBack(fromPop=false) {
  if (fromPop) { if (pageStack.length>1) pageStack.pop(); page=pageStack[pageStack.length-1]||'home'; render(); return; }
  if (history.state?.campusPage && history.length>1) { history.back(); return; }
  if (pageStack.length>1) pageStack.pop();
  page=pageStack[pageStack.length-1]||'home'; render();
}
window.addEventListener('popstate',()=>goBack(true));
function themeButton() {
  const dark = document.documentElement.dataset.theme==='dark';
  $('#themeToggle').textContent = dark?'☀ Светлая':'☾ Тёмная';
  $('#themeToggle').setAttribute('aria-pressed', String(dark));
}
$('#themeToggle').onclick = () => {
  const theme = document.documentElement.dataset.theme==='dark'?'light':'dark';
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem('campus-theme',theme); } catch {}
  themeButton();
};
function title(heading, description='') { return `<h1>${heading}</h1>${description?`<p class="lead">${description}</p>`:''}`; }
function statusBadge(status) {
  return `<span class="status ${['Незачёт','Не допущен','Пересдача','Отменено'].includes(status)?'negative':status==='—'?'pending':''}">${escapeHtml(status)}</span>`;
}
function isAdmitted() { return disciplines.every(subject=>subject.credit==='Зачёт'); }
function admissionWidget() {
  const pending = disciplines.filter(subject=>subject.credit!=='Зачёт');
  return `<div class="card admission"><div><h2>Допуск к сессии</h2><p>${pending.length?'Необходимо закрыть зачёты по дисциплинам: '+pending.map(subject=>subject.name).join(', ')+'.':'Все обязательные зачёты получены.'}</p></div>${statusBadge(isAdmitted()?'Допущен':'Не допущен')}</div>`;
}
function homePage() {
  return title('Добрый день, '+escapeHtml(student.name.split(' ')[1] || student.name)+' ☀',escapeHtml(student.faculty)+' · '+escapeHtml(student.course)+' курс · группа '+escapeHtml(student.group))+`<div class="main-grid"><section class="hero span2"><span class="pill" style="color:#bfd4ed">МОЙ КАМПУС</span><h2>Твой день. В твоём ритме.</h2><p>Всё, что нужно для учёбы, — в одном кабинете.</p><button class="button" data-action="choose-office">Подать заявку ↗</button></section><section class="card span2 semester-module"><div class="row"><h2>Мой семестр</h2>${statusBadge(isAdmitted()?'Допущен':'Есть незакрытые зачёты')}</div><div class="big">${semesterAverage()} <small>средняя оценка</small></div><div class="progress"><i></i></div><button class="link" data-page="study">Открыть успеваемость →</button></section><section class="card span2"><div class="row"><h2>Ближайший учебный день</h2><button class="link" data-page="schedule">6 недель →</button></div>${daySchedule(Math.floor(visibleTodayOffset()/7),visibleTodayOffset()%7,true)}</section><section class="card span2"><div class="row"><h2>Связь с деканатом</h2><button class="link" data-action="new-letter" data-office="reception">Написать ↗</button></div><p class="muted">Ваши обращения и ответы приёмной</p>${allRequests().filter(r=>r.office==='reception').slice(0,3).map(requestRow).join('')}<button class="link section-gap" data-page="messages">Все обращения →</button></section><section class="card news-full"><h2>Новости университета</h2><p class="news-caption">Подборка публикаций МГИМО и подразделений · обновлено 12 ноября 2026</p><div class="news-grid">${news.map(n=>`<a class="news-item" href="${n[3]}" target="_blank" rel="noopener noreferrer"><small>${n[0]} · ${n[1]}</small><h3>${n[2]}</h3><span class="source">${n[4]} ↗</span></a>`).join('')}</div></section></div>`;
}
function semesterAverage() {
  const values=disciplines.flatMap(s=>s.grades.map(g=>Number(g[0])));
  return (values.reduce((a,b)=>a+b,0)/values.length).toFixed(1).replace('.',',');
}
function getLessons(week, day) {
  if (day===6) return [];
  const count = day===5?4:(day%2===0?6:5);
  return Array.from({length:count},(_,index)=>{
    let subject=disciplines[(index+day+week)%disciplines.length];
    if (week===0 && day===3 && index===1) subject=disciplines.find(s=>s.id==='history');
    const changed=week===0&&day===3&&index===1;
    return {...subject,start:dateAt(week*7+day)+'T'+timeSlots[index][0]+':00+03:00',end:dateAt(week*7+day)+'T'+timeSlots[index][1]+':00+03:00',time:timeSlots[index],changed,room:changed?'305':subject.room,kind:index%3===0?'Лекция':'Семинар'};
  });
}
function daySchedule(week, day, compact=false) {
  const lessons=getLessons(week,day);
  const rows=lessons.map((lesson,index)=>`${index===3?`<article class="class-row lunch-row" data-start="${lesson.start.slice(0,10)}T13:30:00+03:00" data-end="${lesson.start.slice(0,10)}T14:00:00+03:00"><time>13:30<small>14:00</small><span class="class-state"></span></time><div class="subject"><span class="pill">🕐 Перерыв</span><h3>Обеденный перерыв</h3><p>Время для отдыха</p></div></article>`:''}<article class="class-row" data-start="${lesson.start}" data-end="${lesson.end}"><time>${lesson.time[0]}<small>${lesson.time[1]}</small><span class="class-state"></span></time><div class="subject"><span class="pill">${lesson.kind} · ${index+1} пара</span><h3>${lesson.name}</h3><p>${lesson.teacher} · ауд. ${lesson.room}</p>${lesson.changed?'<span class="changed">↪ Перенос из аудитории 211 в 305</span>':''}</div></article>`).join('');
  return `<div class="day-heading"><b>${dayNames[day]} · ${dateLabel(dateAt(week*7+day))}</b><small class="muted">${lessons.length} пар</small></div>${rows||'<p class="empty">Выходной день. Занятий нет.</p>'}${compact?'<button class="link section-gap" data-page="schedule">Полное расписание →</button>':''}`;
}
function isScheduleDayFinished(offset) {
  const week=Math.floor(offset/7),day=offset%7,lessons=getLessons(week,day);
  if (!lessons.length) return true;
  return Date.now() >= Date.parse(lessons[lessons.length-1].end);
}
function nextScheduleOffset(offset) {
  let next=offset+1;
  while(next<42 && getLessons(Math.floor(next/7),next%7).length===0) next++;
  return next;
}
function visibleTodayOffset() {
  const today=moscowDayOffset();
  return isScheduleDayFinished(today) ? nextScheduleOffset(today) : today;
}
function updateLessonStates(now=Date.now()) {
  document.querySelectorAll('.class-row[data-start]').forEach(row=>{
    const start=Date.parse(row.dataset.start),end=Date.parse(row.dataset.end);
    row.classList.toggle('started',now>=start+60000);
    row.classList.toggle('finished',now>=end);
    row.querySelector('.class-state').textContent=now>=end?'Завершена':now>=start?'Идёт пара':'';
  });
}
function schedulePage() {
  const todayOffset=moscowDayOffset();
  let nextClassOffset=nextScheduleOffset(todayOffset);
  let offset=scheduleMode==='tomorrow'?todayOffset+1:scheduleMode==='today'?(isScheduleDayFinished(todayOffset)?nextClassOffset:todayOffset):selectedWeek*7+selectedDay;
  if (offset>=0&&offset<42&&scheduleMode!=='week') { selectedWeek=Math.floor(offset/7);selectedDay=offset%7; }
  const outside=offset<0||offset>=42;
  const showingNext=scheduleMode==='today'&&offset!==todayOffset;
  return title('Моё расписание','6 учебных недель')+`<div class="toolbar"><button class="${scheduleMode==='today'?'selected':''}" data-action="schedule-preset" data-value="today">Сегодня</button><button class="${scheduleMode==='tomorrow'?'selected':''}" data-action="schedule-preset" data-value="tomorrow">Завтра</button><button class="${scheduleView==='week'?'selected':''}" data-action="schedule-view" data-value="week">Вся неделя</button></div><div class="week-strip" aria-label="Выбор недели">${Array.from({length:6},(_,i)=>`<button class="${selectedWeek===i?'selected':''}" data-action="week" data-value="${i}">Неделя ${i+1}<span>${dateLabel(dateAt(i*7)).replace(' 2026 г.','')} – ${dateLabel(dateAt(i*7+6)).replace(' 2026 г.','')}</span></button>`).join('')}</div>${showingNext?'<div class="schedule-notice">Все занятия на сегодня завершены — показываем расписание следующего учебного дня.</div>':''}${scheduleView==='week'?`<div class="week">${dayNames.map((name,i)=>`<section class="card">${daySchedule(selectedWeek,i)}</section>`).join('')}</div>`:outside?'<section class="card"><p class="empty">На эту дату нет расписания. Выберите одну из шести учебных недель.</p></section>':`<section class="card">${daySchedule(selectedWeek,selectedDay)}</section>`}`;
}
function studyPage() {
  const passed=disciplines.filter(s=>s.credit==='Зачёт').length;
  return title('Моя успеваемость','Оценки за семестр, результаты сессии и зачёты')+`<div class="metric-grid"><button class="card metric ${studyTab==='grades'?'selected':''}" data-action="study-tab" data-value="grades"><h2>Оценки за семестр</h2><strong>${semesterAverage()}</strong><div class="row"><small>Оценки преподавателей<br>за занятия и работы</small><span>↗</span></div></button><button class="card metric ${studyTab==='session'?'selected':''}" data-action="study-tab" data-value="session"><h2>Экзамены</h2><strong>—</strong><div class="row"><small>Экзамены в текущем семестре<br>Результаты и пересдачи</small><span>↗</span></div></button><button class="card metric ${studyTab==='credits'?'selected':''}" data-action="study-tab" data-value="credits"><h2>Зачёты</h2><strong>${passed} / ${disciplines.length}</strong><div class="row"><small>Полученные зачёты<br>и допуск к сессии</small><span>↗</span></div></button></div>${studyTab?`<section class="card"><h2>${{grades:'Оценки в течение семестра',session:'Экзамены и результаты',credits:'Результаты зачётов'}[studyTab]}</h2>${studyTab==='grades'?semesterTable():studyTab==='session'?sessionResults():creditsTable(false)}</section>`:''}${admissionWidget()}`;
}
function semesterTable() {
  return `<div class="table-wrap"><table><thead><tr><th>Дисциплина / преподаватель</th><th>Оценки и даты</th><th>Средняя</th></tr></thead><tbody>${disciplines.map(s=>`<tr><td>${s.name}<p class="muted">${s.teacher}</p></td><td>${s.grades.map(g=>`<span class="score">${g[0]}<small>${g[1]}</small></span>`).join('')}</td><td>${(s.grades.reduce((a,g)=>a+Number(g[0]),0)/s.grades.length).toFixed(1).replace('.',',')}</td></tr>`).join('')}</tbody></table></div>`;
}
function termButtons() { return `<div class="toolbar"><button class="${sessionTerm==='winter'?'selected':''}" data-action="term" data-value="winter">Зима 2026/27</button><button class="${sessionTerm==='summer'?'selected':''}" data-action="term" data-value="summer">Лето 2026 · архив</button></div>`; }
function sessionResults() {
  const list=sessionTerm==='winter'?disciplines.map(s=>({name:s.name,grade:s.examGrade,date:s.examDate})):pastExams;
  return termButtons()+`<div class="table-wrap"><table><thead><tr><th>Дисциплина</th><th>Дата экзамена</th><th>Оценка за сессию</th></tr></thead><tbody>${list.map(s=>`<tr><td>${s.name}</td><td>${dateLabel(s.date,Boolean(s.date&&s.date.includes('T')))}</td><td>${statusBadge(s.grade||'—')}</td></tr>`).join('')}</tbody></table></div><p class="context-note">«—» — экзамен ещё не сдавался. «Пересдача» — требуется повторная сдача.</p>`;
}
function creditsTable(includeDate=true) {
  return `<div class="table-wrap"><table><thead><tr><th>Дисциплина</th>${includeDate?'<th>Дата зачёта</th>':''}<th>Результат</th><th>Пересдача</th><th>Преподаватель</th></tr></thead><tbody>${disciplines.map(s=>`<tr><td>${s.name}</td>${includeDate?`<td>${dateLabel(s.creditDate,true)}</td>`:''}<td>${statusBadge(s.credit||'—')}</td><td>${s.credit==='Незачёт'?`<b class="retake-date">${dateLabel(s.retakeDate,true)}</b>`:'—'}</td><td>${s.teacher}</td></tr>`).join('')}</tbody></table></div><p class="context-note">«—» — зачёт ещё не проводился. Если результат «Незачёт», здесь указана дата пересдачи либо «Не назначено».</p>`;
}

function fileList(category) {
  const files=storedFiles.filter(file=>file.category===category);
  return files.length?files.map(file=>`<div class="file-row"><div class="file-info"><b>${escapeHtml(file.name)}</b><small>${escapeHtml(file.kind)} · ${(file.size/1024).toFixed(0)} КБ</small></div><div class="file-actions"><button class="link" data-action="download-file" data-id="${file.id}">Скачать</button><button class="link" data-action="remove-file" data-id="${file.id}" aria-label="Убрать ${escapeHtml(file.name)}">Убрать</button></div></div>`).join(''):'<p class="empty">Файлов пока нет. Можно добавить несколько документов и убрать любой позже.</p>';
}
const demoPersonalDocuments = [
  {id:'demo-passport',kind:'Паспорт',number:'45 08 731642',issuer:'ГУ МВД России · учебный пример',issueDate:'14.05.2022',status:'Данные подтверждены',demo:true},
  {id:'demo-snils',kind:'СНИЛС',number:'112-233-445 95',issuer:'Демонстрационная запись',issueDate:'02.09.2021',status:'Данные подтверждены',demo:true},
  {id:'demo-student',kind:'Студенческий билет',number:'МГ-26-04182',issuer:'Учебный отдел',issueDate:'01.09.2026',status:'Данные подтверждены',demo:true},
  {id:'demo-registration',kind:'Регистрация',number:'Запись № 2048 · учебный адрес',issuer:'Демонстрационная запись',issueDate:'01.09.2026',status:'Ожидает подтверждения',demo:true},
  {id:'demo-attestat',kind:'Аттестат',number:'АБ № 7629134',issuer:'Демонстрационная запись',issueDate:'30.06.2024',status:'Данные подтверждены',demo:true}
];
function personalDocuments() {
  const saved=readStore('personal-records',demoPersonalDocuments.map(item=>({...item})));
  return Array.isArray(saved)?saved:demoPersonalDocuments.map(item=>({...item}));
}
function savePersonalDocuments(items) { saveStore('personal-records',items); }
function documentStatusBadge(status) { return `<span class="status ${status==='Данные подтверждены'?'positive':'pending'}">${escapeHtml(status)}</span>`; }
function documentMark(kind) {
  const marks={'Паспорт':'Паспорт','СНИЛС':'СНИЛС','Студенческий билет':'Студенческий билет','Регистрация':'Регистрация','Аттестат':'Аттестат','Личные достижения':'Личные достижения','Медицинская справка':'Медицинская справка','Полис ОМС':'Полис ОМС','Военный билет':'Военный билет','Договор обучения':'Договор обучения','Фото 3×4':'Фото 3×4'};
  return `<span class="doc-symbol" aria-hidden="true">${marks[kind]||'ДОК'}</span>`;
}
function documentsPage() {
  const records=personalDocuments();
  const available=documentTypes.filter(kind=>!records.some(item=>item.kind===kind));
  const applications=allRequests().filter(r=>r.type==='doc'||r.type==='application');
  return title('Мои документы','Личные документы и учебные заявки')+`<section class="card request-launch request-and-applications"><div class="request-launch-copy"><span class="pill">ОНЛАЙН-СЕРВИС</span><h2>Что нужно оформить?</h2><p>Выберите учебный вопрос — откроется готовая заявка с адресатом, сроками и перечнем того, что нужно подготовить.</p><button class="button" data-action="choose-office">Подать заявку →</button></div></section><section class="card personal-documents-card section-gap"><div class="row"><div><h2>Личные документы</h2><p class="muted">Откройте карточку, чтобы посмотреть подробные реквизиты и статус проверки.</p></div><span class="pill">${records.length} документов</span></div><div class="personal-doc-grid">${records.map(item=>`<button class="personal-doc" data-action="view-document" data-id="${escapeHtml(item.id)}">${documentMark(item.kind)}<b>${escapeHtml(item.kind)}</b>${documentStatusBadge(item.status)}</button>`).join('')}</div><div class="add-document-row"><div><label for="personalKind">Добавить документ из списка</label><select id="personalKind">${available.map(kind=>`<option>${escapeHtml(kind)}</option>`).join('')||'<option value="">Все типы добавлены</option>'}</select></div><button class="button" data-action="add-document" ${available.length?'':'disabled'}>＋ Добавить</button></div><p class="context-note">Фото документа не требуется: достаточно указать его реквизиты.</p></section>`;
}
function documentDetailPage() {
  const item=personalDocuments().find(doc=>doc.id===selectedDocumentId);
  if(!item)return '<section class="card"><p>Документ не найден.</p></section>';
  return title(escapeHtml(item.kind),'Личные данные · карточка документа')+`<section class="card document-detail"><div class="document-preview"><h2>${escapeHtml(item.kind)}</h2><p class="document-number">${escapeHtml(item.number||'Реквизиты не заполнены')}</p><p class="muted">Изображение документа не загружено</p></div><div class="document-facts"><h2>Сведения</h2><dl class="details">${[['Тип документа',item.kind],['Номер',item.number||'Не указан'],['Кем выдан',item.issuer||'Не указано'],['Дата выдачи',item.issueDate||'Не указана'],['Статус',item.status],['Файл',item.attachmentName||'Не прикреплён']].map(([k,v])=>`<div><dt>${k}</dt><dd>${escapeHtml(v)}</dd></div>`).join('')}${item.attachmentId?`<div class="document-file-action"><dt>Прикреплённый файл</dt><dd><button class="link" data-action="view-file" data-id="${escapeHtml(item.attachmentId)}">Открыть файл ↗</button></dd></div>`:''}</dl><div class="verification-state">${documentStatusBadge(item.status)}<p>${item.status==='Данные подтверждены'?'Реквизиты подтверждены.':'Документ добавлен в профиль и ожидает проверки учебным отделом.'}</p></div><p class="context-note">Здесь отображаются реквизиты документа без фотографии.</p><div class="form-actions"><button class="button" data-action="edit-document" data-id="${escapeHtml(item.id)}">Изменить реквизиты</button><button class="link" data-action="remove-document" data-id="${escapeHtml(item.id)}">Удалить из профиля</button></div></div></section>`;
}
function officeChooser() {
  return title('Кому подать заявку','Выберите подразделение — откроется готовое письмо')+`<div class="office-grid">${offices.map(office=>`<section class="office-card"><h3>${office.name}</h3><p>${office.location}<br>${office.hours}</p><b>Что подготовить</b><ul>${office.requirements.map(item=>`<li>${item}</li>`).join('')}</ul><b>Когда получить</b><p>${office.pickup}</p><button class="button" data-action="new-letter" data-office="${office.id}">Заполнить заявление →</button></section>`).join('')}</div>`;
}
function requestRow(request) {
  return `<button class="request-row" data-action="request" data-id="${escapeHtml(request.id)}"><div class="row"><small>${escapeHtml(request.number||'Новая заявка')} · ${escapeHtml(request.date||'Сегодня')}</small>${statusBadge(request.status||'Принято')}</div><h3>${escapeHtml(request.title)}</h3><span class="muted">${offices.find(o=>o.id===request.office)?.name||'Приёмная деканата'} ↗</span></button>`;
}
function messagesPage() {
  return title('Связь с деканатом','Приёмная, ваши обращения и ответы')+`<div class="main-grid"><section class="hero span2"><span class="pill" style="color:#bfd4ed">ПРИЁМНАЯ ДЕКАНАТА</span><h2>Поможем с учебными вопросами</h2><p>Начните с готового письма. Ваши данные и адресат уже заполнены.</p><button class="button" data-action="new-letter" data-office="reception">Написать в приёмную ↗</button></section><section class="card span2"><h2>Часы приёма</h2><p>${offices[0].hours}</p><p class="muted">${offices[0].location}</p><p class="context-note">Онлайн-заявку можно создать в любое время.</p></section><section class="card span4"><h2>Ваши обращения</h2>${allRequests().filter(r=>r.type==='msg'||r.office==='reception').map(requestRow).join('')}</section></div>`;
}
function buildLetter(office, requestTitle) {
  return `В ${office.name.toLowerCase()}\nот ${student.name}\nстудента ${student.course} курса, группа ${student.group}\nфакультет ${student.faculty}\n\nЗаявление\n\n${office.intro} «${requestTitle}».\n\n[Дополните цель обращения, причину или место предоставления документа.]\n\n${office.ending}\n\n${student.name}`;
}
function startLetter(officeId, request=null) {
  activeOffice=officeId;
  activeRequest=request;
  const office=offices.find(item=>item.id===officeId)||offices[0];
  letterDraft={title:request?.title||office.types[0],text:request?.text||buildLetter(office,office.types[0]),email:student.email};
  selectedAttachments=[];
  go('letter');
}
function letterPage() {
  const office=offices.find(item=>item.id===activeOffice)||offices[0];
  const request=activeRequest;
  return title(request?'Обращение '+escapeHtml(request.number||''): 'Готовое заявление',office.name)+`<div class="letter"><section class="card">${request?`<div class="row"><span class="muted">${escapeHtml(request.date||'')}</span>${statusBadge(request.status||'Принято')}</div>${request.response?`<div class="success-panel section-gap"><b>Ответ приёмной</b><p>${escapeHtml(request.response)}</p></div>`:''}`:''}<form id="letterForm"><div class="field-grid"><div><label for="letterName">ФИО</label><input id="letterName" value="${escapeHtml(student.name)}" readonly></div><div><label for="letterGroup">Курс и группа</label><input id="letterGroup" value="${escapeHtml(student.course)} курс · ${escapeHtml(student.group)}" readonly></div></div><label for="letterEmail">Почта для связи</label><input id="letterEmail" type="email" required value="${escapeHtml(letterDraft.email)}" ${request?'readonly':''}><label for="letterType">Тема обращения</label>${request?`<input id="letterType" value="${escapeHtml(request.title)}" readonly>`:`<select id="letterType">${office.types.map(type=>`<option ${type===letterDraft.title?'selected':''}>${type}</option>`).join('')}</select>`}<label for="letterText">Текст заявления</label><textarea id="letterText" required maxlength="6000" ${request?'readonly':''}>${escapeHtml(letterDraft.text)}</textarea>${request?`${(request.attachments||[]).map(file=>`<div class="request-attachment">▤ ${escapeHtml(file.name)}${storedFiles.some(f=>f.id===file.id)?` <button type="button" class="link" data-action="download-file" data-id="${file.id}">Скачать</button>`:' · файл убран из хранилища'}</div>`).join('')}<div class="form-actions"><button type="button" class="button" data-action="reply" data-id="${escapeHtml(request.id)}">Новое письмо по этому вопросу</button>${!request.sample&&request.status==='Принято'?`<button type="button" class="link" data-action="cancel-request" data-id="request">Отменить заявку</button>`:''}</div>`:`<label for="letterFiles" class="dropzone">Прикрепить файлы к заявлению<input id="letterFiles" type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.txt"><small>До 10 МБ на файл</small></label><div id="letterAttachments"></div>${storedFiles.length?`<label for="existingFile">Добавить из моих документов</label><select id="existingFile"><option value="">Выберите файл</option>${storedFiles.map(f=>`<option value="${f.id}">${escapeHtml(f.kind)} · ${escapeHtml(f.name)}</option>`).join('')}</select>`:''}<p id="letterError" class="error" role="alert"></p><div class="form-actions"><button class="button" type="submit">Подать онлайн →</button><button class="link" type="button" data-action="save-draft">Сохранить черновик</button></div><p class="context-note">Заявка сохранит текст и появится в списке обращений.</p>`}</form></section><section class="card"><h2>Получатель</h2><h3>${office.name}</h3><p class="muted">${office.location}</p><h3>График работы</h3><p>${office.hours}</p><h3>Что подготовить</h3><ul>${office.requirements.map(item=>`<li>${item}</li>`).join('')}</ul><h3>Когда получить</h3><p>${office.pickup}</p><p class="context-note">Ответ появится в личном кабинете после обработки заявки.</p></section></div>`;
}
const notificationCategories={schedule:'Расписание',requests:'Заявки',grades:'Успеваемость'};
function notificationsPage() {
  const items=notifications.filter(item=>notificationFilter==='all'||(notificationFilter==='unread'?!readIds.has(item.id):item.category===notificationFilter));
  return title('Уведомления',`${unreadCount()} непрочитанных · всё важное об учёбе`)+`<div class="toolbar"><button data-action="notification-filter" data-value="all" class="${notificationFilter==='all'?'selected':''}">Все</button><button data-action="notification-filter" data-value="unread" class="${notificationFilter==='unread'?'selected':''}">Непрочитанные</button>${Object.entries(notificationCategories).map(([id,name])=>`<button class="${notificationFilter===id?'selected':''}" data-action="notification-filter" data-value="${id}">${name}</button>`).join('')}<button data-action="read-all">Прочитать все</button></div><section class="card">${items.map(item=>`<article class="notification-item ${readIds.has(item.id)?'read-item':'unread'}"><div class="row"><span class="pill">${notificationCategories[item.category]||'Кампус'}</span><small class="muted">${escapeHtml(item.date)}</small></div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.text)}</p><div class="row"><button class="link" data-action="open-notification" data-id="${item.id}">Открыть →</button>${readIds.has(item.id)?'<span class="muted">Прочитано</span>':`<button class="link" data-action="read-notification" data-id="${item.id}">Отметить прочитанным</button>`}</div></article>`).join('')||'<p class="empty">Здесь пока нет уведомлений.</p>'}</section>`;
}
function profilePage() {
  const choice=readStore('campus-notification-choice',null);
  const notificationState=choice==='enabled'&&'Notification' in window&&Notification.permission==='granted'?'Разрешены':choice==='disabled'?'Отключены':'Не включены';
  return title('Мой профиль',escapeHtml(student.faculty))+`<div class="card"><dl class="details">${[['ФИО',student.name],['Факультет',student.faculty],['Направление',student.direction],['Курс',student.course],['Группа',student.group],['Почта',student.email]].map(([name,value])=>`<div><dt>${name}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')}</dl><div class="profile-line"><h3>Уведомления браузера · ${notificationState}</h3><p class="muted">Все учебные события всегда доступны в разделе «Уведомления».</p><div class="toolbar"><button data-action="notification-settings">Настроить уведомления</button><button data-action="notifications-off">Отключить уведомления браузера</button></div></div><div class="form-actions"><button class="button" data-action="new-letter" data-office="reception">Написать об изменении данных</button><button class="link" data-action="logout">Выйти</button></div></div>`;
}
// Public registration disabled by campus update.
function loginPage() {
  if (authBusy) return '<section class="card login"><h1>Проверяем вход…</h1></section>';
  return `<section class="card login"><span class="pill">МГИМО · МОЙ КАМПУС</span><h1>Вход в кабинет</h1><form id="authForm">
    <label for="username">Логин</label><input id="username" name="username" required minlength="1" maxlength="1024" autocomplete="username">
    <label for="password">Пароль</label><input id="password" name="password" type="password" required autocomplete="current-password">
    <p id="authError" role="alert">${escapeHtml(authMessage)}</p>
    <button class="button" type="submit">Войти</button></form>
    <p class="context-note">Используйте логин и пароль, выданные администратором.</p></section>`;
}

function render() {
  document.body.classList.toggle('signed-out',!entered);
  renderNavigation();
  if (!entered) { content.innerHTML=loginPage();bindAuthForm();return; }
  const pages={home:homePage,schedule:schedulePage,study:studyPage,docs:documentsPage,documentDetail:documentDetailPage,offices:officeChooser,messages:messagesPage,letter:letterPage,notifications:notificationsPage,profile:profilePage};
  content.innerHTML=(pages[page]||homePage)();
  prepareMobileContent();
  renderMobileNavigation();
  updateLessonStates();
  if (page==='letter') bindLetterForm();
}

// Адаптивный интерфейс подключается вместе с приложением — отдельный CSS не нужен.
function installMobileLayout() {
  let viewport = document.querySelector('meta[name="viewport"]');
  if (!viewport) {
    viewport = document.createElement('meta');
    viewport.name = 'viewport';
    document.head.appendChild(viewport);
  }
  // Масштабирование жестом остаётся доступным.
  viewport.content = 'width=device-width, initial-scale=1, viewport-fit=cover';

  if (!$('#campus-mobile-styles')) {
    const style = document.createElement('style');
    style.id = 'campus-mobile-styles';
    style.textContent = `
      :root {
        --campus-mobile-surface: #f8fafc;
        --campus-mobile-ink: #173f68;
        --campus-mobile-muted: #53677a;
        --campus-mobile-selected: #e6eef5;
        --campus-mobile-border: #dce5ed;
        --campus-mobile-document: #eef2f5;
      }
      [data-theme="dark"] {
        --campus-mobile-surface: #182535;
        --campus-mobile-ink: #e5eef6;
        --campus-mobile-muted: #b4c5d4;
        --campus-mobile-selected: #2a4158;
        --campus-mobile-border: #33495d;
        --campus-mobile-document: #203246;
      }
      .campus-mobile-bar, #campus-mobile-menu:not([open]) { display: none; }
      #campus-mobile-menu {
        box-sizing: border-box;
        width: min(440px, calc(100% - 24px));
        max-height: calc(100dvh - 48px);
        padding: 20px;
        border: 1px solid var(--campus-mobile-border);
        border-radius: 22px;
        color: var(--campus-mobile-ink);
        background: var(--campus-mobile-surface);
        overflow: auto;
        overscroll-behavior: contain;
      }
      #campus-mobile-menu::backdrop { background: rgba(13, 25, 39, .48); }
      #campus-mobile-menu .mobile-menu-heading {
        display: flex; align-items: center; justify-content: space-between; gap: 12px;
      }
      #campus-mobile-menu h2 { margin: 0; font-size: 21px; }
      #campus-mobile-menu button {
        box-sizing: border-box; min-height: 48px; min-width: 44px;
        padding: 12px; font: inherit; color: inherit;
        border: 0; border-radius: 12px; background: transparent; cursor: pointer;
      }
      #campus-mobile-menu .mobile-menu-links { display: grid; gap: 4px; margin: 16px 0; }
      #campus-mobile-menu .mobile-menu-links button {
        display: flex; align-items: center; gap: 12px; width: 100%; text-align: left;
      }
      #campus-mobile-menu .mobile-menu-links .count { margin-left: auto; }
      #campus-mobile-menu button[aria-current="page"],
      #campus-mobile-menu button:hover { background: var(--campus-mobile-selected); }
      #campus-mobile-menu .mobile-menu-theme {
        width: 100%; border: 1px solid var(--campus-mobile-border); text-align: left;
      }
      .campus-mobile-bar button:focus-visible, #campus-mobile-menu button:focus-visible {
        outline: 2px solid var(--campus-mobile-ink); outline-offset: -3px;
      }
      @media (max-width: 768px) {
        html { min-width: 0 !important; scroll-padding-bottom: 100px; }
        body {
          display: block !important; min-width: 0 !important;
          width: 100%; margin: 0 !important; box-sizing: border-box;
        }
        nav, .campus-desktop-navigation { display: none !important; }
        .campus-content-shell {
          display: block !important; box-sizing: border-box;
          width: 100% !important; min-width: 0 !important; max-width: 100% !important;
          margin-inline: 0 !important; padding-inline: 0 !important;
          grid-template-columns: minmax(0, 1fr) !important;
        }
        .campus-header {
          box-sizing: border-box; width: 100%; max-width: 100%; min-width: 0;
          height: auto !important; min-height: 60px;
          margin-inline: 0 !important; padding: 12px 16px !important;
          padding-top: max(12px, env(safe-area-inset-top)) !important;
          flex-wrap: wrap; gap: 10px; overflow-wrap: anywhere;
        }
        .campus-header > * { min-width: 0; max-width: 100%; }
        .campus-header .name { overflow-wrap: anywhere; }
        #content {
          box-sizing: border-box; position: static !important;
          width: 100% !important; min-width: 0 !important; max-width: 100% !important;
          margin: 0 !important; padding: 20px 16px calc(100px + env(safe-area-inset-bottom)) !important;
          overflow-wrap: anywhere;
        }
        #content *, #content *::before, #content *::after { box-sizing: border-box; }
        #content > *, #content section, #content form, #content .subject,
        #content .request-launch-copy, #content .document-facts { min-width: 0; max-width: 100%; }
        #content h1 { font-size: clamp(25px, 6.7vw, 32px); line-height: 1.2; }
        #content h2 { font-size: 20px; line-height: 1.3; }
        #content h3 { font-size: 17px; line-height: 1.35; }
        #content .lead { font-size: 15px; line-height: 1.5; }
        #content .main-grid, #content .metric-grid, #content .news-grid,
        #content .office-grid, #content .week, #content .letter,
        #content .field-grid, #content .document-detail {
          display: grid !important; grid-template-columns: minmax(0, 1fr) !important;
          gap: 14px !important;
        }
        #content .span2, #content .span4, #content .news-full {
          grid-column: 1 / -1 !important; grid-row: auto !important;
        }
        #content .card, #content .office-card { padding: 18px; border-radius: 18px; }
        #content .hero { padding: 24px 20px; border-radius: 20px; }
        #content .hero h2 { font-size: clamp(25px, 7vw, 34px); }
        #content .big { font-size: 38px; }
        #content .big small { display: block; font-size: 14px; }
        #content .row, #content .form-actions, #content .toolbar,
        #content .file-row, #content .file-actions {
          display: flex; flex-wrap: wrap; gap: 10px; min-width: 0;
        }
        #content .row > *, #content .form-actions > *, #content .toolbar > * { min-width: 0; }
        #content button, #content .button, #themeToggle, #headerCount {
          min-height: 44px; touch-action: manipulation;
        }
        #content button { max-width: 100%; white-space: normal; }
        #content .form-actions > *, #content .toolbar > button { flex: 1 1 auto; }
        #content input:not([type="checkbox"]):not([type="radio"]),
        #content select, #content textarea {
          display: block; width: 100% !important; min-width: 0 !important;
          max-width: 100%; min-height: 48px; font-size: 16px !important;
        }
        #content textarea { min-height: 180px; }
        #content label { display: block; margin-bottom: 8px; }
        #content .dropzone { width: 100%; padding: 18px 14px; }
        #content input[type="file"] { min-height: 44px; font-size: 14px !important; }
        #content .week-strip {
          display: flex !important; flex-wrap: nowrap; gap: 10px;
          max-width: 100%; overflow-x: auto; padding: 4px 0 12px;
          scroll-snap-type: x proximity; overscroll-behavior-x: contain;
        }
        #content .week-strip > button {
          flex: 0 0 146px; scroll-snap-align: start; min-height: 64px;
        }
        #content .class-row {
          display: grid; grid-template-columns: 62px minmax(0, 1fr);
          align-items: start; gap: 12px; padding: 16px 0;
        }
        #content .class-row time { width: auto; min-width: 0; font-size: 17px; }
        #content .class-row time small, #content .class-state { display: block; }
        #content .class-state { font-size: 11px; line-height: 1.4; }
        #content .subject h3 { margin: 8px 0; }
        #content .subject p { font-size: 14px; line-height: 1.5; }
        #content .pill, #content .status { max-width: 100%; white-space: normal; line-height: 1.4; }
        #content .day-heading { display: flex; flex-wrap: wrap; gap: 6px; }
        #content .table-wrap {
          width: 100%; min-width: 0; max-width: 100%; overflow-x: auto;
          overscroll-behavior-x: contain; -webkit-overflow-scrolling: touch;
        }
        #content .table-wrap table { min-width: 560px; width: 100%; }
        #content .details { margin: 0; }
        #content .details > div {
          display: grid; grid-template-columns: minmax(0, 1fr); gap: 4px; padding-block: 12px;
        }
        #content .details dd { margin: 0; overflow-wrap: anywhere; }
        #content .personal-documents-card .personal-doc-grid {
          grid-template-columns: minmax(0, 1fr) !important; gap: 12px;
        }
        #content .personal-documents-card .personal-doc {
          width: 100%; min-height: 112px; padding: 16px;
          background: var(--campus-mobile-document) !important; color: var(--campus-mobile-ink);
        }
        #content .personal-documents-card .add-document-row {
          grid-template-columns: minmax(0, 1fr); gap: 14px;
          margin-top: 24px; padding-top: 20px;
        }
        #content .add-document-row label { margin-bottom: 10px; }
        #content .add-document-row .button { width: 100%; white-space: normal; }
        #content .request-launch { display: block; padding: 22px 18px; }
        #content .request-launch .button { width: 100%; margin-top: 8px; }
        #content .document-preview { min-width: 0; padding: 18px; }
        #content .document-number { overflow-wrap: anywhere; font-size: 21px; }
        #content .request-row, #content .notification-item { width: 100%; text-align: left; }
        #content .login { width: 100%; max-width: 440px; margin-inline: auto; }
        #content img, #content video, #content iframe { max-width: 100%; }
        .campus-mobile-bar {
          box-sizing: border-box; position: fixed; z-index: 100;
          inset: auto 0 0; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 2px; padding: 8px max(8px, env(safe-area-inset-right))
            max(8px, env(safe-area-inset-bottom)) max(8px, env(safe-area-inset-left));
          border-top: 1px solid var(--campus-mobile-border);
          background: var(--campus-mobile-surface); color: var(--campus-mobile-ink);
          box-shadow: 0 -4px 20px rgba(12, 28, 44, .06);
        }
        .campus-mobile-bar button {
          position: relative; min-width: 0; min-height: 54px; display: flex;
          flex-direction: column; align-items: center; justify-content: center; gap: 5px;
          border: 0; border-radius: 12px; padding: 6px 2px;
          color: var(--campus-mobile-muted); background: transparent; font: inherit;
          font-size: clamp(11px, 3vw, 13px); line-height: 1.25; cursor: pointer; touch-action: manipulation;
        }
        .campus-mobile-bar .mobile-nav-icon { font-size: 22px; line-height: 1; }
        .campus-mobile-bar button[aria-current="page"],
        .campus-mobile-bar button[aria-expanded="true"] {
          color: var(--campus-mobile-ink); background: var(--campus-mobile-selected);
        }
        .campus-mobile-bar .mobile-unread {
          position: absolute; top: 5px; right: 16%; width: 7px; height: 7px;
          border-radius: 50%; background: #be5239;
        }
        body.signed-out .campus-mobile-bar { display: none; }
        body.signed-out #content { padding-bottom: 24px !important; }
        body.campus-mobile-menu-open { overflow: hidden; }
        #consentDialog {
          box-sizing: border-box; width: calc(100% - 32px); max-width: 440px;
          max-height: calc(100dvh - 48px); overflow-y: auto; padding: 22px;
        }
        #consentDialog .toolbar { display: flex; flex-direction: column; gap: 10px; }
        #consentDialog button { min-height: 48px; width: 100%; }
        #toast {
          box-sizing: border-box; left: 16px; right: 16px;
          bottom: calc(90px + env(safe-area-inset-bottom));
          max-width: calc(100% - 32px); width: auto; transform: none; overflow-wrap: anywhere;
        }
      }
      @media (hover: none) {
        .hero:hover, .hero:active, .semester-module:hover, .semester-module:active,
        .main-grid > .card:hover, .main-grid > .card:active,
        .news-item:hover, .news-item:active, .personal-doc:hover, .personal-doc:active {
          filter: none !important; transform: none !important;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        #content *, .campus-mobile-bar *, #campus-mobile-menu * {
          animation: none !important; transition: none !important; scroll-behavior: auto !important;
        }
        #content .hero, #content .card, #content .news-item, #content .personal-doc {
          filter: none !important; transform: none !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  const contentElement = $('#content');
  // Снимаем ширину боковой колонки на мобильном, не меняя разметку index.html.
  for (let shell = contentElement?.parentElement; shell && shell !== document.body; shell = shell.parentElement) {
    shell.classList.add('campus-content-shell');
  }
  const desktopNav = $('nav');
  if (desktopNav) {
    let sidebar = desktopNav.closest('aside, .sidebar, .side-panel');
    if (!sidebar) {
      sidebar = desktopNav;
      while (sidebar.parentElement && sidebar.parentElement !== document.body &&
        !sidebar.parentElement.contains(contentElement) && !sidebar.parentElement.matches('header')) {
        sidebar = sidebar.parentElement;
      }
    }
    if (!sidebar.contains(contentElement)) sidebar.classList.add('campus-desktop-navigation');
  }
  ($('#headerCount')?.closest('header') || document.querySelector('header'))?.classList.add('campus-header');

  if (!$('#campus-mobile-bar')) {
    const bar = document.createElement('div');
    bar.id = 'campus-mobile-bar';
    bar.className = 'campus-mobile-bar';
    bar.setAttribute('role', 'navigation');
    bar.setAttribute('aria-label', 'Основные разделы');
    document.body.appendChild(bar);

    const menu = document.createElement('dialog');
    menu.id = 'campus-mobile-menu';
    menu.setAttribute('aria-labelledby', 'campus-mobile-menu-title');
    document.body.appendChild(menu);
    menu.addEventListener('close', () => {
      document.body.classList.remove('campus-mobile-menu-open');
      $('#campus-mobile-bar [data-action="mobile-menu"]')?.setAttribute('aria-expanded', 'false');
    });
    menu.addEventListener('click', event => {
      if (event.target === menu) {
        const rect = menu.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right ||
          event.clientY < rect.top || event.clientY > rect.bottom) menu.close();
      }
    });
    const mobileQuery = window.matchMedia('(max-width: 768px)');
    const closeWhenDesktop = event => { if (!event.matches) closeMobileMenu(); };
    if (mobileQuery.addEventListener) mobileQuery.addEventListener('change', closeWhenDesktop);
    else if (mobileQuery.addListener) mobileQuery.addListener(closeWhenDesktop);
  }
}

function closeMobileMenu() {
  const menu = $('#campus-mobile-menu');
  if (menu?.open) menu.close();
}

function openMobileMenu() {
  if (!entered) return;
  const menu = $('#campus-mobile-menu');
  if (!menu || menu.open) return;
  menu.showModal();
  document.body.classList.add('campus-mobile-menu-open');
  $('#campus-mobile-bar [data-action="mobile-menu"]')?.setAttribute('aria-expanded', 'true');
}

function renderMobileNavigation() {
  const bar = $('#campus-mobile-bar');
  const menu = $('#campus-mobile-menu');
  if (!bar || !menu) return;
  if (!entered) { closeMobileMenu(); return; }
  const activePage = page === 'documentDetail' || page === 'offices' ? 'docs'
    : page === 'letter' ? (activeOffice === 'reception' ? 'messages' : 'docs') : page;
  const primary = ['home', 'schedule', 'study', 'docs'];
  const shortLabels = { schedule: 'Пары', study: 'Оценки' };
  const count = unreadCount();
  bar.innerHTML = sections.filter(([id]) => primary.includes(id)).map(([id, icon, label]) =>
    `<button type="button" aria-label="${label}" data-page="${id}"${activePage === id ? ' aria-current="page"' : ''}><span class="mobile-nav-icon" aria-hidden="true">${icon}</span><span>${shortLabels[id] || label}</span></button>`
  ).join('') + `<button type="button" data-action="mobile-menu" aria-label="Ещё разделы${count ? ', есть непрочитанные уведомления' : ''}" aria-controls="campus-mobile-menu" aria-expanded="${menu.open}"${primary.includes(activePage) ? '' : ' aria-current="page"'}><span class="mobile-nav-icon" aria-hidden="true">☰</span><span>Ещё</span>${count ? '<span class="mobile-unread" aria-hidden="true"></span>' : ''}</button>`;
  menu.innerHTML = `<div class="mobile-menu-heading"><h2 id="campus-mobile-menu-title">Мой кампус</h2><button type="button" data-action="close-mobile-menu" aria-label="Закрыть меню">✕</button></div><div class="mobile-menu-links">${sections.map(([id, icon, label]) =>
    `<button type="button" data-page="${id}"${activePage === id ? ' aria-current="page"' : ''}><span aria-hidden="true">${icon}</span><span>${label}</span>${id === 'notifications' && count ? `<span class="count" aria-label="${count} непрочитанных">${count}</span>` : ''}</button>`
  ).join('')}</div><button type="button" class="mobile-menu-theme" data-action="mobile-theme">${document.documentElement.dataset.theme === 'dark' ? '☀ Светлая тема' : '☾ Тёмная тема'}</button>`;
}

function prepareMobileContent() {
  document.querySelectorAll('#content .table-wrap').forEach(wrapper => {
    wrapper.tabIndex = 0;
    wrapper.setAttribute('role', 'region');
    wrapper.setAttribute('aria-label', 'Таблица успеваемости, прокрутите вправо для просмотра');
  });
}

let fileDatabase;
async function database() {
  if (fileDatabase) return fileDatabase;
  fileDatabase=await new Promise((resolve,reject)=>{
    const request=indexedDB.open('campus-documents-user-'+currentUserId,1);
    request.onupgradeneeded=()=>request.result.createObjectStore('files',{keyPath:'id'});
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  });
  return fileDatabase;
}
async function fileTransaction(mode, operation) {
  const db=await database();
  return new Promise((resolve,reject)=>{
    const transaction=db.transaction('files',mode);
    const request=operation(transaction.objectStore('files'));
    transaction.oncomplete=()=>resolve(request?.result);
    transaction.onerror=()=>reject(transaction.error);
    transaction.onabort=()=>reject(transaction.error||new Error('Операция прервана'));
  });
}
async function refreshFiles() {
  const ownerId=currentUserId;
  const files=await fileTransaction('readonly',store=>store.getAll());
  if(ownerId!==currentUserId)return;
  storedFiles=files.map(({blob,...metadata})=>metadata);
}
function validateFile(file) {
  if (file.size>10*1024*1024) return file.name+': размер больше 10 МБ.';
  if (!/\.(pdf|png|jpe?g|webp|docx?|txt)$/i.test(file.name)) return file.name+': неподдерживаемый формат.';
  return null;
}
async function saveFiles(files,category,kind) {
  const records=files.map(file=>({id:crypto.randomUUID(),name:file.name,size:file.size,type:file.type,kind,category,blob:file,createdAt:Date.now()}));
  await fileTransaction('readwrite',store=>{records.forEach(record=>store.put(record));});
  await refreshFiles();
  return records.map(({blob,...metadata})=>metadata);
}
function downloadBlob(blob,name) {
  const url=URL.createObjectURL(blob);
  const anchor=document.createElement('a');anchor.href=url;anchor.download=name;anchor.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function viewFile(id) {
  try {
    const file=await fileTransaction('readonly',store=>store.get(id));
    if (!file) return showToast('Файл уже убран из этого браузера.');
    const url=URL.createObjectURL(file.blob);
    const opened=window.open(url,'_blank','noopener,noreferrer');
    if (!opened) { downloadBlob(file.blob,file.name); showToast('Браузер заблокировал просмотр — файл скачан.'); }
    setTimeout(()=>URL.revokeObjectURL(url),60000);
  } catch { showToast('Не удалось открыть файл.'); }
}
async function downloadFile(id) {
  try {
    const file=await fileTransaction('readonly',store=>store.get(id));
    if (!file) return showToast('Файл уже убран из этого браузера.');
    downloadBlob(file.blob,file.name);
  } catch { showToast('Не удалось открыть файл.'); }
}
function attachList() {
  const container=$('#letterAttachments');
  if (!container) return;
  container.innerHTML=selectedAttachments.map((file,index)=>`<div class="file-row"><span>${escapeHtml(file.name)}</span><button type="button" class="link" data-action="remove-attachment" data-value="${index}">Убрать</button></div>`).join('');
}
function readLetterDraft() {
  letterDraft={title:$('#letterType').value,text:$('#letterText').value,email:$('#letterEmail').value};
}
function bindLetterForm() {
  if (activeRequest) return;
  $('#letterType').onchange=()=>{
    const office=offices.find(o=>o.id===activeOffice);
    const previousTemplate=buildLetter(office,letterDraft.title);
    const currentText=$('#letterText').value;
    if (currentText===previousTemplate) $('#letterText').value=buildLetter(office,$('#letterType').value);
    readLetterDraft();
  };
  $('#letterFiles').onchange=event=>{
    const files=[...event.target.files];
    const error=files.map(validateFile).find(Boolean);
    if (error) { showToast(error);event.target.value='';return; }
    selectedAttachments.push(...files);
    attachList();event.target.value='';
  };
  if ($('#existingFile')) $('#existingFile').onchange=event=>{
    const file=storedFiles.find(file=>file.id===event.target.value);
    if (file&&!selectedAttachments.some(attachment=>attachment.id===file.id)) selectedAttachments.push(file);
    attachList();event.target.value='';
  };
  $('#letterForm').onsubmit=async event=>{
    event.preventDefault();readLetterDraft();
    if (letterDraft.text.includes('[Дополните')) { $('#letterError').textContent='Замените текст в квадратных скобках деталями вашего обращения.';$('#letterText').focus();return; }
    if (!letterDraft.text.trim()) return;
    const button=event.submitter;button.disabled=true;button.textContent='Сохраняем…';
    try {
      const newFiles=selectedAttachments.filter(file=>file instanceof File);
      const saved=newFiles.length?await saveFiles(newFiles,'applications','Приложение к заявлению'):[];
      const attachments=[...selectedAttachments.filter(file=>!(file instanceof File)),...saved].map(file=>({id:file.id,name:file.name}));
      const request={id:crypto.randomUUID(),number:'Д-'+Date.now().toString().slice(-7),date:nowLabel(),title:letterDraft.title,text:letterDraft.text,email:letterDraft.email,office:activeOffice,type:activeOffice==='certificates'?'doc':activeOffice==='reception'?'msg':'application',status:'Принято',attachments};
      const next=[request,...requests];
      if (!saveStore('campus-requests',next)) throw new Error('Не удалось сохранить заявку');
      requests=next;
      try { localStorage.removeItem(storageKey('campus-draft-'+activeOffice)); } catch {}
      addNotification({category:'requests',title:'Заявка '+request.number+' зарегистрирована',text:'«'+request.title+'» сохранена в личном кабинете. Статус — принято.',target:'request',requestId:request.id});
      startLetter(activeOffice,request);showToast('Заявка принята.');
    } catch { $('#letterError').textContent='Не удалось сохранить заявку. Попробуйте ещё раз.';button.disabled=false;button.textContent='Подать онлайн →'; }
  };
}
async function requestNotificationPermission() {
  $('#consentDialog').close();
  if (!('Notification' in window)) {
    saveStore('campus-notification-choice','unsupported');showToast('Браузер не поддерживает системные уведомления. Все события доступны в кабинете.');return;
  }
  try {
    const permission=await Notification.requestPermission();
    saveStore('campus-notification-choice',permission==='granted'?'enabled':'disabled');
    showToast(permission==='granted'?'Уведомления браузера включены.':'Все события будут доступны в центре уведомлений.');
  } catch { showToast('Уведомления браузера недоступны. Центр уведомлений работает.'); }
  if(page==='profile') render();
}
$('#allowNotifications').onclick=requestNotificationPermission;
$('#skipNotifications').onclick=()=>{saveStore('campus-notification-choice','disabled');$('#consentDialog').close();if(page==='profile')render();};
$('#consentDialog').addEventListener('cancel',()=>saveStore('campus-notification-choice','disabled'));

const actions={
  'mobile-menu':()=>openMobileMenu(),
  'close-mobile-menu':()=>closeMobileMenu(),
  'mobile-theme':()=>{const theme=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=theme;try{localStorage.setItem('campus-theme',theme);}catch{}themeButton();renderMobileNavigation();},
  'back':()=>goBack(),
  'schedule-preset':button=>{scheduleMode=button.dataset.value;scheduleView='day';if(scheduleMode==='today'||scheduleMode==='tomorrow'){const offset=moscowDayOffset()+(scheduleMode==='tomorrow'?1:0);if(offset>=0&&offset<42){selectedWeek=Math.floor(offset/7);selectedDay=offset%7;}}render();},
  'add-document':()=>{
    const kind=$('#personalKind')?.value;
    if(!kind)return;
    const records=personalDocuments();
    if(records.some(item=>item.kind===kind))return showToast('Этот документ уже добавлен.');
    const input=document.createElement('input');
    input.type='file'; input.accept='.pdf,.png,.jpg,.jpeg,.webp,.doc,.docx'; input.hidden=true;
    input.onchange=async()=>{
      const file=input.files?.[0];
      input.remove();
      if(!file)return showToast('Чтобы добавить документ, выберите файл.');
      const error=validateFile(file);
      if(error)return showToast(error);
      try {
        const [saved]=await saveFiles([file],'personal',kind);
        const item={id:crypto.randomUUID(),kind,number:'Не заполнено',issuer:'Ожидает заполнения',issueDate:'—',status:'Ожидает подтверждения',attachmentId:saved.id,attachmentName:saved.name, demo:false};
        records.push(item); savePersonalDocuments(records); selectedDocumentId=item.id; go('documentDetail');
      } catch { showToast('Не удалось прикрепить файл. Попробуйте ещё раз.'); }
    };
    document.body.appendChild(input); input.click();
  },
  'view-document':button=>{selectedDocumentId=button.dataset.id;go('documentDetail');},
  'remove-document':button=>{savePersonalDocuments(personalDocuments().filter(item=>item.id!==button.dataset.id));go('docs');showToast('Документ удалён из профиля.');},
  'edit-document':button=>{const records=personalDocuments();const item=records.find(doc=>doc.id===button.dataset.id);if(!item)return;const number=prompt('Введите номер документа:',item.number||'');if(number===null)return;item.number=number.trim()||'Не заполнено';item.status='Ожидает подтверждения';savePersonalDocuments(records);render();showToast('Изменения сохранены. Документ ожидает подтверждения.');},
  'logout':logout,
  'choose-office':()=>go('offices'),
  'new-letter':button=>{
    const office=button.dataset.office;startLetter(office);
    const draft=readStore('campus-draft-'+office,null);
    if(draft){letterDraft=draft;render();showToast('Восстановлен сохранённый черновик.');}
  },
  'request':button=>{const request=allRequests().find(r=>r.id===button.dataset.id);if(request)startLetter(request.office,request);},
  'reply':button=>{const request=allRequests().find(r=>r.id===button.dataset.id);if(!request)return;startLetter(request.office);letterDraft.text=buildLetter(offices.find(o=>o.id===request.office),'обращение '+request.number+' — '+request.title);render();},
  'cancel-request':()=>{const next=requests.map(r=>r.id===activeRequest.id?{...r,status:'Отменено'}:r);persistRequests(next);activeRequest=requests.find(r=>r.id===activeRequest.id);render();},
  'save-draft':()=>{readLetterDraft();if(saveStore('campus-draft-'+activeOffice,letterDraft))showToast('Текст черновика сохранён. Новые файлы прикрепятся при подаче.');},
  'remove-attachment':button=>{selectedAttachments.splice(Number(button.dataset.value),1);attachList();},
  'download-file':button=>downloadFile(button.dataset.id),
  'view-file':button=>viewFile(button.dataset.id),
  'remove-file':async button=>{try{await fileTransaction('readwrite',store=>store.delete(button.dataset.id));await refreshFiles();render();showToast('Файл убран из документов.');}catch{showToast('Не удалось убрать файл.');}},
  
  'study-tab':button=>{studyTab=button.dataset.value;render();},
  'term':button=>{sessionTerm=button.dataset.value;render();},
  'week':button=>{selectedWeek=Number(button.dataset.value);scheduleMode='custom';render();},
  'day':button=>{selectedDay=Number(button.dataset.value);scheduleMode='custom';render();},
  'schedule-view':button=>{scheduleView=button.dataset.value;if(scheduleView==='week')scheduleMode='custom';render();},
  'today':()=>{scheduleMode='today';scheduleView='day';const offset=moscowDayOffset();if(offset>=0&&offset<42){selectedWeek=Math.floor(offset/7);selectedDay=offset%7;}render();},
  'notification-filter':button=>{notificationFilter=button.dataset.value;render();},
  'read-all':()=>{notifications.forEach(n=>readIds.add(n.id));saveStore('campus-read-v2',[...readIds]);render();},
  'read-notification':button=>{readIds.add(button.dataset.id);saveStore('campus-read-v2',[...readIds]);render();},
  'open-notification':button=>{
    const item=notifications.find(n=>n.id===button.dataset.id);if(!item)return;
    readIds.add(item.id);saveStore('campus-read-v2',[...readIds]);
    if(item.target==='request'){const request=allRequests().find(r=>r.id===item.requestId);if(request)startLetter(request.office,request);else go('messages');}
    else {if(item.target==='schedule'){selectedWeek=0;selectedDay=3;scheduleView='day';scheduleMode='custom';}if(item.target==='study')studyTab='grades';go(item.target);}
  },
  'notification-settings':()=>$('#consentDialog').showModal(),
  'notifications-off':()=>{saveStore('campus-notification-choice','disabled');render();showToast('Уведомления браузера отключены для кабинета.');}
};
document.addEventListener('click',event=>{
  const button=event.target.closest('button');
  if(!button)return;
  if(button.dataset.page){closeMobileMenu();go(button.dataset.page);return;}
  const action=actions[button.dataset.action];
  if(action)action(button);
});
document.addEventListener('change',async event=>{
  const input=event.target;
  if(!input.dataset.upload)return;
  const files=[...input.files];if(!files.length)return;
  const error=files.map(validateFile).find(Boolean);if(error){showToast(error);input.value='';return;}
  const category=input.dataset.upload,kind=category==='personal'?($('#personalFileKind')?.value||$('#personalKind')?.value||'Личные документы'):'Приложение к заявке';
  uploadBusy=true;input.disabled=true;
  try{await saveFiles(files,category,kind);showToast('Файлы прикреплены.');}
  catch{showToast('Не удалось сохранить файлы. Проверьте доступное место в браузере.');}
  finally{uploadBusy=false;if(page==='docs')render();}
});
window.addEventListener('storage',event=>{
  if(event.key==='campus-auth-change'){restoreSession();return;}
  if(event.key===storageKey('campus-read-v2'))readIds=new Set(readStore('campus-read-v2',[]));
  if(event.key===storageKey('campus-notifications-v2'))notifications=readStore('campus-notifications-v2',defaultNotifications);
  if(event.key===storageKey('campus-requests'))requests=readStore('campus-requests',[]);
  renderNavigation();if(page==='notifications')render();
});
setInterval(updateLessonStates,15000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)updateLessonStates();});
installMobileLayout();themeButton();render();restoreSession();


async function api(path, options = {}) {
  const response = await fetch('/api' + path, {
    credentials: 'same-origin',
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers }
  });
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(data.error || 'Ошибка запроса.'), { status: response.status });
  return data;
}

function resetAccountState() {
  if (fileDatabase) fileDatabase.close();
  fileDatabase = undefined;
  requests = [];
  notifications = [];
  readIds = new Set();
  storedFiles = [];
  selectedAttachments = [];
  activeRequest = null;
  letterDraft = null;
  if ($('#consentDialog').open) $('#consentDialog').close();
}

async function useProfile(data) {
  resetAccountState();
  currentUserId = data.user.id;
  const profile = data.profile || {};
  Object.assign(student, {
    name: profile.full_name || data.user.username,
    faculty: profile.faculty || 'Не указано',
    direction: profile.direction || 'Не указано',
    course: profile.course_year == null ? '—' : String(profile.course_year),
    group: profile.study_group || 'Не указана', email: ''
  });
  $('.name').textContent = student.name;
  $('.avatar').textContent = student.name.split(/\s+/).slice(0, 2).map(word => word[0]).join('');
  requests = readStore('campus-requests', []);
  notifications = readStore('campus-notifications-v2', defaultNotifications.map(item => ({ ...item })));
  readIds = new Set(readStore('campus-read-v2', []));
  entered = true;
  authBusy = false;
  page = 'home';
  render();
  try { await refreshFiles(); } catch { showToast('Хранилище тестовых файлов недоступно.'); }
  if (!readStore('campus-notification-choice', null)) $('#consentDialog').showModal();
}

// Preserve the login form during background session checks.
async function restoreSession() {
  const checkedUserId=currentUserId;
  const checkedEntered=entered;
  const sessionChanged=()=>currentUserId!==checkedUserId||entered!==checkedEntered;
  try {
    const data=await api('/me');
    if(sessionChanged())return;
    if(!entered||currentUserId!==data.user.id)await useProfile(data);
  } catch(error) {
    if(sessionChanged())return;
    // A repeated 401 must not redraw the login form while the user is typing.
    if(!entered&&!authBusy)return;
    if(error.status===401||!entered) {
      resetAccountState();currentUserId=null;entered=false;authBusy=false;
      authMessage=error.status===401?'':'Сервер недоступен. Запустите npm start и обновите страницу.';
      render();
    }
  }
}

function bindAuthForm() {
  const form = $('#authForm');
  if (!form) return;
  form.onsubmit = async event => {
    event.preventDefault();
    const button = event.submitter;button.disabled = true;
    const body = Object.fromEntries(new FormData(form));
    try {
      await api('/login', { method: 'POST', body: JSON.stringify(body) });
      await useProfile(await api('/me'));
      try { localStorage.setItem('campus-auth-change', String(Date.now())); } catch {}
    } catch (error) {
      $('#authError').textContent = error.message;
      button.disabled = false;
    }
  };
}

async function logout() {
  try { await api('/logout', { method: 'POST', body: '{}' }); }
  catch (error) { if (error.status !== 401) {showToast('Не удалось выйти. Проверьте соединение и повторите.');return;} }
  resetAccountState();currentUserId = null;entered = false;authBusy = false;authMessage = '';page = 'home';
  render();
  try { localStorage.setItem('campus-auth-change', String(Date.now())); } catch {}
}
window.addEventListener('focus', restoreSession);
setInterval(() => { if (entered && !document.hidden) restoreSession(); }, 60000);

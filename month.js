// ===== 首页月日历视图 =====

// ===== 常量 =====
const EVENTS_KEY = 'timeDiaryEvents';
const TODOS_KEY = 'timeDiaryTodos';
const RECURRING_KEY = 'timeDiaryRecurring';

/** 忙碌程度背景色阶：索引 = 事件数量，颜色由浅到深 */
const BUSY_COLORS = [
  '#FFFFFF', // 0 个事件：白色
  '#E8F0FE', // 1 个事件
  '#C5DAFC', // 2 个事件
  '#9FBFF9', // 3 个事件
  '#78A4F6', // 4 个事件
  '#4A90D9', // 5+ 个事件
];

/** 待办圆点最大显示数量 */
const MAX_DOTS = 3;

// ===== 状态 =====
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth(); // 0-11
let events = [];
let todos = [];
let recurring = [];                        // 循环模板数据

// ===== 工具函数 =====

/** 生成唯一ID */
function generateId() {
  return 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
}

/** 日期 → "YYYY-MM-DD" */
function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 获取某日的事件数量（普通事件 + 循环事件） */
function getEventCount(dateStr) {
  const regularCount = events.filter(e => e.date === dateStr && !e.recurringId).length;
  const recurringCount = getRecurringCountForDate(dateStr);
  return regularCount + recurringCount;
}

/** 获取某日的循环事件数量 */
function getRecurringCountForDate(dateStr) {
  const targetDate = parseDate(dateStr);
  const targetWeekDay = targetDate.getDay() === 0 ? 7 : targetDate.getDay();
  let count = 0;

  recurring.forEach(template => {
    if (template.weekDay !== targetWeekDay) return;
    if (dateStr < template.startDate || dateStr > template.endDate) return;
    // 检查是否有覆盖事件
    const override = events.find(e => e.recurringId === template.id && e.date === dateStr);
    if (override && override.deleted) return; // 已删除的本周课程不计入
    count++;
  });

  return count;
}

/** "YYYY-MM-DD" → Date 对象 */
function parseDate(str) {
  return new Date(str + 'T00:00:00');
}

/** 获取某日的未完成待办数量 */
function getTodoCount(dateStr) {
  return todos.filter(t => t.date === dateStr && !t.done).length;
}

/** 根据事件数量返回背景色 */
function getBusyColor(count) {
  const idx = Math.min(count, BUSY_COLORS.length - 1);
  return BUSY_COLORS[idx];
}

// ===== 数据读取 =====

function loadData() {
  try {
    events = JSON.parse(localStorage.getItem(EVENTS_KEY)) || [];
    todos = JSON.parse(localStorage.getItem(TODOS_KEY)) || [];
    recurring = JSON.parse(localStorage.getItem(RECURRING_KEY)) || [];
  } catch (e) {
    events = [];
    todos = [];
    recurring = [];
  }
}

// ===== 渲染 =====

/** 更新标题文字 */
function renderTitle() {
  document.getElementById('monthTitle').textContent =
    `${currentYear}年${currentMonth + 1}月`;
}

/** 更新周视图链接（跳转到今天所在的那一周） */
function renderWeekLink() {
  const today = new Date();
  const monday = getMonday(today);
  document.getElementById('weekLink').href =
    `week.html?date=${formatDate(monday)}`;
}

/** 获取指定日期的周一 */
function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

/** 渲染月历网格 */
function renderCalendar() {
  const calendar = document.getElementById('calendar');
  calendar.innerHTML = '';

  const todayStr = formatDate(new Date());

  // 计算月历起止：当月第一天是周几（周一=0）
  const firstDay = new Date(currentYear, currentMonth, 1);
  let startDow = firstDay.getDay() - 1; // 转为周一=0
  if (startDow < 0) startDow = 6; // 周日时设为6

  // 网格起始日期（上月补位）
  const gridStart = new Date(firstDay);
  gridStart.setDate(gridStart.getDate() - startDow);

  // 计算需要多少行（至少显示完整个月）
  const lastDay = new Date(currentYear, currentMonth + 1, 0); // 当月最后一天
  const totalDays = startDow + lastDay.getDate();
  const totalRows = Math.ceil(totalDays / 7);

  // 逐格生成 7 × totalRows 个日期格子
  const cursor = new Date(gridStart);
  for (let i = 0; i < totalRows * 7; i++) {
    const dateStr = formatDate(cursor);
    const isOtherMonth = cursor.getMonth() !== currentMonth;
    const isToday = dateStr === todayStr;

    const eventCount = getEventCount(dateStr);
    const todoCount = getTodoCount(dateStr);

    // 创建格子
    const cell = document.createElement('div');
    cell.className = 'day-cell'
      + (isOtherMonth ? ' other-month' : '')
      + (isToday ? ' today' : '');

    // 背景色 = 忙碌程度
    cell.style.backgroundColor = getBusyColor(eventCount);

    // 日期数字
    const numEl = document.createElement('span');
    numEl.className = 'day-num';
    numEl.textContent = cursor.getDate();
    cell.appendChild(numEl);

    // 待办圆点（仅当月日期且有待办时显示）
    if (todoCount > 0 && !isOtherMonth) {
      const dotsEl = document.createElement('div');
      dotsEl.className = 'dots';
      const dotCount = Math.min(todoCount, MAX_DOTS);
      for (let d = 0; d < dotCount; d++) {
        const dot = document.createElement('span');
        dot.className = 'dot';
        dotsEl.appendChild(dot);
      }
      cell.appendChild(dotsEl);
    }

    // 点击跳转到单日详情页
    cell.addEventListener('click', () => {
      window.location.href = `day.html?date=${dateStr}`;
    });

    calendar.appendChild(cell);

    // 日期 +1
    cursor.setDate(cursor.getDate() + 1);
  }
}

/** 完整渲染 */
function renderAll() {
  renderTitle();
  renderWeekLink();
  renderCalendar();
}

// ===== 月份导航 =====

function prevMonth() {
  currentMonth--;
  if (currentMonth < 0) {
    currentMonth = 11;
    currentYear--;
  }
  renderAll();
}

function nextMonth() {
  currentMonth++;
  if (currentMonth > 11) {
    currentMonth = 0;
    currentYear++;
  }
  renderAll();
}

function goToday() {
  const now = new Date();
  currentYear = now.getFullYear();
  currentMonth = now.getMonth();
  renderAll();
}

// ===== 初始化 =====

/** 导出全部日程数据为 JSON 备份文件 */
function exportData() {
  const data = {
    events: JSON.parse(localStorage.getItem(EVENTS_KEY) || '[]'),
    todos: JSON.parse(localStorage.getItem(TODOS_KEY) || '[]'),
    recurring: JSON.parse(localStorage.getItem(RECURRING_KEY) || '[]'),
    exportDate: new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const dateStr = formatDate(new Date());
  a.download = `time-diary-backup-${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function init() {
  loadData();
  renderAll();

  // 绑定导航按钮
  document.getElementById('prevMonth').addEventListener('click', prevMonth);
  document.getElementById('nextMonth').addEventListener('click', nextMonth);

  // 点击标题回到今天
  document.getElementById('monthTitle').addEventListener('click', goToday);

  // 导出备份按钮
  document.getElementById('exportBtn').addEventListener('click', exportData);
}

document.addEventListener('DOMContentLoaded', init);

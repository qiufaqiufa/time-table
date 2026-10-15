// ===== 周视图主逻辑 =====

// ===== 常量配置 =====
const STORAGE_KEY = 'timeDiaryEvents';
const RECURRING_KEY = 'timeDiaryRecurring';
const HOUR_HEIGHT = 60; // 每小时占 60px 高度
const COLORS = ['#4A90D9', '#E74C3C', '#2ECC71', '#F39C12', '#9B59B6', '#1ABC9C', '#E67E22', '#34495E'];
const DAY_NAMES = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

// ===== 工具函数 =====

/** 生成唯一 ID */
function generateId() {
  return 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
}

/** 生成循环模板 ID */
function generateRecurringId() {
  return 'rec_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
}

/** 日期 Date 对象 → "YYYY-MM-DD" 字符串 */
function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** "YYYY-MM-DD" → Date 对象 */
function parseDate(str) {
  return new Date(str + 'T00:00:00');
}

/** "HH:mm" → 从 0 点起的分钟数 */
function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

/** 分钟数 → 距网格顶部的像素值 */
function minutesToPx(minutes) {
  return (minutes / 60) * HOUR_HEIGHT;
}

/** 像素值 → 分钟数（向下取整到最近 30 分钟） */
function pxToMinutes(px) {
  const rawMinutes = (px / HOUR_HEIGHT) * 60;
  return Math.round(rawMinutes / 30) * 30;
}

/** 分钟数 → "HH:mm" */
function minutesToTime(minutes) {
  const h = String(Math.floor(minutes / 60)).padStart(2, '0');
  const m = String(minutes % 60).padStart(2, '0');
  return `${h}:${m}`;
}

/** 获取本周一的日期 */
function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // 周日时回退 6 天
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** 获取某日期是周几（1=周一，7=周日） */
function getWeekDay(dateStr) {
  const d = parseDate(dateStr);
  const day = d.getDay();
  return day === 0 ? 7 : day;
}

// ===== 状态管理 =====
let currentMonday = getMonday(new Date()); // 当前显示的周一日期
let events = [];                           // 普通事件数据
let recurring = [];                        // 循环模板数据
let editingEventId = null;                 // 当前正在编辑的事件 ID（null 表示新增模式）
let editingRecurringId = null;             // 当前正在编辑的循环模板 ID
let editingRecurringDate = null;           // 编辑循环实例时，记录该实例的日期
let isEditingRecurringInstance = false;    // 是否正在编辑循环实例（单周）
let selectedColor = COLORS[0];             // 弹窗中选中的颜色

// ===== 数据读写（localStorage） =====

/** 从 localStorage 加载普通事件 */
function loadEvents() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    events = raw ? JSON.parse(raw) : [];
  } catch (e) {
    events = [];
  }
}

/** 保存普通事件到 localStorage */
function saveEvents() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
}

/** 从 localStorage 加载循环模板 */
function loadRecurring() {
  try {
    const raw = localStorage.getItem(RECURRING_KEY);
    recurring = raw ? JSON.parse(raw) : [];
  } catch (e) {
    recurring = [];
  }
}

/** 保存循环模板到 localStorage */
function saveRecurring() {
  localStorage.setItem(RECURRING_KEY, JSON.stringify(recurring));
}

/** 获取循环模板在指定日期范围内的所有实例日期 */
function getRecurringInstances(template, weekStart, weekEnd) {
  const instances = [];
  const startDate = parseDate(template.startDate);
  const endDate = parseDate(template.endDate);
  const targetWeekDay = template.weekDay; // 1-7

  // 从 startDate 开始，找到第一个目标星期几
  let cursor = new Date(startDate);
  const cursorWeekDay = cursor.getDay() === 0 ? 7 : cursor.getDay();
  const daysToAdd = (targetWeekDay - cursorWeekDay + 7) % 7;
  cursor.setDate(cursor.getDate() + daysToAdd);

  // 遍历每个目标星期几，直到超过 endDate 或 weekEnd
  while (cursor <= endDate && cursor <= weekEnd) {
    const dateStr = formatDate(cursor);
    if (cursor >= weekStart) {
      const override = events.find(e => e.recurringId === template.id && e.date === dateStr);
      if (override && override.deleted) {
        // 本周已被手动删除，跳过
      } else {
        instances.push({
          date: dateStr,
          event: override || {
            id: template.id,
            date: dateStr,
            start: template.start,
            end: template.end,
            title: template.title,
            note: template.note,
            color: template.color,
            recurringId: template.id,
            isRecurring: true
          },
          isOverride: !!override && !override.deleted,
          template: template
        });
      }
    }
    cursor.setDate(cursor.getDate() + 7);
  }

  return instances;
}

// ===== 渲染函数 =====

/** 渲染星期标题行 */
function renderDayHeaders() {
  const container = document.getElementById('dayHeaders');
  container.innerHTML = '';
  const todayStr = formatDate(new Date());

  for (let i = 0; i < 7; i++) {
    const d = new Date(currentMonday);
    d.setDate(d.getDate() + i);
    const dateStr = formatDate(d);

    const cell = document.createElement('div');
    cell.className = 'day-header-cell' + (dateStr === todayStr ? ' today' : '');
    cell.innerHTML = `
      <span class="day-name">${DAY_NAMES[i]}</span>
      <span class="day-date">${d.getMonth() + 1}/${d.getDate()}</span>
    `;
    container.appendChild(cell);
  }
}

/** 渲染左侧时间刻度（0~23 点） */
function renderTimeGutter() {
  const gutter = document.getElementById('timeGutter');
  gutter.innerHTML = '';
  // 总高度 = 24 小时 × 每小时像素
  gutter.style.height = (24 * HOUR_HEIGHT) + 'px';

  for (let h = 0; h < 24; h++) {
    const label = document.createElement('div');
    label.className = 'time-label';
    label.style.top = (h * HOUR_HEIGHT) + 'px';
    label.textContent = String(h).padStart(2, '0') + ':00';
    gutter.appendChild(label);
  }
}

/** 渲染七天事件列（空列 + 小时网格线） */
function renderDayColumns() {
  const container = document.getElementById('dayColumns');
  container.innerHTML = '';
  const todayStr = formatDate(new Date());

  for (let i = 0; i < 7; i++) {
    const d = new Date(currentMonday);
    d.setDate(d.getDate() + i);
    const dateStr = formatDate(d);

    const col = document.createElement('div');
    col.className = 'day-column' + (dateStr === todayStr ? ' today' : '');
    col.dataset.date = dateStr;
    col.dataset.dayIndex = i;
    container.appendChild(col);
  }

  // 设置列容器和时间刻度的总高度
  container.style.height = (24 * HOUR_HEIGHT) + 'px';
}

/** 在已渲染的列上绘制事件色块（普通事件 + 循环事件） */
function renderEvents() {
  // 先清除所有已有事件块
  document.querySelectorAll('.event-block').forEach(el => el.remove());

  // 计算当前周的起止日期
  const weekStart = new Date(currentMonday);
  const weekEnd = new Date(currentMonday);
  weekEnd.setDate(weekEnd.getDate() + 6);

  // 收集所有需要渲染的事件（按日期分组）
  const grouped = {};

  // 1. 普通事件（非循环覆盖事件）
  events.forEach(evt => {
    if (!evt.recurringId) {
      if (!grouped[evt.date]) grouped[evt.date] = [];
      grouped[evt.date].push({ ...evt, isRecurring: false });
    }
  });

  // 2. 循环事件实例
  recurring.forEach(template => {
    const instances = getRecurringInstances(template, weekStart, weekEnd);
    instances.forEach(inst => {
      if (!grouped[inst.date]) grouped[inst.date] = [];
      grouped[inst.date].push(inst.event);
    });
  });

  // 逐日渲染
  Object.keys(grouped).forEach(date => {
    const col = document.querySelector(`.day-column[data-date="${date}"]`);
    if (!col) return;

    const dayEvents = grouped[date].sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));

    // 计算重叠布局：为每个事件分配列号
    const columns = []; // columns[i] = 第 i 列中最后一个事件的结束分钟数
    const layoutMap = new Map();

    dayEvents.forEach(evt => {
      const startMin = timeToMinutes(evt.start);
      const endMin = timeToMinutes(evt.end);

      // 找一个该事件开始时已空闲的列
      let placed = false;
      for (let c = 0; c < columns.length; c++) {
        if (columns[c] <= startMin) {
          columns[c] = endMin;
          layoutMap.set(evt.id + '_' + evt.date, { col: c });
          placed = true;
          break;
        }
      }
      if (!placed) {
        layoutMap.set(evt.id + '_' + evt.date, { col: columns.length });
        columns.push(endMin);
      }
    });

    const totalCols = columns.length || 1;

    // 创建事件 DOM 元素
    dayEvents.forEach(evt => {
      const startMin = timeToMinutes(evt.start);
      const endMin = timeToMinutes(evt.end);
      const top = minutesToPx(startMin);
      const height = Math.max(minutesToPx(endMin - startMin), 20); // 最小高度 20px

      const layoutKey = evt.id + '_' + evt.date;
      const { col: colIndex } = layoutMap.get(layoutKey);
      const widthPercent = 100 / totalCols;
      const leftPercent = colIndex * widthPercent;

      const block = document.createElement('div');
      block.className = 'event-block';
      block.style.top = top + 'px';
      block.style.height = height + 'px';
      block.style.left = `calc(${leftPercent}% + 2px)`;
      block.style.width = `calc(${widthPercent}% - 4px)`;
      block.style.backgroundColor = evt.color || COLORS[0];

      block.innerHTML = `
        <div class="event-title">${escapeHtml(evt.title || '（无标题）')}</div>
        <div class="event-time">${evt.start} - ${evt.end}</div>
      `;

      // 点击事件块 → 打开编辑弹窗
      block.addEventListener('click', (e) => {
        e.stopPropagation();
        openModal('edit', evt);
      });

      col.appendChild(block);
    });
  });
}

/** HTML 转义，防止 XSS */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/** 更新顶部标题文字（显示日期范围） */
function updateTitle() {
  const sunday = new Date(currentMonday);
  sunday.setDate(sunday.getDate() + 6);
  const mStr = currentMonday.getMonth() + 1;
  const sStr = sunday.getMonth() + 1;
  document.getElementById('weekTitle').textContent =
    `${currentMonday.getFullYear()}年${mStr}月${currentMonday.getDate()}日 - ${sStr}月${sunday.getDate()}日`;
}

/** 完整重新渲染整个视图 */
function renderAll() {
  updateTitle();
  renderDayHeaders();
  renderTimeGutter();
  renderDayColumns();
  renderEvents();
}

// ===== 弹窗逻辑 =====

/** 打开弹窗
 *  @param {'create'|'edit'} mode  模式
 *  @param {object} eventData      事件数据（编辑时传入已有数据）
 *  @param {object} defaults       默认值（创建时传入 date/start）
 */
function openModal(mode, eventData = null, defaults = {}) {
  editingEventId = null;
  editingRecurringId = null;
  editingRecurringDate = null;
  isEditingRecurringInstance = false;
  const overlay = document.getElementById('modalOverlay');
  const modal = document.querySelector('.modal');
  const recurringCheck = document.getElementById('recurringCheck');
  const recurringOptions = document.getElementById('recurringOptions');
  const btnSave = document.getElementById('btnSave');
  const btnSaveWeek = document.getElementById('btnSaveWeek');

  if (mode === 'edit' && eventData) {
    // 检查是否是循环课程的实例（且尚未有覆盖事件）
    const isRecurringInstance = eventData.recurringId && !events.find(e => e.id === eventData.id && e.recurringId);

    if (isRecurringInstance) {
      const template = recurring.find(r => r.id === eventData.recurringId);
      if (template) {
        editingRecurringId = template.id;
        editingRecurringDate = eventData.date;
        isEditingRecurringInstance = true;
        document.getElementById('modalTitle').textContent = '编辑循环课程（本周）';
        document.getElementById('eventDate').value = eventData.date;
        document.getElementById('eventStart').value = eventData.start;
        document.getElementById('eventEnd').value = eventData.end;
        document.getElementById('eventTitleInput').value = eventData.title;
        document.getElementById('eventNote').value = eventData.note || '';
        selectedColor = eventData.color || COLORS[0];
        recurringCheck.checked = true;
        recurringOptions.style.display = 'block';
        document.getElementById('recurringEndDate').value = template.endDate;
        modal.classList.add('edit-mode');
        btnSaveWeek.style.display = 'inline-block';
        btnSave.style.display = 'none';
      }
    } else {
      // 普通事件（或已有覆盖的循环事件）
      editingEventId = eventData.id;
      document.getElementById('modalTitle').textContent = '编辑事件';
      document.getElementById('eventDate').value = eventData.date;
      document.getElementById('eventStart').value = eventData.start;
      document.getElementById('eventEnd').value = eventData.end;
      document.getElementById('eventTitleInput').value = eventData.title;
      document.getElementById('eventNote').value = eventData.note || '';
      selectedColor = eventData.color || COLORS[0];
      recurringCheck.checked = false;
      recurringOptions.style.display = 'none';
      modal.classList.add('edit-mode');
      btnSaveWeek.style.display = 'none';
      btnSave.style.display = 'inline-block';
    }
  } else {
    // 创建模式
    document.getElementById('modalTitle').textContent = '新增事件';
    document.getElementById('eventDate').value = defaults.date || formatDate(new Date());
    document.getElementById('eventStart').value = defaults.start || '09:00';
    document.getElementById('eventEnd').value = defaults.end || '10:00';
    document.getElementById('eventTitleInput').value = '';
    document.getElementById('eventNote').value = '';
    selectedColor = COLORS[0];
    recurringCheck.checked = false;
    recurringOptions.style.display = 'none';
    modal.classList.remove('edit-mode');
    btnSaveWeek.style.display = 'none';
    btnSave.style.display = 'inline-block';
  }

  renderColorPicker();
  overlay.classList.add('active');
}

/** 关闭弹窗 */
function closeModal() {
  document.getElementById('modalOverlay').classList.remove('active');
  editingEventId = null;
  editingRecurringId = null;
  editingRecurringDate = null;
  isEditingRecurringInstance = false;
}

/** 渲染颜色选择器圆点 */
function renderColorPicker() {
  const container = document.getElementById('colorPicker');
  container.innerHTML = '';
  COLORS.forEach(color => {
    const dot = document.createElement('div');
    dot.className = 'color-option' + (color === selectedColor ? ' selected' : '');
    dot.style.backgroundColor = color;
    dot.addEventListener('click', () => {
      selectedColor = color;
      renderColorPicker();
    });
    container.appendChild(dot);
  });
}

/** 保存弹窗中的事件（新增或更新） */
function saveEventFromModal() {
  const date = document.getElementById('eventDate').value;
  const start = document.getElementById('eventStart').value;
  const end = document.getElementById('eventEnd').value;
  const title = document.getElementById('eventTitleInput').value.trim();
  const note = document.getElementById('eventNote').value.trim();
  const isRecurring = document.getElementById('recurringCheck').checked;
  const endDate = document.getElementById('recurringEndDate').value;

  // 基本校验
  if (!date || !start || !end) {
    alert('请填写日期、开始和结束时间');
    return;
  }
  if (timeToMinutes(end) <= timeToMinutes(start)) {
    alert('结束时间必须晚于开始时间');
    return;
  }
  if (isRecurring && !endDate) {
    alert('请选择循环截止日期');
    return;
  }
  if (isRecurring && endDate < date) {
    alert('截止日期不能早于开始日期');
    return;
  }

  if (isEditingRecurringInstance) {
    // 编辑循环实例 → 创建/更新覆盖事件（仅影响本周）
    const existingOverride = events.find(e => e.recurringId === editingRecurringId && e.date === editingRecurringDate);
    if (existingOverride) {
      existingOverride.start = start;
      existingOverride.end = end;
      existingOverride.title = title;
      existingOverride.note = note;
      existingOverride.color = selectedColor;
      existingOverride.deleted = false;
    } else {
      events.push({
        id: generateId(),
        date: editingRecurringDate,
        start,
        end,
        title,
        note,
        color: selectedColor,
        recurringId: editingRecurringId,
        deleted: false
      });
    }
    saveEvents();

  } else if (editingEventId) {
    // 更新普通事件
    const idx = events.findIndex(e => e.id === editingEventId);
    if (idx !== -1) {
      events[idx] = { ...events[idx], date, start, end, title, note, color: selectedColor };
    }
    saveEvents();

  } else {
    // 新增事件
    if (isRecurring) {
      recurring.push({
        id: generateRecurringId(),
        weekDay: getWeekDay(date),
        startDate: date,
        endDate: endDate,
        start: start,
        end: end,
        title: title,
        note: note,
        color: selectedColor
      });
      saveRecurring();
    } else {
      events.push({
        id: generateId(),
        date,
        start,
        end,
        title,
        note,
        color: selectedColor
      });
      saveEvents();
    }
  }

  renderEvents();
  closeModal();
}

/** 删除当前编辑的事件或取消循环 */
function deleteEvent() {
  if (isEditingRecurringInstance) {
    // 编辑循环实例时：提供选择
    const choice = confirm('点击"确定"仅删除本周课程，点击"取消"后选择取消整个循环课程。');
    if (choice) {
      // 仅删除本周：创建 deleted 覆盖记录
      const existingOverride = events.find(e => e.recurringId === editingRecurringId && e.date === editingRecurringDate);
      if (existingOverride) {
        existingOverride.deleted = true;
      } else {
        events.push({
          id: generateId(),
          date: editingRecurringDate,
          recurringId: editingRecurringId,
          deleted: true
        });
      }
      saveEvents();
    } else {
      // 取消整个循环
      if (!confirm('确定取消整个循环课程吗？已手动修改的单周事件将保留。')) return;
      recurring = recurring.filter(r => r.id !== editingRecurringId);
      saveRecurring();
      // 同时清除相关的 deleted 覆盖记录
      events = events.filter(e => e.recurringId !== editingRecurringId || !e.deleted);
      saveEvents();
    }
  } else if (editingEventId) {
    if (!confirm('确定删除这个事件吗？')) return;
    events = events.filter(e => e.id !== editingEventId);
    saveEvents();
  }
  renderEvents();
  closeModal();
}

// ===== 网格点击事件（点击空白区域新增） =====

function setupGridClickHandler() {
  const dayColumnsContainer = document.getElementById('dayColumns');

  dayColumnsContainer.addEventListener('click', (e) => {
    // 如果点击的是事件块或其子元素，不处理（事件块有自己的 click handler）
    if (e.target.closest('.event-block')) return;

    // 确定点击的是哪一列（哪一天）
    const columns = document.querySelectorAll('.day-column');
    let clickedDate = null;

    columns.forEach(col => {
      const rect = col.getBoundingClientRect();
      if (e.clientX >= rect.left && e.clientX <= rect.right) {
        clickedDate = col.dataset.date;
      }
    });

    if (!clickedDate) return;

    // 计算点击位置对应的分钟数
    const gridBody = document.getElementById('gridBody');
    const columnsRect = dayColumnsContainer.getBoundingClientRect();
    const relativeY = e.clientY - columnsRect.top + gridBody.scrollTop;
    const minutes = pxToMinutes(relativeY);

    // 限制在 0~24h 范围内
    const clampedMin = Math.max(0, Math.min(minutes, 23 * 60 + 30));
    const startTime = minutesToTime(clampedMin);
    const endTime = minutesToTime(Math.min(clampedMin + 60, 24 * 60));

    openModal('create', null, { date: clickedDate, start: startTime, end: endTime });
  });
}

// ===== 周导航 =====

function setupNavigation() {
  document.getElementById('prevWeek').addEventListener('click', () => {
    currentMonday.setDate(currentMonday.getDate() - 7);
    renderAll();
    // 滚动到早上 8 点位置
    scrollToMorning();
  });

  document.getElementById('nextWeek').addEventListener('click', () => {
    currentMonday.setDate(currentMonday.getDate() + 7);
    renderAll();
    scrollToMorning();
  });

  document.getElementById('todayBtn').addEventListener('click', () => {
    currentMonday = getMonday(new Date());
    renderAll();
    scrollToMorning();
  });
}

/** 滚动到早上 8 点位置 */
function scrollToMorning() {
  const gridBody = document.getElementById('gridBody');
  gridBody.scrollTop = 8 * HOUR_HEIGHT;
}

// ===== 弹窗按钮事件 =====

function setupModalHandlers() {
  document.getElementById('btnSave').addEventListener('click', saveEventFromModal);
  document.getElementById('btnSaveWeek').addEventListener('click', saveEventFromModal);
  document.getElementById('btnCancel').addEventListener('click', closeModal);
  document.getElementById('btnDelete').addEventListener('click', deleteEvent);

  // 循环复选框切换
  document.getElementById('recurringCheck').addEventListener('change', (e) => {
    document.getElementById('recurringOptions').style.display = e.target.checked ? 'block' : 'none';
  });

  // 点击遮罩层关闭弹窗
  document.getElementById('modalOverlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
  });
}

// ===== 初始化 =====

function init() {
  // 读取 URL 参数，支持从月视图跳转过来时定位到指定周
  const params = new URLSearchParams(window.location.search);
  const dateParam = params.get('date');
  if (dateParam) {
    const parsed = new Date(dateParam + 'T00:00:00');
    if (!isNaN(parsed.getTime())) {
      currentMonday = getMonday(parsed);
    }
  }

  loadEvents();
  loadRecurring();
  renderAll();
  scrollToMorning();
  setupNavigation();
  setupGridClickHandler();
  setupModalHandlers();
}

document.addEventListener('DOMContentLoaded', init);

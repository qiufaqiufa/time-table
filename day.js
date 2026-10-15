// ===== 单日详情页主逻辑 =====

// ===== 常量 =====
const EVENTS_KEY = 'timeDiaryEvents';
const TODOS_KEY = 'timeDiaryTodos';
const RECURRING_KEY = 'timeDiaryRecurring';
const HOUR_HEIGHT = 60; // 每小时60px
const COLORS = ['#4A90D9', '#E74C3C', '#2ECC71', '#F39C12', '#9B59B6', '#1ABC9C', '#E67E22', '#34495E'];

// ===== 状态 =====
let currentDate = formatDate(new Date()); // 当前查看的日期 YYYY-MM-DD
let events = [];
let todos = [];
let recurring = [];                        // 循环模板数据
let editingEventId = null;
let editingRecurringId = null;             // 当前编辑的循环模板 ID
let editingRecurringDate = null;           // 编辑循环实例时，记录该实例的日期
let isEditingRecurringInstance = false;    // 是否正在编辑循环实例（单周）
let selectedColor = COLORS[0];
let editingTodoId = null; // 正在编辑文字的待办ID

// ===== 工具函数 =====

/** 生成唯一ID */
function generateId() {
  return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
}

/** Date → "YYYY-MM-DD" */
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

/** "HH:mm" → 从0点起的分钟数 */
function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

/** 分钟数 → "HH:mm" */
function minutesToTime(minutes) {
  const h = String(Math.floor(minutes / 60)).padStart(2, '0');
  const m = String(minutes % 60).padStart(2, '0');
  return `${h}:${m}`;
}

/** 分钟数 → 距顶部的像素值 */
function minutesToPx(minutes) {
  return (minutes / 60) * HOUR_HEIGHT;
}

/** 像素值 → 分钟数（吸附到最近30分钟） */
function pxToMinutes(px) {
  const raw = (px / HOUR_HEIGHT) * 60;
  return Math.round(raw / 30) * 30;
}

/** 日期格式化显示：2026年10月15日 周四 */
function formatDateDisplay(dateStr) {
  const d = parseDate(dateStr);
  const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${days[d.getDay()]}`;
}

/** HTML转义 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ===== 数据读写 =====

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

function saveEvents() {
  localStorage.setItem(EVENTS_KEY, JSON.stringify(events));
}

function saveTodos() {
  localStorage.setItem(TODOS_KEY, JSON.stringify(todos));
}

/** 获取循环模板在指定日期的实例（如果有） */
function getRecurringInstancesForDate(dateStr) {
  const instances = [];
  const targetDate = parseDate(dateStr);
  const targetWeekDay = targetDate.getDay() === 0 ? 7 : targetDate.getDay();

  recurring.forEach(template => {
    if (template.weekDay !== targetWeekDay) return;
    if (dateStr < template.startDate || dateStr > template.endDate) return;

    const override = events.find(e => e.recurringId === template.id && e.date === dateStr);
    if (override && override.deleted) return;

    instances.push(override || {
      id: template.id,
      date: dateStr,
      start: template.start,
      end: template.end,
      title: template.title,
      note: template.note,
      color: template.color,
      recurringId: template.id,
      isRecurring: true
    });
  });

  return instances;
}

// ===== 时间轴渲染 =====

/** 渲染24小时时间轴 */
function renderTimeline() {
  const timeline = document.getElementById('timeline');
  timeline.innerHTML = '';

  // 总高度 = 24小时
  const totalHeight = 24 * HOUR_HEIGHT;
  timeline.style.height = totalHeight + 'px';

  // 绘制小时刻度线和标签
  for (let h = 0; h < 24; h++) {
    // 刻度线
    const line = document.createElement('div');
    line.className = 'hour-line';
    line.style.top = (h * HOUR_HEIGHT) + 'px';
    timeline.appendChild(line);

    // 时间标签
    const label = document.createElement('div');
    label.className = 'time-label';
    label.style.top = (h * HOUR_HEIGHT) + 'px';
    label.textContent = String(h).padStart(2, '0') + ':00';
    timeline.appendChild(label);
  }

  // 如果是今天，绘制当前时间红线
  const todayStr = formatDate(new Date());
  if (currentDate === todayStr) {
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const nowLine = document.createElement('div');
    nowLine.className = 'now-line';
    nowLine.style.top = minutesToPx(nowMin) + 'px';
    timeline.appendChild(nowLine);
  }

  // 渲染当天的事件色块（普通事件 + 循环事件）
  const regularEvents = events
    .filter(e => e.date === currentDate && !e.recurringId)
    .map(e => ({ ...e, isRecurring: false }));

  const recurringInstances = getRecurringInstancesForDate(currentDate);

  const dayEvents = [...regularEvents, ...recurringInstances]
    .sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));

  // 计算重叠布局
  const columns = [];
  const layoutMap = new Map();

  dayEvents.forEach(evt => {
    const startMin = timeToMinutes(evt.start);
    const endMin = timeToMinutes(evt.end);

    let placed = false;
    for (let c = 0; c < columns.length; c++) {
      if (columns[c] <= startMin) {
        columns[c] = endMin;
        layoutMap.set(evt.id, { col: c });
        placed = true;
        break;
      }
    }
    if (!placed) {
      layoutMap.set(evt.id, { col: columns.length });
      columns.push(endMin);
    }
  });

  const totalCols = columns.length || 1;

  dayEvents.forEach(evt => {
    const startMin = timeToMinutes(evt.start);
    const endMin = timeToMinutes(evt.end);
    const top = minutesToPx(startMin);
    const height = Math.max(minutesToPx(endMin - startMin), 20);

    const { col: colIndex } = layoutMap.get(evt.id);
    const widthPercent = 100 / totalCols;
    const leftPercent = colIndex * widthPercent;

    const block = document.createElement('div');
    block.className = 'event-block';
    block.style.top = top + 'px';
    block.style.height = height + 'px';
    block.style.left = `calc(${leftPercent}% + 40px)`;
    block.style.width = `calc(${widthPercent}% - 44px)`;
    block.style.backgroundColor = evt.color || COLORS[0];

    block.innerHTML = `
      <div class="event-title">${escapeHtml(evt.title || '（无标题）')}</div>
      <div class="event-time">${evt.start} - ${evt.end}</div>
    `;

    block.addEventListener('click', (e) => {
      e.stopPropagation();
      openModal('edit', evt);
    });

    timeline.appendChild(block);
  });

  // 滚动到早上8点位置
  timeline.scrollTop = 8 * HOUR_HEIGHT;
}

// ===== 时间轴点击（空白区域新增事件） =====

function setupTimelineClick() {
  const timeline = document.getElementById('timeline');

  timeline.addEventListener('click', (e) => {
    // 点击事件块时不触发（事件块有自己的 handler）
    if (e.target.closest('.event-block')) return;

    const rect = timeline.getBoundingClientRect();
    const relativeY = e.clientY - rect.top + timeline.scrollTop;
    const minutes = pxToMinutes(relativeY);
    const clampedMin = Math.max(0, Math.min(minutes, 23 * 60 + 30));

    const startTime = minutesToTime(clampedMin);
    const endTime = minutesToTime(Math.min(clampedMin + 60, 24 * 60));

    openModal('create', null, { date: currentDate, start: startTime, end: endTime });
  });
}

// ===== 弹窗逻辑 =====

function openModal(mode, eventData = null, defaults = {}) {
  editingEventId = null;
  editingRecurringId = null;
  editingRecurringDate = null;
  isEditingRecurringInstance = false;
  const overlay = document.getElementById('modalOverlay');
  const modal = document.querySelector('.modal');

  if (mode === 'edit' && eventData) {
    // 检查是否是循环课程实例（且尚无覆盖事件）
    const isRecurringInstance = eventData.recurringId && !events.find(e => e.id === eventData.id && e.recurringId);

    if (isRecurringInstance) {
      const template = recurring.find(r => r.id === eventData.recurringId);
      if (template) {
        editingRecurringId = template.id;
        editingRecurringDate = eventData.date;
        isEditingRecurringInstance = true;
        document.getElementById('modalTitle').textContent = '编辑循环课程（当天）';
        document.getElementById('eventDate').value = eventData.date;
        document.getElementById('eventStart').value = eventData.start;
        document.getElementById('eventEnd').value = eventData.end;
        document.getElementById('eventTitleInput').value = eventData.title;
        document.getElementById('eventNote').value = eventData.note || '';
        selectedColor = eventData.color || COLORS[0];
        modal.classList.add('edit-mode');
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
      modal.classList.add('edit-mode');
    }
  } else {
    document.getElementById('modalTitle').textContent = '新增事件';
    document.getElementById('eventDate').value = defaults.date || currentDate;
    document.getElementById('eventStart').value = defaults.start || '09:00';
    document.getElementById('eventEnd').value = defaults.end || '10:00';
    document.getElementById('eventTitleInput').value = '';
    document.getElementById('eventNote').value = '';
    selectedColor = COLORS[0];
    modal.classList.remove('edit-mode');
  }

  renderColorPicker();
  overlay.classList.add('active');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('active');
  editingEventId = null;
  editingRecurringId = null;
  editingRecurringDate = null;
  isEditingRecurringInstance = false;
}

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

function saveEventFromModal() {
  const date = document.getElementById('eventDate').value;
  const start = document.getElementById('eventStart').value;
  const end = document.getElementById('eventEnd').value;
  const title = document.getElementById('eventTitleInput').value.trim();
  const note = document.getElementById('eventNote').value.trim();

  if (!date || !start || !end) {
    alert('请填写日期、开始和结束时间');
    return;
  }
  if (timeToMinutes(end) <= timeToMinutes(start)) {
    alert('结束时间必须晚于开始时间');
    return;
  }

  if (isEditingRecurringInstance) {
    // 编辑循环实例 → 创建/更新覆盖事件（仅影响当天）
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
    const idx = events.findIndex(e => e.id === editingEventId);
    if (idx !== -1) {
      events[idx] = { ...events[idx], date, start, end, title, note, color: selectedColor };
    }
    saveEvents();
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

  renderTimeline();
  closeModal();
}

function deleteEvent() {
  if (isEditingRecurringInstance) {
    const choice = confirm('点击"确定"仅删除当天课程，点击"取消"后选择取消整个循环课程。');
    if (choice) {
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
      if (!confirm('确定取消整个循环课程吗？已手动修改的单周事件将保留。')) return;
      recurring = recurring.filter(r => r.id !== editingRecurringId);
      localStorage.setItem(RECURRING_KEY, JSON.stringify(recurring));
      events = events.filter(e => e.recurringId !== editingRecurringId || !e.deleted);
      saveEvents();
    }
  } else if (editingEventId) {
    if (!confirm('确定删除这个事件吗？')) return;
    events = events.filter(e => e.id !== editingEventId);
    saveEvents();
  }
  renderTimeline();
  closeModal();
}

// ===== 待办渲染 =====

function renderTodos() {
  const list = document.getElementById('todoList');
  list.innerHTML = '';

  const dayTodos = todos
    .filter(t => t.date === currentDate)
    .sort((a, b) => (a.done - b.done)); // 未完成在前

  if (dayTodos.length === 0) {
    list.innerHTML = '<div class="empty-hint">暂无待办</div>';
    return;
  }

  dayTodos.forEach(todo => {
    const item = document.createElement('div');
    item.className = 'todo-item' + (todo.done ? ' done' : '');
    item.dataset.id = todo.id;

    // 复选框
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = todo.done;
    checkbox.addEventListener('change', () => {
      todo.done = checkbox.checked;
      saveTodos();
      renderTodos();
    });

    // 文字 / 编辑输入框
    let textOrInput;
    if (editingTodoId === todo.id) {
      textOrInput = document.createElement('input');
      textOrInput.type = 'text';
      textOrInput.className = 'todo-edit-input';
      textOrInput.value = todo.content;
      textOrInput.addEventListener('blur', () => {
        const newContent = textOrInput.value.trim();
        if (newContent) {
          todo.content = newContent;
          saveTodos();
        }
        editingTodoId = null;
        renderTodos();
      });
      textOrInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') textOrInput.blur();
      });
    } else {
      textOrInput = document.createElement('span');
      textOrInput.className = 'todo-text';
      textOrInput.textContent = todo.content;
    }

    // 操作按钮
    const actions = document.createElement('div');
    actions.className = 'todo-actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'btn-edit-todo';
    editBtn.textContent = '✎';
    editBtn.addEventListener('click', () => {
      editingTodoId = todo.id;
      renderTodos();
      // 自动聚焦输入框
      setTimeout(() => {
        const input = item.querySelector('.todo-edit-input');
        if (input) {
          input.focus();
          input.select();
        }
      }, 0);
    });

    const delBtn = document.createElement('button');
    delBtn.className = 'btn-del-todo';
    delBtn.textContent = '✕';
    delBtn.addEventListener('click', () => {
      todos = todos.filter(t => t.id !== todo.id);
      saveTodos();
      renderTodos();
    });

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);

    item.appendChild(checkbox);
    item.appendChild(textOrInput);
    item.appendChild(actions);
    list.appendChild(item);
  });
}

// ===== 新增待办 =====

function setupTodoInput() {
  const input = document.getElementById('todoInput');
  const btn = document.getElementById('addTodoBtn');

  function addTodo() {
    const content = input.value.trim();
    if (!content) return;

    todos.push({
      id: generateId(),
      date: currentDate,
      content,
      done: false
    });

    saveTodos();
    input.value = '';
    renderTodos();
  }

  btn.addEventListener('click', addTodo);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addTodo();
  });
}

// ===== 日期导航 =====

function updateTitle() {
  document.getElementById('dayTitle').textContent = formatDateDisplay(currentDate);
}

function prevDay() {
  const d = parseDate(currentDate);
  d.setDate(d.getDate() - 1);
  currentDate = formatDate(d);
  renderAll();
}

function nextDay() {
  const d = parseDate(currentDate);
  d.setDate(d.getDate() + 1);
  currentDate = formatDate(d);
  renderAll();
}

function goToday() {
  currentDate = formatDate(new Date());
  renderAll();
}

// ===== 完整渲染 =====

function renderAll() {
  updateTitle();
  renderTimeline();
  renderTodos();
}

// ===== 弹窗按钮事件 =====

function setupModalHandlers() {
  document.getElementById('btnSave').addEventListener('click', saveEventFromModal);
  document.getElementById('btnCancel').addEventListener('click', closeModal);
  document.getElementById('btnDelete').addEventListener('click', deleteEvent);

  document.getElementById('modalOverlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
  });
}

// ===== 初始化 =====

function init() {
  // 读取 URL 参数
  const params = new URLSearchParams(window.location.search);
  const dateParam = params.get('date');
  if (dateParam) {
    const parsed = parseDate(dateParam);
    if (!isNaN(parsed.getTime())) {
      currentDate = formatDate(parsed);
    }
  }

  loadData();
  renderAll();
  setupTimelineClick();
  setupTodoInput();
  setupModalHandlers();

  // 日期导航
  document.getElementById('prevDay').addEventListener('click', prevDay);
  document.getElementById('nextDay').addEventListener('click', nextDay);
  document.getElementById('dayTitle').addEventListener('click', goToday);
}

document.addEventListener('DOMContentLoaded', init);

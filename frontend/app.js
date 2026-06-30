// ── Auth guard ─────────────────────────────────────────────
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user') || 'null');
if (!token || !user) window.location.href = '/';

document.getElementById('userName').textContent = user.name;
document.getElementById('logoutBtn').onclick = () => {
  localStorage.clear();
  window.location.href = '/';
};

// ── Socket.io ──────────────────────────────────────────────
const socket = io({ auth: { token } });

socket.on('connect_error', (err) => {
  if (err.message === 'Invalid token' || err.message === 'Authentication required') {
    localStorage.clear();
    window.location.href = '/';
  }
});

socket.on('user:joined', ({ name }) => showNotice(`${name} joined the board`));
socket.on('user:left', ({ name }) => showNotice(`${name} left`));

// ── Task state ─────────────────────────────────────────────
let tasks = []; // local cache
let editingTaskId = null;

// ── API helpers ────────────────────────────────────────────
const api = async (method, path, body) => {
  const res = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined
  });
  if (res.status === 401 || res.status === 403) { localStorage.clear(); window.location.href = '/'; }
  return res.json();
};

// ── Load tasks ─────────────────────────────────────────────
async function loadTasks() {
  tasks = await api('GET', '/api/tasks');
  renderBoard();
}

// ── Render ─────────────────────────────────────────────────
function renderBoard() {
  ['todo', 'inprogress', 'done'].forEach(status => {
    const list = document.getElementById(`list-${status}`);
    list.innerHTML = '';
    tasks
      .filter(t => t.status === status)
      .sort((a, b) => a.position - b.position)
      .forEach(t => list.appendChild(createCard(t)));
  });
  initDragAndDrop();
}

function createCard(task) {
  const card = document.createElement('div');
  card.className = 'task-card';
  card.style.setProperty('--card-accent', { todo: '#8B92A3', inprogress: '#E08148', done: '#5C9777' }[task.status]);
  card.draggable = true;
  card.dataset.id = task.id;
  card.innerHTML = `
    <div class="card-id">#${String(task.id).padStart(3, '0')}</div>
    <div class="card-title">${escapeHtml(task.title)}</div>
    ${task.description ? `<div class="card-desc">${escapeHtml(task.description)}</div>` : ''}
    <div class="card-meta">by ${escapeHtml(task.creator_name || 'unknown')}</div>
  `;
  card.onclick = () => openModal(task);
  return card;
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Drag and drop ──────────────────────────────────────────
function initDragAndDrop() {
  document.querySelectorAll('.task-card').forEach(card => {
    card.addEventListener('dragstart', onDragStart);
    card.addEventListener('dragend', onDragEnd);
  });
  document.querySelectorAll('.column').forEach(col => {
    col.addEventListener('dragenter', onDragEnter);
    col.addEventListener('dragover', onDragOver);
    col.addEventListener('dragleave', onDragLeave);
    col.addEventListener('drop', onDrop);
  });
}

let draggedId = null;

function onDragStart(e) {
  draggedId = this.dataset.id;
  this.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}

function onDragEnd() {
  this.classList.remove('dragging');
  document.querySelectorAll('.task-list').forEach(l => l.classList.remove('drag-over'));
}

function onDragEnter(e) {
  e.preventDefault();
}

function onDragLeave(e) {
  if (e.target === this) {
    this.querySelector('.task-list').classList.remove('drag-over');
  }
}

function onDragOver(e) {
  e.preventDefault();
  this.querySelector('.task-list').classList.add('drag-over');
}

async function onDrop(e) {
  e.preventDefault();
  const list = this.querySelector('.task-list');
  list.classList.remove('drag-over');

  const newStatus = this.dataset.status;
  const taskId = parseInt(draggedId);
  const task = tasks.find(t => t.id === taskId);
  if (!task || task.status === newStatus) return;

  task.status = newStatus;
  renderBoard();

  const updated = await api('PATCH', `/api/tasks/${taskId}`, { status: newStatus });
  const idx = tasks.findIndex(t => t.id === taskId);
  if (idx !== -1) tasks[idx] = { ...tasks[idx], ...updated };

  socket.emit('task:updated', updated);
}

// ── Modal ──────────────────────────────────────────────────
document.getElementById('newTaskBtn').onclick = () => openModal(null);
document.getElementById('cancelTaskBtn').onclick = closeModal;
document.getElementById('modalOverlay').onclick = (e) => {
  if (e.target === document.getElementById('modalOverlay')) closeModal();
};

function openModal(task) {
  editingTaskId = task?.id || null;
  document.getElementById('modalTitle').textContent = task ? 'Edit ticket' : 'New ticket';
  document.getElementById('taskTitle').value = task?.title || '';
  document.getElementById('taskDesc').value = task?.description || '';
  document.getElementById('taskStatus').value = task?.status || 'todo';
  document.getElementById('deleteTaskBtn').classList.toggle('hidden', !task);
  document.getElementById('modalOverlay').classList.remove('hidden');
  document.getElementById('modalOverlay').classList.add('flex');
  document.getElementById('taskTitle').focus();
}

function closeModal() {
  document.getElementById('modalOverlay').classList.add('hidden');
  document.getElementById('modalOverlay').classList.remove('flex');
  editingTaskId = null;
}

document.getElementById('saveTaskBtn').onclick = async () => {
  const title = document.getElementById('taskTitle').value.trim();
  if (!title) return alert('Title is required');
  const body = {
    title,
    description: document.getElementById('taskDesc').value.trim(),
    status: document.getElementById('taskStatus').value
  };

  if (editingTaskId) {
    const updated = await api('PATCH', `/api/tasks/${editingTaskId}`, body);
    const idx = tasks.findIndex(t => t.id === editingTaskId);
    if (idx !== -1) tasks[idx] = { ...tasks[idx], ...updated };
    socket.emit('task:updated', updated);
  } else {
    const created = await api('POST', '/api/tasks', body);
    tasks.push(created);
    socket.emit('task:created', created);
  }

  renderBoard();
  closeModal();
};

document.getElementById('deleteTaskBtn').onclick = async () => {
  if (!confirm('Delete this task?')) return;
  await api('DELETE', `/api/tasks/${editingTaskId}`);
  tasks = tasks.filter(t => t.id !== editingTaskId);
  socket.emit('task:deleted', { id: editingTaskId });
  renderBoard();
  closeModal();
};

// ── Real-time Socket events ────────────────────────────────
socket.on('task:created', (task) => {
  if (!tasks.find(t => t.id === task.id)) tasks.push(task);
  renderBoard();
});

socket.on('task:updated', (task) => {
  const idx = tasks.findIndex(t => t.id === task.id);
  if (idx !== -1) tasks[idx] = { ...tasks[idx], ...task };
  renderBoard();
});

socket.on('task:deleted', ({ id }) => {
  tasks = tasks.filter(t => t.id !== id);
  renderBoard();
});

// ── Notice banner ──────────────────────────────────────────
function showNotice(msg) {
  const el = document.getElementById('onlineNotice');
  el.textContent = msg;
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.textContent = '', 3000);
}

// ── Init ───────────────────────────────────────────────────
loadTasks();
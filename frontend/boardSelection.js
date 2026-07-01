const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user') || 'null');
if (!token || !user) window.location.href = '/';

document.getElementById('logoutBtn').onclick = () => {
  localStorage.clear();
  window.location.href = '/';
};

const api = async (method, path, body) => {
  const res = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json();
  if (res.status === 401 || res.status === 403) {
    if (res.status === 401) { localStorage.clear(); window.location.href = '/'; }
  }
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
};

document.getElementById('openPersonalBtn').onclick = () => {
  window.location.href = '/board.html';
};

document.getElementById('joinTeamBtn').onclick = async () => {
  const code = document.getElementById('joinCodeInput').value.trim();
  const errEl = document.getElementById('joinError');
  errEl.textContent = '';
  if (!code) return;

  try {
    const team = await api('POST', '/api/teams/join', { join_code: code });
    await loadTeams();
    window.location.href = `/board.html?team_id=${team.id}`;
  } catch (err) {
    errEl.textContent = err.message;
  }
};

document.getElementById('createTeamBtn').onclick = async () => {
  const name = document.getElementById('newTeamInput').value.trim();
  const errEl = document.getElementById('createError');
  errEl.textContent = '';
  if (!name) return;

  try {
    const team = await api('POST', '/api/teams', { name });
    showJoinCodeModal(team);
    await loadTeams();
  } catch (err) {
    errEl.textContent = err.message;
  }
};

function showJoinCodeModal(team) {
  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 bg-black/70 flex items-center justify-center z-50';
  overlay.innerHTML = `
    <div class="bg-panel border border-paper/15 p-8 max-w-sm w-full mx-4 relative">
      <p class="font-mono text-xs text-paper/40 mb-2">// team created</p>
      <h2 class="font-display font-bold text-xl mb-1">${escapeHtml(team.name)}</h2>
      <p class="text-sm text-paper/55 mb-6">Share this code with your teammates so they can join.</p>
      <div class="bg-ink border border-paper/20 px-4 py-3 font-mono text-2xl tracking-[0.25em] text-rust text-center mb-2 select-all">
        ${team.join_code}
      </div>
      <p class="font-mono text-[11px] text-paper/35 text-center mb-6">click the code to select it</p>
      <button id="proceedBtn" class="w-full bg-paper text-ink font-mono text-sm py-2.5 hover:bg-rust transition-colors">Open Team Board</button>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  document.getElementById('proceedBtn').onclick = () => {
    window.location.href = `/board.html?team_id=${team.id}`;
  };
}

async function loadTeams() {
  const teams = await api('GET', '/api/teams');
  const list = document.getElementById('teamList');
  list.innerHTML = '';

  if (!teams.length) {
    list.innerHTML = `<p class="font-mono text-xs text-paper/35 text-center py-6 border border-paper/10">You haven't joined any teams yet.</p>`;
    return;
  }

  teams.forEach(team => {
    const row = document.createElement('div');
    row.className = 'border border-paper/15 bg-panel flex items-center justify-between px-5 py-3.5';
    row.innerHTML = `
      <div>
        <div class="font-display font-semibold">${escapeHtml(team.name)}</div>
        <div class="font-mono text-xs text-paper/40 mt-0.5">code: ${escapeHtml(team.join_code)} · ${team.member_count} member${team.member_count == 1 ? '' : 's'}</div>
      </div>
      <div class="flex gap-2">
        <button class="open-team-btn bg-paper text-ink font-mono text-xs px-3.5 py-2 hover:bg-rust transition-colors" data-id="${team.id}">Open</button>
        <button class="leave-team-btn border border-red-500/40 text-red-500 font-mono text-xs px-3.5 py-2 hover:bg-red-500 hover:text-ink transition-colors" data-id="${team.id}">Leave</button>
      </div>
    `;
    list.appendChild(row);
  });

  document.querySelectorAll('.open-team-btn').forEach(btn => {
    btn.onclick = () => window.location.href = `/board.html?team_id=${btn.dataset.id}`;
  });

  document.querySelectorAll('.leave-team-btn').forEach(btn => {
    btn.onclick = async () => {
      if (!confirm('Leave this team? You will lose access to its board.')) return;
      await api('DELETE', `/api/teams/${btn.dataset.id}/leave`);
      loadTeams();
    };
  });
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

loadTeams();
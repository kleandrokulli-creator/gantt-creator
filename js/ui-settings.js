/* ===================================================================
   UI-SETTINGS.JS -- Settings modal, calendar settings, calendar assignment
   =================================================================== */

/* ---------- SETTINGS MODAL ---------- */

function openSettings() {
  DOM.settingsModal.classList.add('open');
  renderSettingsBody();
}

function closeSettings() {
  DOM.settingsModal.classList.remove('open');
}

function switchSettingsTab(tab) {
  currentSettingsTab = tab;
  document.querySelectorAll('#settings-modal .mtab').forEach(t => t.classList.toggle('active', t.dataset.stab === tab));
  // Smooth crossfade between tabs
  const body = DOM.settingsBody;
  body.classList.add('switching');
  setTimeout(() => {
    renderSettingsBody();
    body.classList.remove('switching');
  }, 100);
}

function renderSettingsBody() {
  const body = DOM.settingsBody;
  let html = '';
  if (currentSettingsTab === 'labels') {
    const entries = Object.entries(LABEL_COLORS);
    if (entries.length === 0) {
      html += `<p class="settings-hint">No labels configured. Add labels or load defaults.</p>`;
    }
    entries.forEach(([name, color]) => {
      html += `<div class="setting-row">
        <input type="color" class="swatch" value="${color}" onchange="LABEL_COLORS['${esc(name)}']=this.value;renderAll();if(currentTab==='dati')renderDataTable();scheduleSave()">
        <input type="text" value="${esc(name)}" onchange="renameLabel('${esc(name)}',this.value)">
        <button class="del-btn" onclick="deleteLabel('${esc(name)}')" title="Delete label"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
      </div>`;
    });
    html += `<div class="settings-actions">
      <button class="add-row-btn" onclick="addLabel()">+ Add label</button>
      <button class="defaults-btn" onclick="saveGlobalDefaults();this.textContent='Saved!';setTimeout(()=>this.textContent='Save as defaults',1500)" title="Save current labels/buckets/priority as defaults for new projects">Save as defaults</button>
      <button class="defaults-btn" onclick="resetToBuiltinDefaults()" title="Reset labels, buckets and priority to factory defaults">Reset to factory</button>
    </div>`;
  } else if (currentSettingsTab === 'buckets') {
    html += `<p class="settings-hint">Each bucket has a color applied to the task bars assigned to it.</p>`;
    const buckets = getAllBuckets().filter(b => b);
    if (buckets.length === 0) {
      html += `<p class="settings-hint">No buckets configured. Add buckets or load defaults.</p>`;
    }
    buckets.forEach(b => {
      const color = BUCKET_COLORS[b] || DEFAULT_COLOR;
      html += `<div class="setting-row">
        <input type="color" class="swatch" value="${color}" onchange="BUCKET_COLORS['${esc(b)}']=this.value;reassignColors();renderAll();if(currentTab==='dati')renderDataTable();scheduleSave()">
        <input type="text" value="${esc(b)}" onchange="renameBucketWithColor('${esc(b)}',this.value)">
        <button class="del-btn" onclick="deleteBucket('${esc(b)}')" title="Delete bucket"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
      </div>`;
    });
    html += `<div class="settings-actions">
      <button class="add-row-btn" onclick="addBucket()">+ Add bucket</button>
      <button class="defaults-btn" onclick="saveGlobalDefaults();this.textContent='Saved!';setTimeout(()=>this.textContent='Save as defaults',1500)">Save as defaults</button>
      <button class="defaults-btn" onclick="resetToBuiltinDefaults()">Reset to factory</button>
    </div>`;
  } else if (currentSettingsTab === 'priority') {
    html += `<p class="settings-hint">Priority colors affect milestones (stars) in the timeline.</p>`;
    PRIORITY_OPTIONS.forEach(p => {
      const color = PRIORITY_COLORS[p] || DEFAULT_COLOR;
      html += `<div class="setting-row">
        <input type="color" class="swatch" value="${color}" onchange="PRIORITY_COLORS['${esc(p)}']=this.value;renderAll();scheduleSave()">
        <span class="setting-label">${esc(p)}</span>
      </div>`;
    });
    html += `<div class="settings-actions">
      <button class="defaults-btn" onclick="saveGlobalDefaults();this.textContent='Saved!';setTimeout(()=>this.textContent='Save as defaults',1500)">Save as defaults</button>
      <button class="defaults-btn" onclick="resetToBuiltinDefaults()">Reset to factory</button>
    </div>`;
  } else if (currentSettingsTab === 'calendar') {
    html = renderCalendarSettingsHTML();
  }
  body.innerHTML = html;
  refreshLegendIfOpen();
}

function renderTeamSettingsHTML() {
  let html = '<p class="settings-hint" style="margin-bottom:12px">Create functional areas (teams) and add members. Assign members to tasks in the Data Grid or Edit Panel.</p>';
  const teamEntries = Object.entries(teams);
  if (teamEntries.length === 0) {
    html += '<p class="settings-hint">No teams yet.</p>';
  }
  teamEntries.forEach(([id, team]) => {
    html += `<div class="team-block">`;
    html += `<div class="team-header">`;
    html += `<input type="color" class="swatch" value="${team.color}" onchange="changeTeamColor('${id}',this.value)">`;
    html += `<input type="text" value="${esc(team.name)}" class="setting-input" onchange="renameTeam('${id}',this.value)" style="flex:1;font-weight:600">`;
    html += `<button class="del-btn" onclick="deleteTeam('${id}')" title="Delete team"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button>`;
    html += `</div>`;
    html += `<div class="team-members">`;
    team.members.forEach((m, i) => {
      html += `<div class="team-member-row">`;
      html += `<input type="text" class="member-name" value="${esc(m)}" onchange="renameTeamMember('${id}','${esc(m)}',this.value)">`;
      html += `<button class="member-remove" onclick="removeTeamMember('${id}','${esc(m)}')" title="Remove member"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button>`;
      html += `</div>`;
    });
    html += `</div>`;
    html += `<button class="team-add-member" onclick="addTeamMember('${id}')">+ Add member</button>`;
    html += `</div>`;
  });
  html += `<div style="margin-top:12px"><button class="add-row-btn" onclick="addTeam()">+ Add team</button></div>`;
  return html;
}

function renameLabel(oldName, newName) {
  if (!newName.trim()) return;
  LABEL_COLORS[newName.trim()] = LABEL_COLORS[oldName];
  if (newName.trim() !== oldName) delete LABEL_COLORS[oldName];
  allTasks.forEach(t => { t.labels = t.labels.map(l => l === oldName ? newName.trim() : l); });
  populateFilterDropdowns(); renderAll(); if (currentTab === 'dati') renderDataTable();
  renderSettingsBody(); scheduleSave();
}

function deleteLabel(name) {
  delete LABEL_COLORS[name];
  allTasks.forEach(t => { t.labels = t.labels.filter(l => l !== name); });
  populateFilterDropdowns(); renderAll(); if (currentTab === 'dati') renderDataTable();
  renderSettingsBody(); scheduleSave();
}

async function addLabel() {
  const name = await showPrompt('Enter a name for the new label:', { title: 'New Label', placeholder: 'e.g. Business, IT, Testing...' });
  if (!name || !name.trim()) return;
  LABEL_COLORS[name.trim()] = '#64748B';
  renderSettingsBody(); scheduleSave();
}

/* ---------- ORG CHART COLOR PALETTE ---------- */

function showOrgColorPalette(teamId, triggerEl) {
  const old = document.querySelector('.org-color-palette');
  if (old) old.remove();
  const palette = ['#3B82F6','#22C55E','#F59E0B','#EF4444','#8B5CF6','#EC4899','#14B8A6','#F97316',
                   '#6366F1','#06B6D4','#84CC16','#F43F5E','#A855F7','#0EA5E9','#D946EF','#64748B'];
  const picker = document.createElement('div');
  picker.className = 'org-color-palette';
  palette.forEach(c => {
    const swatch = document.createElement('span');
    swatch.className = 'org-palette-swatch' + (teams[teamId] && teams[teamId].color === c ? ' active' : '');
    swatch.style.background = c;
    swatch.onclick = function(e) {
      e.stopPropagation();
      changeTeamColor(teamId, c);
      picker.remove();
    };
    picker.appendChild(swatch);
  });
  // Position as fixed
  const rect = triggerEl.getBoundingClientRect();
  picker.style.position = 'fixed';
  picker.style.left = rect.left + 'px';
  picker.style.top = (rect.bottom + 4) + 'px';
  document.body.appendChild(picker);
  // Flip up if off-screen
  const pRect = picker.getBoundingClientRect();
  if (pRect.bottom > window.innerHeight) {
    picker.style.top = (rect.top - pRect.height - 4) + 'px';
  }
  setTimeout(() => {
    document.addEventListener('click', function close(e) {
      if (!picker.contains(e.target)) { picker.remove(); document.removeEventListener('click', close); }
    });
  }, 0);
}

/* ---------- TEAM CRUD (used by Org Chart page) ---------- */

function _teamAutoColor() {
  const palette = ['#3B82F6','#22C55E','#F59E0B','#EF4444','#8B5CF6','#EC4899','#14B8A6','#F97316'];
  const used = Object.values(teams).map(t => t.color);
  return palette.find(c => !used.includes(c)) || palette[0];
}

function addRootTeam() {
  const id = 'team-' + Date.now();
  teams[id] = { name: 'New team', color: _teamAutoColor(), parentId: null, members: [] };
  rebuildTeamColors();
  renderOrgChart();
  scheduleSave();
}

function addSubTeam(parentId) {
  if (!teams[parentId]) return;
  const id = 'team-' + Date.now();
  teams[id] = { name: 'New sub-team', color: _teamAutoColor(), parentId: parentId, members: [] };
  rebuildTeamColors();
  renderOrgChart();
  scheduleSave();
}

function addTeam() { addRootTeam(); }

function renameTeam(teamId, newName) {
  if (!teams[teamId] || !newName.trim()) return;
  teams[teamId].name = newName.trim();
  rebuildTeamColors();
  populateFilterDropdowns();
  scheduleSave();
}

function deleteTeam(teamId) {
  if (!teams[teamId]) return;
  // Collect all descendant team IDs recursively
  const toDelete = [teamId];
  function collectChildren(pid) {
    Object.entries(teams).forEach(([id, t]) => {
      if (t.parentId === pid) { toDelete.push(id); collectChildren(id); }
    });
  }
  collectChildren(teamId);
  // Unassign all members from tasks
  const allMembers = new Set();
  toDelete.forEach(id => { if (teams[id]) teams[id].members.forEach(m => allMembers.add(m)); });
  allTasks.forEach(t => {
    if (t.assigned && t.assigned.length > 0) {
      t.assigned = t.assigned.filter(m => !allMembers.has(m));
    }
  });
  // Delete teams
  toDelete.forEach(id => delete teams[id]);
  rebuildTeamColors();
  populateFilterDropdowns();
  renderOrgChart();
  if (currentTab === 'roadmap') renderAll();
  if (currentTab === 'dati') renderDataTable();
  scheduleSave();
}

function changeTeamColor(teamId, color) {
  if (!teams[teamId]) return;
  teams[teamId].color = color;
  rebuildTeamColors();
  renderOrgChart();
  scheduleSave();
}

function addTeamMember(teamId) {
  if (!teams[teamId]) return;
  // Add a placeholder member and re-render so the input appears
  teams[teamId].members.push('New member');
  renderOrgChart();
  scheduleSave();
  // Focus and select the last added member's input for immediate editing
  requestAnimationFrame(() => {
    const node = document.querySelector(`[data-team-id="${teamId}"]`);
    if (!node) return;
    const inputs = node.querySelectorAll('.org-node-member-name');
    const last = inputs[inputs.length - 1];
    if (last) { last.focus(); last.select(); }
  });
}

function removeTeamMember(teamId, memberName) {
  if (!teams[teamId]) return;
  teams[teamId].members = teams[teamId].members.filter(m => m !== memberName);
  allTasks.forEach(t => {
    if (t.assigned && t.assigned.length > 0) {
      t.assigned = t.assigned.filter(m => m !== memberName);
    }
  });
  renderOrgChart();
  scheduleSave();
}

function renameTeamMember(teamId, oldName, newName) {
  if (!teams[teamId] || !newName.trim()) return;
  const idx = teams[teamId].members.indexOf(oldName);
  if (idx >= 0) teams[teamId].members[idx] = newName.trim();
  allTasks.forEach(t => {
    if (t.assigned && t.assigned.length > 0) {
      const i = t.assigned.indexOf(oldName);
      if (i >= 0) t.assigned[i] = newName.trim();
    }
  });
  renderOrgChart();
  scheduleSave();
}

/* ---------- ORG CHART EXPORT ---------- */

function _buildCleanOrgNode(id, team) {
  const memberCount = team.members.length;
  let html = `<div data-export-id="${id}" style="background:#fff;border:2px solid ${team.color};border-radius:12px;padding:14px 16px;min-width:180px;max-width:260px;box-shadow:0 2px 8px rgba(0,0,0,.08)">`;
  // Header
  html += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:${memberCount > 0 ? '8px' : '0'}">`;
  html += `<span style="width:14px;height:14px;border-radius:50%;background:${team.color};display:inline-block;flex-shrink:0"></span>`;
  html += `<span style="font-weight:700;font-size:14px;color:#1E293B">${esc(team.name)}</span>`;
  html += `<span style="font-size:11px;color:#94A3B8;margin-left:auto">${memberCount}</span>`;
  html += `</div>`;
  // Members
  if (memberCount > 0) {
    html += `<div style="border-top:1px solid #E2E8F0;padding-top:6px;display:flex;flex-direction:column;gap:3px">`;
    team.members.forEach(m => {
      const initials = getInitials(m);
      const taskCount = allTasks.filter(t => (t.assigned || []).includes(team.name)).length;
      html += `<div style="display:flex;align-items:center;gap:6px">`;
      html += `<span style="width:20px;height:20px;border-radius:50%;background:${team.color};color:#fff;font-size:9px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0">${initials}</span>`;
      html += `<span style="font-size:12px;color:#334155">${esc(m)}</span>`;
      html += `</div>`;
    });
    html += `</div>`;
  }
  html += `</div>`;
  return html;
}

function exportOrgChartPNG() {
  if (Object.keys(teams).length === 0) { showToast('No teams to export', 'info'); return; }

  // Build a clean static version in a temp container
  const teamEntries = Object.entries(teams);
  function getChildren(parentId) {
    return teamEntries.filter(([_, t]) => (t.parentId || null) === parentId).map(([id]) => id);
  }
  const roots = teamEntries.filter(([_, t]) => !t.parentId).map(([id]) => id);
  const levels = [];
  let queue = [...roots];
  while (queue.length > 0) {
    levels.push([...queue]);
    const next = [];
    queue.forEach(id => getChildren(id).forEach(cid => next.push(cid)));
    queue = next;
  }

  const projName = projects[currentProjectId]?.name || 'Org Chart';
  let cleanHtml = `<div style="padding:24px;font-family:'Inter',system-ui,sans-serif">`;
  cleanHtml += `<div style="text-align:center;margin-bottom:20px;font-size:18px;font-weight:700;color:#1E293B">${esc(projName)} - Org Chart</div>`;

  levels.forEach(levelIds => {
    cleanHtml += `<div style="display:flex;justify-content:center;gap:20px;margin-bottom:36px">`;
    levelIds.forEach(id => { cleanHtml += _buildCleanOrgNode(id, teams[id]); });
    cleanHtml += `</div>`;
  });
  cleanHtml += `</div>`;

  // Render in offscreen container (but visible for getBoundingClientRect)
  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;left:0;top:0;background:#fff;z-index:99999;opacity:0;pointer-events:none';
  container.innerHTML = cleanHtml;
  document.body.appendChild(container);

  // Add connector lines using HTML divs (not SVG, for better html2canvas support)
  requestAnimationFrame(() => {
    const containerRect = container.getBoundingClientRect();
    teamEntries.forEach(([id, team]) => {
      if (!team.parentId || !teams[team.parentId]) return;
      const parentEl = container.querySelector(`[data-export-id="${team.parentId}"]`);
      const childEl = container.querySelector(`[data-export-id="${id}"]`);
      if (!parentEl || !childEl) return;
      const pR = parentEl.getBoundingClientRect();
      const cR = childEl.getBoundingClientRect();
      const px = pR.left + pR.width / 2 - containerRect.left;
      const py = pR.bottom - containerRect.top;
      const cx = cR.left + cR.width / 2 - containerRect.left;
      const cy = cR.top - containerRect.top;
      const midY = (py + cy) / 2;
      // Vertical line from parent down to midpoint
      const v1 = document.createElement('div');
      v1.style.cssText = `position:absolute;left:${px}px;top:${py}px;width:2px;height:${midY - py}px;background:#CBD5E1`;
      container.firstChild.appendChild(v1);
      // Horizontal line at midpoint
      const minX = Math.min(px, cx), maxX = Math.max(px, cx);
      if (Math.abs(px - cx) > 2) {
        const h = document.createElement('div');
        h.style.cssText = `position:absolute;left:${minX}px;top:${midY}px;width:${maxX - minX}px;height:2px;background:#CBD5E1`;
        container.firstChild.appendChild(h);
      }
      // Vertical line from midpoint down to child
      const v2 = document.createElement('div');
      v2.style.cssText = `position:absolute;left:${cx}px;top:${midY}px;width:2px;height:${cy - midY}px;background:#CBD5E1`;
      container.firstChild.appendChild(v2);
    });
    container.firstChild.style.position = 'relative';

    html2canvas(container, { backgroundColor: '#ffffff', scale: 2 }).then(canvas => {
      container.remove();
      const a = document.createElement('a');
      a.download = (projName).replace(/[^a-zA-Z0-9_\- ]/g, '_') + '_OrgChart.png';
      a.href = canvas.toDataURL('image/png');
      a.click();
      showToast('Org Chart PNG exported', 'info', 2000);
    }).catch(err => {
      container.remove();
      showToast('Export failed: ' + err.message, 'error');
    });
  }); // end requestAnimationFrame
}

function renameBucket(oldName, newName) {
  allTasks.forEach(t => { if (t.bucket === oldName) t.bucket = newName.trim(); });
  // Transfer color to new name
  if (BUCKET_COLORS[oldName]) {
    BUCKET_COLORS[newName.trim()] = BUCKET_COLORS[oldName];
    if (newName.trim() !== oldName) delete BUCKET_COLORS[oldName];
  }
  reassignColors();
  populateFilterDropdowns(); renderAll(); if (currentTab === 'dati') renderDataTable();
  renderSettingsBody(); scheduleSave();
}

function renameBucketWithColor(oldName, newName) {
  renameBucket(oldName, newName);
}

function deleteBucket(name) {
  allTasks.forEach(t => { if (t.bucket === name) t.bucket = ''; });
  delete BUCKET_COLORS[name];
  customBuckets.delete(name);
  reassignColors();
  populateFilterDropdowns(); renderAll(); if (currentTab === 'dati') renderDataTable();
  renderSettingsBody(); scheduleSave();
}

async function addBucket() {
  const name = await showPrompt('Enter a name for the new bucket:', { title: 'New Bucket', placeholder: 'e.g. Team A, Phase 1...' });
  if (!name || !name.trim()) return;
  customBuckets.add(name.trim());
  // Assign a random nice color
  const palette = ['#3B82F6','#10B981','#F59E0B','#EF4444','#8B5CF6','#EC4899','#14B8A6','#F97316','#6366F1','#06B6D4'];
  const usedColors = Object.values(BUCKET_COLORS);
  const available = palette.filter(c => !usedColors.includes(c));
  BUCKET_COLORS[name.trim()] = available.length > 0 ? available[0] : palette[Math.floor(Math.random() * palette.length)];
  populateFilterDropdowns();
  renderSettingsBody();
  reassignColors(); renderAll();
  scheduleSave();
}


/* ---------- CALENDAR SETTINGS ---------- */

let _selectedCalId = null;

function renderCalendarSettingsHTML() {
  ensureDefaultCalendar();
  const calIds = Object.keys(calendars);
  if (!_selectedCalId || !calendars[_selectedCalId]) _selectedCalId = calIds[0];

  let html = '';

  // Working days toggle
  html += `<div class="setting-row" style="justify-content:space-between;margin-bottom:12px">
    <span>Working days mode (Mon-Fri, skip holidays)</span>
    <label class="toggle-switch">
      <input type="checkbox" ${workingDaysMode ? 'checked' : ''} onchange="toggleWorkingDaysMode(this.checked)">
      <span class="toggle-slider"></span>
    </label>
  </div>`;

  // Calendar selector chips
  html += `<div class="cal-chips-row">`;
  calIds.forEach(id => {
    const cal = calendars[id];
    const active = id === _selectedCalId ? 'active' : '';
    const defBadge = cal.isDefault ? ' (default)' : '';
    html += `<span class="cal-chip ${active}" style="border-color:${cal.color}" onclick="selectCalendarChip('${id}')">${esc(cal.name)}${defBadge}</span>`;
  });
  html += `<span class="cal-chip cal-chip-add" onclick="addCalendar()">+ Add</span>`;
  html += `</div>`;

  // Selected calendar details
  const cal = calendars[_selectedCalId];
  if (cal) {
    html += `<div class="cal-detail">`;
    html += `<div class="setting-row" style="gap:8px;margin-bottom:8px">
      <input type="text" value="${esc(cal.name)}" onchange="renameCalendar('${_selectedCalId}',this.value)" style="flex:1">
      <input type="color" value="${cal.color}" onchange="changeCalendarColor('${_selectedCalId}',this.value)" class="swatch" title="Calendar color">
      ${cal.isDefault ? '' : `<button class="del-btn" onclick="setDefaultCalendar('${_selectedCalId}')" title="Set as default" style="font-size:.7rem;padding:2px 6px;background:var(--blue);color:#fff;border:none;border-radius:4px;cursor:pointer">Set Default</button>`}
      ${calIds.length > 1 ? `<button class="del-btn" onclick="deleteCalendar('${_selectedCalId}')" title="Delete calendar"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button>` : ''}
    </div>`;

    // Entries list
    html += `<div class="cal-entries">`;
    if (cal.entries.length === 0) {
      html += `<p class="settings-hint" style="margin:8px 0">No holidays or closures defined.</p>`;
    }
    cal.entries.forEach((entry, idx) => {
      if (entry.type === 'holiday') {
        html += `<div class="cal-entry">
          <span class="cal-entry-type">Holiday</span>
          <input type="date" value="${entry.date}" onchange="updateCalendarEntry('${_selectedCalId}',${idx},'date',this.value)" style="font-size:.8rem">
          <input type="text" value="${esc(entry.label)}" onchange="updateCalendarEntry('${_selectedCalId}',${idx},'label',this.value)" placeholder="Label" style="flex:1;font-size:.8rem">
          <button class="del-btn" onclick="removeCalendarEntry('${_selectedCalId}',${idx})"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
        </div>`;
      } else {
        html += `<div class="cal-entry">
          <span class="cal-entry-type">Closure</span>
          <input type="date" value="${entry.startDate}" onchange="updateCalendarEntry('${_selectedCalId}',${idx},'startDate',this.value)" style="font-size:.8rem">
          <span style="color:var(--grey-txt);font-size:.8rem">to</span>
          <input type="date" value="${entry.endDate}" onchange="updateCalendarEntry('${_selectedCalId}',${idx},'endDate',this.value)" style="font-size:.8rem">
          <input type="text" value="${esc(entry.label)}" onchange="updateCalendarEntry('${_selectedCalId}',${idx},'label',this.value)" placeholder="Label" style="flex:1;font-size:.8rem">
          <button class="del-btn" onclick="removeCalendarEntry('${_selectedCalId}',${idx})"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
        </div>`;
      }
    });
    html += `</div>`;

    // Add holiday form
    html += `<div class="cal-add-form">
      <div style="display:flex;gap:6px;align-items:center;margin-top:8px">
        <input type="date" id="cal-h-date" style="flex:1">
        <input type="text" id="cal-h-label" placeholder="Holiday label" style="flex:1">
        <button class="add-row-btn" onclick="submitCalendarHoliday('${_selectedCalId}')" style="white-space:nowrap">+ Holiday</button>
      </div>
      <div style="display:flex;gap:6px;align-items:center;margin-top:6px">
        <input type="date" id="cal-c-start" style="flex:1">
        <span style="color:var(--grey-txt)">to</span>
        <input type="date" id="cal-c-end" style="flex:1">
        <input type="text" id="cal-c-label" placeholder="Closure label" style="flex:1">
        <button class="add-row-btn" onclick="submitCalendarClosure('${_selectedCalId}')" style="white-space:nowrap">+ Closure</button>
      </div>
    </div>`;

    // Import national holidays preset
    html += `<div style="margin-top:10px;padding-top:8px;border-top:1px solid var(--border)">
      <div style="display:flex;gap:6px;align-items:center">
        <select id="cal-preset-country" style="flex:1;padding:4px 8px;border-radius:6px;border:1px solid var(--border);font-size:.8rem">
          <option value="">-- Import national holidays --</option>
          <option value="IT">Italia</option>
          <option value="UK">United Kingdom</option>
          <option value="DE">Deutschland</option>
          <option value="FR">France</option>
          <option value="ES">Espana</option>
          <option value="US">United States</option>
          <option value="NL">Nederland</option>
          <option value="PT">Portugal</option>
          <option value="AT">Osterreich</option>
          <option value="BE">Belgique</option>
          <option value="AU">Australia</option>
        </select>
        <select id="cal-preset-year" style="padding:4px 8px;border-radius:6px;border:1px solid var(--border);font-size:.8rem">
          <option value="2026" selected>2026</option>
          <option value="2027">2027</option>
          <option value="2028">2028</option>
          <option value="2029">2029</option>
          <option value="2030">2030</option>
        </select>
        <button class="add-row-btn" onclick="importNationalHolidays('${_selectedCalId}')" style="white-space:nowrap">Import</button>
      </div>
    </div>`;

    html += `</div>`;
  }
  return html;
}

function toggleWorkingDaysMode(checked) {
  workingDaysMode = checked;
  invalidateHolidayCache();
  recalcFinishDates();
  rebuildAfterChange();
  renderAll();
  if (currentTab === 'dati') renderDataTable();
  scheduleSave();
}

function selectCalendarChip(id) {
  _selectedCalId = id;
  renderSettingsBody();
}

function addCalendar() {
  const name = prompt('New calendar name:');
  if (!name || !name.trim()) return;
  const id = 'cal_' + Date.now();
  const usedColors = Object.values(calendars).map(c => c.color);
  const available = CALENDAR_COLORS.filter(c => !usedColors.includes(c));
  calendars[id] = { name: name.trim(), isDefault: false, entries: [], color: available[0] || CALENDAR_COLORS[Object.keys(calendars).length % CALENDAR_COLORS.length] };
  _selectedCalId = id;
  invalidateHolidayCache();
  renderSettingsBody();
  scheduleSave();
}

function renameCalendar(id, newName) {
  if (!newName.trim()) return;
  calendars[id].name = newName.trim();
  renderSettingsBody();
  if (currentTab === 'dati') renderDataTable();
  scheduleSave();
}

function deleteCalendar(id) {
  if (Object.keys(calendars).length <= 1) return;
  if (!confirm('Delete calendar "' + calendars[id].name + '"?')) return;
  // Move tasks to default
  const defId = getDefaultCalendarId();
  allTasks.forEach(t => { if (t.calendarId === id) t.calendarId = defId; });
  delete calendars[id];
  ensureDefaultCalendar();
  _selectedCalId = Object.keys(calendars)[0];
  invalidateHolidayCache();
  recalcFinishDates();
  renderSettingsBody();
  renderAll();
  if (currentTab === 'dati') renderDataTable();
  scheduleSave();
}

function setDefaultCalendar(id) {
  Object.keys(calendars).forEach(k => calendars[k].isDefault = (k === id));
  invalidateHolidayCache();
  recalcFinishDates();
  renderSettingsBody();
  renderAll();
  scheduleSave();
}

function changeCalendarColor(id, color) {
  calendars[id].color = color;
  renderSettingsBody();
  renderAll();
  scheduleSave();
}

function submitCalendarHoliday(calId) {
  const dateEl = document.getElementById('cal-h-date');
  const labelEl = document.getElementById('cal-h-label');
  if (!dateEl.value) { showToast('Select a date', 'error'); return; }
  // Validate: duplicate check
  const existing = calendars[calId].entries.find(e => e.type === 'holiday' && e.date === dateEl.value);
  if (existing) { showToast('This date is already in the calendar (' + existing.label + ')', 'warn'); return; }
  // Validate: weekend warning
  const hDate = new Date(dateEl.value + 'T00:00:00');
  if (isWeekend(hDate)) { showToast('Note: this date falls on a weekend', 'warn'); }
  calendars[calId].entries.push({ type: 'holiday', date: dateEl.value, label: labelEl.value || 'Holiday' });
  // Keep entries sorted by date
  calendars[calId].entries.sort((a, b) => (a.date || a.startDate || '').localeCompare(b.date || b.startDate || ''));
  invalidateHolidayCache();
  recalcFinishDates();
  renderSettingsBody();
  renderAll();
  scheduleSave();
}

function submitCalendarClosure(calId) {
  const startEl = document.getElementById('cal-c-start');
  const endEl = document.getElementById('cal-c-end');
  const labelEl = document.getElementById('cal-c-label');
  if (!startEl.value || !endEl.value) { showToast('Select start and end dates', 'error'); return; }
  if (startEl.value > endEl.value) { showToast('Start must be before end', 'error'); return; }
  calendars[calId].entries.push({ type: 'closure', startDate: startEl.value, endDate: endEl.value, label: labelEl.value || 'Closure' });
  invalidateHolidayCache();
  recalcFinishDates();
  renderSettingsBody();
  renderAll();
  scheduleSave();
}

function updateCalendarEntry(calId, idx, field, value) {
  const entry = calendars[calId]?.entries?.[idx];
  if (!entry) return;
  entry[field] = value;
  // Validate closure dates
  if (entry.type === 'closure' && entry.startDate && entry.endDate && entry.startDate > entry.endDate) {
    if (field === 'startDate') entry.endDate = value;
    else entry.startDate = value;
    renderSettingsBody();
  }
  invalidateHolidayCache();
  recalcFinishDates();
  renderAll();
  scheduleSave();
}

function removeCalendarEntry(calId, idx) {
  calendars[calId].entries.splice(idx, 1);
  invalidateHolidayCache();
  recalcFinishDates();
  renderSettingsBody();
  renderAll();
  scheduleSave();
}


/* ---------- CALENDAR ASSIGNMENT MODAL ---------- */

function openCalendarAssignModal() {
  ensureDefaultCalendar();
  const modal = document.getElementById('cal-assign-modal');
  const body = document.getElementById('cal-assign-body');
  const calIds = Object.keys(calendars);

  // Get Level 1 and Level 2 tasks
  const phases = allTasks.filter(t => t.depth <= 2);

  let html = '';
  if (calIds.length === 0) {
    html = '<p>No calendars defined. Create one in Settings > Calendar first.</p>';
  } else if (phases.length === 0) {
    html = '<p>No tasks to assign calendars to.</p>';
  } else {
    // Calendar selector
    html += `<div style="margin-bottom:12px">
      <label style="font-weight:600;font-size:.85rem">Select calendar:</label>
      <select id="cal-assign-select" style="margin-left:8px;padding:4px 8px;border-radius:6px;border:1px solid var(--border);font-size:.85rem">
        ${calIds.map(id => `<option value="${id}">${esc(calendars[id].name)}${calendars[id].isDefault ? ' (default)' : ''}</option>`).join('')}
      </select>
    </div>`;

    // Phase checklist
    html += `<div style="margin-bottom:12px">
      <label style="font-weight:600;font-size:.85rem">Apply to phases:</label>
      <div style="margin-top:4px;display:flex;gap:4px">
        <button class="add-row-btn" onclick="calAssignSelectAll(true)" style="font-size:.75rem;padding:2px 8px">Select all</button>
        <button class="add-row-btn" onclick="calAssignSelectAll(false)" style="font-size:.75rem;padding:2px 8px">Deselect all</button>
      </div>
    </div>`;
    html += `<div class="cal-assign-list" style="max-height:300px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;padding:4px">`;
    phases.forEach(t => {
      const indent = (t.depth - 1) * 20;
      const calName = t.calendarId && calendars[t.calendarId] ? calendars[t.calendarId].name : '(default)';
      html += `<label class="cal-assign-item" style="padding-left:${indent + 8}px">
        <input type="checkbox" class="cal-assign-cb" value="${t.id}">
        <span class="cal-assign-outline">${esc(t.outline)}</span>
        <span class="cal-assign-name">${esc(t.name)}</span>
        <span class="cal-assign-current" style="color:var(--grey-txt);font-size:.75rem;margin-left:auto">${esc(calName)}</span>
      </label>`;
    });
    html += `</div>`;

    // Apply button
    html += `<button onclick="applyCalendarAssignment()" style="margin-top:12px;width:100%;background:var(--blue);color:#fff;border:none;border-radius:8px;padding:.5rem;cursor:pointer;font-family:inherit;font-weight:600;font-size:.85rem">Apply Calendar</button>`;
  }

  body.innerHTML = html;

  // When a parent checkbox is toggled, propagate to its children visually
  body.querySelectorAll('.cal-assign-cb').forEach(cb => {
    cb.addEventListener('change', function() {
      const taskId = parseInt(this.value);
      const task = allTasks.find(t => t.id === taskId);
      if (!task) return;
      const prefix = task.outline + '.';
      body.querySelectorAll('.cal-assign-cb').forEach(other => {
        if (other === this) return;
        const otherId = parseInt(other.value);
        const otherTask = allTasks.find(t => t.id === otherId);
        if (otherTask && otherTask.outline.startsWith(prefix)) {
          other.checked = this.checked;
        }
      });
    });
  });

  modal.classList.add('open');
}

function closeCalendarAssignModal() {
  document.getElementById('cal-assign-modal').classList.remove('open');
}

function calAssignSelectAll(checked) {
  document.querySelectorAll('.cal-assign-cb').forEach(cb => cb.checked = checked);
}

function applyCalendarAssignment() {
  const select = document.getElementById('cal-assign-select');
  if (!select) return;
  const calId = select.value;
  const checked = document.querySelectorAll('.cal-assign-cb:checked');
  if (checked.length === 0) { showToast('Select at least one phase', 'error'); return; }

  snapshotUndo();
  checked.forEach(cb => {
    const taskId = parseInt(cb.value);
    const task = allTasks.find(t => t.id === taskId);
    if (task) assignCalendarWithChildren(task, calId);
  });

  invalidateHolidayCache();
  recalcFinishDates();
  rebuildAfterChange();
  renderAll();
  if (currentTab === 'dati') renderDataTable();
  scheduleSave();
  closeCalendarAssignModal();
  showToast(`Calendar assigned to ${checked.length} phase(s)`, 'info', 2000);
}


/* ---------- NATIONAL HOLIDAY PRESETS ---------- */
const NATIONAL_HOLIDAYS = {
  IT: {
    2026: [
      { date: '2026-01-01', label: 'Capodanno' },
      { date: '2026-01-06', label: 'Epifania' },
      { date: '2026-04-05', label: 'Pasqua' },
      { date: '2026-04-06', label: 'Lunedi Angelo' },
      { date: '2026-04-25', label: 'Liberazione' },
      { date: '2026-05-01', label: 'Festa del Lavoro' },
      { date: '2026-06-02', label: 'Festa della Repubblica' },
      { date: '2026-08-15', label: 'Ferragosto' },
      { date: '2026-11-01', label: 'Ognissanti' },
      { date: '2026-12-08', label: 'Immacolata Concezione' },
      { date: '2026-12-25', label: 'Natale' },
      { date: '2026-12-26', label: 'Santo Stefano' }
    ],
    2027: [
      { date: '2027-01-01', label: 'Capodanno' },
      { date: '2027-01-06', label: 'Epifania' },
      { date: '2027-03-28', label: 'Pasqua' },
      { date: '2027-03-29', label: 'Lunedi Angelo' },
      { date: '2027-04-25', label: 'Liberazione' },
      { date: '2027-05-01', label: 'Festa del Lavoro' },
      { date: '2027-06-02', label: 'Festa della Repubblica' },
      { date: '2027-08-15', label: 'Ferragosto' },
      { date: '2027-11-01', label: 'Ognissanti' },
      { date: '2027-12-08', label: 'Immacolata Concezione' },
      { date: '2027-12-25', label: 'Natale' },
      { date: '2027-12-26', label: 'Santo Stefano' }
    ],
    2028: [
      { date: '2028-01-01', label: 'Capodanno' },
      { date: '2028-01-06', label: 'Epifania' },
      { date: '2028-04-16', label: 'Pasqua' },
      { date: '2028-04-17', label: 'Lunedi Angelo' },
      { date: '2028-04-25', label: 'Liberazione' },
      { date: '2028-05-01', label: 'Festa del Lavoro' },
      { date: '2028-06-02', label: 'Festa della Repubblica' },
      { date: '2028-08-15', label: 'Ferragosto' },
      { date: '2028-11-01', label: 'Ognissanti' },
      { date: '2028-12-08', label: 'Immacolata Concezione' },
      { date: '2028-12-25', label: 'Natale' },
      { date: '2028-12-26', label: 'Santo Stefano' }
    ],
    2029: [
      { date: '2029-01-01', label: 'Capodanno' },
      { date: '2029-01-06', label: 'Epifania' },
      { date: '2029-04-01', label: 'Pasqua' },
      { date: '2029-04-02', label: 'Lunedi Angelo' },
      { date: '2029-04-25', label: 'Liberazione' },
      { date: '2029-05-01', label: 'Festa del Lavoro' },
      { date: '2029-06-02', label: 'Festa della Repubblica' },
      { date: '2029-08-15', label: 'Ferragosto' },
      { date: '2029-11-01', label: 'Ognissanti' },
      { date: '2029-12-08', label: 'Immacolata Concezione' },
      { date: '2029-12-25', label: 'Natale' },
      { date: '2029-12-26', label: 'Santo Stefano' }
    ],
    2030: [
      { date: '2030-01-01', label: 'Capodanno' },
      { date: '2030-01-06', label: 'Epifania' },
      { date: '2030-04-21', label: 'Pasqua' },
      { date: '2030-04-22', label: 'Lunedi Angelo' },
      { date: '2030-04-25', label: 'Liberazione' },
      { date: '2030-05-01', label: 'Festa del Lavoro' },
      { date: '2030-06-02', label: 'Festa della Repubblica' },
      { date: '2030-08-15', label: 'Ferragosto' },
      { date: '2030-11-01', label: 'Ognissanti' },
      { date: '2030-12-08', label: 'Immacolata Concezione' },
      { date: '2030-12-25', label: 'Natale' },
      { date: '2030-12-26', label: 'Santo Stefano' }
    ]
  },
  UK: {
    2026: [
      { date: '2026-01-01', label: 'New Year' },
      { date: '2026-04-03', label: 'Good Friday' },
      { date: '2026-04-06', label: 'Easter Monday' },
      { date: '2026-05-04', label: 'Early May Bank' },
      { date: '2026-05-25', label: 'Spring Bank' },
      { date: '2026-08-31', label: 'Summer Bank' },
      { date: '2026-12-25', label: 'Christmas' },
      { date: '2026-12-28', label: 'Boxing Day (substitute)' }
    ],
    2027: [
      { date: '2027-01-01', label: 'New Year' },
      { date: '2027-03-26', label: 'Good Friday' },
      { date: '2027-03-29', label: 'Easter Monday' },
      { date: '2027-05-03', label: 'Early May Bank' },
      { date: '2027-05-31', label: 'Spring Bank' },
      { date: '2027-08-30', label: 'Summer Bank' },
      { date: '2027-12-27', label: 'Christmas (substitute)' },
      { date: '2027-12-28', label: 'Boxing Day (substitute)' }
    ],
    2028: [
      { date: '2028-01-03', label: 'New Year (substitute)' },
      { date: '2028-04-14', label: 'Good Friday' },
      { date: '2028-04-17', label: 'Easter Monday' },
      { date: '2028-05-01', label: 'Early May Bank' },
      { date: '2028-05-29', label: 'Spring Bank' },
      { date: '2028-08-28', label: 'Summer Bank' },
      { date: '2028-12-25', label: 'Christmas' },
      { date: '2028-12-26', label: 'Boxing Day' }
    ],
    2029: [
      { date: '2029-01-01', label: 'New Year' },
      { date: '2029-03-30', label: 'Good Friday' },
      { date: '2029-04-02', label: 'Easter Monday' },
      { date: '2029-05-07', label: 'Early May Bank' },
      { date: '2029-05-28', label: 'Spring Bank' },
      { date: '2029-08-27', label: 'Summer Bank' },
      { date: '2029-12-25', label: 'Christmas' },
      { date: '2029-12-26', label: 'Boxing Day' }
    ],
    2030: [
      { date: '2030-01-01', label: 'New Year' },
      { date: '2030-04-19', label: 'Good Friday' },
      { date: '2030-04-22', label: 'Easter Monday' },
      { date: '2030-05-06', label: 'Early May Bank' },
      { date: '2030-05-27', label: 'Spring Bank' },
      { date: '2030-08-26', label: 'Summer Bank' },
      { date: '2030-12-25', label: 'Christmas' },
      { date: '2030-12-26', label: 'Boxing Day' }
    ]
  },
  DE: {
    2026: [
      { date: '2026-01-01', label: 'Neujahr' },
      { date: '2026-04-03', label: 'Karfreitag' },
      { date: '2026-04-06', label: 'Ostermontag' },
      { date: '2026-05-01', label: 'Tag der Arbeit' },
      { date: '2026-05-14', label: 'Christi Himmelfahrt' },
      { date: '2026-05-25', label: 'Pfingstmontag' },
      { date: '2026-10-03', label: 'Tag der Deutschen Einheit' },
      { date: '2026-12-25', label: 'Weihnachten' },
      { date: '2026-12-26', label: 'Zweiter Weihnachtsfeiertag' }
    ],
    2027: [
      { date: '2027-01-01', label: 'Neujahr' },
      { date: '2027-03-26', label: 'Karfreitag' },
      { date: '2027-03-29', label: 'Ostermontag' },
      { date: '2027-05-01', label: 'Tag der Arbeit' },
      { date: '2027-05-06', label: 'Christi Himmelfahrt' },
      { date: '2027-05-17', label: 'Pfingstmontag' },
      { date: '2027-10-03', label: 'Tag der Deutschen Einheit' },
      { date: '2027-12-25', label: 'Weihnachten' },
      { date: '2027-12-26', label: 'Zweiter Weihnachtsfeiertag' }
    ],
    2028: [
      { date: '2028-01-01', label: 'Neujahr' },
      { date: '2028-04-14', label: 'Karfreitag' },
      { date: '2028-04-17', label: 'Ostermontag' },
      { date: '2028-05-01', label: 'Tag der Arbeit' },
      { date: '2028-05-25', label: 'Christi Himmelfahrt' },
      { date: '2028-06-05', label: 'Pfingstmontag' },
      { date: '2028-10-03', label: 'Tag der Deutschen Einheit' },
      { date: '2028-12-25', label: 'Weihnachten' },
      { date: '2028-12-26', label: 'Zweiter Weihnachtsfeiertag' }
    ],
    2029: [
      { date: '2029-01-01', label: 'Neujahr' },
      { date: '2029-03-30', label: 'Karfreitag' },
      { date: '2029-04-02', label: 'Ostermontag' },
      { date: '2029-05-01', label: 'Tag der Arbeit' },
      { date: '2029-05-10', label: 'Christi Himmelfahrt' },
      { date: '2029-05-21', label: 'Pfingstmontag' },
      { date: '2029-10-03', label: 'Tag der Deutschen Einheit' },
      { date: '2029-12-25', label: 'Weihnachten' },
      { date: '2029-12-26', label: 'Zweiter Weihnachtsfeiertag' }
    ],
    2030: [
      { date: '2030-01-01', label: 'Neujahr' },
      { date: '2030-04-19', label: 'Karfreitag' },
      { date: '2030-04-22', label: 'Ostermontag' },
      { date: '2030-05-01', label: 'Tag der Arbeit' },
      { date: '2030-05-30', label: 'Christi Himmelfahrt' },
      { date: '2030-06-10', label: 'Pfingstmontag' },
      { date: '2030-10-03', label: 'Tag der Deutschen Einheit' },
      { date: '2030-12-25', label: 'Weihnachten' },
      { date: '2030-12-26', label: 'Zweiter Weihnachtsfeiertag' }
    ]
  },
  FR: {
    2026: [
      { date: '2026-01-01', label: 'Jour de l\'An' },
      { date: '2026-04-06', label: 'Lundi de Paques' },
      { date: '2026-05-01', label: 'Fete du Travail' },
      { date: '2026-05-08', label: 'Victoire 1945' },
      { date: '2026-05-14', label: 'Ascension' },
      { date: '2026-05-25', label: 'Lundi de Pentecote' },
      { date: '2026-07-14', label: 'Fete Nationale' },
      { date: '2026-08-15', label: 'Assomption' },
      { date: '2026-11-01', label: 'Toussaint' },
      { date: '2026-11-11', label: 'Armistice' },
      { date: '2026-12-25', label: 'Noel' }
    ],
    2027: [
      { date: '2027-01-01', label: 'Jour de l\'An' },
      { date: '2027-03-29', label: 'Lundi de Paques' },
      { date: '2027-05-01', label: 'Fete du Travail' },
      { date: '2027-05-06', label: 'Ascension' },
      { date: '2027-05-08', label: 'Victoire 1945' },
      { date: '2027-05-17', label: 'Lundi de Pentecote' },
      { date: '2027-07-14', label: 'Fete Nationale' },
      { date: '2027-08-15', label: 'Assomption' },
      { date: '2027-11-01', label: 'Toussaint' },
      { date: '2027-11-11', label: 'Armistice' },
      { date: '2027-12-25', label: 'Noel' }
    ],
    2028: [
      { date: '2028-01-01', label: 'Jour de l\'An' },
      { date: '2028-04-17', label: 'Lundi de Paques' },
      { date: '2028-05-01', label: 'Fete du Travail' },
      { date: '2028-05-08', label: 'Victoire 1945' },
      { date: '2028-05-25', label: 'Ascension' },
      { date: '2028-06-05', label: 'Lundi de Pentecote' },
      { date: '2028-07-14', label: 'Fete Nationale' },
      { date: '2028-08-15', label: 'Assomption' },
      { date: '2028-11-01', label: 'Toussaint' },
      { date: '2028-11-11', label: 'Armistice' },
      { date: '2028-12-25', label: 'Noel' }
    ],
    2029: [
      { date: '2029-01-01', label: 'Jour de l\'An' },
      { date: '2029-04-02', label: 'Lundi de Paques' },
      { date: '2029-05-01', label: 'Fete du Travail' },
      { date: '2029-05-08', label: 'Victoire 1945' },
      { date: '2029-05-10', label: 'Ascension' },
      { date: '2029-05-21', label: 'Lundi de Pentecote' },
      { date: '2029-07-14', label: 'Fete Nationale' },
      { date: '2029-08-15', label: 'Assomption' },
      { date: '2029-11-01', label: 'Toussaint' },
      { date: '2029-11-11', label: 'Armistice' },
      { date: '2029-12-25', label: 'Noel' }
    ],
    2030: [
      { date: '2030-01-01', label: 'Jour de l\'An' },
      { date: '2030-04-22', label: 'Lundi de Paques' },
      { date: '2030-05-01', label: 'Fete du Travail' },
      { date: '2030-05-08', label: 'Victoire 1945' },
      { date: '2030-05-30', label: 'Ascension' },
      { date: '2030-06-10', label: 'Lundi de Pentecote' },
      { date: '2030-07-14', label: 'Fete Nationale' },
      { date: '2030-08-15', label: 'Assomption' },
      { date: '2030-11-01', label: 'Toussaint' },
      { date: '2030-11-11', label: 'Armistice' },
      { date: '2030-12-25', label: 'Noel' }
    ]
  },
  ES: {
    2026: [
      { date: '2026-01-01', label: 'Ano Nuevo' },
      { date: '2026-01-06', label: 'Epifania' },
      { date: '2026-04-03', label: 'Viernes Santo' },
      { date: '2026-05-01', label: 'Dia del Trabajo' },
      { date: '2026-08-15', label: 'Asuncion' },
      { date: '2026-10-12', label: 'Fiesta Nacional' },
      { date: '2026-11-01', label: 'Todos los Santos' },
      { date: '2026-12-06', label: 'Dia de la Constitucion' },
      { date: '2026-12-07', label: 'Inmaculada Concepcion (substitute)' },
      { date: '2026-12-25', label: 'Navidad' }
    ],
    2027: [
      { date: '2027-01-01', label: 'Ano Nuevo' },
      { date: '2027-01-06', label: 'Epifania' },
      { date: '2027-03-26', label: 'Viernes Santo' },
      { date: '2027-05-01', label: 'Dia del Trabajo' },
      { date: '2027-08-15', label: 'Asuncion' },
      { date: '2027-10-12', label: 'Fiesta Nacional' },
      { date: '2027-11-01', label: 'Todos los Santos' },
      { date: '2027-12-06', label: 'Dia de la Constitucion' },
      { date: '2027-12-08', label: 'Inmaculada Concepcion' },
      { date: '2027-12-25', label: 'Navidad' }
    ],
    2028: [
      { date: '2028-01-01', label: 'Ano Nuevo' },
      { date: '2028-01-06', label: 'Epifania' },
      { date: '2028-04-14', label: 'Viernes Santo' },
      { date: '2028-05-01', label: 'Dia del Trabajo' },
      { date: '2028-08-15', label: 'Asuncion' },
      { date: '2028-10-12', label: 'Fiesta Nacional' },
      { date: '2028-11-01', label: 'Todos los Santos' },
      { date: '2028-12-06', label: 'Dia de la Constitucion' },
      { date: '2028-12-08', label: 'Inmaculada Concepcion' },
      { date: '2028-12-25', label: 'Navidad' }
    ],
    2029: [
      { date: '2029-01-01', label: 'Ano Nuevo' },
      { date: '2029-01-06', label: 'Epifania' },
      { date: '2029-03-30', label: 'Viernes Santo' },
      { date: '2029-05-01', label: 'Dia del Trabajo' },
      { date: '2029-08-15', label: 'Asuncion' },
      { date: '2029-10-12', label: 'Fiesta Nacional' },
      { date: '2029-11-01', label: 'Todos los Santos' },
      { date: '2029-12-06', label: 'Dia de la Constitucion' },
      { date: '2029-12-08', label: 'Inmaculada Concepcion' },
      { date: '2029-12-25', label: 'Navidad' }
    ],
    2030: [
      { date: '2030-01-01', label: 'Ano Nuevo' },
      { date: '2030-01-06', label: 'Epifania' },
      { date: '2030-04-19', label: 'Viernes Santo' },
      { date: '2030-05-01', label: 'Dia del Trabajo' },
      { date: '2030-08-15', label: 'Asuncion' },
      { date: '2030-10-12', label: 'Fiesta Nacional' },
      { date: '2030-11-01', label: 'Todos los Santos' },
      { date: '2030-12-06', label: 'Dia de la Constitucion' },
      { date: '2030-12-08', label: 'Inmaculada Concepcion' },
      { date: '2030-12-25', label: 'Navidad' }
    ]
  },
  US: {
    2026: [
      { date: '2026-01-01', label: 'New Year\'s Day' },
      { date: '2026-01-19', label: 'MLK Day' },
      { date: '2026-02-16', label: 'Presidents\' Day' },
      { date: '2026-05-25', label: 'Memorial Day' },
      { date: '2026-06-19', label: 'Juneteenth' },
      { date: '2026-07-03', label: 'Independence Day (observed)' },
      { date: '2026-09-07', label: 'Labor Day' },
      { date: '2026-11-26', label: 'Thanksgiving' },
      { date: '2026-12-25', label: 'Christmas' }
    ],
    2027: [
      { date: '2027-01-01', label: 'New Year\'s Day' },
      { date: '2027-01-18', label: 'MLK Day' },
      { date: '2027-02-15', label: 'Presidents\' Day' },
      { date: '2027-05-31', label: 'Memorial Day' },
      { date: '2027-06-18', label: 'Juneteenth (observed)' },
      { date: '2027-07-05', label: 'Independence Day (observed)' },
      { date: '2027-09-06', label: 'Labor Day' },
      { date: '2027-11-25', label: 'Thanksgiving' },
      { date: '2027-12-24', label: 'Christmas (observed)' }
    ],
    2028: [
      { date: '2028-01-01', label: 'New Year\'s Day' },
      { date: '2028-01-17', label: 'MLK Day' },
      { date: '2028-02-21', label: 'Presidents\' Day' },
      { date: '2028-05-29', label: 'Memorial Day' },
      { date: '2028-06-19', label: 'Juneteenth' },
      { date: '2028-07-04', label: 'Independence Day' },
      { date: '2028-09-04', label: 'Labor Day' },
      { date: '2028-11-23', label: 'Thanksgiving' },
      { date: '2028-12-25', label: 'Christmas' }
    ],
    2029: [
      { date: '2029-01-01', label: 'New Year\'s Day' },
      { date: '2029-01-15', label: 'MLK Day' },
      { date: '2029-02-19', label: 'Presidents\' Day' },
      { date: '2029-05-28', label: 'Memorial Day' },
      { date: '2029-06-19', label: 'Juneteenth' },
      { date: '2029-07-04', label: 'Independence Day' },
      { date: '2029-09-03', label: 'Labor Day' },
      { date: '2029-11-22', label: 'Thanksgiving' },
      { date: '2029-12-25', label: 'Christmas' }
    ],
    2030: [
      { date: '2030-01-01', label: 'New Year\'s Day' },
      { date: '2030-01-21', label: 'MLK Day' },
      { date: '2030-02-18', label: 'Presidents\' Day' },
      { date: '2030-05-27', label: 'Memorial Day' },
      { date: '2030-06-19', label: 'Juneteenth' },
      { date: '2030-07-04', label: 'Independence Day' },
      { date: '2030-09-02', label: 'Labor Day' },
      { date: '2030-11-28', label: 'Thanksgiving' },
      { date: '2030-12-25', label: 'Christmas' }
    ]
  },
  NL: {
    2026: [
      { date: '2026-01-01', label: 'Nieuwjaarsdag' },
      { date: '2026-04-03', label: 'Goede Vrijdag' },
      { date: '2026-04-05', label: 'Pasen' },
      { date: '2026-04-06', label: 'Tweede Paasdag' },
      { date: '2026-04-27', label: 'Koningsdag' },
      { date: '2026-05-05', label: 'Bevrijdingsdag' },
      { date: '2026-05-14', label: 'Hemelvaartsdag' },
      { date: '2026-05-24', label: 'Pinksteren' },
      { date: '2026-05-25', label: 'Tweede Pinksterdag' },
      { date: '2026-12-25', label: 'Kerstmis' },
      { date: '2026-12-26', label: 'Tweede Kerstdag' }
    ],
    2027: [
      { date: '2027-01-01', label: 'Nieuwjaarsdag' },
      { date: '2027-03-26', label: 'Goede Vrijdag' },
      { date: '2027-03-28', label: 'Pasen' },
      { date: '2027-03-29', label: 'Tweede Paasdag' },
      { date: '2027-04-27', label: 'Koningsdag' },
      { date: '2027-05-05', label: 'Bevrijdingsdag' },
      { date: '2027-05-06', label: 'Hemelvaartsdag' },
      { date: '2027-05-16', label: 'Pinksteren' },
      { date: '2027-05-17', label: 'Tweede Pinksterdag' },
      { date: '2027-12-25', label: 'Kerstmis' },
      { date: '2027-12-26', label: 'Tweede Kerstdag' }
    ],
    2028: [
      { date: '2028-01-01', label: 'Nieuwjaarsdag' },
      { date: '2028-04-14', label: 'Goede Vrijdag' },
      { date: '2028-04-16', label: 'Pasen' },
      { date: '2028-04-17', label: 'Tweede Paasdag' },
      { date: '2028-04-27', label: 'Koningsdag' },
      { date: '2028-05-05', label: 'Bevrijdingsdag' },
      { date: '2028-05-25', label: 'Hemelvaartsdag' },
      { date: '2028-06-04', label: 'Pinksteren' },
      { date: '2028-06-05', label: 'Tweede Pinksterdag' },
      { date: '2028-12-25', label: 'Kerstmis' },
      { date: '2028-12-26', label: 'Tweede Kerstdag' }
    ],
    2029: [
      { date: '2029-01-01', label: 'Nieuwjaarsdag' },
      { date: '2029-03-30', label: 'Goede Vrijdag' },
      { date: '2029-04-01', label: 'Pasen' },
      { date: '2029-04-02', label: 'Tweede Paasdag' },
      { date: '2029-04-27', label: 'Koningsdag' },
      { date: '2029-05-05', label: 'Bevrijdingsdag' },
      { date: '2029-05-10', label: 'Hemelvaartsdag' },
      { date: '2029-05-20', label: 'Pinksteren' },
      { date: '2029-05-21', label: 'Tweede Pinksterdag' },
      { date: '2029-12-25', label: 'Kerstmis' },
      { date: '2029-12-26', label: 'Tweede Kerstdag' }
    ],
    2030: [
      { date: '2030-01-01', label: 'Nieuwjaarsdag' },
      { date: '2030-04-19', label: 'Goede Vrijdag' },
      { date: '2030-04-21', label: 'Pasen' },
      { date: '2030-04-22', label: 'Tweede Paasdag' },
      { date: '2030-04-27', label: 'Koningsdag' },
      { date: '2030-05-05', label: 'Bevrijdingsdag' },
      { date: '2030-05-30', label: 'Hemelvaartsdag' },
      { date: '2030-06-09', label: 'Pinksteren' },
      { date: '2030-06-10', label: 'Tweede Pinksterdag' },
      { date: '2030-12-25', label: 'Kerstmis' },
      { date: '2030-12-26', label: 'Tweede Kerstdag' }
    ]
  },
  PT: {
    2026: [
      { date: '2026-01-01', label: 'Ano Novo' },
      { date: '2026-04-03', label: 'Sexta-feira Santa' },
      { date: '2026-04-05', label: 'Pascoa' },
      { date: '2026-04-25', label: 'Dia da Liberdade' },
      { date: '2026-05-01', label: 'Dia do Trabalhador' },
      { date: '2026-06-04', label: 'Corpo de Deus' },
      { date: '2026-06-10', label: 'Dia de Portugal' },
      { date: '2026-08-15', label: 'Assuncao' },
      { date: '2026-10-05', label: 'Implantacao da Republica' },
      { date: '2026-11-01', label: 'Todos os Santos' },
      { date: '2026-12-01', label: 'Restauracao da Independencia' },
      { date: '2026-12-08', label: 'Imaculada Conceicao' },
      { date: '2026-12-25', label: 'Natal' }
    ],
    2027: [
      { date: '2027-01-01', label: 'Ano Novo' },
      { date: '2027-03-26', label: 'Sexta-feira Santa' },
      { date: '2027-03-28', label: 'Pascoa' },
      { date: '2027-04-25', label: 'Dia da Liberdade' },
      { date: '2027-05-01', label: 'Dia do Trabalhador' },
      { date: '2027-05-27', label: 'Corpo de Deus' },
      { date: '2027-06-10', label: 'Dia de Portugal' },
      { date: '2027-08-15', label: 'Assuncao' },
      { date: '2027-10-05', label: 'Implantacao da Republica' },
      { date: '2027-11-01', label: 'Todos os Santos' },
      { date: '2027-12-01', label: 'Restauracao da Independencia' },
      { date: '2027-12-08', label: 'Imaculada Conceicao' },
      { date: '2027-12-25', label: 'Natal' }
    ],
    2028: [
      { date: '2028-01-01', label: 'Ano Novo' },
      { date: '2028-04-14', label: 'Sexta-feira Santa' },
      { date: '2028-04-16', label: 'Pascoa' },
      { date: '2028-04-25', label: 'Dia da Liberdade' },
      { date: '2028-05-01', label: 'Dia do Trabalhador' },
      { date: '2028-06-08', label: 'Corpo de Deus' },
      { date: '2028-06-10', label: 'Dia de Portugal' },
      { date: '2028-08-15', label: 'Assuncao' },
      { date: '2028-10-05', label: 'Implantacao da Republica' },
      { date: '2028-11-01', label: 'Todos os Santos' },
      { date: '2028-12-01', label: 'Restauracao da Independencia' },
      { date: '2028-12-08', label: 'Imaculada Conceicao' },
      { date: '2028-12-25', label: 'Natal' }
    ],
    2029: [
      { date: '2029-01-01', label: 'Ano Novo' },
      { date: '2029-03-30', label: 'Sexta-feira Santa' },
      { date: '2029-04-01', label: 'Pascoa' },
      { date: '2029-04-25', label: 'Dia da Liberdade' },
      { date: '2029-05-01', label: 'Dia do Trabalhador' },
      { date: '2029-05-24', label: 'Corpo de Deus' },
      { date: '2029-06-10', label: 'Dia de Portugal' },
      { date: '2029-08-15', label: 'Assuncao' },
      { date: '2029-10-05', label: 'Implantacao da Republica' },
      { date: '2029-11-01', label: 'Todos os Santos' },
      { date: '2029-12-01', label: 'Restauracao da Independencia' },
      { date: '2029-12-08', label: 'Imaculada Conceicao' },
      { date: '2029-12-25', label: 'Natal' }
    ],
    2030: [
      { date: '2030-01-01', label: 'Ano Novo' },
      { date: '2030-04-19', label: 'Sexta-feira Santa' },
      { date: '2030-04-21', label: 'Pascoa' },
      { date: '2030-04-25', label: 'Dia da Liberdade' },
      { date: '2030-05-01', label: 'Dia do Trabalhador' },
      { date: '2030-06-10', label: 'Dia de Portugal' },
      { date: '2030-06-13', label: 'Corpo de Deus' },
      { date: '2030-08-15', label: 'Assuncao' },
      { date: '2030-10-05', label: 'Implantacao da Republica' },
      { date: '2030-11-01', label: 'Todos os Santos' },
      { date: '2030-12-01', label: 'Restauracao da Independencia' },
      { date: '2030-12-08', label: 'Imaculada Conceicao' },
      { date: '2030-12-25', label: 'Natal' }
    ]
  },
  AT: {
    2026: [
      { date: '2026-01-01', label: 'Neujahr' },
      { date: '2026-01-06', label: 'Heilige Drei Konige' },
      { date: '2026-04-06', label: 'Ostermontag' },
      { date: '2026-05-01', label: 'Staatsfeiertag' },
      { date: '2026-05-14', label: 'Christi Himmelfahrt' },
      { date: '2026-05-25', label: 'Pfingstmontag' },
      { date: '2026-06-04', label: 'Fronleichnam' },
      { date: '2026-08-15', label: 'Maria Himmelfahrt' },
      { date: '2026-10-26', label: 'Nationalfeiertag' },
      { date: '2026-11-01', label: 'Allerheiligen' },
      { date: '2026-12-08', label: 'Maria Empfangnis' },
      { date: '2026-12-25', label: 'Weihnachten' },
      { date: '2026-12-26', label: 'Stefanitag' }
    ],
    2027: [
      { date: '2027-01-01', label: 'Neujahr' },
      { date: '2027-01-06', label: 'Heilige Drei Konige' },
      { date: '2027-03-29', label: 'Ostermontag' },
      { date: '2027-05-01', label: 'Staatsfeiertag' },
      { date: '2027-05-06', label: 'Christi Himmelfahrt' },
      { date: '2027-05-17', label: 'Pfingstmontag' },
      { date: '2027-05-27', label: 'Fronleichnam' },
      { date: '2027-08-15', label: 'Maria Himmelfahrt' },
      { date: '2027-10-26', label: 'Nationalfeiertag' },
      { date: '2027-11-01', label: 'Allerheiligen' },
      { date: '2027-12-08', label: 'Maria Empfangnis' },
      { date: '2027-12-25', label: 'Weihnachten' },
      { date: '2027-12-26', label: 'Stefanitag' }
    ],
    2028: [
      { date: '2028-01-01', label: 'Neujahr' },
      { date: '2028-01-06', label: 'Heilige Drei Konige' },
      { date: '2028-04-17', label: 'Ostermontag' },
      { date: '2028-05-01', label: 'Staatsfeiertag' },
      { date: '2028-05-25', label: 'Christi Himmelfahrt' },
      { date: '2028-06-05', label: 'Pfingstmontag' },
      { date: '2028-06-15', label: 'Fronleichnam' },
      { date: '2028-08-15', label: 'Maria Himmelfahrt' },
      { date: '2028-10-26', label: 'Nationalfeiertag' },
      { date: '2028-11-01', label: 'Allerheiligen' },
      { date: '2028-12-08', label: 'Maria Empfangnis' },
      { date: '2028-12-25', label: 'Weihnachten' },
      { date: '2028-12-26', label: 'Stefanitag' }
    ],
    2029: [
      { date: '2029-01-01', label: 'Neujahr' },
      { date: '2029-01-06', label: 'Heilige Drei Konige' },
      { date: '2029-04-02', label: 'Ostermontag' },
      { date: '2029-05-01', label: 'Staatsfeiertag' },
      { date: '2029-05-10', label: 'Christi Himmelfahrt' },
      { date: '2029-05-21', label: 'Pfingstmontag' },
      { date: '2029-05-31', label: 'Fronleichnam' },
      { date: '2029-08-15', label: 'Maria Himmelfahrt' },
      { date: '2029-10-26', label: 'Nationalfeiertag' },
      { date: '2029-11-01', label: 'Allerheiligen' },
      { date: '2029-12-08', label: 'Maria Empfangnis' },
      { date: '2029-12-25', label: 'Weihnachten' },
      { date: '2029-12-26', label: 'Stefanitag' }
    ],
    2030: [
      { date: '2030-01-01', label: 'Neujahr' },
      { date: '2030-01-06', label: 'Heilige Drei Konige' },
      { date: '2030-04-22', label: 'Ostermontag' },
      { date: '2030-05-01', label: 'Staatsfeiertag' },
      { date: '2030-05-30', label: 'Christi Himmelfahrt' },
      { date: '2030-06-10', label: 'Pfingstmontag' },
      { date: '2030-06-20', label: 'Fronleichnam' },
      { date: '2030-08-15', label: 'Maria Himmelfahrt' },
      { date: '2030-10-26', label: 'Nationalfeiertag' },
      { date: '2030-11-01', label: 'Allerheiligen' },
      { date: '2030-12-08', label: 'Maria Empfangnis' },
      { date: '2030-12-25', label: 'Weihnachten' },
      { date: '2030-12-26', label: 'Stefanitag' }
    ]
  },
  BE: {
    2026: [
      { date: '2026-01-01', label: 'Nieuwjaar' },
      { date: '2026-04-06', label: 'Paasmaandag' },
      { date: '2026-05-01', label: 'Dag van de Arbeid' },
      { date: '2026-05-14', label: 'Hemelvaart' },
      { date: '2026-05-25', label: 'Pinkstermaandag' },
      { date: '2026-07-21', label: 'Nationale Feestdag' },
      { date: '2026-08-15', label: 'O.L.V. Hemelvaart' },
      { date: '2026-11-01', label: 'Allerheiligen' },
      { date: '2026-11-11', label: 'Wapenstilstand' },
      { date: '2026-12-25', label: 'Kerstmis' }
    ],
    2027: [
      { date: '2027-01-01', label: 'Nieuwjaar' },
      { date: '2027-03-29', label: 'Paasmaandag' },
      { date: '2027-05-01', label: 'Dag van de Arbeid' },
      { date: '2027-05-06', label: 'Hemelvaart' },
      { date: '2027-05-17', label: 'Pinkstermaandag' },
      { date: '2027-07-21', label: 'Nationale Feestdag' },
      { date: '2027-08-15', label: 'O.L.V. Hemelvaart' },
      { date: '2027-11-01', label: 'Allerheiligen' },
      { date: '2027-11-11', label: 'Wapenstilstand' },
      { date: '2027-12-25', label: 'Kerstmis' }
    ],
    2028: [
      { date: '2028-01-01', label: 'Nieuwjaar' },
      { date: '2028-04-17', label: 'Paasmaandag' },
      { date: '2028-05-01', label: 'Dag van de Arbeid' },
      { date: '2028-05-25', label: 'Hemelvaart' },
      { date: '2028-06-05', label: 'Pinkstermaandag' },
      { date: '2028-07-21', label: 'Nationale Feestdag' },
      { date: '2028-08-15', label: 'O.L.V. Hemelvaart' },
      { date: '2028-11-01', label: 'Allerheiligen' },
      { date: '2028-11-11', label: 'Wapenstilstand' },
      { date: '2028-12-25', label: 'Kerstmis' }
    ],
    2029: [
      { date: '2029-01-01', label: 'Nieuwjaar' },
      { date: '2029-04-02', label: 'Paasmaandag' },
      { date: '2029-05-01', label: 'Dag van de Arbeid' },
      { date: '2029-05-10', label: 'Hemelvaart' },
      { date: '2029-05-21', label: 'Pinkstermaandag' },
      { date: '2029-07-21', label: 'Nationale Feestdag' },
      { date: '2029-08-15', label: 'O.L.V. Hemelvaart' },
      { date: '2029-11-01', label: 'Allerheiligen' },
      { date: '2029-11-11', label: 'Wapenstilstand' },
      { date: '2029-12-25', label: 'Kerstmis' }
    ],
    2030: [
      { date: '2030-01-01', label: 'Nieuwjaar' },
      { date: '2030-04-22', label: 'Paasmaandag' },
      { date: '2030-05-01', label: 'Dag van de Arbeid' },
      { date: '2030-05-30', label: 'Hemelvaart' },
      { date: '2030-06-10', label: 'Pinkstermaandag' },
      { date: '2030-07-21', label: 'Nationale Feestdag' },
      { date: '2030-08-15', label: 'O.L.V. Hemelvaart' },
      { date: '2030-11-01', label: 'Allerheiligen' },
      { date: '2030-11-11', label: 'Wapenstilstand' },
      { date: '2030-12-25', label: 'Kerstmis' }
    ]
  },
  AU: {
    2026: [
      { date: '2026-01-01', label: 'New Year\'s Day' },
      { date: '2026-01-26', label: 'Australia Day' },
      { date: '2026-04-03', label: 'Good Friday' },
      { date: '2026-04-04', label: 'Saturday before Easter' },
      { date: '2026-04-06', label: 'Easter Monday' },
      { date: '2026-04-25', label: 'Anzac Day' },
      { date: '2026-06-08', label: 'Queen\'s Birthday' },
      { date: '2026-12-25', label: 'Christmas Day' },
      { date: '2026-12-28', label: 'Boxing Day (substitute)' }
    ],
    2027: [
      { date: '2027-01-01', label: 'New Year\'s Day' },
      { date: '2027-01-26', label: 'Australia Day' },
      { date: '2027-03-26', label: 'Good Friday' },
      { date: '2027-03-27', label: 'Saturday before Easter' },
      { date: '2027-03-29', label: 'Easter Monday' },
      { date: '2027-04-25', label: 'Anzac Day' },
      { date: '2027-06-14', label: 'Queen\'s Birthday' },
      { date: '2027-12-27', label: 'Christmas Day (substitute)' },
      { date: '2027-12-28', label: 'Boxing Day (substitute)' }
    ],
    2028: [
      { date: '2028-01-01', label: 'New Year\'s Day' },
      { date: '2028-01-26', label: 'Australia Day' },
      { date: '2028-04-14', label: 'Good Friday' },
      { date: '2028-04-15', label: 'Saturday before Easter' },
      { date: '2028-04-17', label: 'Easter Monday' },
      { date: '2028-04-25', label: 'Anzac Day' },
      { date: '2028-06-12', label: 'Queen\'s Birthday' },
      { date: '2028-12-25', label: 'Christmas Day' },
      { date: '2028-12-26', label: 'Boxing Day' }
    ],
    2029: [
      { date: '2029-01-01', label: 'New Year\'s Day' },
      { date: '2029-01-26', label: 'Australia Day' },
      { date: '2029-03-30', label: 'Good Friday' },
      { date: '2029-03-31', label: 'Saturday before Easter' },
      { date: '2029-04-02', label: 'Easter Monday' },
      { date: '2029-04-25', label: 'Anzac Day' },
      { date: '2029-06-11', label: 'Queen\'s Birthday' },
      { date: '2029-12-25', label: 'Christmas Day' },
      { date: '2029-12-26', label: 'Boxing Day' }
    ],
    2030: [
      { date: '2030-01-01', label: 'New Year\'s Day' },
      { date: '2030-01-28', label: 'Australia Day (substitute)' },
      { date: '2030-04-19', label: 'Good Friday' },
      { date: '2030-04-20', label: 'Saturday before Easter' },
      { date: '2030-04-22', label: 'Easter Monday' },
      { date: '2030-04-25', label: 'Anzac Day' },
      { date: '2030-06-10', label: 'Queen\'s Birthday' },
      { date: '2030-12-25', label: 'Christmas Day' },
      { date: '2030-12-26', label: 'Boxing Day' }
    ]
  }
};

function importNationalHolidays(calId) {
  const countryEl = document.getElementById('cal-preset-country');
  const yearEl = document.getElementById('cal-preset-year');
  if (!countryEl || !countryEl.value) { showToast('Select a country', 'error'); return; }
  const country = countryEl.value;
  const year = yearEl ? yearEl.value : '2026';
  const presets = NATIONAL_HOLIDAYS[country]?.[year];
  if (!presets || presets.length === 0) { showToast('No holidays available for this selection', 'error'); return; }

  const cal = calendars[calId];
  if (!cal) return;

  // Check for duplicates
  const existingDates = new Set(cal.entries.filter(e => e.type === 'holiday').map(e => e.date));
  let added = 0;
  let skipped = 0;
  for (const h of presets) {
    if (existingDates.has(h.date)) {
      skipped++;
      continue;
    }
    cal.entries.push({ type: 'holiday', date: h.date, label: h.label });
    added++;
  }

  // Sort entries by date
  cal.entries.sort((a, b) => {
    const dA = a.date || a.startDate || '';
    const dB = b.date || b.startDate || '';
    return dA.localeCompare(dB);
  });

  invalidateHolidayCache();
  recalcFinishDates();
  renderSettingsBody();
  renderAll();
  scheduleSave();

  const msg = added + ' holidays imported' + (skipped > 0 ? ', ' + skipped + ' duplicates skipped' : '');
  showToast(msg, 'success');
}

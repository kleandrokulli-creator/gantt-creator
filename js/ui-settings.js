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
  calendars[calId].entries.push({ type: 'holiday', date: dateEl.value, label: labelEl.value || 'Holiday' });
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

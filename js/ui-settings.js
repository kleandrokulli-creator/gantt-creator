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
        </select>
        <select id="cal-preset-year" style="padding:4px 8px;border-radius:6px;border:1px solid var(--border);font-size:.8rem">
          <option value="2025">2025</option>
          <option value="2026" selected>2026</option>
          <option value="2027">2027</option>
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
    2025: [
      { date: '2025-01-01', label: 'Capodanno' },
      { date: '2025-01-06', label: 'Epifania' },
      { date: '2025-04-20', label: 'Pasqua' },
      { date: '2025-04-21', label: 'Lunedi Angelo' },
      { date: '2025-04-25', label: 'Liberazione' },
      { date: '2025-05-01', label: 'Festa del Lavoro' },
      { date: '2025-06-02', label: 'Festa della Repubblica' },
      { date: '2025-08-15', label: 'Ferragosto' },
      { date: '2025-11-01', label: 'Ognissanti' },
      { date: '2025-12-08', label: 'Immacolata Concezione' },
      { date: '2025-12-25', label: 'Natale' },
      { date: '2025-12-26', label: 'Santo Stefano' }
    ],
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
    ]
  },
  UK: {
    2025: [
      { date: '2025-01-01', label: 'New Year' },
      { date: '2025-04-18', label: 'Good Friday' },
      { date: '2025-04-21', label: 'Easter Monday' },
      { date: '2025-05-05', label: 'Early May Bank' },
      { date: '2025-05-26', label: 'Spring Bank' },
      { date: '2025-08-25', label: 'Summer Bank' },
      { date: '2025-12-25', label: 'Christmas' },
      { date: '2025-12-26', label: 'Boxing Day' }
    ],
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
    ]
  },
  DE: {
    2025: [
      { date: '2025-01-01', label: 'Neujahr' },
      { date: '2025-04-18', label: 'Karfreitag' },
      { date: '2025-04-21', label: 'Ostermontag' },
      { date: '2025-05-01', label: 'Tag der Arbeit' },
      { date: '2025-05-29', label: 'Christi Himmelfahrt' },
      { date: '2025-06-09', label: 'Pfingstmontag' },
      { date: '2025-10-03', label: 'Tag der Deutschen Einheit' },
      { date: '2025-12-25', label: 'Weihnachten' },
      { date: '2025-12-26', label: 'Zweiter Weihnachtsfeiertag' }
    ],
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
    ]
  },
  FR: {
    2025: [
      { date: '2025-01-01', label: 'Jour de l\'An' },
      { date: '2025-04-21', label: 'Lundi de Paques' },
      { date: '2025-05-01', label: 'Fete du Travail' },
      { date: '2025-05-08', label: 'Victoire 1945' },
      { date: '2025-05-29', label: 'Ascension' },
      { date: '2025-06-09', label: 'Lundi de Pentecote' },
      { date: '2025-07-14', label: 'Fete Nationale' },
      { date: '2025-08-15', label: 'Assomption' },
      { date: '2025-11-01', label: 'Toussaint' },
      { date: '2025-11-11', label: 'Armistice' },
      { date: '2025-12-25', label: 'Noel' }
    ],
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
    ]
  },
  ES: {
    2025: [
      { date: '2025-01-01', label: 'Ano Nuevo' },
      { date: '2025-01-06', label: 'Epifania' },
      { date: '2025-04-18', label: 'Viernes Santo' },
      { date: '2025-05-01', label: 'Dia del Trabajo' },
      { date: '2025-08-15', label: 'Asuncion' },
      { date: '2025-10-12', label: 'Fiesta Nacional' },
      { date: '2025-11-01', label: 'Todos los Santos' },
      { date: '2025-12-06', label: 'Dia de la Constitucion' },
      { date: '2025-12-08', label: 'Inmaculada Concepcion' },
      { date: '2025-12-25', label: 'Navidad' }
    ],
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
    ]
  },
  US: {
    2025: [
      { date: '2025-01-01', label: 'New Year\'s Day' },
      { date: '2025-01-20', label: 'MLK Day' },
      { date: '2025-02-17', label: 'Presidents\' Day' },
      { date: '2025-05-26', label: 'Memorial Day' },
      { date: '2025-06-19', label: 'Juneteenth' },
      { date: '2025-07-04', label: 'Independence Day' },
      { date: '2025-09-01', label: 'Labor Day' },
      { date: '2025-11-27', label: 'Thanksgiving' },
      { date: '2025-12-25', label: 'Christmas' }
    ],
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
    ]
  },
  NL: {
    2025: [
      { date: '2025-01-01', label: 'Nieuwjaarsdag' },
      { date: '2025-04-18', label: 'Goede Vrijdag' },
      { date: '2025-04-20', label: 'Pasen' },
      { date: '2025-04-21', label: 'Tweede Paasdag' },
      { date: '2025-04-26', label: 'Koningsdag' },
      { date: '2025-05-05', label: 'Bevrijdingsdag' },
      { date: '2025-05-29', label: 'Hemelvaartsdag' },
      { date: '2025-06-08', label: 'Pinksteren' },
      { date: '2025-06-09', label: 'Tweede Pinksterdag' },
      { date: '2025-12-25', label: 'Kerstmis' },
      { date: '2025-12-26', label: 'Tweede Kerstdag' }
    ],
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
    ]
  },
  PT: {
    2025: [
      { date: '2025-01-01', label: 'Ano Novo' },
      { date: '2025-04-18', label: 'Sexta-feira Santa' },
      { date: '2025-04-20', label: 'Pascoa' },
      { date: '2025-04-25', label: 'Dia da Liberdade' },
      { date: '2025-05-01', label: 'Dia do Trabalhador' },
      { date: '2025-06-10', label: 'Dia de Portugal' },
      { date: '2025-06-19', label: 'Corpo de Deus' },
      { date: '2025-08-15', label: 'Assuncao' },
      { date: '2025-10-05', label: 'Implantacao da Republica' },
      { date: '2025-11-01', label: 'Todos os Santos' },
      { date: '2025-12-01', label: 'Restauracao da Independencia' },
      { date: '2025-12-08', label: 'Imaculada Conceicao' },
      { date: '2025-12-25', label: 'Natal' }
    ],
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
    ]
  },
  AT: {
    2025: [
      { date: '2025-01-01', label: 'Neujahr' },
      { date: '2025-01-06', label: 'Heilige Drei Konige' },
      { date: '2025-04-21', label: 'Ostermontag' },
      { date: '2025-05-01', label: 'Staatsfeiertag' },
      { date: '2025-05-29', label: 'Christi Himmelfahrt' },
      { date: '2025-06-09', label: 'Pfingstmontag' },
      { date: '2025-06-19', label: 'Fronleichnam' },
      { date: '2025-08-15', label: 'Maria Himmelfahrt' },
      { date: '2025-10-26', label: 'Nationalfeiertag' },
      { date: '2025-11-01', label: 'Allerheiligen' },
      { date: '2025-12-08', label: 'Maria Empfangnis' },
      { date: '2025-12-25', label: 'Weihnachten' },
      { date: '2025-12-26', label: 'Stefanitag' }
    ],
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
    ]
  },
  BE: {
    2025: [
      { date: '2025-01-01', label: 'Nieuwjaar' },
      { date: '2025-04-21', label: 'Paasmaandag' },
      { date: '2025-05-01', label: 'Dag van de Arbeid' },
      { date: '2025-05-29', label: 'Hemelvaart' },
      { date: '2025-06-09', label: 'Pinkstermaandag' },
      { date: '2025-07-21', label: 'Nationale Feestdag' },
      { date: '2025-08-15', label: 'O.L.V. Hemelvaart' },
      { date: '2025-11-01', label: 'Allerheiligen' },
      { date: '2025-11-11', label: 'Wapenstilstand' },
      { date: '2025-12-25', label: 'Kerstmis' }
    ],
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

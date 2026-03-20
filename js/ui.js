/* ===================================================================
   UI.JS — Edit panel, settings modal, tooltip, interactions
   =================================================================== */

/* ---------- EXPORT DROPDOWN ---------- */

let _exportMenuListener = null;

function toggleExportMenu() {
  const menu = document.getElementById('export-menu');
  if (!menu) return;
  const isOpen = menu.classList.contains('open');
  if (isOpen) {
    closeExportMenu();
  } else {
    // Position menu using fixed coords so it escapes any overflow:hidden/auto parent
    const btn = document.querySelector('#export-dropdown > button');
    if (btn) {
      const r = btn.getBoundingClientRect();
      menu.style.position = 'fixed';
      menu.style.top = (r.bottom + 4) + 'px';
      menu.style.right = (window.innerWidth - r.right) + 'px';
      menu.style.left = 'auto';
    }
    menu.classList.add('open');
    // Clean up any stale listener before adding new one
    if (_exportMenuListener) document.removeEventListener('click', _exportMenuListener);
    _exportMenuListener = function(e) {
      if (!e.target.closest('#export-dropdown')) closeExportMenu();
    };
    setTimeout(() => document.addEventListener('click', _exportMenuListener), 0);
  }
}

function closeExportMenu() {
  const menu = document.getElementById('export-menu');
  if (menu) menu.classList.remove('open');
  if (_exportMenuListener) {
    document.removeEventListener('click', _exportMenuListener);
    _exportMenuListener = null;
  }
}

/* ---------- EDIT PANEL ---------- */

let _epInitialAutoColor = '';   // tracks the auto-color when panel first opened

function openEditPanel(taskId) {
  editPanelTaskId = taskId;
  const task = allTasks.find(t => t.id === taskId);
  if (!task) return;
  const panel = DOM.editPanel;
  const pct = Math.round(task.percentComplete * 100);
  const isParent = task.children && task.children.length > 0;
  const bucketsArr = getAllBuckets();
  const allLabels = Object.keys(LABEL_COLORS);
  // Store the auto-color at panel-open time so saveEditPanel can detect user changes
  _epInitialAutoColor = ((task.bucket && BUCKET_COLORS[task.bucket]) ? BUCKET_COLORS[task.bucket]
    : (task.labels?.length > 0 ? (LABEL_COLORS[task.labels[0]] || DEFAULT_COLOR) : DEFAULT_COLOR)).toLowerCase();
  allTasks.forEach(t => t.labels.forEach(l => { if (!allLabels.includes(l)) allLabels.push(l); }));

  let html = `
    <div class="ep-header">
      <span class="ep-title" style="color:${task.color}">Edit task</span>
      <button class="ep-close" onclick="closeEditPanel()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
    </div>
    <div class="ep-field">
      <label>Task name</label>
      <input type="text" id="ep-name" value="${esc(task.name)}">
    </div>
    <div class="ep-field">
      <label>Start date</label>
      <input type="date" id="ep-start" value="${task.start ? dateToInputStr(task.start) : ''}">
    </div>
    <div class="ep-field">
      <label>End date</label>
      <input type="date" id="ep-finish" value="${task.finish ? dateToInputStr(task.finish) : ''}">
    </div>
    <div class="ep-field">
      <label>Duration <span style="font-weight:400;font-size:.7rem;color:var(--grey-txt)">(${workingDaysMode ? 'working' : 'calendar'} days)</span></label>
      <div style="display:flex;gap:6px;align-items:center">
        <input type="number" id="ep-duration-num" min="0" value="${parseInt(task.duration) || 0}" style="width:70px">
        <span style="color:var(--grey-txt);font-size:.85rem">days</span>
      </div>
    </div>
    <div class="ep-field">
      <label>Completion${isParent ? ' <span style="font-weight:400;font-size:.7rem;color:var(--grey-txt)">(auto-calcolato dai sotto-task)</span>' : ''}</label>
      <div class="ep-slider-wrap" style="--pct:${pct}%">
        <input type="range" id="ep-pct" min="0" max="100" value="${pct}" ${isParent ? 'disabled' : ''}>
        <span id="ep-pct-val" class="${pct >= 100 ? 'pct-done' : pct > 0 ? 'pct-partial' : ''}">${pct}%</span>
      </div>
    </div>
    <div class="ep-field">
      <label>Labels</label>
      <div class="ep-tags" id="ep-tags">
        ${allLabels.map(l => {
          const c = LABEL_COLORS[l] || '#64748B';
          const sel = task.labels.includes(l) ? 'selected' : '';
          return `<span class="ep-tag ${sel}" data-label="${esc(l)}" style="background:${c}22;color:${c};${sel ? 'border-color:' + c : ''}" onclick="toggleEpTag(this,'${esc(l)}')">${esc(l)}</span>`;
        }).join('')}
      </div>
    </div>
    <div class="ep-field">
      <label>Bucket</label>
      <select id="ep-bucket">${bucketsArr.map(b => `<option value="${b}" ${b === task.bucket ? 'selected' : ''}>${b || '— None —'}</option>`).join('')}</select>
    </div>
    <div class="ep-field">
      <label>Priority</label>
      <select id="ep-priority">${['', 'Urgent', 'Important', 'Medium', 'Low'].map(p => `<option value="${p}" ${p === task.priority ? 'selected' : ''}>${p || '— None —'}</option>`).join('')}</select>
    </div>
    <div class="ep-field">
      <label>Dependencies</label>
      <input type="text" id="ep-depends" value="${esc(task.dependsOn)}" title="${esc(buildDepTooltip(task.dependsOn))}">
    </div>
    <div class="ep-field">
      <label>Effort</label>
      <input type="text" id="ep-effort" value="${esc(String(task.effort || ''))}">
    </div>
    <div class="ep-field">
      <label>Note</label>
      <textarea id="ep-notes">${esc(task.notes || '')}</textarea>
    </div>
    <div class="ep-field">
      <label>Calendar</label>
      <select id="ep-calendar">${Object.keys(calendars).filter(id => !calendars[id].isDefault || calendars[id].entries.length > 0).map(id => `<option value="${id}" ${id === (task.calendarId || getDefaultCalendarId()) ? 'selected' : ''}>${esc(calendars[id].name)}</option>`).join('')}${Object.keys(calendars).filter(id => !calendars[id].isDefault || calendars[id].entries.length > 0).length === 0 ? '<option value="" disabled>No calendars configured</option>' : ''}</select>
    </div>
    <div class="ep-field">
      <label>Bar color <span style="font-weight:400;font-size:.7rem;color:var(--grey-txt)">${task.colorOverride ? '(overridden)' : '(automatic)'}</span></label>
      <div class="ep-color-row">
        <span class="ep-color-auto" style="background:${task.bucket && BUCKET_COLORS[task.bucket] ? BUCKET_COLORS[task.bucket] : (task.labels?.length > 0 ? (LABEL_COLORS[task.labels[0]] || DEFAULT_COLOR) : DEFAULT_COLOR)}" title="Automatic color (from labels/bucket)"></span>
        <input type="color" id="ep-color" value="${task.colorOverride || task.color || DEFAULT_COLOR}" class="ep-color-picker ${task.colorOverride ? 'active' : ''}">
        <button class="ep-color-reset ${task.colorOverride ? '' : 'u-hidden'}" onclick="resetTaskColor()" title="Reset to automatic color">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 019-9 9.75 9.75 0 016.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 01-9 9 9.75 9.75 0 01-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg>
          Reset
        </button>
      </div>
    </div>
    <button style="background:var(--blue);color:#fff;border:none;border-radius:8px;padding:.5rem;cursor:pointer;font-family:inherit;font-weight:600;font-size:.85rem;text-align:center;transition:opacity .15s;display:flex;align-items:center;justify-content:center;gap:.3rem" onclick="addSubTask(${task.id})">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
      Add sub-task
    </button>
    <button class="ep-delete" onclick="deleteTask(${task.id})">Delete task</button>
  `;
  panel.innerHTML = html;
  DOM.editPanelOverlay.classList.add('open');
  snapshotUndo(); // Single undo snapshot when panel opens
  setTimeout(() => { const nameEl = document.getElementById('ep-name'); if (nameEl) nameEl.focus(); }, 100);

  // Slider live update during drag
  const epPctEl = document.getElementById('ep-pct');
  const epPctValEl = document.getElementById('ep-pct-val');
  if (epPctEl && !epPctEl.disabled) {
    epPctEl.addEventListener('input', () => {
      const v = epPctEl.value;
      epPctValEl.textContent = v + '%';
      epPctEl.parentElement.style.setProperty('--pct', v + '%');
      epPctValEl.className = v >= 100 ? 'pct-done' : v > 0 ? 'pct-partial' : '';
      clearTimeout(saveDebounce);
      saveDebounce = setTimeout(() => saveEditPanel(), DEBOUNCE_INPUT_MS);
    });
    epPctEl.addEventListener('change', () => {
      clearTimeout(saveDebounce);
      saveEditPanel();
    });
  }

  // Color picker
  const epColor = document.getElementById('ep-color');
  if (epColor) {
    epColor.addEventListener('input', () => {
      clearTimeout(saveDebounce);
      saveDebounce = setTimeout(() => saveEditPanel(), DEBOUNCE_INPUT_MS);
    });
    epColor.addEventListener('change', () => {
      clearTimeout(saveDebounce);
      saveEditPanel();
    });
  }

  // Text fields: save on input (debounced) and change (immediate)
  const textFields = ['ep-name', 'ep-bucket', 'ep-priority', 'ep-depends', 'ep-effort', 'ep-notes'];
  textFields.forEach(fid => {
    const el = document.getElementById(fid);
    if (!el) return;
    el.addEventListener('input', () => {
      clearTimeout(saveDebounce);
      saveDebounce = setTimeout(() => saveEditPanel(), DEBOUNCE_INPUT_MS);
    });
    el.addEventListener('change', () => {
      clearTimeout(saveDebounce);
      saveEditPanel();
    });
  });
  // Date fields: save ONLY on change (not input) to avoid saving
  // intermediate values when user navigates months in the date picker
  ['ep-start', 'ep-finish'].forEach(fid => {
    const el = document.getElementById(fid);
    if (!el) return;
    el.addEventListener('change', () => {
      clearTimeout(saveDebounce);
      saveEditPanel();
    });
  });
}

function resetTaskColor() {
  const task = allTasks.find(t => t.id === editPanelTaskId);
  if (!task) return;
  task.colorOverride = '';
  reassignColors();
  // Update the color picker UI and sync the initial tracker
  const epColor = document.getElementById('ep-color');
  if (epColor) {
    epColor.value = task.color || DEFAULT_COLOR;
    epColor.classList.remove('active');
    _epInitialAutoColor = (task.color || DEFAULT_COLOR).toLowerCase();
  }
  // Update the auto-color circle
  const autoCircle = document.querySelector('.ep-color-auto');
  if (autoCircle) autoCircle.style.background = task.color || DEFAULT_COLOR;
  showToast('Color reset to automatic', 'success', 2000);
  renderAll();
  scheduleSave();
}


/* ---------- LEGEND ---------- */

let legendOpen = false;

function toggleLegend() {
  legendOpen = !legendOpen;
  const bar = document.getElementById('legend-bar');
  const btn = document.getElementById('legend-toggle');
  if (!bar || !btn) return;
  if (legendOpen) {
    renderLegend();
    bar.classList.add('open');
    btn.classList.add('active');
  } else {
    bar.classList.remove('open');
    btn.classList.remove('active');
  }
}

function renderLegend() {
  const container = document.getElementById('legend-content');
  if (!container) return;
  let html = '';

  // Labels
  const labelEntries = Object.entries(LABEL_COLORS);
  if (labelEntries.length > 0) {
    html += '<div class="legend-section"><span class="legend-section-title">Labels:</span>';
    labelEntries.forEach(([name, color]) => {
      html += `<span class="legend-item"><span class="legend-swatch" style="background:${color}"></span>${esc(name)}</span>`;
    });
    html += '</div>';
  }

  // Buckets (only those actually used by tasks)
  const usedBuckets = new Set();
  allTasks.forEach(t => { if (t.bucket) usedBuckets.add(t.bucket); });
  const bucketEntries = Object.entries(BUCKET_COLORS).filter(([name]) => usedBuckets.has(name));
  if (bucketEntries.length > 0) {
    html += '<div class="legend-section"><span class="legend-section-title">Buckets:</span>';
    bucketEntries.forEach(([name, color]) => {
      html += `<span class="legend-item"><span class="legend-swatch" style="background:${color}"></span>${esc(name)}</span>`;
    });
    html += '</div>';
  }

  // Priority / Milestones
  html += '<div class="legend-section"><span class="legend-section-title">Milestones:</span>';
  PRIORITY_OPTIONS.forEach(p => {
    const color = PRIORITY_COLORS[p] || DEFAULT_COLOR;
    html += `<span class="legend-item"><span class="legend-star">${starSVG(10, color)}</span>${esc(p)}</span>`;
  });
  html += '</div>';

  container.innerHTML = html;
}

// Auto-refresh legend when settings change
const _origRenderSettingsBody = typeof renderSettingsBody === 'function' ? null : null;
function refreshLegendIfOpen() {
  if (legendOpen) renderLegend();
}


function toggleEpTag(el, label) {
  el.classList.toggle('selected');
  const c = LABEL_COLORS[label] || '#64748B';
  el.style.borderColor = el.classList.contains('selected') ? c : 'transparent';

  // Immediately sync labels + colors to the task and re-render the bar
  const task = allTasks.find(t => t.id === editPanelTaskId);
  if (task) {
    const tags = document.querySelectorAll('#ep-tags .ep-tag.selected');
    task.labels = [...tags].map(t => t.dataset.label);
    task.colorOverride = '';          // clear any stale override
    reassignColors();

    // Update the color picker to reflect the new auto-color
    const epColor = document.getElementById('ep-color');
    if (epColor) {
      epColor.value = task.color || DEFAULT_COLOR;
      _epInitialAutoColor = (task.color || DEFAULT_COLOR).toLowerCase();
      epColor.classList.toggle('active', false);
    }
    // Update the auto-color circle and status text
    const autoCircle = document.querySelector('.ep-color-auto');
    if (autoCircle) autoCircle.style.background = task.color || DEFAULT_COLOR;
    const statusSpan = document.querySelector('.ep-field label span');

    if (currentTab === 'roadmap') renderAll();
    if (typeof refreshLegendIfOpen === 'function') refreshLegendIfOpen();
  }

  clearTimeout(saveDebounce);
  saveDebounce = setTimeout(() => saveEditPanel(), DEBOUNCE_INPUT_MS);
}

/* ---------- DATA TABLE LABEL PICKER ---------- */

function openDataLabelPicker(cell, taskId) {
  // Remove any existing picker
  const old = document.querySelector('.dt-label-picker');
  if (old) old.remove();

  const task = allTasks.find(t => t.id === taskId);
  if (!task) return;

  const allLabels = Object.keys(LABEL_COLORS);
  allTasks.forEach(t => t.labels.forEach(l => { if (!allLabels.includes(l)) allLabels.push(l); }));

  const picker = document.createElement('div');
  picker.className = 'dt-label-picker';
  allLabels.forEach(l => {
    const c = LABEL_COLORS[l] || '#64748B';
    const sel = task.labels.includes(l);
    const tag = document.createElement('span');
    tag.className = 'ep-tag' + (sel ? ' selected' : '');
    tag.textContent = l;
    tag.style.cssText = `background:${c}22;color:${c};border-color:${sel ? c : 'transparent'}`;
    tag.onclick = function(e) {
      e.stopPropagation();
      const idx = task.labels.indexOf(l);
      if (idx >= 0) task.labels.splice(idx, 1);
      else task.labels.push(l);
      const nowSel = task.labels.includes(l);
      tag.classList.toggle('selected', nowSel);
      tag.style.borderColor = nowSel ? c : 'transparent';
      snapshotUndo();
      rebuildAfterChange();
      // Update the tags display in the cell
      const tagsHtml = task.labels.map(lb => {
        const cc = LABEL_COLORS[lb] || '#64748B';
        return `<span class="tag" style="background:${cc}22;color:${cc}">${esc(lb)}</span>`;
      }).join('');
      cell.innerHTML = tagsHtml + '<span class="tag-add-hint">+</span>';
      if (currentTab === 'roadmap') renderAll();
      if (typeof refreshLegendIfOpen === 'function') refreshLegendIfOpen();
      scheduleSave();
    };
    picker.appendChild(tag);
  });

  cell.style.position = 'relative';
  cell.appendChild(picker);

  // Close on outside click
  setTimeout(() => {
    document.addEventListener('click', function closePicker(e) {
      if (!picker.contains(e.target)) {
        picker.remove();
        document.removeEventListener('click', closePicker);
      }
    });
  }, 0);
}

function saveEditPanel() {
  if (editPanelTaskId === null) return;
  const task = allTasks.find(t => t.id === editPanelTaskId);
  if (!task) return;
  const nameVal = document.getElementById('ep-name').value.trim();
  task.name = nameVal || DEFAULT_TASK_NAME;
  if (!nameVal) document.getElementById('ep-name').value = task.name;
  const sv = document.getElementById('ep-start').value;
  const fv = document.getElementById('ep-finish').value;
  let newStart = sv ? new Date(sv + 'T00:00:00') : null;
  let newFinish = fv ? new Date(fv + 'T00:00:00') : null;
  if (newStart && isNaN(newStart.getTime())) newStart = null;
  if (newFinish && isNaN(newFinish.getTime())) newFinish = null;
  if (newStart && newFinish && newStart > newFinish) {
    const startEl = document.getElementById('ep-start');
    const finishEl = document.getElementById('ep-finish');
    if (newStart.getTime() !== task.start?.getTime()) {
      newFinish = new Date(newStart);
      finishEl.value = sv;
    } else {
      newStart = new Date(newFinish);
      startEl.value = fv;
    }
  }
  // Check if duration was manually changed
  const epDurNum = document.getElementById('ep-duration-num');
  const newDurDays = parseInt(epDurNum.value) || 0;
  const oldDurDays = parseInt(task.duration) || 0;
  const durationManuallyChanged = newDurDays !== oldDurDays;

  const datesChanged = (newStart?.getTime() !== task.start?.getTime()) || (newFinish?.getTime() !== task.finish?.getTime());
  task.start = newStart;

  if (durationManuallyChanged && newStart && newDurDays > 0) {
    // Duration was edited: compute finish from start + duration
    const calId = task.calendarId || getDefaultCalendarId();
    if (workingDaysMode) {
      task.finish = addWorkingDays(newStart, newDurDays, calId);
    } else {
      task.finish = new Date(newStart.getTime() + newDurDays * MS_PER_DAY);
    }
    task.duration = newDurDays + (newDurDays === 1 ? ' day' : ' days');
    // Update the finish date picker in the panel
    const finishEl = document.getElementById('ep-finish');
    if (finishEl) finishEl.value = dateToInputStr(task.finish);
    propagateDependencies(task);
  } else {
    task.finish = newFinish;
    if (datesChanged) {
      recalcDuration(task);
      propagateDependencies(task);
      if (epDurNum) epDurNum.value = parseInt(task.duration) || 0;
    }
  }
  const rawPct = parseInt(document.getElementById('ep-pct').value) || 0;
  const manualPct = Math.max(0, Math.min(100, rawPct)) / 100;
  task.percentComplete = manualPct;
  // Only mark leaf tasks as manual progress; parent tasks should always auto-aggregate
  const isLeaf = !task.children || task.children.length === 0;
  if (isLeaf) task.manualProgress = true;
  const tags = document.querySelectorAll('#ep-tags .ep-tag.selected');
  task.labels = [...tags].map(t => t.dataset.label);
  task.bucket = document.getElementById('ep-bucket').value;
  task.priority = document.getElementById('ep-priority').value;
  const newDepsVal = document.getElementById('ep-depends').value;
  if (newDepsVal && detectCircularDependency(task.id, newDepsVal)) {
    showToast('Circular dependency detected. This would create a cycle.', 'error');
    document.getElementById('ep-depends').value = task.dependsOn;
    return;
  }
  // Validate dependency references exist
  if (newDepsVal) {
    const deps = parseDependency(newDepsVal);
    const taskByNum = new Map();
    allTasks.forEach(t => taskByNum.set(t.taskNumber, t));
    const invalid = deps.filter(d => !taskByNum.has(d.taskNum));
    if (invalid.length > 0) {
      showToast('Task #' + invalid[0].taskNum + ' not found. Check dependency references.', 'warn');
    }
  }
  task.dependsOn = newDepsVal;
  task.effort = document.getElementById('ep-effort').value;
  task.notes = document.getElementById('ep-notes').value;

  // Calendar assignment with child propagation
  const epCal = document.getElementById('ep-calendar');
  if (epCal) {
    const newCalId = epCal.value;
    const effectiveOld = task.calendarId || getDefaultCalendarId();
    if (newCalId !== effectiveOld) {
      assignCalendarWithChildren(task, newCalId);
      invalidateHolidayCache();
      recalcFinishDates(newCalId);
    }
  }

  // Color override — only set if user actually interacted with the color picker
  const epColor = document.getElementById('ep-color');
  if (epColor) {
    const pickerVal = epColor.value.toLowerCase();
    const newAutoColor = ((task.bucket && BUCKET_COLORS[task.bucket]) ? BUCKET_COLORS[task.bucket]
      : (task.labels?.length > 0 ? (LABEL_COLORS[task.labels[0]] || DEFAULT_COLOR) : DEFAULT_COLOR)).toLowerCase();
    // If picker still shows the auto-color from when the panel opened,
    // or matches the new auto-color, it means user didn't manually pick — clear override
    if (pickerVal === newAutoColor || pickerVal === _epInitialAutoColor) {
      task.colorOverride = '';
    } else {
      task.colorOverride = epColor.value;
    }
  }

  rebuildAfterChange();
  // Re-apply manual percentage for leaf tasks — aggregateParentProgress() may have overwritten it
  const isParentNow = task.children && task.children.length > 0;
  if (!isParentNow) task.percentComplete = manualPct;
  if (currentTab === 'roadmap') renderAll();
  if (currentTab === 'dati') renderDataTable();
  scheduleSave();

  // Refresh panel fields if parent aggregation changed values
  if (editPanelTaskId !== null) {
    const updated = allTasks.find(t => t.id === editPanelTaskId);
    if (updated) {
      const epStart = document.getElementById('ep-start');
      const epFinish = document.getElementById('ep-finish');
      const epDurNum = document.getElementById('ep-duration-num');
      const epPct = document.getElementById('ep-pct');
      const epPctVal = document.getElementById('ep-pct-val');
      if (epStart && document.activeElement !== epStart && updated.start) epStart.value = dateToInputStr(updated.start);
      if (epFinish && document.activeElement !== epFinish && updated.finish) epFinish.value = dateToInputStr(updated.finish);
      if (epDurNum && document.activeElement !== epDurNum) epDurNum.value = parseInt(updated.duration) || 0;
      // Only refresh slider if user isn't actively dragging it
      if (epPct && document.activeElement !== epPct) {
        const newPct = Math.round(updated.percentComplete * 100);
        epPct.value = newPct;
        if (epPctVal) epPctVal.textContent = newPct + '%';
        epPct.parentElement.style.setProperty('--pct', newPct + '%');
      }
    }
  }
}

function closeEditPanel() {
  // Always save current state before closing
  clearTimeout(saveDebounce);
  saveDebounce = null;
  saveEditPanel(); // safe: returns early if editPanelTaskId is already null
  // Force immediate persist to localStorage
  clearTimeout(autoSaveDebounce);
  saveCurrentProjectToStorage();
  updateSaveIndicator();
  DOM.editPanelOverlay.classList.remove('open');
  editPanelTaskId = null;
}


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
  // Hide the system default calendar from the UI — it's a silent fallback
  const visibleCalIds = calIds.filter(id => !calendars[id].isDefault || calendars[id].entries.length > 0 || calIds.length === 1 && false);
  if (!_selectedCalId || !calendars[_selectedCalId] || (calendars[_selectedCalId].isDefault && !visibleCalIds.includes(_selectedCalId))) {
    _selectedCalId = visibleCalIds[0] || null;
  }

  let html = '';

  // Working days toggle
  html += `<div class="setting-row" style="justify-content:space-between;margin-bottom:12px">
    <span>Working days mode (Mon-Fri, skip holidays)</span>
    <label class="toggle-switch">
      <input type="checkbox" ${workingDaysMode ? 'checked' : ''} onchange="toggleWorkingDaysMode(this.checked)">
      <span class="toggle-slider"></span>
    </label>
  </div>`;

  // Calendar selector chips (hide empty default)
  html += `<div class="cal-chips-row">`;
  visibleCalIds.forEach(id => {
    const cal = calendars[id];
    const active = id === _selectedCalId ? 'active' : '';
    html += `<span class="cal-chip ${active}" style="border-color:${cal.color}" onclick="selectCalendarChip('${id}')">${esc(cal.name)}</span>`;
  });
  html += `<span class="cal-chip cal-chip-add" onclick="addCalendar()">+ Add Calendar</span>`;
  html += `</div>`;

  if (visibleCalIds.length === 0) {
    html += `<p class="settings-hint" style="margin:12px 0;text-align:center">No holiday calendars configured.<br>Click "+ Add Calendar" to create one (e.g. Italy, UK).</p>`;
    return html;
  }

  // Selected calendar details
  const cal = _selectedCalId ? calendars[_selectedCalId] : null;
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

async function addCalendar() {
  const name = await showPrompt('New calendar name:', { title: 'Add Calendar', placeholder: 'e.g. Italy, UK, Germany...' });
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

async function deleteCalendar(id) {
  if (Object.keys(calendars).length <= 1) return;
  if (!await showConfirm('Delete calendar "' + calendars[id].name + '"?', { title: 'Delete Calendar', danger: true, okLabel: 'Delete' })) return;
  // Move tasks to default
  const defId = getDefaultCalendarId();
  allTasks.forEach(t => { if (t.calendarId === id) t.calendarId = defId; });
  delete calendars[id];
  ensureDefaultCalendar();
  _selectedCalId = Object.keys(calendars)[0];
  invalidateHolidayCache();
  recalcFinishDates(); // full recalc: tasks moved calendars
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
  recalcFinishDates(calId);
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
  recalcFinishDates(calId);
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
  recalcFinishDates(calId);
  renderAll();
  scheduleSave();
}

function removeCalendarEntry(calId, idx) {
  calendars[calId].entries.splice(idx, 1);
  invalidateHolidayCache();
  recalcFinishDates(calId);
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
  const defaultCalId = getDefaultCalendarId();
  // Only show calendars that have entries (hide empty default)
  const assignableCalIds = calIds.filter(id => !calendars[id].isDefault || calendars[id].entries.length > 0);

  // Get Level 1 and Level 2 tasks
  const phases = allTasks.filter(t => t.depth <= 2);

  let html = '';
  if (assignableCalIds.length === 0) {
    html = '<p>No holiday calendars configured. Create one in Settings > Calendar first.</p>';
  } else if (phases.length === 0) {
    html = '<p>No tasks to assign calendars to.</p>';
  } else {
    // Calendar selector
    html += `<div style="margin-bottom:12px">
      <label style="font-weight:600;font-size:.85rem">Select calendar to assign:</label>
      <select id="cal-assign-select" onchange="calAssignRefreshList()" style="margin-left:8px;padding:4px 8px;border-radius:6px;border:1px solid var(--border);font-size:.85rem">
        ${assignableCalIds.map(id => `<option value="${id}">${esc(calendars[id].name)}</option>`).join('')}
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
    html += `<div class="cal-assign-list" id="cal-assign-list-container" style="max-height:300px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;padding:4px">`;
    html += _buildCalAssignListHTML(assignableCalIds[0], defaultCalId, phases);
    html += `</div>`;

    // Apply button
    html += `<button onclick="applyCalendarAssignment()" style="margin-top:12px;width:100%;background:var(--blue);color:#fff;border:none;border-radius:8px;padding:.5rem;cursor:pointer;font-family:inherit;font-weight:600;font-size:.85rem">Apply Calendar</button>`;
  }

  body.innerHTML = html;
  modal.classList.add('open');
}

/** Build the inner HTML for the assign list, highlighting current assignments */
function _buildCalAssignListHTML(selectedCalId, defaultCalId, phases) {
  let html = '';
  phases.forEach(t => {
    const indent = (t.depth - 1) * 20;
    const effectiveCal = t.calendarId || defaultCalId;
    const cal = calendars[effectiveCal];
    const calColor = cal ? cal.color : '#94A3B8';
    const calName = cal ? cal.name : 'Default';
    const alreadyAssigned = effectiveCal === selectedCalId;
    html += `<label class="cal-assign-item${alreadyAssigned ? ' already-assigned' : ''}" style="padding-left:${indent + 8}px">
      <input type="checkbox" class="cal-assign-cb" value="${t.id}"${alreadyAssigned ? ' checked disabled' : ''}>
      <span class="cal-assign-outline">${esc(t.outline)}</span>
      <span class="cal-assign-name">${esc(t.name)}</span>
      <span class="cal-assign-cal-chip" style="background:${calColor}22;color:${calColor};border:1px solid ${calColor}44;border-radius:4px;padding:1px 6px;font-size:.7rem;margin-left:auto;white-space:nowrap">${esc(calName)}</span>
    </label>`;
  });
  return html;
}

/** Refresh the assign list when the calendar selector changes */
function calAssignRefreshList() {
  const select = document.getElementById('cal-assign-select');
  const container = document.getElementById('cal-assign-list-container');
  if (!select || !container) return;
  const defaultCalId = getDefaultCalendarId();
  const phases = allTasks.filter(t => t.depth <= 2);
  container.innerHTML = _buildCalAssignListHTML(select.value, defaultCalId, phases);
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
  const defaultCalId = getDefaultCalendarId();
  let changedCount = 0;
  checked.forEach(cb => {
    const taskId = parseInt(cb.value);
    const task = allTasks.find(t => t.id === taskId);
    if (!task) return;
    const currentCal = task.calendarId || defaultCalId;
    if (currentCal === calId) return; // already on this calendar, skip
    assignCalendarWithChildren(task, calId);
    changedCount++;
  });

  if (changedCount > 0) {
    invalidateHolidayCache();
    recalcFinishDates(calId);
    rebuildAfterChange();
    renderAll();
    if (currentTab === 'dati') renderDataTable();
    scheduleSave();
  }
  closeCalendarAssignModal();
  showToast(changedCount > 0
    ? `Calendar assigned to ${changedCount} phase(s)`
    : 'No changes needed (already assigned)', 'info', 2000);
}


/* ---------- TOOLTIP ---------- */

let tooltipTimeout;

function showTooltip(e, taskId) {
  const task = allTasks.find(t => t.id === taskId);
  if (!task) return;
  clearTimeout(tooltipTimeout);
  const pct = Math.round(task.percentComplete * 100);
  let html = `<div class="tt-name" style="color:${task.color}">${esc(task.name)}</div>`;
  html += `<div class="tt-row"><span class="tt-label">Start:</span><span>${task.start ? fmtDate(task.start) : '—'}</span></div>`;
  html += `<div class="tt-row"><span class="tt-label">End:</span><span>${task.finish ? fmtDate(task.finish) : '—'}</span></div>`;
  html += `<div class="tt-row"><span class="tt-label">Duration:</span><span>${task.duration}</span></div>`;
  html += `<div class="tt-row"><span class="tt-label">Complete:</span><span>${pct}%</span></div>`;
  html += `<div class="tt-progress"><div class="fill" style="width:${pct}%;background:${task.color}"></div></div>`;
  if (task.labels.length) {
    html += '<div class="tt-tags">';
    task.labels.forEach(l => {
      const c = LABEL_COLORS[l] || '#64748B';
      html += `<span class="tt-tag" style="background:${c}22;color:${c};border:1px solid ${c}44">${esc(l)}</span>`;
    });
    html += '</div>';
  }
  if (task.bucket) html += `<div class="tt-row" style="margin-top:.3rem"><span class="tt-label">Bucket:</span><span>${esc(task.bucket)}</span></div>`;
  if (task.priority) html += `<div class="tt-row"><span class="tt-label">Priority:</span><span>${esc(task.priority)}</span></div>`;
  if (task.dependsOn) html += `<div class="tt-row"><span class="tt-label">Depends on:</span><span>${esc(task.dependsOn)}</span></div>`;
  DOM.tooltip.innerHTML = html;
  DOM.tooltip.classList.add('visible');
  moveTooltip(e);
}

function moveTooltip(e) {
  let x = e.clientX + 12, y = e.clientY + 12;
  const rect = DOM.tooltip.getBoundingClientRect();
  if (x + 320 > window.innerWidth) x = e.clientX - 320;
  if (y + rect.height > window.innerHeight) y = e.clientY - rect.height - 8;
  DOM.tooltip.style.left = x + 'px';
  DOM.tooltip.style.top = y + 'px';
}

function hideTooltip() {
  tooltipTimeout = setTimeout(() => DOM.tooltip.classList.remove('visible'), 100);
}


/* ---------- NAVIGATION ---------- */

function getCurrentScope() {
  if (navStack.length === 0) return taskTree;
  return navStack[navStack.length - 1].task.children;
}

function navigateInto(taskId) {
  const task = allTasks.find(t => t.id === taskId);
  if (!task || task.children.length === 0) return;
  navStack.push({ task, label: task.name });
  getState().expandedSet.clear();
  getState().collapsedSet.clear();
  renderAll();
}

function navigateToLevel(level) {
  navStack = navStack.slice(0, level);
  getState().expandedSet.clear();
  getState().collapsedSet.clear();
  renderAll();
}

function navigateBack() {
  if (navStack.length > 0) {
    navStack.pop();
    getState().expandedSet.clear();
    getState().collapsedSet.clear();
    renderAll();
  }
}

function getScopeDateRange(nodes) {
  let dMin = Infinity, dMax = -Infinity;
  function walk(list) {
    list.forEach(t => {
      if (t.start && t.start.getTime() < dMin) dMin = t.start.getTime();
      if (t.finish && t.finish.getTime() > dMax) dMax = t.finish.getTime();
      if (t.start && !t.finish && t.start.getTime() > dMax) dMax = t.start.getTime();
      if (t.children.length) walk(t.children);
    });
  }
  walk(nodes);
  if (dMin === Infinity) return null;
  return _smartDatePadding(dMin, dMax);
}

/** Zoom-aware date padding — avoid showing empty past months at higher zoom levels */
function _smartDatePadding(dMin, dMax) {
  const mn = new Date(dMin);
  const mx = new Date(dMax);

  if (currentZoom === 'day') {
    // Day view: minimal padding — 2 days before, 3 days after
    mn.setTime(mn.getTime() - 2 * MS_PER_DAY);
    mx.setTime(mx.getTime() + 3 * MS_PER_DAY);
  } else if (currentZoom === 'week') {
    // Week view: snap to the Monday of the week the first task starts in
    const dow = mn.getDay() || 7;           // 1=Mon..7=Sun
    mn.setDate(mn.getDate() - dow + 1);     // snap to Monday of that week
    // Add 1 week after the last task
    const dowEnd = mx.getDay() || 7;
    mx.setDate(mx.getDate() + (7 - dowEnd) + 7);  // snap to next Sunday + 1 week
  } else {
    // Month view: start from the 1st of the same month as earliest task
    mn.setDate(1);
    // End at last day of the month after the latest task
    mx.setTime(mx.getTime() + 14 * MS_PER_DAY);
  }
  return { min: mn, max: mx };
}


/* ---------- INTERACTIONS ---------- */

function handleTaskRowClick(e, outline, taskId, hasChildren) {
  const arrow = e.target.closest('.arrow');
  if (arrow && !arrow.classList.contains('hidden')) {
    toggleExpand(outline);
  } else {
    openEditPanel(taskId);
  }
}

function handleBarClick(taskId, hasChildren) {
  openEditPanel(taskId);
}

function toggleArrows() {
  showArrows = !showArrows;
  const btn = document.getElementById('arrows-btn');
  const lbl = document.getElementById('arrows-label');
  if (btn && lbl) {
    if (showArrows) {
      btn.classList.remove('dim');
      lbl.innerText = 'Deps';
    } else {
      btn.classList.add('dim');
      lbl.innerText = 'Deps';
    }
  }
  renderAll();
}

function toggleTaskVisibility(taskId) {
  if (hiddenTasks.has(taskId)) hiddenTasks.delete(taskId);
  else hiddenTasks.add(taskId);
  updateShowAllBtn();
  renderAll();
  scheduleSave();
}

function showAllTasks() {
  hiddenTasks.clear();
  updateShowAllBtn();
  renderAll();
  scheduleSave();
}

function updateShowAllBtn() {
  const btn = DOM.btnShowAll;
  if (btn) btn.style.display = hiddenTasks.size > 0 ? '' : 'none';
}

function toggleExpand(outline) {
  const task = allTasks.find(t => t.outline === outline);
  if (!task) return;
  const maxDepth = getState().visibleDepth === 0 ? 999 : getState().visibleDepth;
  const depth = (outline.match(/\./g) || []).length;
  const depthAllows = depth + 1 < maxDepth;

  if (depthAllows) {
    if (getState().collapsedSet.has(outline)) {
      getState().collapsedSet.delete(outline);
    } else {
      getState().collapsedSet.add(outline);
      allTasks.forEach(t => {
        if (t.outline.startsWith(outline + '.')) {
          getState().collapsedSet.add(t.outline);
          getState().expandedSet.delete(t.outline);
        }
      });
    }
  } else {
    if (getState().expandedSet.has(outline)) {
      getState().expandedSet.delete(outline);
      allTasks.forEach(t => {
        if (t.outline.startsWith(outline + '.')) getState().expandedSet.delete(t.outline);
      });
    } else {
      getState().expandedSet.add(outline);
    }
  }
  renderAll();
  if (currentTab === 'dati') renderDataTable();
}

function toggleExpandAll() {
  getState().allExpanded = !getState().allExpanded;
  getState().expandedSet.clear();
  getState().collapsedSet.clear();
  if (getState().allExpanded) {
    // Expand: add all parents to expandedSet (needed when visibleDepth limits display)
    allTasks.forEach(t => { if (t.children.length > 0) getState().expandedSet.add(t.outline); });
  } else {
    // Collapse: add all parents to collapsedSet (needed when visibleDepth=0 allows all by default)
    allTasks.forEach(t => { if (t.children.length > 0) getState().collapsedSet.add(t.outline); });
  }
  DOM.expandLabel.textContent = getState().allExpanded ? 'Collapse' : 'Expand';
  renderAll();
  if (currentTab === 'dati') renderDataTable();
}

function setZoom(level) {
  currentZoom = level;
  document.querySelectorAll('#zoom-month,#zoom-week,#zoom-day').forEach(b => b.classList.remove('active'));
  document.getElementById('zoom-' + level).classList.add('active');
  renderAll();
}

function toggleWorkingDays() {
  workingDaysMode = !workingDaysMode;
  const btn = document.getElementById('working-days-btn');
  if (btn) btn.classList.toggle('active', workingDaysMode);
  // Recalc finish dates preserving working-day durations
  recalcFinishDates();
  rebuildAfterChange();
  renderAll();
  if (currentTab === 'dati') renderDataTable();
  scheduleSave();
  showToast(workingDaysMode ? 'Working days mode (Mon-Fri)' : 'Calendar days mode (all days)', 'info', 2000);
}

function setDepth(val) {
  getState().visibleDepth = parseInt(val);
  getState().expandedSet.clear();
  getState().collapsedSet.clear();
  renderAll();
}

function toggleMilestoneInline() {
  milestoneInline = !milestoneInline;
  const btn = document.getElementById('ms-inline-btn');
  btn.classList.toggle('active', milestoneInline);
  document.getElementById('ms-inline-label').textContent = milestoneInline ? 'MS Inline' : 'MS Separate';
  renderAll();
}

function scrollToToday() {
  const dpx = getResponsiveDayPx();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const x = dateToPxR(today, dpx) - DOM.timelineBody.clientWidth / 2;
  DOM.timelineBody.scrollLeft = Math.max(0, x);
}


/* ---------- FILTERS ---------- */

function applyFilters() {
  renderAll();
  if (currentTab === 'dati') renderDataTable();
}

function taskMatchesFilter(task) {
  const search = DOM.searchInput.value.toLowerCase();
  const labelF = DOM.filterLabel.value;
  const bucketF = DOM.filterBucket.value;
  const matchSelf = (t) => {
    if (search && !t.name.toLowerCase().includes(search)) return false;
    if (labelF && !t.labels.includes(labelF)) return false;
    if (bucketF && t.bucket !== bucketF) return false;
    return true;
  };
  const matchTree = (t) => {
    if (matchSelf(t)) return true;
    return t.children.some(c => matchTree(c));
  };
  return matchTree(task);
}

function filterTree(nodes) {
  return nodes.filter(n => taskMatchesFilter(n)).map(n => {
    n.filteredChildren = filterTree(n.children);
    return n;
  });
}

function getFilteredFlatTasks() {
  const search = DOM.searchInput.value.toLowerCase();
  const labelF = DOM.filterLabel.value;
  const bucketF = DOM.filterBucket.value;
  return allTasks.filter(t => {
    if (search && !t.name.toLowerCase().includes(search)) return false;
    if (labelF && !t.labels.includes(labelF)) return false;
    if (bucketF && t.bucket !== bucketF) return false;
    return true;
  });
}


/* ---------- TAB SYSTEM ---------- */

function switchTab(tab) {
  // Flush any pending save debounce from data table edits
  if (typeof saveDebounce !== 'undefined' && saveDebounce) {
    clearTimeout(saveDebounce);
    saveDebounce = null;
  }
  // Save old tab filters
  const oldState = viewStates[currentTab];
  if (oldState) {
    oldState.filters.search = DOM.searchInput.value;
    oldState.filters.label = DOM.filterLabel.value;
    oldState.filters.bucket = DOM.filterBucket.value;
  }

  currentTab = tab;
  
  // Restore new tab filters and UI controls
  const newState = viewStates[currentTab];
  if (newState) {
    DOM.searchInput.value = newState.filters.search;
    DOM.filterLabel.value = newState.filters.label;
    DOM.filterBucket.value = newState.filters.bucket;
    const ds = DOM.depthSelect;
    if (ds) ds.value = newState.visibleDepth;
    const elbl = DOM.expandLabel;
    if (elbl) elbl.textContent = newState.allExpanded ? 'Collapse' : 'Expand';
  }

  document.querySelectorAll('.tab-bar .tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  const gw = DOM.ganttWrapper;
  const dw = DOM.datiWrapper;
  if (tab === 'roadmap') {
    gw.style.opacity = '0';
    gw.classList.add('active'); gw.classList.remove('hidden');
    dw.classList.remove('active');
    renderAll();
    requestAnimationFrame(() => { gw.style.opacity = '1'; });
  } else {
    dw.style.opacity = '0';
    gw.classList.remove('active'); gw.classList.add('hidden');
    dw.classList.add('active');
    renderDataTable();
    requestAnimationFrame(() => { dw.style.opacity = '1'; });
  }
  
  const editBtn = document.getElementById('data-edit-btn');
  if (editBtn) editBtn.style.display = tab === 'dati' ? '' : 'none';

  DOM.btnDeleteSel.style.display = (tab === 'dati' && selectedRows.size > 0) ? '' : 'none';

  document.querySelectorAll('.tab-roadmap').forEach(el => {
    el.style.display = tab === 'roadmap' ? '' : 'none';
  });
}

/* ---------- TABLE LAYOUT MODE (Fit vs Scroll) ---------- */

// Enable horizontal scrolling with Shift+wheel in scroll mode
// Also hide scroll hint once user scrolls
(function initTableHorizontalScroll() {
  document.addEventListener('wheel', function(e) {
    if (!tableScrollMode) return;
    const container = document.querySelector('.dati-table-container');
    if (!container || !container.contains(e.target)) return;
    if (container.scrollWidth <= container.clientWidth) return;
    // Shift+wheel => convert vertical to horizontal scroll
    if (e.shiftKey && Math.abs(e.deltaY) > 0) {
      e.preventDefault();
      container.scrollLeft += e.deltaY;
    }
  }, { passive: false });

})();

function toggleTableLayoutMode() {
  // If trying to switch to fit mode, check if columns fit
  if (tableScrollMode) {
    const container = document.querySelector('.dati-table-container');
    const visCols = ALL_COLUMNS.filter(c => visibleColumns.has(c.id));
    const minNeeded = visCols.length * MIN_COLUMN_WIDTH + (isDataEditMode ? 28 : 0);
    const available = container ? container.clientWidth : window.innerWidth;
    if (minNeeded > available) {
      // Cannot fit -- keep scroll mode, flash the button to indicate
      const btn = document.getElementById('table-layout-btn');
      if (btn) {
        btn.classList.add('btn-shake');
        btn.title = 'Too many columns to fit. Hide some columns first.';
        setTimeout(() => btn.classList.remove('btn-shake'), 500);
      }
      return;
    }
  }
  tableScrollMode = !tableScrollMode;
  const btn = document.getElementById('table-layout-btn');
  if (btn) {
    btn.classList.toggle('active', tableScrollMode);
    btn.querySelector('span').textContent = tableScrollMode ? 'Scroll' : 'Fit';
    btn.title = tableScrollMode
      ? 'Switch to fit-to-page (columns auto-shrink)'
      : 'Switch to scroll mode (columns keep width)';
  }
  applyTableLayoutMode();
  scheduleSave();
}

function applyTableLayoutMode() {
  const table = document.getElementById('data-table');
  const container = document.querySelector('.dati-table-container');
  if (!table || !container) return;

  const visCols = ALL_COLUMNS.filter(c => visibleColumns.has(c.id));

  // Check if fit is even possible — sum per-column minimums
  let minNeeded = isDataEditMode ? 28 : 0;
  visCols.forEach(col => { minNeeded += (MIN_COL_WIDTHS && MIN_COL_WIDTHS[col.id]) || MIN_COLUMN_WIDTH; });
  const available = container.clientWidth || window.innerWidth;
  const fitPossible = minNeeded <= available;

  // If user wants fit but it's not possible, force scroll
  if (!tableScrollMode && !fitPossible) {
    tableScrollMode = true;
  }

  if (tableScrollMode) {
    table.classList.add('scroll-mode');
    table.classList.remove('fit-mode');
    container.classList.add('scroll-active');
    // Calculate total width from target column widths
    let sum = isDataEditMode ? 28 : 0;
    visCols.forEach(col => {
      sum += columnWidths[col.id] || DEFAULT_COLUMN_WIDTHS[col.id] || 100;
    });
    table.style.width = sum + 'px';
    // Restore inline widths on th
    const ths = table.querySelectorAll('thead th');
    let i = isDataEditMode ? 1 : 0; // skip drag handle th
    visCols.forEach(col => {
      if (ths[i]) {
        ths[i].style.width = (columnWidths[col.id] || DEFAULT_COLUMN_WIDTHS[col.id] || 100) + 'px';
      }
      i++;
    });
  } else {
    table.classList.add('fit-mode');
    table.classList.remove('scroll-mode');
    container.classList.remove('scroll-active');
    container.scrollLeft = 0;
    table.style.width = '100%';
    // Remove inline widths on th so auto layout can work
    table.querySelectorAll('thead th').forEach(th => {
      th.style.width = '';
    });
  }
}


/* ---------- COLUMN PICKER ---------- */

function toggleColumnPicker() {
  const dd = document.getElementById('col-picker-dropdown');
  if (dd.classList.contains('open')) {
    dd.classList.remove('open');
    return;
  }
  renderColumnPicker();
  dd.classList.add('open');

  // Close on outside click
  setTimeout(() => {
    document.addEventListener('click', function closeCP(e) {
      if (!dd.contains(e.target) && !e.target.closest('#col-picker-btn')) {
        dd.classList.remove('open');
        document.removeEventListener('click', closeCP);
      }
    });
  }, 0);
}

function renderColumnPicker() {
  const dd = document.getElementById('col-picker-dropdown');
  let html = '<div class="cp-title">Visible Columns</div>';
  ALL_COLUMNS.forEach(col => {
    if (col.id === 'select') return; // always on, don't show
    const checked = visibleColumns.has(col.id) ? 'checked' : '';
    const disabled = col.alwaysOn ? 'disabled' : '';
    html += `<label class="cp-item">
      <input type="checkbox" ${checked} ${disabled} data-col="${col.id}" onchange="toggleColumn('${col.id}', this.checked)">
      <span>${col.label}</span>
    </label>`;
  });
  html += '<div class="cp-actions"><button class="cp-reset" onclick="resetColumns()">Reset to default</button></div>';
  dd.innerHTML = html;
}

function toggleColumn(colId, visible) {
  if (visible) visibleColumns.add(colId);
  else visibleColumns.delete(colId);
  renderColumnPicker();
  renderDataTable();
  scheduleSave();
}

function resetColumns() {
  visibleColumns = new Set(ALL_COLUMNS.filter(c => c.defaultVisible).map(c => c.id));
  renderColumnPicker();
  renderDataTable();
  scheduleSave();
}

function toggleDataEditMode() {
  isDataEditMode = !isDataEditMode;
  activeCell = null;
  cellEditMode = false;
  const btn = document.getElementById('data-edit-btn');
  const lbl = document.getElementById('data-edit-label');
  if (isDataEditMode) {
    btn.classList.add('active');
    lbl.innerText = 'Disable Edit';
  } else {
    btn.classList.remove('active');
    lbl.innerText = 'Enable Edit';
  }
  renderDataTable();
}


/* ---------- ADD / DELETE TASKS ---------- */

function addNewTask() {
  snapshotUndo();
  const maxId = allTasks.reduce((m, t) => Math.max(m, t.id), 0);
  let nextOutline = '1';
  if (allTasks.length > 0) {
    const topLevelOutlines = allTasks.filter(t => t.depth === 1).map(t => parseInt(t.outline)).filter(n => !isNaN(n));
    nextOutline = String((topLevelOutlines.length > 0 ? Math.max(...topLevelOutlines) : 0) + 1);
  }
  const task = createTaskObject({ id: maxId + 1, taskNumber: maxId + 1, outline: nextOutline });
  allTasks.push(task);
  rebuildAfterChange();
  renderAll();
  if (currentTab === 'dati') renderDataTable();
  scheduleSave();
}

// Template dependency references use taskNumber (sequential: 1,2,3,...).
// Only leaf tasks have deps; parent dates are auto-aggregated from children.
// Task numbering: parent=N, then children N+1, N+2, etc.
//
// Software: 1=Planning, 2=Req, 3=Design, 4=Dev, 5=Backend, 6=Frontend, 7=Integration,
//           8=Testing, 9=Unit, 10=IntTest, 11=UAT, 12=Deploy, 13=Staging, 14=Release
// Marketing: 1=Strategy, 2=Research, 3=Brief, 4=Content, 5=Copy, 6=Visual, 7=Review,
//            8=Launch, 9=Setup, 10=Launch, 11=Monitor
// Event: 1=Pre-plan, 2=Objectives, 3=Venue, 4=Vendors, 5=Prep, 6=Invitations,
//        7=Catering, 8=Program, 9=Execution, 10=Setup, 11=EventDay, 12=Teardown
// SAP: 1=Discover, 2=BPA, 3=Landscape, 4=Gap, 5=Prepare, 6=Onboard, 7=EnvSetup,
//      8=DataMigStrat, 9=Cutover, 10=Explore, 11=Workshops, 12=ConfigDoc, 13=DevSpecs,
//      14=Realize, 15=SysConfig, 16=CustomDev, 17=DataMigDev, 18=IntTest, 19=UAT,
//      20=Deploy, 21=Training, 22=DataMigExec, 23=GoLive, 24=Hypercare,
//      25=Run, 26=Handover, 27=Monitoring, 28=Closure

const PROJECT_TEMPLATES = {
  software: {
    name: 'Software Development',
    tasks: [
      { outline: '1', name: 'Planning', days: 5, children: [
        { outline: '1.1', name: 'Requirements gathering', days: 3 },
        { outline: '1.2', name: 'Technical design', days: 2, dep: '2' }
      ]},
      { outline: '2', name: 'Development', days: 15, children: [
        { outline: '2.1', name: 'Backend development', days: 10, dep: '3' },
        { outline: '2.2', name: 'Frontend development', days: 10, dep: '3' },
        { outline: '2.3', name: 'Integration', days: 5, dep: '5,6' }
      ]},
      { outline: '3', name: 'Testing', days: 7, children: [
        { outline: '3.1', name: 'Unit testing', days: 3, dep: '7' },
        { outline: '3.2', name: 'Integration testing', days: 2, dep: '9' },
        { outline: '3.3', name: 'User acceptance testing', days: 2, dep: '10' }
      ]},
      { outline: '4', name: 'Deployment', days: 2, children: [
        { outline: '4.1', name: 'Staging deployment', days: 1, dep: '11' },
        { outline: '4.2', name: 'Production release', days: 0, dep: '13' }
      ]}
    ]
  },
  marketing: {
    name: 'Marketing Campaign',
    tasks: [
      { outline: '1', name: 'Strategy', days: 5, children: [
        { outline: '1.1', name: 'Market research', days: 3 },
        { outline: '1.2', name: 'Campaign brief', days: 2, dep: '2' }
      ]},
      { outline: '2', name: 'Content Creation', days: 10, children: [
        { outline: '2.1', name: 'Copywriting', days: 5, dep: '3' },
        { outline: '2.2', name: 'Visual design', days: 7, dep: '3' },
        { outline: '2.3', name: 'Review & approval', days: 3, dep: '5,6' }
      ]},
      { outline: '3', name: 'Launch', days: 5, children: [
        { outline: '3.1', name: 'Channel setup', days: 2, dep: '7' },
        { outline: '3.2', name: 'Campaign launch', days: 0, dep: '9' },
        { outline: '3.3', name: 'Monitor & optimize', days: 5, dep: '10' }
      ]}
    ]
  },
  event: {
    name: 'Event Planning',
    tasks: [
      { outline: '1', name: 'Pre-planning', days: 10, children: [
        { outline: '1.1', name: 'Define objectives & budget', days: 3 },
        { outline: '1.2', name: 'Venue selection', days: 5, dep: '2' },
        { outline: '1.3', name: 'Vendor contracts', days: 5, dep: '3' }
      ]},
      { outline: '2', name: 'Preparation', days: 15, children: [
        { outline: '2.1', name: 'Invitations & registration', days: 5, dep: '4' },
        { outline: '2.2', name: 'Catering & logistics', days: 7, dep: '4' },
        { outline: '2.3', name: 'Program & speakers', days: 10, dep: '4' }
      ]},
      { outline: '3', name: 'Execution', days: 3, children: [
        { outline: '3.1', name: 'Setup', days: 1, dep: '6,7,8' },
        { outline: '3.2', name: 'Event day', days: 1, dep: '10' },
        { outline: '3.3', name: 'Teardown & follow-up', days: 1, dep: '11' }
      ]}
    ]
  },
  sap: {
    name: 'SAP Implementation',
    tasks: [
      { outline: '1', name: 'Discover', days: 15, children: [
        { outline: '1.1', name: 'Business process analysis', days: 5 },
        { outline: '1.2', name: 'System landscape review', days: 5, dep: '2' },
        { outline: '1.3', name: 'Gap analysis & requirements', days: 5, dep: '3' }
      ]},
      { outline: '2', name: 'Prepare', days: 15, children: [
        { outline: '2.1', name: 'Project team onboarding', days: 3, dep: '4' },
        { outline: '2.2', name: 'Environment setup & provisioning', days: 5, dep: '6' },
        { outline: '2.3', name: 'Data migration strategy', days: 5, dep: '6' },
        { outline: '2.4', name: 'Cutover plan', days: 2, dep: '7,8' }
      ]},
      { outline: '3', name: 'Explore', days: 20, children: [
        { outline: '3.1', name: 'Fit-to-standard workshops', days: 10, dep: '9' },
        { outline: '3.2', name: 'Configuration documentation', days: 5, dep: '11' },
        { outline: '3.3', name: 'Custom development specs', days: 5, dep: '12' }
      ]},
      { outline: '4', name: 'Realize', days: 30, children: [
        { outline: '4.1', name: 'System configuration', days: 10, dep: '13' },
        { outline: '4.2', name: 'Custom development (ABAP/Fiori)', days: 15, dep: '13' },
        { outline: '4.3', name: 'Data migration development', days: 10, dep: '15' },
        { outline: '4.4', name: 'Integration testing', days: 5, dep: '16,17' },
        { outline: '4.5', name: 'User acceptance testing', days: 5, dep: '18' }
      ]},
      { outline: '5', name: 'Deploy', days: 10, children: [
        { outline: '5.1', name: 'End-user training', days: 5, dep: '19' },
        { outline: '5.2', name: 'Data migration execution', days: 3, dep: '21' },
        { outline: '5.3', name: 'Go-live', days: 0, dep: '22' },
        { outline: '5.4', name: 'Hypercare support', days: 5, dep: '23' }
      ]},
      { outline: '6', name: 'Run', days: 10, children: [
        { outline: '6.1', name: 'Operational handover', days: 3, dep: '24' },
        { outline: '6.2', name: 'Performance monitoring', days: 5, dep: '26' },
        { outline: '6.3', name: 'Project closure', days: 0, dep: '27' }
      ]}
    ]
  }
};

function loadTemplate(templateKey) {
  const template = PROJECT_TEMPLATES[templateKey];
  if (!template) return;
  snapshotUndo();
  const now = new Date(); now.setHours(0, 0, 0, 0);
  let taskId = 0;
  function createTasks(items, startDate) {
    const result = [];
    for (const item of items) {
      taskId++;
      const start = new Date(startDate);
      const finish = new Date(start.getTime() + Math.max(item.days, 1) * MS_PER_DAY);
      const task = createTaskObject({
        id: taskId, taskNumber: taskId, outline: item.outline,
        depth: item.outline.split('.').length,
        name: item.name, start, finish,
        duration: item.days === 0 ? '0 days' : item.days + ' days',
        dependsOn: item.dep || '',
        isMilestone: item.days === 0
      });
      result.push(task);
      if (item.children) {
        result.push(...createTasks(item.children, start));
      }
    }
    return result;
  }
  allTasks = createTasks(template.tasks, now);
  buildTree();
  aggregateParentProgress();
  reassignColors();
  allTasks.forEach(t => { if (t.dependsOn) propagateDependencies(t); });
  rebuildAfterChange();
  renderAll();
  if (currentTab === 'dati') renderDataTable();
  scheduleSave();
}

/* ---------- CUSTOM TEMPLATES ---------- */

function getCustomTemplates() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TEMPLATES);
    return raw ? JSON.parse(raw) : {};
  } catch(e) { return {}; }
}

function saveCustomTemplates(templates) {
  try {
    localStorage.setItem(STORAGE_KEY_TEMPLATES, JSON.stringify(templates));
  } catch(e) { showToast('Could not save templates - storage may be full.', 'warn'); }
}

async function saveAsTemplate() {
  if (allTasks.length === 0) {
    showToast('No tasks to save as template.', 'warn');
    return;
  }
  const defaultName = projects[currentProjectId]?.name || 'My Template';
  const name = await showPrompt('Enter a name for this template:', { title: 'Save as Template', defaultValue: defaultName });
  if (!name || !name.trim()) return;
  const trimmed = name.trim();
  const templates = getCustomTemplates();
  // Check for duplicate name
  if (templates[trimmed]) {
    const overwrite = await showConfirm('A template named "' + trimmed + '" already exists. Overwrite it?', { title: 'Template Exists', okLabel: 'Overwrite', danger: true });
    if (!overwrite) return;
  }
  // Serialize current tasks as template
  templates[trimmed] = {
    name: trimmed,
    tasks: serializeTasks(),
    createdAt: new Date().toISOString()
  };
  saveCustomTemplates(templates);
  showToast('Template "' + trimmed + '" saved successfully.', 'success');
}

function loadCustomTemplate(name) {
  const templates = getCustomTemplates();
  const tmpl = templates[name];
  if (!tmpl || !tmpl.tasks) return;
  snapshotUndo();
  allTasks = deserializeTasks(tmpl.tasks);
  // Re-assign IDs to avoid conflicts
  allTasks.forEach((t, i) => { t.id = i + 1; t.taskNumber = i + 1; });
  buildTree();
  aggregateParentProgress();
  reassignColors();
  allTasks.forEach(t => { if (t.dependsOn) propagateDependencies(t); });
  rebuildAfterChange();
  renderAll();
  if (currentTab === 'dati') renderDataTable();
  scheduleSave();
}

async function deleteCustomTemplate(name) {
  const ok = await showConfirm('Delete template "' + name + '"?', { title: 'Delete Template', danger: true, okLabel: 'Delete' });
  if (!ok) return;
  const templates = getCustomTemplates();
  delete templates[name];
  saveCustomTemplates(templates);
  showToast('Template deleted.', 'success');
  // Refresh the modal if open
  const modal = document.getElementById('template-modal');
  if (modal) showTemplateModal();
}

function showTemplateModal() {
  // Remove existing modal if any
  const existing = document.getElementById('template-modal-overlay');
  if (existing) existing.remove();

  const builtIn = Object.entries(PROJECT_TEMPLATES);
  const custom = Object.entries(getCustomTemplates());

  let html = '<div id="template-modal-overlay" class="dialog-overlay show" onclick="if(event.target===this)this.remove()">';
  html += '<div class="dialog-box" style="max-width:520px;width:90%">';
  html += '<div class="dialog-title" style="display:flex;align-items:center;justify-content:space-between">';
  html += '<span>Choose a Template</span>';
  html += '<button onclick="this.closest(\'#template-modal-overlay\').remove()" style="background:none;border:none;cursor:pointer;color:var(--grey-txt);font-size:1.2rem">&times;</button>';
  html += '</div>';

  // Built-in templates
  html += '<div style="margin:.8rem 0 .4rem;font-size:.75rem;font-weight:600;text-transform:uppercase;color:var(--grey-txt);letter-spacing:.5px">Built-in</div>';
  html += '<div class="template-modal-list">';
  for (const [key, tmpl] of builtIn) {
    const taskCount = _countTemplateTasks(tmpl.tasks);
    html += '<div class="template-modal-item" onclick="loadTemplate(\'' + key + '\');document.getElementById(\'template-modal-overlay\').remove()">';
    html += '<div class="template-modal-name">' + _escDialog(tmpl.name) + '</div>';
    html += '<div class="template-modal-meta">' + taskCount + ' tasks</div>';
    html += '</div>';
  }
  html += '</div>';

  // Custom templates
  html += '<div style="margin:1rem 0 .4rem;font-size:.75rem;font-weight:600;text-transform:uppercase;color:var(--grey-txt);letter-spacing:.5px;display:flex;align-items:center;justify-content:space-between">Custom';
  html += '<button onclick="document.getElementById(\'template-modal-overlay\').remove();saveAsTemplate()" style="background:var(--blue);color:#fff;border:none;border-radius:6px;padding:3px 10px;font-size:.75rem;cursor:pointer;font-family:inherit">+ Save Current</button>';
  html += '</div>';
  html += '<div class="template-modal-list">';
  if (custom.length === 0) {
    html += '<div style="padding:.8rem;color:var(--grey-txt);font-size:.82rem;text-align:center">No custom templates yet. Save your current project as a template to reuse it later.</div>';
  }
  for (const [name, tmpl] of custom) {
    const taskCount = tmpl.tasks ? tmpl.tasks.length : 0;
    const dateStr = tmpl.createdAt ? new Date(tmpl.createdAt).toLocaleDateString() : '';
    html += '<div class="template-modal-item">';
    html += '<div style="flex:1;cursor:pointer" onclick="loadCustomTemplate(\'' + _escDialog(name).replace(/'/g, "\\'") + '\');document.getElementById(\'template-modal-overlay\').remove()">';
    html += '<div class="template-modal-name">' + _escDialog(name) + '</div>';
    html += '<div class="template-modal-meta">' + taskCount + ' tasks' + (dateStr ? ' -- ' + dateStr : '') + '</div>';
    html += '</div>';
    html += '<button class="template-modal-delete" onclick="event.stopPropagation();deleteCustomTemplate(\'' + _escDialog(name).replace(/'/g, "\\'") + '\')" title="Delete template">';
    html += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2M5 6v14a2 2 0 002 2h10a2 2 0 002-2V6"/></svg>';
    html += '</button>';
    html += '</div>';
  }
  html += '</div>';

  // Dialog buttons
  html += '<div class="dialog-buttons" style="margin-top:1rem">';
  html += '<button class="dialog-btn dialog-btn-cancel" onclick="this.closest(\'#template-modal-overlay\').remove()">Cancel</button>';
  html += '</div>';
  html += '</div></div>';

  document.body.insertAdjacentHTML('beforeend', html);
}

function _countTemplateTasks(tasks) {
  let count = 0;
  for (const t of tasks) {
    count++;
    if (t.children) count += _countTemplateTasks(t.children);
  }
  return count;
}

/**
 * Insert a task below a specific task in the list.
 * Detects dependency chains and offers to splice the new task in.
 */
function insertTaskBelow(refTaskId) {
  const refTask = allTasks.find(t => t.id === refTaskId);
  if (!refTask) return;

  // Find insertion index: after refTask and all its children
  const refIdx = allTasks.findIndex(t => t.id === refTaskId);
  let insertIdx = refIdx + 1;
  while (insertIdx < allTasks.length && allTasks[insertIdx].outline.startsWith(refTask.outline + '.')) {
    insertIdx++;
  }

  // Determine new outline: same level as refTask, next sibling
  const parentOutline = refTask.outline.includes('.') ? refTask.outline.substring(0, refTask.outline.lastIndexOf('.')) : '';
  const siblingNum = parseInt(refTask.outline.split('.').pop());
  const newOutline = parentOutline ? parentOutline + '.' + (siblingNum + 1) : String(siblingNum + 1);
  const depth = refTask.depth;

  // Check: does the task BELOW the insertion point depend on refTask?
  const belowTask = insertIdx < allTasks.length ? allTasks[insertIdx] : null;
  let chainDetected = false;
  let chainDep = null;

  if (belowTask) {
    const deps = parseDependency(belowTask.dependsOn);
    chainDep = deps.find(d => d.taskNum === refTask.taskNumber);
    if (chainDep) chainDetected = true;
  }

  // Create the new task
  const maxId = allTasks.reduce((m, t) => Math.max(m, t.id), 0);
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const newTask = createTaskObject({
    id: maxId + 1, taskNumber: maxId + 1, outline: newOutline, depth: depth,
    start: refTask.finish || now,
    finish: new Date((refTask.finish || now).getTime() + DEFAULT_TASK_DURATION_DAYS * MS_PER_DAY),
    labels: [...(refTask.labels || [])], bucket: refTask.bucket || ''
  });

  if (chainDetected && belowTask) {
    // Show dependency chain dialog
    showDepChainDialog(refTask, belowTask, newTask, chainDep, insertIdx);
  } else {
    // No chain — show simple insert dialog
    showSimpleInsertDialog(refTask, belowTask, newTask, insertIdx);
  }
}

function showSimpleInsertDialog(refTask, belowTask, newTask, insertIdx) {
  const old = document.getElementById('dep-chain-dialog');
  if (old) old.remove();

  const belowName = belowTask ? esc(belowTask.name) : '(fine lista)';

  const html = `
    <div id="dep-chain-dialog" class="dep-chain-overlay" onclick="if(event.target===this)this.remove()">
      <div class="dep-chain-box">
        <div class="dep-chain-header">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
          <h3>Inserisci nuovo task</h3>
        </div>
        <p class="dep-chain-desc">
          Il task verrà inserito dopo <strong>${esc(refTask.name)}</strong>${belowTask ? ' e prima di <strong>' + belowName + '</strong>' : ''}
        </p>
        <p class="dep-chain-question">Vuoi aggiungere una dipendenza?</p>
        <div class="dep-chain-options">
          <button class="dep-chain-btn chain" onclick="handleSimpleInsert('depend')">
            <div class="dep-chain-icon">🔗</div>
            <div>
              <strong>Con dipendenza (FS)</strong>
              <span>Il nuovo task inizierà quando <em>${esc(refTask.name)}</em> finisce</span>
            </div>
          </button>
          <button class="dep-chain-btn independent" onclick="handleSimpleInsert('none')">
            <div class="dep-chain-icon">📌</div>
            <div>
              <strong>Senza dipendenza</strong>
              <span>Nessun legame, task libero</span>
            </div>
          </button>
        </div>
        <button class="dep-chain-cancel" onclick="this.closest('.dep-chain-overlay').remove()">Annulla</button>
      </div>
    </div>`;

  document.body.insertAdjacentHTML('beforeend', html);
  window._simpleInsertCtx = { refTask, newTask, insertIdx };
}

function handleSimpleInsert(choice) {
  const ctx = window._simpleInsertCtx;
  if (!ctx) return;
  const { refTask, newTask, insertIdx } = ctx;

  if (choice === 'depend') {
    newTask.dependsOn = refTask.taskNumber + 'FS';
  }

  doInsertTask(newTask, insertIdx);
  document.getElementById('dep-chain-dialog')?.remove();
  delete window._simpleInsertCtx;
}

function showDepChainDialog(aboveTask, belowTask, newTask, chainDep, insertIdx) {
  // Remove existing dialog if any
  const old = document.getElementById('dep-chain-dialog');
  if (old) old.remove();

  const depTypeLabel = chainDep.type + (chainDep.lag ? (chainDep.lag > 0 ? '+' : '') + chainDep.lag + 'd' : '');

  const html = `
    <div id="dep-chain-dialog" class="dep-chain-overlay" onclick="if(event.target===this)this.remove()">
      <div class="dep-chain-box">
        <div class="dep-chain-header">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" stroke-width="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
          <h3>Catena di dipendenze rilevata</h3>
        </div>
        <p class="dep-chain-desc">
          <strong>${esc(belowTask.name)}</strong> dipende da <strong>${esc(aboveTask.name)}</strong>
          <span class="dep-chain-badge">${depTypeLabel}</span>
        </p>
        <p class="dep-chain-question">Come vuoi inserire il nuovo task?</p>
        <div class="dep-chain-options">
          <button class="dep-chain-btn chain" onclick="handleDepChain('chain')">
            <div class="dep-chain-icon">🔗</div>
            <div>
              <strong>Inserisci nella catena</strong>
              <span>${esc(aboveTask.name)} → <em>Nuovo task</em> → ${esc(belowTask.name)}</span>
            </div>
          </button>
          <button class="dep-chain-btn independent" onclick="handleDepChain('independent')">
            <div class="dep-chain-icon">📌</div>
            <div>
              <strong>Mantieni indipendente</strong>
              <span>Nessuna dipendenza, catena originale invariata</span>
            </div>
          </button>
          <button class="dep-chain-btn copy" onclick="handleDepChain('copy')">
            <div class="dep-chain-icon">📋</div>
            <div>
              <strong>Copia dipendenza</strong>
              <span>Nuovo task e ${esc(belowTask.name)} dipendono entrambi da ${esc(aboveTask.name)}</span>
            </div>
          </button>
        </div>
        <button class="dep-chain-cancel" onclick="this.closest('.dep-chain-overlay').remove()">Annulla</button>
      </div>
    </div>`;

  document.body.insertAdjacentHTML('beforeend', html);

  // Store context for handler
  window._depChainCtx = { aboveTask, belowTask, newTask, chainDep, insertIdx };
}

function handleDepChain(choice) {
  const ctx = window._depChainCtx;
  if (!ctx) return;
  const { aboveTask, belowTask, newTask, chainDep, insertIdx } = ctx;
  const depType = chainDep.type;
  const depLag = chainDep.lag;
  const depStr = (num, type, lag) => num + type + (lag ? (lag > 0 ? '+' : '') + lag + 'd' : '');

  if (choice === 'chain') {
    // A → New → B: new task depends on A, B now depends on new task
    newTask.dependsOn = depStr(aboveTask.taskNumber, depType, depLag);
    // Replace B's dependency on A with dependency on new task
    const belowDeps = parseDependency(belowTask.dependsOn);
    const updatedDeps = belowDeps.map(d => {
      if (d.taskNum === aboveTask.taskNumber && d.type === depType) {
        return { ...d, taskNum: newTask.taskNumber };
      }
      return d;
    });
    belowTask.dependsOn = updatedDeps.map(d => depStr(d.taskNum, d.type, d.lag)).join(', ');
  } else if (choice === 'copy') {
    // New task gets same dependency as B
    newTask.dependsOn = depStr(aboveTask.taskNumber, depType, depLag);
  }
  // 'independent' → no changes to dependencies

  doInsertTask(newTask, insertIdx);
  document.getElementById('dep-chain-dialog')?.remove();
  delete window._depChainCtx;
}

function doInsertTask(newTask, insertIdx) {
  snapshotUndo();

  // Renumber outlines of siblings after insertion point
  const newOutlineParts = newTask.outline.split('.');
  const newNum = parseInt(newOutlineParts[newOutlineParts.length - 1]);
  const parentPrefix = newOutlineParts.length > 1 ? newOutlineParts.slice(0, -1).join('.') + '.' : '';

  for (let i = insertIdx; i < allTasks.length; i++) {
    const t = allTasks[i];
    if (parentPrefix && !t.outline.startsWith(parentPrefix)) break;
    if (!parentPrefix && t.outline.includes('.')) continue;

    const parts = t.outline.split('.');
    const level = parentPrefix ? parts.length : 1;
    if (level !== newOutlineParts.length) continue;

    const sibNum = parseInt(parts[parts.length - 1]);
    if (sibNum >= newNum) {
      const oldOutline = t.outline;
      const newSibOutline = parentPrefix + (sibNum + 1);
      t.outline = newSibOutline;
      // Also update children outlines
      for (let j = i + 1; j < allTasks.length; j++) {
        if (allTasks[j].outline.startsWith(oldOutline + '.')) {
          allTasks[j].outline = allTasks[j].outline.replace(oldOutline, newSibOutline);
        } else break;
      }
    }
  }

  allTasks.splice(insertIdx, 0, newTask);
  renumberAllTaskNumbers();
  rebuildAfterChange();
  if (newTask.dependsOn) propagateDependencies(newTask);
  renderAll();
  if (currentTab === 'dati') renderDataTable();
  scheduleSave();
  setTimeout(() => openEditPanel(newTask.id), 100);
}

function addSubTask(parentId) {
  const parent = allTasks.find(t => t.id === parentId);
  if (!parent) return;
  snapshotUndo();
  const maxId = allTasks.reduce((m, t) => Math.max(m, t.id), 0);

  // Find next child outline number
  const childOutlines = allTasks
    .filter(t => t.outline.startsWith(parent.outline + '.') && t.depth === parent.depth + 1)
    .map(t => {
      const parts = t.outline.split('.');
      return parseInt(parts[parts.length - 1]);
    })
    .filter(n => !isNaN(n));
  const nextChildNum = childOutlines.length > 0 ? Math.max(...childOutlines) + 1 : 1;
  const newOutline = parent.outline + '.' + nextChildNum;

  const now = new Date(); now.setHours(0, 0, 0, 0);
  const subTask = createTaskObject({
    id: maxId + 1, taskNumber: maxId + 1, outline: newOutline, depth: parent.depth + 1,
    name: DEFAULT_SUB_TASK_NAME,
    start: parent.start || now,
    finish: parent.finish || new Date(now.getTime() + DEFAULT_TASK_DURATION_DAYS * MS_PER_DAY),
    labels: [...parent.labels], bucket: parent.bucket
  });

  // Insert after parent and all its existing children
  const parentIdx = allTasks.findIndex(t => t.id === parentId);
  let insertIdx = parentIdx + 1;
  while (insertIdx < allTasks.length && allTasks[insertIdx].outline.startsWith(parent.outline + '.')) {
    insertIdx++;
  }
  allTasks.splice(insertIdx, 0, subTask);

  // Ensure parent is expanded
  getState().expandedSet.add(parent.outline);
  getState().collapsedSet.delete(parent.outline);

  rebuildAfterChange();
  renderAll();
  if (currentTab === 'dati') renderDataTable();
  scheduleSave();

  // Open edit panel for the new sub-task
  closeEditPanel();
  setTimeout(() => openEditPanel(subTask.id), 100);
}

/**
 * Smart Auto-Link: analyzes tasks and suggests sequential FS dependencies.
 * Groups by parent (siblings get chained), shows preview for approval.
 */
function autoLinkDependencies() {
  // Analyze: find groups of sibling tasks without dependencies
  const groups = [];

  function analyzeSiblings(tasks) {
    // Filter to tasks at same level, ordered by outline
    const unlinked = [];
    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i];
      const hasDep = t.dependsOn && t.dependsOn.trim().length > 0;
      if (!hasDep && !t.isMilestone) {
        unlinked.push(t);
      }
      // Recurse into children
      if (t.children && t.children.length > 1) {
        analyzeSiblings(t.children);
      }
    }
    // Find consecutive unlinked siblings (2+ in a row)
    if (tasks.length < 2) return;
    let chain = [];
    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i];
      const hasDep = t.dependsOn && t.dependsOn.trim().length > 0;
      if (!hasDep) {
        chain.push(t);
      } else {
        if (chain.length >= 2) groups.push([...chain]);
        chain = [];
      }
    }
    if (chain.length >= 2) groups.push([...chain]);
  }

  analyzeSiblings(taskTree);

  if (groups.length === 0) {
    showAutoLinkResult('Nessun suggerimento', 'Tutti i task hanno già dipendenze configurate, oppure non ci sono gruppi di task collegabili in sequenza.');
    return;
  }

  // Build preview
  let totalLinks = 0;
  let previewHtml = '';
  groups.forEach((group, gi) => {
    const parentName = group[0].parent ? group[0].parent.name : 'Livello principale';
    previewHtml += `<div class="al-group">
      <div class="al-group-title">${esc(parentName)}</div>
      <div class="al-chain">`;
    group.forEach((t, i) => {
      previewHtml += `<span class="al-task">${esc(t.name)}</span>`;
      if (i < group.length - 1) {
        previewHtml += `<span class="al-arrow">→</span>`;
        totalLinks++;
      }
    });
    previewHtml += `</div></div>`;
  });

  const old = document.getElementById('dep-chain-dialog');
  if (old) old.remove();

  const html = `
    <div id="dep-chain-dialog" class="dep-chain-overlay" onclick="if(event.target===this)this.remove()">
      <div class="dep-chain-box" style="max-width:540px">
        <div class="dep-chain-header">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" stroke-width="2"><path d="M9 17H7A5 5 0 017 7h2"/><path d="M15 7h2a5 5 0 010 10h-2"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
          <h3>Auto-Link Dipendenze</h3>
        </div>
        <p class="dep-chain-desc">
          Ho trovato <strong>${totalLinks} dipendenze</strong> da aggiungere in <strong>${groups.length} gruppo/i</strong> di task sequenziali.
          Ogni task inizierà quando il precedente finisce <span class="dep-chain-badge">FS</span>
        </p>
        <div class="al-preview">${previewHtml}</div>
        <div class="dep-chain-options" style="flex-direction:row;gap:.5rem;margin-top:.75rem">
          <button class="dep-chain-btn chain" onclick="executeAutoLink()" style="flex:1;justify-content:center;align-items:center;padding:.6rem">
            <div class="dep-chain-icon">✅</div>
            <strong>Applica tutto</strong>
          </button>
          <button class="dep-chain-btn independent" onclick="document.getElementById('dep-chain-dialog')?.remove()" style="flex:1;justify-content:center;align-items:center;padding:.6rem">
            <div class="dep-chain-icon">✕</div>
            <strong>Annulla</strong>
          </button>
        </div>
      </div>
    </div>`;

  document.body.insertAdjacentHTML('beforeend', html);
  window._autoLinkGroups = groups;
}

function executeAutoLink() {
  const groups = window._autoLinkGroups;
  if (!groups || !groups.length) return;
  snapshotUndo();

  groups.forEach(group => {
    for (let i = 1; i < group.length; i++) {
      const prev = group[i - 1];
      const curr = group[i];
      // Add FS dependency to predecessor
      const existing = curr.dependsOn ? curr.dependsOn.trim() : '';
      const newDep = prev.taskNumber + 'FS';
      curr.dependsOn = existing ? existing + ', ' + newDep : newDep;
    }
  });

  // Propagate all dependencies
  groups.forEach(group => {
    propagateDependencies(group[0]);
  });

  rebuildAfterChange();
  renderAll();
  if (currentTab === 'dati') renderDataTable();
  scheduleSave();

  document.getElementById('dep-chain-dialog')?.remove();
  delete window._autoLinkGroups;

  const totalLinks = groups.reduce((sum, g) => sum + g.length - 1, 0);
  showAutoLinkResult('Dipendenze applicate', `${totalLinks} dipendenze FS create con successo. Le date dei task sono state aggiornate automaticamente.`);
}

function showAutoLinkResult(title, msg) {
  const old = document.getElementById('dep-chain-dialog');
  if (old) old.remove();

  const html = `
    <div id="dep-chain-dialog" class="dep-chain-overlay" onclick="if(event.target===this)this.remove()">
      <div class="dep-chain-box" style="max-width:400px;text-align:center">
        <h3 style="margin:0 0 .5rem;font-size:1rem">${title}</h3>
        <p style="font-size:.85rem;color:var(--grey-txt);margin:0 0 1rem;line-height:1.5">${msg}</p>
        <button class="dep-chain-btn chain" onclick="document.getElementById('dep-chain-dialog')?.remove()" style="justify-content:center;align-items:center;padding:.5rem">
          <strong>OK</strong>
        </button>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
}

async function deleteSelectedTasks() {
  if (!selectedRows.size) return;
  if (!await showConfirm(`Delete ${selectedRows.size} selected task(s)?`, { title: 'Delete Tasks', danger: true, okLabel: 'Delete' })) return;
  snapshotUndo();
  const toRemove = new Set(selectedRows);
  const selectedOutlines = allTasks.filter(t => selectedRows.has(t.id)).map(t => t.outline);
  allTasks.forEach(t => {
    if (selectedOutlines.some(o => t.outline && t.outline.startsWith(o + '.'))) toRemove.add(t.id);
  });
  allTasks = allTasks.filter(t => !toRemove.has(t.id));
  selectedRows.clear();
  renumberAllTaskNumbers();
  rebuildAfterChange();
  renderAll();
  if (currentTab === 'dati') renderDataTable();
  DOM.btnDeleteSel.style.display = 'none';
  scheduleSave();
}

async function deleteTask(id) {
  if (!await showConfirm('Delete this task and all its sub-tasks?', { title: 'Delete Task', danger: true, okLabel: 'Delete' })) return;
  snapshotUndo();
  const task = allTasks.find(t => t.id === id);
  if (!task) return;
  const toRemove = new Set([id]);
  function collectChildren(t) { t.children.forEach(c => { toRemove.add(c.id); collectChildren(c); }); }
  collectChildren(task);
  allTasks = allTasks.filter(t => !toRemove.has(t.id));
  renumberAllTaskNumbers();
  rebuildAfterChange();
  closeEditPanel();
  renderAll();
  if (currentTab === 'dati') renderDataTable();
  scheduleSave();
}

function toggleSelectAll(checked) {
  const tasks = getFilteredFlatTasks();
  selectedRows.clear();
  if (checked) tasks.forEach(t => selectedRows.add(t.id));
  DOM.btnDeleteSel.style.display = selectedRows.size > 0 ? '' : 'none';
  renderDataTable();
}


/* ---------- SHARE VIA URL ---------- */

async function shareProject() {
  saveCurrentProjectToStorage();
  const proj = projects[currentProjectId];
  if (!proj) return;
  const json = JSON.stringify(proj);
  try {
    const blob = new Blob([json]);
    const cs = new CompressionStream('deflate');
    const stream = blob.stream().pipeThrough(cs);
    const compressed = await new Response(stream).arrayBuffer();
    const bytes = new Uint8Array(compressed);
    let binary = '';
    bytes.forEach(b => binary += String.fromCharCode(b));
    const b64 = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    if (b64.length > 32000) {
      showToast('Project is too large to share via URL. Use Excel export instead.', 'warn');
      return;
    }
    const url = location.origin + location.pathname + '#share=' + b64;
    await navigator.clipboard.writeText(url);
    showToast('Link copied to clipboard! Share it to let others view this project.', 'success', 5000);
  } catch (e) {
    console.error('Share failed:', e);
    showToast('Share error: ' + e.message, 'error');
  }
}

async function loadFromURL() {
  const hash = location.hash;
  if (!hash.startsWith('#share=')) return false;
  const b64 = hash.slice(7).replace(/-/g, '+').replace(/_/g, '/');
  try {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const ds = new DecompressionStream('deflate');
    const blob = new Blob([bytes]);
    const stream = blob.stream().pipeThrough(ds);
    const text = await new Response(stream).text();
    const proj = JSON.parse(text);
    const id = generateId();
    proj.name = (proj.name || 'Shared project') + ' (shared)';
    projects[id] = proj;
    currentProjectId = id;
    saveCurrentProjectToStorage();
    loadProjectById(id);
    history.replaceState(null, '', location.pathname);
    updateSaveIndicator('Shared project loaded');
    return true;
  } catch (e) {
    console.error('Failed to load shared project:', e);
    showToast('Failed to load shared project. The link may be invalid or corrupted.', 'error', 6000);
    return false;
  }
}


/* ---------- THEME ---------- */

function toggleTheme() {
  const d = document.documentElement;
  const dark = d.getAttribute('data-theme') === 'dark';
  d.setAttribute('data-theme', dark ? '' : 'dark');
  document.querySelectorAll('#theme-icon').forEach(el => el.innerHTML = dark ? SVG_MOON : SVG_SUN);
  try { localStorage.setItem(STORAGE_KEY_THEME, dark ? '' : 'dark'); } catch (e) {}
}

function loadTheme() {
  try {
    const t = localStorage.getItem(STORAGE_KEY_THEME);
    if (t === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.querySelectorAll('#theme-icon').forEach(el => el.innerHTML = SVG_SUN);
    }
  } catch (e) {}
}


/* ---------- EXPORT PNG ---------- */

function exportPNG() {
  const el = DOM.ganttWrapper;
  html2canvas(el, {
    scale: 2, useCORS: true,
    backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()
  }).then(canvas => {
    const a = document.createElement('a');
    const pName = projects[currentProjectId]?.name || 'PlanView';
    a.download = pName.replace(/[^a-zA-Z0-9_-]/g, '_') + '.png';
    a.href = canvas.toDataURL('image/png');
    a.click();
  });
}

function exportCopyPNG() {
  const el = DOM.ganttWrapper;
  html2canvas(el, {
    scale: 2, useCORS: true,
    backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()
  }).then(canvas => {
    canvas.toBlob(blob => {
      if (!blob) { showToast('Failed to create image', 'error'); return; }
      navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]).then(() => {
        showToast('PNG copied to clipboard', 'success');
      }).catch(() => {
        showToast('Could not copy to clipboard. Try downloading instead.', 'warn');
      });
    }, 'image/png');
  });
}


/* ====================================================================
   COLUMN RESIZE
   ==================================================================== */

let _resizeCol = null;
let _resizeStartX = 0;
let _resizeStartW = 0;

let _colResizeJustFinished = false;
function startColResize(e, colId) {
  e.preventDefault();
  e.stopPropagation();
  _resizeCol = colId;
  _resizeStartX = e.clientX;
  const th = e.target.closest('th');
  _resizeStartW = th.offsetWidth;
  document.body.classList.add('col-resizing');
  e.target.classList.add('active');

  // Auto-switch to scroll mode when user manually resizes a column
  if (!tableScrollMode) {
    tableScrollMode = true;
    applyTableLayoutMode();
    const togBtn = document.getElementById('table-layout-btn');
    if (togBtn) {
      togBtn.classList.add('active');
      togBtn.querySelector('span').textContent = 'Scroll';
    }
  }

  const table = document.getElementById('data-table');

  // Feature 4: Create resize guide line
  const guide = document.createElement('div');
  guide.className = 'col-resize-guide';
  guide.style.left = e.clientX + 'px';
  document.body.appendChild(guide);

  function onMove(ev) {
    const diff = ev.clientX - _resizeStartX;
    const colMinW = (typeof MIN_COL_WIDTHS !== 'undefined' && MIN_COL_WIDTHS[_resizeCol]) || MIN_COLUMN_WIDTH;
    const newW = Math.max(colMinW, _resizeStartW + diff);
    columnWidths[_resizeCol] = newW;
    th.style.width = newW + 'px';
    // Update guide line position
    guide.style.left = ev.clientX + 'px';
    // Update table total width so it can grow beyond container
    if (table && tableScrollMode) {
      applyTableLayoutMode();
    }
  }
  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    document.body.classList.remove('col-resizing');
    document.querySelectorAll('.col-resize-handle.active').forEach(h => h.classList.remove('active'));
    // Remove guide line
    guide.remove();
    _resizeCol = null;
    // Suppress the click event that fires right after mouseup on the <th>
    _colResizeJustFinished = true;
    requestAnimationFrame(() => { _colResizeJustFinished = false; });
    scheduleSave();
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}


/* ====================================================================
   DRAG & DROP ROWS
   ==================================================================== */

function initDragDrop() {
  const tbody = DOM.dtBody;
  if (!tbody) return;

  let dragging = false;
  let dragId = null;
  let ghostEl = null;
  let indicatorEl = null;
  let startX = 0;
  let startY = 0;
  let origIdx = -1;
  let targetIdx = -1;
  let indentDelta = 0;

  tbody.addEventListener('mousedown', function(e) {
    const handle = e.target.closest('.dt-drag-handle');
    if (!handle || !isDataEditMode) return;
    e.preventDefault();
    dragId = parseInt(handle.dataset.dragId);
    startX = e.clientX;
    startY = e.clientY;
    dragging = false;

    const row = handle.closest('tr');
    origIdx = allTasks.findIndex(t => t.id === dragId);

    function onMove(ev) {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;

      if (!dragging && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
        dragging = true;
        document.body.classList.add('row-dragging');
        row.classList.add('dragging-source');

        // Create ghost
        const task = allTasks.find(t => t.id === dragId);
        ghostEl = document.createElement('div');
        ghostEl.className = 'drag-ghost';
        ghostEl.innerHTML = `${esc(task.name)}<span class="drag-indent-hint"></span>`;
        document.body.appendChild(ghostEl);

        // Create drop indicator
        indicatorEl = document.createElement('div');
        indicatorEl.className = 'drag-drop-indicator';
        indicatorEl.style.display = 'none';
        tbody.style.position = 'relative';
        tbody.appendChild(indicatorEl);
      }

      if (!dragging) return;

      // Move ghost
      ghostEl.style.left = (ev.clientX + 16) + 'px';
      ghostEl.style.top = (ev.clientY - 14) + 'px';

      // Compute indent from horizontal offset
      const hintEl = ghostEl.querySelector('.drag-indent-hint');
      if (dx > 40) {
        indentDelta = 1;
        hintEl.textContent = '(indent →)';
        hintEl.classList.add('visible');
      } else if (dx < -40) {
        indentDelta = -1;
        hintEl.textContent = '(← outdent)';
        hintEl.classList.add('visible');
      } else {
        indentDelta = 0;
        hintEl.classList.remove('visible');
      }

      // Find target row
      const rows = tbody.querySelectorAll('tr[data-id]:not(.dragging-source):not(.quick-add-row)');
      targetIdx = -1;
      let closestDist = Infinity;
      let indicatorTop = 0;

      rows.forEach((r, i) => {
        const rect = r.getBoundingClientRect();
        const mid = rect.top + rect.height / 2;
        const dist = Math.abs(ev.clientY - mid);
        if (dist < closestDist) {
          closestDist = dist;
          if (ev.clientY < mid) {
            targetIdx = i;
            indicatorTop = r.offsetTop;
          } else {
            targetIdx = i + 1;
            indicatorTop = r.offsetTop + r.offsetHeight;
          }
        }
      });

      // Show indicator
      if (targetIdx >= 0) {
        indicatorEl.style.display = 'block';
        indicatorEl.style.top = indicatorTop + 'px';
        // Indent visual offset
        const indentPx = Math.max(0, indentDelta) * 30;
        indicatorEl.style.left = indentPx + 'px';
      }
    }

    function onUp(ev) {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);

      if (ghostEl) { ghostEl.remove(); ghostEl = null; }
      if (indicatorEl) { indicatorEl.remove(); indicatorEl = null; }
      row.classList.remove('dragging-source');
      document.body.classList.remove('row-dragging');

      if (!dragging || origIdx < 0 || targetIdx < 0) return;

      // Get the flat task list as currently displayed
      const visCols = ALL_COLUMNS.filter(c => visibleColumns.has(c.id));
      const dataRows = buildVisibleList(filteredTree, { skipInlineMs: false, tabState: viewStates.dati });
      const visibleTasks = dataRows.map(r => r.task);

      const draggedTask = allTasks[origIdx];
      if (!draggedTask) return;

      // Determine target task in allTasks
      const targetTask = targetIdx < visibleTasks.length ? visibleTasks[targetIdx] : null;
      const targetAllIdx = targetTask ? allTasks.findIndex(t => t.id === targetTask.id) : allTasks.length;

      if (targetAllIdx === origIdx || targetAllIdx === origIdx + 1) {
        // Only handle indent/outdent if no position change
        if (indentDelta !== 0) {
          snapshotUndo();
          applyIndentOutdent(draggedTask, indentDelta);
        }
        return;
      }

      snapshotUndo();

      // Collect dragged task + children
      const toMove = [draggedTask];
      const dIdx = allTasks.indexOf(draggedTask);
      for (let i = dIdx + 1; i < allTasks.length; i++) {
        if (allTasks[i].outline.startsWith(draggedTask.outline + '.')) toMove.push(allTasks[i]);
        else break;
      }

      // Remove from array
      allTasks = allTasks.filter(t => !toMove.includes(t));

      // Recalculate insert index after removal
      let insertIdx = targetTask ? allTasks.findIndex(t => t.id === targetTask.id) : allTasks.length;
      if (insertIdx < 0) insertIdx = allTasks.length;

      // Determine the correct depth for the dragged task at its new position
      const aboveTask = insertIdx > 0 ? allTasks[insertIdx - 1] : null;
      const belowTask = insertIdx < allTasks.length ? allTasks[insertIdx] : null;

      let targetDepth;
      if (indentDelta > 0 && aboveTask) {
        // Indent: become child of above task
        targetDepth = aboveTask.depth + 1;
      } else if (indentDelta < 0) {
        // Outdent: go up one level, but not above depth 1
        targetDepth = Math.max(1, draggedTask.depth - 1);
      } else {
        // Same level move: match the depth of the context
        if (belowTask) {
          targetDepth = belowTask.depth;
        } else if (aboveTask) {
          targetDepth = aboveTask.depth;
        } else {
          targetDepth = 1;
        }
      }

      // Adjust depths of moved tasks relative to the dragged task's new depth
      const depthShift = targetDepth - draggedTask.depth;
      toMove.forEach(t => {
        t.depth = t.depth + depthShift;
      });

      // Insert at new position
      allTasks.splice(insertIdx, 0, ...toMove);

      // Recalculate all outlines from depths, then renumber task numbers
      recalculateAllOutlines();
      renumberAllTaskNumbers();
      rebuildAfterChange();
      renderAll();
      if (currentTab === 'dati') renderDataTable();
      scheduleSave();
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

function applyIndentOutdent(task, delta) {
  const idx = allTasks.indexOf(task);

  if (delta > 0) {
    // Indent: become child of previous task
    if (idx <= 0) return;
    const prev = allTasks[idx - 1];
    if (prev.depth < task.depth) return; // already a child

    // Shift depth of task and its children
    const oldDepth = task.depth;
    const newDepth = prev.depth + 1;
    const depthShift = newDepth - oldDepth;

    // Collect task + children (contiguous tasks with outline starting with task.outline + '.')
    for (let i = idx; i < allTasks.length; i++) {
      const t = allTasks[i];
      if (i === idx || t.outline.startsWith(task.outline + '.')) {
        t.depth += depthShift;
      } else {
        break;
      }
    }
  } else if (delta < 0) {
    // Outdent: go up one level
    if (task.depth <= 1) return;

    const depthShift = -1;
    for (let i = idx; i < allTasks.length; i++) {
      const t = allTasks[i];
      if (i === idx || t.outline.startsWith(task.outline + '.')) {
        t.depth += depthShift;
      } else {
        break;
      }
    }
  }

  recalculateAllOutlines();
  renumberAllTaskNumbers();
  rebuildAfterChange();
  renderAll();
  if (currentTab === 'dati') renderDataTable();
  scheduleSave();
}


/* ====================================================================
   QUICK-ADD ROW
   ==================================================================== */

function handleQuickAdd(e) {
  if (e.key !== 'Enter') return;
  const input = e.target;
  const name = input.value.trim();
  if (!name) return;

  snapshotUndo();
  const maxId = allTasks.reduce((m, t) => Math.max(m, t.id), 0);
  let nextOutline = '1';
  if (allTasks.length > 0) {
    const topLevelOutlines = allTasks.filter(t => t.depth === 1).map(t => parseInt(t.outline)).filter(n => !isNaN(n));
    nextOutline = String((topLevelOutlines.length > 0 ? Math.max(...topLevelOutlines) : 0) + 1);
  }
  const task = createTaskObject({ id: maxId + 1, taskNumber: maxId + 1, outline: nextOutline, name: name });
  allTasks.push(task);
  renumberAllTaskNumbers();
  rebuildAfterChange();
  renderAll();
  if (currentTab === 'dati') renderDataTable();
  scheduleSave();

  // Re-focus input after re-render
  setTimeout(() => {
    const newInput = document.getElementById('quick-add-input');
    if (newInput) newInput.focus();
  }, 50);
}


/* ====================================================================
   CONTEXT MENU
   ==================================================================== */

let _ctxMenu = null;

function showContextMenu(e, taskId) {
  e.preventDefault();
  closeContextMenu();

  const task = allTasks.find(t => t.id === taskId);
  if (!task) return;

  const menu = document.createElement('div');
  menu.className = 'ctx-menu';
  menu.id = 'ctx-menu';

  const items = [
    { label: 'Edit task', icon: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>', action: () => openEditPanel(taskId) },
    { label: 'Duplicate', icon: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>', action: () => duplicateTask(taskId), shortcut: 'Ctrl+D' },
    { sep: true },
    { label: 'Insert above', icon: '<path d="M12 5v14M5 12h14"/><path d="M5 5h14"/>', action: () => insertTaskAt(taskId, 'above') },
    { label: 'Insert below', icon: '<path d="M12 5v14M5 12h14"/><path d="M5 19h14"/>', action: () => insertTaskAt(taskId, 'below') },
    { label: 'Add subtask', icon: '<path d="M12 5v14M5 12h14"/>', action: () => addSubTask(taskId) },
    { sep: true },
    { label: 'Indent (make child)', icon: '<path d="M13 17l5-5-5-5M3 12h15"/>', action: () => { snapshotUndo(); applyIndentOutdent(task, 1); }, shortcut: 'Alt+Right' },
    { label: 'Outdent (promote)', icon: '<path d="M11 17l-5-5 5-5M21 12H6"/>', action: () => { snapshotUndo(); applyIndentOutdent(task, -1); }, shortcut: 'Alt+Left' },
    { sep: true },
    { label: 'Delete task', icon: '<path d="M3 6h18M8 6V4h8v2M5 6v14a2 2 0 002 2h10a2 2 0 002-2V6"/>', action: () => deleteTask(taskId), danger: true, shortcut: 'Del' },
  ];

  items.forEach(item => {
    if (item.sep) {
      menu.insertAdjacentHTML('beforeend', '<div class="ctx-menu-sep"></div>');
      return;
    }
    const cls = item.danger ? 'ctx-menu-item danger' : 'ctx-menu-item';
    const shortcut = item.shortcut ? `<span class="ctx-shortcut">${item.shortcut}</span>` : '';
    const el = document.createElement('div');
    el.className = cls;
    el.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${item.icon}</svg><span>${item.label}</span>${shortcut}`;
    el.addEventListener('click', () => { closeContextMenu(); item.action(); });
    menu.appendChild(el);
  });

  document.body.appendChild(menu);
  _ctxMenu = menu;

  // Position
  let x = e.clientX, y = e.clientY;
  requestAnimationFrame(() => {
    const rect = menu.getBoundingClientRect();
    if (x + rect.width > window.innerWidth) x = window.innerWidth - rect.width - 8;
    if (y + rect.height > window.innerHeight) y = window.innerHeight - rect.height - 8;
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
  });

  // Close on outside click / Escape
  setTimeout(() => {
    document.addEventListener('click', closeContextMenu);
    document.addEventListener('keydown', _ctxMenuEscHandler);
  }, 0);
}

function _ctxMenuEscHandler(ev) {
  if (ev.key === 'Escape') closeContextMenu();
}

function closeContextMenu() {
  if (_ctxMenu) { _ctxMenu.remove(); _ctxMenu = null; }
  document.removeEventListener('click', closeContextMenu);
  document.removeEventListener('keydown', _ctxMenuEscHandler);
}

function duplicateTask(taskId) {
  const task = allTasks.find(t => t.id === taskId);
  if (!task) return;
  snapshotUndo();
  const maxId = allTasks.reduce((m, t) => Math.max(m, t.id), 0);
  const idx = allTasks.indexOf(task);

  // Find next sibling outline
  const parts = task.outline.split('.');
  parts[parts.length - 1] = String(parseInt(parts[parts.length - 1]) + 1);
  const newOutline = parts.join('.');

  const clone = {
    ...task,
    id: maxId + 1, taskNumber: maxId + 1,
    outline: newOutline,
    name: task.name + ' (copy)',
    children: [], parent: null,
    colorOverride: task.colorOverride || '',
    manualProgress: task.manualProgress || false,
    labels: [...task.labels]
  };

  // Insert after original (and its children)
  let insertIdx = idx + 1;
  while (insertIdx < allTasks.length && allTasks[insertIdx].outline.startsWith(task.outline + '.')) insertIdx++;

  // Renumber outlines of siblings after insertion
  const cloneParts = newOutline.split('.');
  const cloneNum = parseInt(cloneParts[cloneParts.length - 1]);
  const parentPrefix = cloneParts.length > 1 ? cloneParts.slice(0, -1).join('.') + '.' : '';

  for (let i = insertIdx; i < allTasks.length; i++) {
    const t = allTasks[i];
    if (parentPrefix && !t.outline.startsWith(parentPrefix)) break;
    if (!parentPrefix && t.outline.includes('.')) continue;
    const tParts = t.outline.split('.');
    if (tParts.length !== cloneParts.length) continue;
    const sibNum = parseInt(tParts[tParts.length - 1]);
    if (sibNum >= cloneNum) {
      const oldO = t.outline;
      const newSibOutline = parentPrefix + (sibNum + 1);
      t.outline = newSibOutline;
      for (let j = i + 1; j < allTasks.length; j++) {
        if (allTasks[j].outline.startsWith(oldO + '.')) {
          allTasks[j].outline = allTasks[j].outline.replace(oldO, newSibOutline);
        } else break;
      }
    }
  }

  allTasks.splice(insertIdx, 0, clone);
  renumberAllTaskNumbers();
  rebuildAfterChange();
  renderAll();
  if (currentTab === 'dati') renderDataTable();
  scheduleSave();
}

function insertTaskAt(taskId, position) {
  const task = allTasks.find(t => t.id === taskId);
  if (!task) return;
  if (position === 'below') {
    insertTaskBelow(taskId);
    return;
  }
  // Insert above: same as insertBelow on the task above, or at position 0
  const idx = allTasks.indexOf(task);
  if (idx > 0) {
    insertTaskBelow(allTasks[idx - 1].id);
  } else {
    // Insert at very top
    snapshotUndo();
    const maxId = allTasks.reduce((m, t) => Math.max(m, t.id), 0);
    const newTask = createTaskObject({ id: maxId + 1, taskNumber: maxId + 1 });
    // Shift all outlines at depth 1
    allTasks.forEach(t => {
      if (t.depth === 1) {
        const num = parseInt(t.outline);
        if (!isNaN(num)) {
          const oldO = t.outline;
          t.outline = String(num + 1);
          // Update children
          allTasks.forEach(c => {
            if (c.outline.startsWith(oldO + '.')) {
              c.outline = c.outline.replace(oldO, t.outline);
            }
          });
        }
      }
    });
    allTasks.unshift(newTask);
    renumberAllTaskNumbers();
    rebuildAfterChange();
    renderAll();
    if (currentTab === 'dati') renderDataTable();
    scheduleSave();
    setTimeout(() => openEditPanel(newTask.id), 100);
  }
}


/* ====================================================================
   KEYBOARD NAVIGATION (Data Table)
   ==================================================================== */

function initKeyboardNav() {
  const table = document.getElementById('data-table');
  if (!table) return;

  table.addEventListener('click', function(e) {
    if (currentTab !== 'dati') return;
    const td = e.target.closest('td');
    const tr = e.target.closest('tr[data-row-idx]');
    if (!td || !tr) return;
    // Don't override clicks on inputs/selects/buttons
    if (e.target.matches('input,select,textarea,button,.dt-drag-handle,.dt-insert-btn,.row-cb,.tag-add-hint,.ep-tag,.col-resize-handle')) return;

    const rowIdx = parseInt(tr.dataset.rowIdx);
    const cells = [...tr.children];
    const colIdx = cells.indexOf(td);
    if (isNaN(rowIdx) || colIdx < 0) return;

    setActiveCell(rowIdx, colIdx);
  });

  // Double-click to inline edit in non-edit mode
  table.addEventListener('dblclick', function(e) {
    if (currentTab !== 'dati') return;
    if (isDataEditMode) return; // already has inputs
    const td = e.target.closest('td');
    const tr = e.target.closest('tr[data-row-idx]');
    if (!td || !tr) return;
    const taskId = parseInt(tr.dataset.id);
    if (isNaN(taskId)) return;
    const task = allTasks.find(t => t.id === taskId);
    if (!task) return;

    // Map cell to column using data-col attribute on td, fallback to index
    const visCols = ALL_COLUMNS.filter(c => visibleColumns.has(c.id));
    let col = null;
    if (td.dataset.col) {
      col = visCols.find(c => c.id === td.dataset.col);
    }
    if (!col) {
      const cellIdx = [...tr.children].indexOf(td);
      col = visCols[cellIdx];
    }
    if (!col) return;

    const isParent = task.children && task.children.length > 0;

    // Non-editable columns
    if (['select', 'taskNum', 'outline', 'duration', 'milestone'].includes(col.id)) return;
    // Parent tasks: dates and progress are auto-calculated, block editing
    if (isParent && ['start', 'finish', 'pct'].includes(col.id)) return;

    const origValue = td.innerHTML;
    let inputHtml = '';
    switch (col.id) {
      case 'name':
        inputHtml = `<input type="text" value="${esc(task.name)}" data-field="name" data-id="${taskId}">`;
        break;
      case 'start': {
        const sv = task.start ? task.start.toISOString().slice(0,10) : '';
        inputHtml = `<input type="date" value="${sv}" data-field="start" data-id="${taskId}">`;
        break;
      }
      case 'finish': {
        const fv = task.finish ? task.finish.toISOString().slice(0,10) : '';
        inputHtml = `<input type="date" value="${fv}" data-field="finish" data-id="${taskId}">`;
        break;
      }
      case 'pct': {
        const pct = Math.round(task.percentComplete * 100);
        inputHtml = `<input type="number" min="0" max="100" value="${pct}" data-field="percentComplete" data-id="${taskId}" style="width:60px">`;
        break;
      }
      case 'bucket': {
        const buckets = ['', ...customBuckets, ...Object.keys(BUCKET_COLORS)].filter((v,i,a) => a.indexOf(v) === i);
        inputHtml = `<select data-field="bucket" data-id="${taskId}">${buckets.map(b => `<option value="${b}" ${b === task.bucket ? 'selected' : ''}>${b || '\u2014'}</option>`).join('')}</select>`;
        break;
      }
      case 'priority':
        inputHtml = `<select data-field="priority" data-id="${taskId}">${['', 'Urgent', 'Important', 'Medium', 'Low'].map(p => `<option value="${p}" ${p === task.priority ? 'selected' : ''}>${p || '\u2014'}</option>`).join('')}</select>`;
        break;
      case 'deps':
        inputHtml = `<input type="text" value="${esc(task.dependsOn)}" data-field="dependsOn" data-id="${taskId}">`;
        break;
      case 'effort':
        inputHtml = `<input type="text" value="${esc(String(task.effort || ''))}" data-field="effort" data-id="${taskId}">`;
        break;
      case 'notes':
        inputHtml = `<input type="text" value="${esc(task.notes || '')}" data-field="notes" data-id="${taskId}">`;
        break;
      case 'assigned':
        inputHtml = `<input type="text" value="${esc(task.assigned || '')}" data-field="assigned" data-id="${taskId}">`;
        break;
      case 'status':
        inputHtml = `<select data-field="status" data-id="${taskId}">${(typeof STATUS_OPTIONS !== 'undefined' ? STATUS_OPTIONS : ['','Not started','In progress','Completed','On hold']).map(s => `<option value="${s}" ${s === (task.status||'') ? 'selected' : ''}>${s || '\u2014'}</option>`).join('')}</select>`;
        break;
      case 'cost':
        inputHtml = `<input type="text" value="${esc(task.cost || '')}" data-field="cost" data-id="${taskId}">`;
        break;
      case 'sprint':
        inputHtml = `<input type="text" value="${esc(task.sprint || '')}" data-field="sprint" data-id="${taskId}">`;
        break;
      case 'category':
        inputHtml = `<input type="text" value="${esc(task.category || '')}" data-field="category" data-id="${taskId}">`;
        break;
      case 'labels':
        openDataLabelPicker(td, taskId);
        return;
      default:
        return;
    }

    td.innerHTML = inputHtml;
    td.classList.add('cell-editing');
    const input = td.querySelector('input,select');
    if (input) {
      input.focus();
      if (input.type === 'text' || input.type === 'number') input.select();

      let saved = false;
      const saveAndRevert = () => {
        if (saved) return;
        saved = true;
        input.removeEventListener('blur', saveAndRevert);
        input.removeEventListener('keydown', onKey);
        // Explicitly save the value to the task before re-render
        const field = input.dataset.field;
        const val = input.value;
        if (field === 'name') {
          const trimmed = val.trim();
          task.name = trimmed || DEFAULT_TASK_NAME;
        } else if (field === 'start') {
          const newStart = val ? new Date(val + 'T00:00:00') : null;
          if (newStart && isNaN(newStart.getTime())) { td.innerHTML = origValue; td.classList.remove('cell-editing'); return; }
          if (newStart && task.finish && newStart > task.finish) task.finish = new Date(newStart);
          task.start = newStart;
          recalcDuration(task);
          propagateDependencies(task);
        } else if (field === 'finish') {
          const newFinish = val ? new Date(val + 'T00:00:00') : null;
          if (newFinish && isNaN(newFinish.getTime())) { td.innerHTML = origValue; td.classList.remove('cell-editing'); return; }
          if (newFinish && task.start && newFinish < task.start) task.start = new Date(newFinish);
          task.finish = newFinish;
          recalcDuration(task);
          propagateDependencies(task);
        } else if (field === 'percentComplete') {
          let v = parseInt(val) || 0;
          v = Math.max(0, Math.min(100, v));
          task.percentComplete = v / 100;
          const isLeaf = !task.children || task.children.length === 0;
          if (isLeaf) task.manualProgress = true;
        } else if (field === 'dependsOn') {
          if (val && detectCircularDependency(task.id, val)) {
            showToast('Circular dependency detected.', 'error');
            td.innerHTML = origValue;
            td.classList.remove('cell-editing');
            return;
          }
          // Validate dependency references exist
          if (val) {
            const deps = parseDependency(val);
            const taskByNum = new Map();
            allTasks.forEach(t => taskByNum.set(t.taskNumber, t));
            const invalid = deps.filter(d => !taskByNum.has(d.taskNum));
            if (invalid.length > 0) {
              showToast('Task #' + invalid[0].taskNum + ' not found. Check dependency references.', 'warn');
            }
          }
          task.dependsOn = val;
        } else if (field === 'bucket') { task.bucket = val; }
        else if (field === 'priority') { task.priority = val; }
        else if (field === 'effort') { task.effort = val; }
        else if (field === 'notes') { task.notes = val; }
        else if (field === 'assigned') { task.assigned = val; }
        else if (field === 'status') { task.status = val; }
        else if (field === 'cost') { task.cost = val; }
        else if (field === 'sprint') { task.sprint = val; }
        else if (field === 'category') { task.category = val; }

        snapshotUndo();
        rebuildAfterChange();
        if (currentTab === 'dati') renderDataTable();
        if (currentTab === 'roadmap') renderAll();
        scheduleSave();
      };
      const onKey = (ev) => {
        if (ev.key === 'Enter') { ev.preventDefault(); saveAndRevert(); }
        if (ev.key === 'Escape') {
          saved = true;
          input.removeEventListener('blur', saveAndRevert);
          input.removeEventListener('keydown', onKey);
          td.innerHTML = origValue;
          td.classList.remove('cell-editing');
        }
      };
      input.addEventListener('blur', saveAndRevert);
      input.addEventListener('keydown', onKey);
    }
  });

  document.addEventListener('keydown', function(e) {
    if (currentTab !== 'dati' || !activeCell) return;
    // Skip if user is in quick-add input
    if (document.activeElement && document.activeElement.id === 'quick-add-input') return;

    const { rowIdx, colIdx } = activeCell;
    const tbody = DOM.dtBody;
    if (!tbody) return;
    const rows = tbody.querySelectorAll('tr[data-row-idx]');
    const maxRow = rows.length - 1;

    if (cellEditMode) {
      // In edit mode: Escape exits edit, Tab moves to next cell, Enter confirms and moves down
      if (e.key === 'Escape') {
        e.preventDefault();
        exitCellEdit();
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        exitCellEdit();
        if (e.shiftKey) moveActiveCell(0, -1);
        else moveActiveCell(0, 1);
        return;
      }
      if (e.key === 'Enter' && !e.target.matches('select')) {
        e.preventDefault();
        exitCellEdit();
        moveActiveCell(1, 0);
        return;
      }
      return; // let normal typing through
    }

    // Navigation mode
    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault(); moveActiveCell(-1, 0); break;
      case 'ArrowDown':
        e.preventDefault(); moveActiveCell(1, 0); break;
      case 'ArrowLeft':
        e.preventDefault(); moveActiveCell(0, -1); break;
      case 'ArrowRight':
        e.preventDefault(); moveActiveCell(0, 1); break;
      case 'Tab':
        e.preventDefault();
        if (e.shiftKey) moveActiveCell(0, -1);
        else moveActiveCell(0, 1);
        break;
      case 'Enter':
      case 'F2':
        e.preventDefault(); enterCellEdit(); break;
      case 'Delete':
      case 'Backspace':
        if (!cellEditMode) {
          // Delete key on selected row - show delete confirm
          const tr = rows[rowIdx];
          if (tr) {
            const id = parseInt(tr.dataset.id);
            if (id && e.key === 'Delete') deleteTask(id);
          }
        }
        break;
      case 'Escape':
        e.preventDefault();
        activeCell = null; cellEditMode = false;
        clearCellHighlights();
        break;
      case 'd':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          const tr = rows[rowIdx];
          if (tr) duplicateTask(parseInt(tr.dataset.id));
        }
        break;
    }

    // Alt+Arrow for indent/outdent/move
    if (e.altKey) {
      const tr = rows[rowIdx];
      if (!tr) return;
      const taskId = parseInt(tr.dataset.id);
      const task = allTasks.find(t => t.id === taskId);
      if (!task) return;

      if (e.key === 'ArrowRight') {
        e.preventDefault(); snapshotUndo(); applyIndentOutdent(task, 1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault(); snapshotUndo(); applyIndentOutdent(task, -1);
      }
    }
  });
}

function setActiveCell(rowIdx, colIdx) {
  clearCellHighlights();
  removeFillHandle();
  activeCell = { rowIdx, colIdx };
  cellEditMode = false;
  highlightActiveCell();
  // Feature 13: Show fill handle on selected cell
  if (isDataEditMode) showFillHandle();
}

function moveActiveCell(dRow, dCol) {
  if (!activeCell) return;
  const tbody = DOM.dtBody;
  const rows = tbody.querySelectorAll('tr[data-row-idx]');
  const maxRow = rows.length - 1;

  let { rowIdx, colIdx } = activeCell;
  rowIdx = Math.max(0, Math.min(maxRow, rowIdx + dRow));
  const row = rows[rowIdx];
  if (!row) return;
  const maxCol = row.children.length - 1;
  colIdx = Math.max(0, Math.min(maxCol, colIdx + dCol));

  setActiveCell(rowIdx, colIdx);
}

function highlightActiveCell() {
  if (!activeCell) return;
  const tbody = DOM.dtBody;
  const rows = tbody.querySelectorAll('tr[data-row-idx]');
  const row = rows[activeCell.rowIdx];
  if (!row) return;
  row.classList.add('row-selected');
  const cell = row.children[activeCell.colIdx];
  if (cell) {
    cell.classList.add('cell-selected');
    cell.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
}

function clearCellHighlights() {
  document.querySelectorAll('.cell-selected,.cell-editing,.row-selected').forEach(el => {
    el.classList.remove('cell-selected', 'cell-editing', 'row-selected');
  });
  removeFillHandle();
}

function enterCellEdit() {
  if (!activeCell) return;
  const tbody = DOM.dtBody;
  const rows = tbody.querySelectorAll('tr[data-row-idx]');
  const row = rows[activeCell.rowIdx];
  if (!row) return;
  const cell = row.children[activeCell.colIdx];
  if (!cell) return;

  // If not in edit mode, simulate a dblclick to trigger inline edit
  if (!isDataEditMode) {
    cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    return;
  }

  cellEditMode = true;
  cell.classList.remove('cell-selected');
  cell.classList.add('cell-editing');

  // Focus the first input/select/textarea inside the cell
  const input = cell.querySelector('input,select,textarea');
  if (input) {
    input.focus();
    if (input.type === 'text' || input.type === 'number') input.select();
  }
}

function exitCellEdit() {
  cellEditMode = false;
  // Blur active element
  if (document.activeElement && document.activeElement.matches('input,select,textarea')) {
    document.activeElement.blur();
  }
  clearCellHighlights();
  highlightActiveCell();
}


/* ====================================================================
   FEATURE 4: COLUMN RESIZE GUIDE LINE
   ==================================================================== */

// (Added inside startColResize via patching below)


/* ====================================================================
   FEATURE 8: BULK EDIT BAR
   ==================================================================== */

function showBulkEditBar(visCols) {
  const bar = document.getElementById('bulk-edit-bar');
  if (!bar) return;
  if (selectedRows.size <= 1) {
    bar.style.display = 'none';
    return;
  }
  bar.style.display = 'flex';
  const countEl = document.getElementById('bulk-edit-count');
  if (countEl) countEl.textContent = selectedRows.size + ' selected';

  // Populate bucket options
  const bulkBucket = document.getElementById('bulk-bucket');
  if (bulkBucket) {
    const buckets = getAllBuckets();
    let opts = '<option value="">Set Bucket...</option>';
    buckets.forEach(b => { if (b) opts += `<option value="${b}">${b}</option>`; });
    bulkBucket.innerHTML = opts;
  }
  // Populate priority options
  const bulkPriority = document.getElementById('bulk-priority');
  if (bulkPriority) {
    let opts = '<option value="">Set Priority...</option>';
    PRIORITY_OPTIONS.forEach(p => { opts += `<option value="${p}">${p}</option>`; });
    bulkPriority.innerHTML = opts;
  }
  // Populate status options
  const bulkStatus = document.getElementById('bulk-status');
  if (bulkStatus) {
    let opts = '<option value="">Set Status...</option>';
    STATUS_OPTIONS.forEach(s => { if (s) opts += `<option value="${s}">${s}</option>`; });
    bulkStatus.innerHTML = opts;
  }
}

function bulkEditField(field, value) {
  if (!value || selectedRows.size === 0) return;
  snapshotUndo();
  selectedRows.forEach(id => {
    const task = allTasks.find(t => t.id === id);
    if (task) task[field] = value;
  });
  reassignColors();
  rebuildAfterChange();
  if (currentTab === 'roadmap') renderAll();
  if (currentTab === 'dati') renderDataTable();
  scheduleSave();
}

function bulkDelete() {
  deleteSelectedTasks();
}


/* ====================================================================
   FEATURE 10: COLUMN DRAG REORDER
   ==================================================================== */

let _colDragId = null;

function colDragStart(e, colId) {
  _colDragId = colId;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', colId);
  const th = e.target.closest('th');
  if (th) th.classList.add('col-dragging');
}

function colDragOver(e, colId) {
  if (!_colDragId || _colDragId === colId) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  // Visual indicator
  const th = e.target.closest('th');
  // Clear previous indicators
  document.querySelectorAll('.col-drag-over').forEach(el => el.classList.remove('col-drag-over'));
  if (th) th.classList.add('col-drag-over');
}

function colDrop(e, targetColId) {
  e.preventDefault();
  document.querySelectorAll('.col-drag-over').forEach(el => el.classList.remove('col-drag-over'));
  if (!_colDragId || _colDragId === targetColId) return;

  // Build or get the current column order
  const visCols = ALL_COLUMNS.filter(c => visibleColumns.has(c.id));
  let order = columnOrder ? [...columnOrder] : visCols.map(c => c.id);
  // Remove dragged column
  const fromIdx = order.indexOf(_colDragId);
  if (fromIdx < 0) return;
  order.splice(fromIdx, 1);
  // Insert before target
  const toIdx = order.indexOf(targetColId);
  if (toIdx < 0) { order.push(_colDragId); }
  else { order.splice(toIdx, 0, _colDragId); }

  columnOrder = order;
  _colDragId = null;
  renderDataTable();
  scheduleSave();
}

function colDragEnd(e) {
  _colDragId = null;
  document.querySelectorAll('.col-dragging,.col-drag-over').forEach(el => {
    el.classList.remove('col-dragging', 'col-drag-over');
  });
}


/* ====================================================================
   FEATURE 11: COLUMN FILTER DROPDOWN
   ==================================================================== */

let _colFilterDropdown = null;

function openColumnFilter(e, colId) {
  closeColumnFilter();
  const rect = e.target.closest('th').getBoundingClientRect();

  const dropdown = document.createElement('div');
  dropdown.className = 'col-filter-dropdown';
  dropdown.id = 'col-filter-dropdown';

  // Gather unique values for this column
  const values = new Set();
  allTasks.forEach(t => {
    let val = '';
    switch (colId) {
      case 'name': val = t.name || ''; break;
      case 'bucket': val = t.bucket || ''; break;
      case 'priority': val = t.priority || ''; break;
      case 'status': val = t.status || ''; break;
      case 'assigned': val = t.assigned || ''; break;
      case 'labels': val = t.labels.join(', '); break;
      case 'notes': val = t.notes || ''; break;
      case 'sprint': val = t.sprint || ''; break;
      case 'category': val = t.category || ''; break;
      case 'cost': val = t.cost || ''; break;
      default: val = String(t[colId] || '');
    }
    if (val) values.add(val);
  });

  const currentFilter = columnFilters[colId] || { values: new Set(), search: '' };

  let html = `<input type="text" placeholder="Search..." value="${currentFilter.search || ''}" id="cf-search-${colId}" oninput="updateColumnFilterSearch('${colId}', this.value)">`;
  const sortedValues = [...values].sort();
  sortedValues.forEach(v => {
    const checked = currentFilter.values && currentFilter.values.has(v) ? 'checked' : '';
    html += `<label class="cf-item"><input type="checkbox" ${checked} onchange="toggleColumnFilterValue('${colId}', '${esc(v).replace(/'/g, "\\'")}', this.checked)"><span>${esc(v)}</span></label>`;
  });
  html += `<div class="col-filter-actions">
    <button onclick="clearColumnFilter('${colId}')">Clear</button>
    <button onclick="closeColumnFilter()">Done</button>
  </div>`;

  dropdown.innerHTML = html;
  document.body.appendChild(dropdown);

  // Position
  let x = rect.left;
  let y = rect.bottom + 4;
  if (x + 250 > window.innerWidth) x = window.innerWidth - 260;
  if (y + 300 > window.innerHeight) y = rect.top - 300;
  dropdown.style.left = x + 'px';
  dropdown.style.top = y + 'px';

  _colFilterDropdown = dropdown;

  // Close on outside click
  setTimeout(() => {
    document.addEventListener('click', _colFilterOutsideClick);
  }, 0);
}

function _colFilterOutsideClick(e) {
  if (_colFilterDropdown && !_colFilterDropdown.contains(e.target) && !e.target.closest('.col-filter-icon')) {
    closeColumnFilter();
  }
}

function closeColumnFilter() {
  if (_colFilterDropdown) {
    _colFilterDropdown.remove();
    _colFilterDropdown = null;
  }
  document.removeEventListener('click', _colFilterOutsideClick);
}

function updateColumnFilterSearch(colId, val) {
  if (!columnFilters[colId]) columnFilters[colId] = { values: new Set(), search: '' };
  columnFilters[colId].search = val;
  renderDataTable();
}

function toggleColumnFilterValue(colId, val, checked) {
  if (!columnFilters[colId]) columnFilters[colId] = { values: new Set(), search: '' };
  if (checked) columnFilters[colId].values.add(val);
  else columnFilters[colId].values.delete(val);
  renderDataTable();
}

function clearColumnFilter(colId) {
  delete columnFilters[colId];
  closeColumnFilter();
  renderDataTable();
}


/* ====================================================================
   FEATURE 13: CELL COPY-DOWN (FILL HANDLE)
   ==================================================================== */

let _fillHandle = null;
let _fillActive = false;
let _fillStartRow = -1;
let _fillStartCol = -1;
let _fillValue = null;
let _fillField = null;

function showFillHandle() {
  removeFillHandle();
  if (!activeCell || !isDataEditMode) return;
  const tbody = DOM.dtBody;
  if (!tbody) return;
  const rows = tbody.querySelectorAll('tr[data-row-idx]');
  const row = rows[activeCell.rowIdx];
  if (!row) return;
  const cell = row.children[activeCell.colIdx];
  if (!cell) return;

  // Determine if this cell has a fillable value
  const colAttr = cell.dataset.col;
  if (!colAttr || colAttr === 'select') return;

  const handle = document.createElement('div');
  handle.className = 'fill-handle';
  cell.style.position = 'relative';
  handle.style.position = 'absolute';
  handle.style.right = '-4px';
  handle.style.bottom = '-4px';
  cell.appendChild(handle);
  _fillHandle = handle;

  handle.addEventListener('mousedown', function(e) {
    e.preventDefault();
    e.stopPropagation();
    _fillActive = true;
    _fillStartRow = activeCell.rowIdx;
    _fillStartCol = activeCell.colIdx;

    // Get the value from the task
    const taskId = parseInt(row.dataset.id);
    const task = allTasks.find(t => t.id === taskId);
    if (!task) return;

    _fillField = colAttr;
    switch (colAttr) {
      case 'name': _fillValue = task.name; break;
      case 'bucket': _fillValue = task.bucket; break;
      case 'priority': _fillValue = task.priority; break;
      case 'status': _fillValue = task.status; break;
      case 'assigned': _fillValue = task.assigned; break;
      case 'notes': _fillValue = task.notes; break;
      case 'effort': _fillValue = task.effort; break;
      case 'cost': _fillValue = task.cost; break;
      case 'sprint': _fillValue = task.sprint; break;
      case 'category': _fillValue = task.category; break;
      case 'pct': _fillValue = Math.round(task.percentComplete * 100); break;
      default: _fillValue = null;
    }

    document.addEventListener('mousemove', onFillMove);
    document.addEventListener('mouseup', onFillUp);
  });
}

function onFillMove(e) {
  if (!_fillActive) return;
  const tbody = DOM.dtBody;
  const rows = tbody.querySelectorAll('tr[data-row-idx]');
  // Clear previous previews
  tbody.querySelectorAll('.fill-preview-cell').forEach(c => c.classList.remove('fill-preview-cell'));

  // Find which row the mouse is over
  for (let i = 0; i < rows.length; i++) {
    const rect = rows[i].getBoundingClientRect();
    if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
      // Highlight cells from start to current
      const minR = Math.min(_fillStartRow, i);
      const maxR = Math.max(_fillStartRow, i);
      for (let r = minR; r <= maxR; r++) {
        if (r === _fillStartRow) continue;
        const cell = rows[r]?.children[_fillStartCol];
        if (cell) cell.classList.add('fill-preview-cell');
      }
      break;
    }
  }
}

function onFillUp(e) {
  document.removeEventListener('mousemove', onFillMove);
  document.removeEventListener('mouseup', onFillUp);
  if (!_fillActive || _fillValue === null || !_fillField) {
    _fillActive = false;
    return;
  }

  const tbody = DOM.dtBody;
  const rows = tbody.querySelectorAll('tr[data-row-idx]');
  // Find target row
  let targetRow = _fillStartRow;
  for (let i = 0; i < rows.length; i++) {
    const rect = rows[i].getBoundingClientRect();
    if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
      targetRow = i;
      break;
    }
  }

  if (targetRow !== _fillStartRow) {
    snapshotUndo();
    const minR = Math.min(_fillStartRow, targetRow);
    const maxR = Math.max(_fillStartRow, targetRow);
    for (let r = minR; r <= maxR; r++) {
      if (r === _fillStartRow) continue;
      const tr = rows[r];
      if (!tr) continue;
      const taskId = parseInt(tr.dataset.id);
      const task = allTasks.find(t => t.id === taskId);
      if (!task) continue;

      switch (_fillField) {
        case 'name': task.name = _fillValue; break;
        case 'bucket': task.bucket = _fillValue; break;
        case 'priority': task.priority = _fillValue; break;
        case 'status': task.status = _fillValue; break;
        case 'assigned': task.assigned = _fillValue; break;
        case 'notes': task.notes = _fillValue; break;
        case 'effort': task.effort = _fillValue; break;
        case 'cost': task.cost = _fillValue; break;
        case 'sprint': task.sprint = _fillValue; break;
        case 'category': task.category = _fillValue; break;
        case 'pct': {
          const isLeaf = !task.children || task.children.length === 0;
          if (isLeaf) {
            task.percentComplete = Math.max(0, Math.min(100, parseInt(_fillValue) || 0)) / 100;
            task.manualProgress = true;
          }
          break;
        }
      }
    }
    rebuildAfterChange();
    if (currentTab === 'roadmap') renderAll();
    if (currentTab === 'dati') renderDataTable();
    scheduleSave();
  }

  // Cleanup
  tbody.querySelectorAll('.fill-preview-cell').forEach(c => c.classList.remove('fill-preview-cell'));
  _fillActive = false;
  _fillValue = null;
  _fillField = null;
}

function removeFillHandle() {
  if (_fillHandle) {
    _fillHandle.remove();
    _fillHandle = null;
  }
}

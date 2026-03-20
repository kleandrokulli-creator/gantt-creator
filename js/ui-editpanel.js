/* ===================================================================
   UI-EDITPANEL.JS -- Edit panel, legend, label picker, save/close
   =================================================================== */
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
      <select id="ep-calendar">${Object.keys(calendars).map(id => `<option value="${id}" ${id === (task.calendarId || getDefaultCalendarId()) ? 'selected' : ''}>${esc(calendars[id].name)}${calendars[id].isDefault ? ' (default)' : ''}</option>`).join('')}</select>
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
  // Snap start to working day immediately
  if (workingDaysMode && task.start) {
    const calId = task.calendarId || getDefaultCalendarId();
    task.start = nextWorkingDay(task.start, calId);
  }

  if (durationManuallyChanged && task.start && newDurDays > 0) {
    // Duration was edited: compute finish from start + duration
    const calId = task.calendarId || getDefaultCalendarId();
    if (workingDaysMode) {
      task.finish = addWorkingDays(task.start, newDurDays, calId);
    } else {
      task.finish = new Date(task.start.getTime() + newDurDays * MS_PER_DAY);
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
    if (newCalId !== task.calendarId) {
      assignCalendarWithChildren(task, newCalId);
      invalidateHolidayCache();
      recalcFinishDates();
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
  // Force immediate persist to storage
  clearTimeout(autoSaveDebounce);
  saveCurrentProjectToStorage();
  updateSaveIndicator();
  DOM.editPanelOverlay.classList.remove('open');
  editPanelTaskId = null;
}


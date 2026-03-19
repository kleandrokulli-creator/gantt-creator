/* ===================================================================
   UI.JS — Edit panel, settings modal, tooltip, interactions
   =================================================================== */

/* ---------- EDIT PANEL ---------- */

function openEditPanel(taskId) {
  editPanelTaskId = taskId;
  const task = allTasks.find(t => t.id === taskId);
  if (!task) return;
  const panel = DOM.editPanel;
  const pct = Math.round(task.percentComplete * 100);
  const isParent = task.children && task.children.length > 0;
  const bucketsArr = getAllBuckets();
  const allLabels = Object.keys(LABEL_COLORS);
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
      <label>Duration</label>
      <input type="text" id="ep-duration" value="${esc(task.duration)}" readonly style="opacity:.7">
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
      <label>Colore barra <span style="font-weight:400;font-size:.7rem;color:var(--grey-txt)">(override)</span></label>
      <div class="ep-color-row">
        <span class="ep-color-auto" style="background:${task.bucket && BUCKET_COLORS[task.bucket] ? BUCKET_COLORS[task.bucket] : (task.labels?.length > 0 ? (LABEL_COLORS[task.labels[0]] || DEFAULT_COLOR) : DEFAULT_COLOR)}" title="Colore automatico"></span>
        <input type="color" id="ep-color" value="${task.colorOverride || task.color || DEFAULT_COLOR}" class="ep-color-picker ${task.colorOverride ? 'active' : ''}">
        <button class="ep-color-reset" onclick="resetTaskColor()" title="Ripristina colore automatico">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 019-9 9.75 9.75 0 016.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 01-9 9 9.75 9.75 0 01-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg>
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

  // Other fields: save on input (debounced) and change (immediate)
  const otherFields = ['ep-name', 'ep-start', 'ep-finish', 'ep-bucket', 'ep-priority', 'ep-depends', 'ep-effort', 'ep-notes'];
  otherFields.forEach(fid => {
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
}

function resetTaskColor() {
  const task = allTasks.find(t => t.id === editPanelTaskId);
  if (!task) return;
  task.colorOverride = '';
  reassignColors();
  const epColor = document.getElementById('ep-color');
  if (epColor) epColor.value = task.color;
  renderAll();
  scheduleSave();
}

function toggleEpTag(el, label) {
  el.classList.toggle('selected');
  const c = LABEL_COLORS[label] || '#64748B';
  el.style.borderColor = el.classList.contains('selected') ? c : 'transparent';
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
  const datesChanged = (newStart?.getTime() !== task.start?.getTime()) || (newFinish?.getTime() !== task.finish?.getTime());
  task.start = newStart;
  task.finish = newFinish;
  if (datesChanged) {
    recalcDuration(task);
    propagateDependencies(task);
    document.getElementById('ep-duration').value = task.duration;
  }
  const manualPct = parseInt(document.getElementById('ep-pct').value) / 100;
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
  task.dependsOn = newDepsVal;
  task.effort = document.getElementById('ep-effort').value;
  task.notes = document.getElementById('ep-notes').value;

  // Color override - clear if it matches the new auto color
  const epColor = document.getElementById('ep-color');
  if (epColor) {
    const autoColor = (task.bucket && BUCKET_COLORS[task.bucket]) ? BUCKET_COLORS[task.bucket]
      : (task.labels?.length > 0 ? (LABEL_COLORS[task.labels[0]] || DEFAULT_COLOR) : DEFAULT_COLOR);
    task.colorOverride = (epColor.value !== autoColor) ? epColor.value : '';
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
      const epDur = document.getElementById('ep-duration');
      const epPct = document.getElementById('ep-pct');
      const epPctVal = document.getElementById('ep-pct-val');
      if (epStart && document.activeElement !== epStart && updated.start) epStart.value = dateToInputStr(updated.start);
      if (epFinish && document.activeElement !== epFinish && updated.finish) epFinish.value = dateToInputStr(updated.finish);
      if (epDur) epDur.value = updated.duration || '';
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
  }
  body.innerHTML = html;
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
  const mn = new Date(dMin - 7 * MS_PER_DAY);
  const mx = new Date(dMax + 7 * MS_PER_DAY);
  mn.setDate(1);
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
      lbl.innerText = 'Hide Dependencies';
    } else {
      btn.classList.add('dim');
      lbl.innerText = 'Show Dependencies';
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
  DOM.expandLabel.textContent = getState().allExpanded ? 'Collapse all' : 'Expand all';
  renderAll();
  if (currentTab === 'dati') renderDataTable();
}

function setZoom(level) {
  currentZoom = level;
  document.querySelectorAll('#zoom-month,#zoom-week,#zoom-day').forEach(b => b.classList.remove('active'));
  document.getElementById('zoom-' + level).classList.add('active');
  renderAll();
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
    if (elbl) elbl.textContent = newState.allExpanded ? 'Collapse all' : 'Expand all';
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

  // Check if fit is even possible
  const minNeeded = visCols.length * MIN_COLUMN_WIDTH + (isDataEditMode ? 28 : 0);
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

const PROJECT_TEMPLATES = {
  software: {
    name: 'Software Development',
    tasks: [
      { outline: '1', name: 'Planning', days: 5, children: [
        { outline: '1.1', name: 'Requirements gathering', days: 3 },
        { outline: '1.2', name: 'Technical design', days: 2, dep: '1' }
      ]},
      { outline: '2', name: 'Development', days: 15, dep: '1', children: [
        { outline: '2.1', name: 'Backend development', days: 10 },
        { outline: '2.2', name: 'Frontend development', days: 10 },
        { outline: '2.3', name: 'Integration', days: 5, dep: '4,5' }
      ]},
      { outline: '3', name: 'Testing', days: 7, dep: '2', children: [
        { outline: '3.1', name: 'Unit testing', days: 3 },
        { outline: '3.2', name: 'Integration testing', days: 2, dep: '8' },
        { outline: '3.3', name: 'User acceptance testing', days: 2, dep: '9' }
      ]},
      { outline: '4', name: 'Deployment', days: 2, dep: '3', children: [
        { outline: '4.1', name: 'Staging deployment', days: 1 },
        { outline: '4.2', name: 'Production release', days: 0, dep: '12' }
      ]}
    ]
  },
  marketing: {
    name: 'Marketing Campaign',
    tasks: [
      { outline: '1', name: 'Strategy', days: 5, children: [
        { outline: '1.1', name: 'Market research', days: 3 },
        { outline: '1.2', name: 'Campaign brief', days: 2, dep: '1' }
      ]},
      { outline: '2', name: 'Content Creation', days: 10, dep: '1', children: [
        { outline: '2.1', name: 'Copywriting', days: 5 },
        { outline: '2.2', name: 'Visual design', days: 7 },
        { outline: '2.3', name: 'Review & approval', days: 3, dep: '4,5' }
      ]},
      { outline: '3', name: 'Launch', days: 5, dep: '2', children: [
        { outline: '3.1', name: 'Channel setup', days: 2 },
        { outline: '3.2', name: 'Campaign launch', days: 0, dep: '8' },
        { outline: '3.3', name: 'Monitor & optimize', days: 5, dep: '9' }
      ]}
    ]
  },
  event: {
    name: 'Event Planning',
    tasks: [
      { outline: '1', name: 'Pre-planning', days: 10, children: [
        { outline: '1.1', name: 'Define objectives & budget', days: 3 },
        { outline: '1.2', name: 'Venue selection', days: 5, dep: '1' },
        { outline: '1.3', name: 'Vendor contracts', days: 5, dep: '2' }
      ]},
      { outline: '2', name: 'Preparation', days: 15, dep: '1', children: [
        { outline: '2.1', name: 'Invitations & registration', days: 5 },
        { outline: '2.2', name: 'Catering & logistics', days: 7 },
        { outline: '2.3', name: 'Program & speakers', days: 10 }
      ]},
      { outline: '3', name: 'Execution', days: 3, dep: '2', children: [
        { outline: '3.1', name: 'Setup', days: 1 },
        { outline: '3.2', name: 'Event day', days: 1, dep: '8' },
        { outline: '3.3', name: 'Teardown & follow-up', days: 1, dep: '9' }
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
  function onMove(ev) {
    const diff = ev.clientX - _resizeStartX;
    const newW = Math.max(40, _resizeStartW + diff);
    columnWidths[_resizeCol] = newW;
    th.style.width = newW + 'px';
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

      // Determine new outline based on neighbors
      const aboveTask = insertIdx > 0 ? allTasks[insertIdx - 1] : null;
      const belowTask = insertIdx < allTasks.length ? allTasks[insertIdx] : null;

      let newOutline;
      if (indentDelta > 0 && aboveTask) {
        // Indent: become child of above task
        const parentOutline = aboveTask.outline;
        const existingChildren = allTasks.filter(t => t.outline.startsWith(parentOutline + '.') && t.depth === aboveTask.depth + 1);
        const nextNum = existingChildren.length > 0 ? Math.max(...existingChildren.map(c => parseInt(c.outline.split('.').pop()))) + 1 : 1;
        newOutline = parentOutline + '.' + nextNum;
      } else if (indentDelta < 0 && draggedTask.parent) {
        // Outdent: become sibling of parent
        const grandParent = draggedTask.parent.parent;
        const parentOutline = grandParent ? grandParent.outline : '';
        const siblings = allTasks.filter(t => {
          if (parentOutline) return t.outline.startsWith(parentOutline + '.') && t.depth === grandParent.depth + 1;
          return t.depth === 1;
        });
        const maxNum = siblings.length > 0 ? Math.max(...siblings.map(s => parseInt(s.outline.split('.').pop()))) + 1 : 1;
        newOutline = parentOutline ? parentOutline + '.' + maxNum : String(maxNum);
      } else {
        // Same level: sibling of target
        if (belowTask) {
          newOutline = belowTask.outline;
        } else if (aboveTask) {
          const parts = aboveTask.outline.split('.');
          parts[parts.length - 1] = String(parseInt(parts[parts.length - 1]) + 1);
          newOutline = parts.join('.');
        } else {
          newOutline = '1';
        }
      }

      // Update outlines of moved tasks
      const oldOutline = draggedTask.outline;
      toMove.forEach(t => {
        t.outline = t.outline.replace(oldOutline, newOutline);
        t.depth = t.outline.split('.').length;
      });

      // Insert at new position
      allTasks.splice(insertIdx, 0, ...toMove);

      // Renumber everything
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
  if (delta > 0) {
    // Indent: find previous sibling and become its child
    const idx = allTasks.indexOf(task);
    if (idx <= 0) return;
    const prev = allTasks[idx - 1];
    if (prev.depth < task.depth) return; // already a child
    const newParentOutline = prev.outline;
    const existingChildren = allTasks.filter(t => t.outline.startsWith(newParentOutline + '.') && t.outline.split('.').length === prev.depth + 1);
    const nextNum = existingChildren.length > 0 ? Math.max(...existingChildren.map(c => parseInt(c.outline.split('.').pop()))) + 1 : 1;
    const oldOutline = task.outline;
    const newOutline = newParentOutline + '.' + nextNum;

    // Update task and children
    allTasks.forEach(t => {
      if (t.outline === oldOutline || t.outline.startsWith(oldOutline + '.')) {
        t.outline = t.outline.replace(oldOutline, newOutline);
        t.depth = t.outline.split('.').length;
      }
    });
  } else if (delta < 0) {
    // Outdent
    if (task.depth <= 1) return;
    const parts = task.outline.split('.');
    const parentOutline = parts.slice(0, -1).join('.');
    const grandParentOutline = parts.slice(0, -2).join('.');
    const oldOutline = task.outline;

    // New outline: next sibling of parent
    const parentSiblings = allTasks.filter(t => {
      const tParts = t.outline.split('.');
      if (grandParentOutline) return t.outline.startsWith(grandParentOutline + '.') && tParts.length === parts.length - 1;
      return tParts.length === 1;
    });
    const maxNum = parentSiblings.length > 0 ? Math.max(...parentSiblings.map(s => parseInt(s.outline.split('.').pop()))) + 1 : 1;
    const newOutline = grandParentOutline ? grandParentOutline + '.' + maxNum : String(maxNum);

    allTasks.forEach(t => {
      if (t.outline === oldOutline || t.outline.startsWith(oldOutline + '.')) {
        t.outline = t.outline.replace(oldOutline, newOutline);
        t.depth = t.outline.split('.').length;
      }
    });
  }

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
    document.addEventListener('keydown', function escClose(ev) {
      if (ev.key === 'Escape') { closeContextMenu(); document.removeEventListener('keydown', escClose); }
    });
  }, 0);
}

function closeContextMenu() {
  if (_ctxMenu) { _ctxMenu.remove(); _ctxMenu = null; }
  document.removeEventListener('click', closeContextMenu);
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
          if (newStart && task.finish && newStart > task.finish) task.finish = new Date(newStart);
          task.start = newStart;
          recalcDuration(task);
          propagateDependencies(task);
        } else if (field === 'finish') {
          const newFinish = val ? new Date(val + 'T00:00:00') : null;
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
  activeCell = { rowIdx, colIdx };
  cellEditMode = false;
  highlightActiveCell();
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

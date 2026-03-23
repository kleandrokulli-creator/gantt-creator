/* ===================================================================
   UI.JS — Core UI: export dropdown, tooltip, navigation, interactions,
   filters, tab system, table layout, column picker, edit mode toggle
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



/* ---------- SETTINGS MODAL is in ui-settings.js ---------- */
/* (openSettings, closeSettings, switchSettingsTab, renderSettingsBody,
   renameLabel, deleteLabel, addLabel, renameBucket, deleteBucket, addBucket,
   NATIONAL_HOLIDAYS, importNationalHolidays, calendar CRUD, etc.) */


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

/* ---------- HOLIDAY TOOLTIP ---------- */

let holidayTooltipEl = null;

function getHolidayTooltipEl() {
  if (!holidayTooltipEl) {
    holidayTooltipEl = document.createElement('div');
    holidayTooltipEl.className = 'holiday-tooltip';
    document.body.appendChild(holidayTooltipEl);
  }
  return holidayTooltipEl;
}

function showHolidayTooltip(e) {
  const el = e.currentTarget;
  const infoStr = el.getAttribute('data-holiday-info');
  const dateLabel = el.getAttribute('data-holiday-date');
  if (!infoStr) return;
  const infos = JSON.parse(decodeURIComponent(infoStr));
  const tip = getHolidayTooltipEl();
  let html = `<div style="font-weight:600;font-size:.8rem;margin-bottom:4px;color:#334155">${dateLabel}</div>`;
  infos.forEach(info => {
    html += `<div style="display:flex;align-items:center;gap:6px;margin-top:3px">`;
    html += `<span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${info.color};flex-shrink:0"></span>`;
    html += `<span style="font-size:.75rem;color:#64748B">${esc(info.cal)}</span>`;
    html += `<span style="font-size:.78rem;font-weight:500;color:#1E293B">${esc(info.label)}</span>`;
    html += `</div>`;
  });
  tip.innerHTML = html;
  tip.classList.add('visible');
  moveHolidayTooltip(e);
}

function moveHolidayTooltip(e) {
  const tip = getHolidayTooltipEl();
  let x = e.clientX + 12, y = e.clientY + 12;
  const rect = tip.getBoundingClientRect();
  if (x + 220 > window.innerWidth) x = e.clientX - 220;
  if (y + rect.height > window.innerHeight) y = e.clientY - rect.height - 8;
  tip.style.left = x + 'px';
  tip.style.top = y + 'px';
}

function hideHolidayTooltip() {
  const tip = getHolidayTooltipEl();
  tip.classList.remove('visible');
}

/* ---------- TOGGLE SPLIT BARS ---------- */

function toggleSplitBars() {
  splitBarsMode = !splitBarsMode;
  const btn = document.getElementById('split-bars-btn');
  if (btn) btn.classList.toggle('active', splitBarsMode);
  saveCurrentProjectToStorage();
  renderAll();
  showToast(splitBarsMode ? 'Bars split around holidays' : 'Continuous bars (no split)', 'info', 2000);
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
      lbl.innerText = 'Dependencies';
    } else {
      btn.classList.add('dim');
      lbl.innerText = 'Dependencies';
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
  // Flush any pending inline save from data table edits before switching
  if (saveDebounce) {
    clearTimeout(saveDebounce);
    saveDebounce = null;
    if (pendingInlineSave) { pendingInlineSave(); pendingInlineSave = null; }
  }
  // Close edit panel (saves pending changes via saveEditPanel)
  if (editPanelTaskId !== null) closeEditPanel();
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


/* ---------- CUSTOM TOOLBAR TOOLTIPS ---------- */
(function initToolbarTooltips() {
  const tip = document.createElement('div');
  tip.className = 'custom-tooltip';
  document.body.appendChild(tip);

  let showTimer = null;

  function show(el) {
    const text = el.getAttribute('data-tooltip');
    if (!text) return;
    tip.textContent = text;
    const rect = el.getBoundingClientRect();
    tip.style.left = rect.left + rect.width / 2 + 'px';
    tip.style.top = rect.top - 8 + 'px';
    tip.style.transform = 'translate(-50%, -100%)';
    tip.classList.add('visible');
  }

  function hide() {
    clearTimeout(showTimer);
    showTimer = null;
    tip.classList.remove('visible');
  }

  document.addEventListener('mouseover', function(e) {
    const el = e.target.closest('[data-tooltip]');
    if (!el) { hide(); return; }
    if (showTimer) return;
    showTimer = setTimeout(() => show(el), 400);
  });

  document.addEventListener('mouseout', function(e) {
    const el = e.target.closest('[data-tooltip]');
    if (el) hide();
  });
})();

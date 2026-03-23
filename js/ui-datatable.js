/* ===================================================================
   UI-DATATABLE.JS -- Column resize, drag-drop, keyboard nav,
   context menu, bulk edit, column filter, fill handle
   =================================================================== */
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

/** Initialize drag-and-drop reordering for data table rows (supports indent/outdent). */
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

/** Initialize arrow-key cell navigation and Enter-to-edit in the data table. */
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

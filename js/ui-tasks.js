/* ===================================================================
   UI-TASKS.JS -- Task CRUD, templates, insert, auto-link, share, theme, export PNG
   =================================================================== */

/* ---------- ADD / DELETE TASKS ---------- */

/** Add a new top-level task with default values and append it to allTasks. */
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
  return AppStorage.getTemplates();
}

function saveCustomTemplates(templates) {
  AppStorage.setTemplates(templates);
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

/** Delete all tasks currently in selectedRows after user confirmation. */
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
  AppStorage.setTheme(dark ? '' : 'dark');
}

function loadTheme() {
  try {
    const t = AppStorage.getTheme();
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

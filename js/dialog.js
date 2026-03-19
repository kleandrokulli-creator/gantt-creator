/* ===================================================================
   DIALOG.JS — Custom dialog & toast system (replaces native prompt/alert/confirm)
   =================================================================== */

/* ---------- TOAST NOTIFICATIONS ---------- */

let _toastContainer = null;

function _getToastContainer() {
  if (!_toastContainer) {
    _toastContainer = document.createElement('div');
    _toastContainer.className = 'toast-container';
    document.body.appendChild(_toastContainer);
  }
  return _toastContainer;
}

const _TOAST_ICONS = {
  success: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>',
  error:   '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>',
  info:    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>',
  warn:    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01"/></svg>'
};

/**
 * Show a toast notification.
 * @param {string} message - Text to display
 * @param {'success'|'error'|'info'|'warn'} type - Toast style
 * @param {number} duration - Auto-dismiss in ms (0 = manual close only)
 */
function showToast(message, type, duration) {
  type = type || 'info';
  duration = duration !== undefined ? duration : 4000;
  const container = _getToastContainer();
  const toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  toast.innerHTML =
    '<span class="toast-icon">' + (_TOAST_ICONS[type] || '') + '</span>' +
    '<span class="toast-text">' + _escDialog(message) + '</span>' +
    '<button class="toast-close" onclick="this.parentElement.remove()">&times;</button>';
  container.appendChild(toast);
  // Trigger animation
  requestAnimationFrame(function() {
    requestAnimationFrame(function() { toast.classList.add('show'); });
  });
  if (duration > 0) {
    setTimeout(function() {
      toast.classList.remove('show');
      setTimeout(function() { toast.remove(); }, 300);
    }, duration);
  }
}


/* ---------- CUSTOM DIALOGS ---------- */

function _escDialog(s) {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}

/**
 * Show a custom alert dialog.
 * @param {string} message
 * @param {object} opts - { title, okLabel, danger }
 * @returns {Promise<void>}
 */
function showAlert(message, opts) {
  opts = opts || {};
  return new Promise(function(resolve) {
    var overlay = _createDialogOverlay();
    var box = overlay.querySelector('.dialog-box');
    var html = '';
    if (opts.title) html += '<div class="dialog-title">' + _escDialog(opts.title) + '</div>';
    html += '<div class="dialog-message">' + _escDialog(message) + '</div>';
    html += '<div class="dialog-buttons">';
    html += '<button class="dialog-btn ' + (opts.danger ? 'dialog-btn-danger' : 'dialog-btn-ok') + '">' + _escDialog(opts.okLabel || 'OK') + '</button>';
    html += '</div>';
    box.innerHTML = html;
    var okBtn = box.querySelector('.dialog-btn');
    okBtn.onclick = function() { _closeDialog(overlay); resolve(); };
    okBtn.focus();
    overlay.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); _closeDialog(overlay); resolve(); }
    });
  });
}

/**
 * Show a custom confirm dialog.
 * @param {string} message
 * @param {object} opts - { title, okLabel, cancelLabel, danger }
 * @returns {Promise<boolean>}
 */
function showConfirm(message, opts) {
  opts = opts || {};
  return new Promise(function(resolve) {
    var overlay = _createDialogOverlay();
    var box = overlay.querySelector('.dialog-box');
    var html = '';
    if (opts.title) html += '<div class="dialog-title">' + _escDialog(opts.title) + '</div>';
    html += '<div class="dialog-message">' + _escDialog(message) + '</div>';
    html += '<div class="dialog-buttons">';
    html += '<button class="dialog-btn dialog-btn-cancel">' + _escDialog(opts.cancelLabel || 'Cancel') + '</button>';
    html += '<button class="dialog-btn ' + (opts.danger ? 'dialog-btn-danger' : 'dialog-btn-ok') + '">' + _escDialog(opts.okLabel || 'OK') + '</button>';
    html += '</div>';
    box.innerHTML = html;
    var btns = box.querySelectorAll('.dialog-btn');
    btns[0].onclick = function() { _closeDialog(overlay); resolve(false); };
    btns[1].onclick = function() { _closeDialog(overlay); resolve(true); };
    btns[1].focus();
    overlay.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') { e.preventDefault(); _closeDialog(overlay); resolve(false); }
      if (e.key === 'Enter') { e.preventDefault(); _closeDialog(overlay); resolve(true); }
    });
  });
}

/**
 * Show a custom prompt dialog.
 * @param {string} message
 * @param {object} opts - { title, defaultValue, placeholder, okLabel, cancelLabel }
 * @returns {Promise<string|null>} - null if cancelled
 */
function showPrompt(message, opts) {
  opts = opts || {};
  return new Promise(function(resolve) {
    var overlay = _createDialogOverlay();
    var box = overlay.querySelector('.dialog-box');
    var html = '';
    if (opts.title) html += '<div class="dialog-title">' + _escDialog(opts.title) + '</div>';
    if (message) html += '<div class="dialog-message">' + _escDialog(message) + '</div>';
    html += '<input class="dialog-input" type="text" value="' + _escDialog(opts.defaultValue || '') + '"' +
            (opts.placeholder ? ' placeholder="' + _escDialog(opts.placeholder) + '"' : '') + '>';
    html += '<div class="dialog-buttons">';
    html += '<button class="dialog-btn dialog-btn-cancel">' + _escDialog(opts.cancelLabel || 'Cancel') + '</button>';
    html += '<button class="dialog-btn dialog-btn-ok">' + _escDialog(opts.okLabel || 'OK') + '</button>';
    html += '</div>';
    box.innerHTML = html;
    var input = box.querySelector('.dialog-input');
    var btns = box.querySelectorAll('.dialog-btn');
    btns[0].onclick = function() { _closeDialog(overlay); resolve(null); };
    btns[1].onclick = function() { _closeDialog(overlay); resolve(input.value); };
    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') { e.preventDefault(); _closeDialog(overlay); resolve(input.value); }
      if (e.key === 'Escape') { e.preventDefault(); _closeDialog(overlay); resolve(null); }
    });
    // Focus & select input after animation
    setTimeout(function() { input.focus(); input.select(); }, 50);
  });
}


/* ---------- DIALOG HELPERS ---------- */

function _createDialogOverlay() {
  var overlay = document.createElement('div');
  overlay.className = 'dialog-overlay';
  overlay.innerHTML = '<div class="dialog-box"></div>';
  document.body.appendChild(overlay);
  // Click backdrop to cancel (but not on box itself)
  overlay.addEventListener('mousedown', function(e) {
    if (e.target === overlay) {
      // Will be handled by specific dialog resolve
    }
  });
  // Trigger show animation
  requestAnimationFrame(function() {
    requestAnimationFrame(function() { overlay.classList.add('show'); });
  });
  return overlay;
}

function _closeDialog(overlay) {
  overlay.classList.remove('show');
  setTimeout(function() { overlay.remove(); }, 250);
}

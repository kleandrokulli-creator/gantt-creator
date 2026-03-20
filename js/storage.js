/* ===================================================================
   STORAGE.JS — Persistence abstraction layer
   Wraps all localStorage access behind a uniform interface.
   In Phase 2 this will be swapped to Firebase Realtime Database.
   =================================================================== */

const AppStorage = (() => {
  'use strict';

  /* ---------- Core project data ---------- */

  function getProjects() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_PROJECTS);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      console.warn('AppStorage.getProjects failed:', e);
      return {};
    }
  }

  function setProjects(obj) {
    try {
      localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(obj));
    } catch (e) {
      console.warn('AppStorage.setProjects failed:', e);
      throw e; // let caller handle quota errors
    }
  }

  function getCurrentProjectId() {
    return localStorage.getItem(STORAGE_KEY_CURRENT);
  }

  function setCurrentProjectId(id) {
    localStorage.setItem(STORAGE_KEY_CURRENT, id);
  }

  /* ---------- Theme ---------- */

  function getTheme() {
    return localStorage.getItem(STORAGE_KEY_THEME) || '';
  }

  function setTheme(value) {
    localStorage.setItem(STORAGE_KEY_THEME, value);
  }

  /* ---------- Global defaults (label/bucket/priority colors) ---------- */

  function getDefaults() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_DEFAULTS);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.warn('AppStorage.getDefaults failed:', e);
      return null;
    }
  }

  function setDefaults(obj) {
    try {
      localStorage.setItem(STORAGE_KEY_DEFAULTS, JSON.stringify(obj));
    } catch (e) {
      console.warn('AppStorage.setDefaults failed:', e);
    }
  }

  /* ---------- Templates ---------- */

  function getTemplates() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_TEMPLATES);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      console.warn('AppStorage.getTemplates failed:', e);
      return {};
    }
  }

  function setTemplates(obj) {
    try {
      localStorage.setItem(STORAGE_KEY_TEMPLATES, JSON.stringify(obj));
    } catch (e) {
      console.warn('AppStorage.setTemplates failed:', e);
    }
  }

  /* ---------- Generic cache (used by export.js for CSS/JS caching) ---------- */

  function getCacheItem(key) {
    return localStorage.getItem(key);
  }

  function setCacheItem(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn('AppStorage.setCacheItem failed:', e);
    }
  }

  /* ---------- Lifecycle ---------- */

  function flush() {
    // In localStorage mode, writes are synchronous — nothing to flush.
    // Firebase implementation will flush pending writes here.
  }

  function init() {
    // In localStorage mode, no initialization needed.
    // Firebase implementation will set up auth and listeners here.
  }

  /* ---------- Public API ---------- */

  return {
    getProjects,
    setProjects,
    getCurrentProjectId,
    setCurrentProjectId,
    getTheme,
    setTheme,
    getDefaults,
    setDefaults,
    getTemplates,
    setTemplates,
    getCacheItem,
    setCacheItem,
    flush,
    init
  };
})();

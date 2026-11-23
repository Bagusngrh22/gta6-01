// save.js — localStorage save / load for Solmar Bay.
const KEY = 'solmar-bay-save-v1';
export function saveGameData(data) {
  try { localStorage.setItem(KEY, JSON.stringify({ ...data, savedAt: Date.now() })); return true; } catch (e) { return false; }
}
export function loadGameData() {
  try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
}
export function clearSave() { try { localStorage.removeItem(KEY); } catch (e) {} }

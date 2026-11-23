// game.js — Solmar Bay main loop: input, driving, combat, stealing, wanted, missions, save.
// Original open-world crime game. Keyboard + mouse. Progress auto-saves to localStorage.
import { buildCity, collideBuildings, isOnRoad, nearestRoadPoint, WORLD_W, WORLD_H, districtAt } from './city.js';
import { Vehicle, Pedestrian, spawnTraffic, spawnParkedCars, updateTrafficCar, CAR_MODELS } from './world.js';
import { Police, crimeHeatFor, wantedStars, POLICE_MODEL } from './police.js';
import { MissionManager, STORY } from './missions.js';
import { Renderer } from './hud.js';
import { AudioEngine } from './audio.js';
import { saveGameData, loadGameData } from './save.js';
import { clamp, dist, mulberry32, pick, fmtMoney } from './utils.js';

const canvas = document.getElementById('game');
const renderer = new Renderer(canvas, document.getElementById('minimap'));
const audio = new AudioEngine();

const state = {
  city: buildCity(20261123),
  player: { x: 520, y: 460, angle: 0, aimAngle: 0, health: 100, color: '#ff8a5a', weapon: 'fists', ammo: 0, speed: 0 },
  playerCar: null,
  traffic: [], parked: [], peds: [], bullets: [], pickups: [],
  police: new Police(),
  cash: 250, heat: 0, wanted: 0, day: 1, clockMinutes: 9 * 60,
  missionsDone: 0, carsStolen: 0, kills: 0, missions: null,
  cam: { x: 520, y: 460 }, time: 0, dayFactor: 1,
  running: false, paused: false, dead: false, deadKind: '',
  objectiveDist: '', feedItems: [],
  keys: {}, mouse: { x: 640, y: 360, down: false },
  shotMode: null,
};
state.missions = new MissionManager(state);
state.audio = audio;

function toast(text) {
  const el = document.getElementById('toast');
  el.textContent = text;
  clearTimeout(el._t); el._t = setTimeout(() => { el.textContent = ''; }, 3200);
}
state.toast = toast;
state.feed = (text) => {
  const box = document.getElementById('missionFeed');
  const div = document.createElement('div'); div.className = 'feed-item'; div.textContent = text;
  box.appendChild(div);
  setTimeout(() => div.remove(), 5200);
  while (box.children.length > 3) box.firstChild.remove();
};
state.addHeat = (amount) => {
  state.heat = clamp(state.heat + amount, 0, 5);
  state.wanted = wantedStars(state.heat);
};
state.saveGame = () => {
  saveGameData({
    cash: state.cash, missionsDone: state.missionsDone, carsStolen: state.carsStolen,
    day: state.day, clockMinutes: state.clockMinutes,
    player: { x: state.player.x, y: state.player.y, health: state.player.health, weapon: state.player.weapon, ammo: state.player.ammo },
  });
};

// ---- world setup ----
function resetWorld() {
  const rng = mulberry32(20261123);
  state.traffic = spawnTraffic(state.city, 16, rng);
  state.parked = spawnParkedCars(state.city, rng, 26);
  state.peds = [];
  for (let i = 0; i < 22; i++) state.peds.push(new Pedestrian(rng, state.city));
  state.pickups = [
    { x: 900, y: 700, kind: 'health' }, { x: 1560, y: 1270, kind: 'health' },
    { x: 2230, y: 400, kind: 'ammo' }, { x: 2900, y: 2090, kind: 'cash' },
    { x: 200, y: 2040, kind: 'cash' }, { x: 1240, y: 1900, kind: 'health' },
  ];
  state.bullets = [];
  state.police.clear();
}

// ---- input ----
window.addEventListener('keydown', (e) => {
  state.keys[e.key.toLowerCase()] = true;
  if (e.key === 'Enter' && state.dead) respawn();
  if (e.key.toLowerCase() === 'p' && state.running) togglePause();
  if (e.key.toLowerCase() === 'm' && state.running) toggleMissions();
  if (e.key.toLowerCase() === 'e' && state.running && !state.paused) tryEnterCar();
  if (e.key.toLowerCase() === 'r' && state.running) toast('📻 ' + audio.nextStation());
  if (e.key.toLowerCase() === 'h' && state.playerCar) audio.horn();
  if (e.key.toLowerCase() === 'f' && state.running) punch();
  if ([' ', 'arrowup', 'arrowdown'].includes(e.key.toLowerCase())) e.preventDefault();
});
window.addEventListener('keyup', (e) => { state.keys[e.key.toLowerCase()] = false; });
canvas.addEventListener('mousemove', (e) => {
  const r = canvas.getBoundingClientRect();
  state.mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
  state.mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
  const ch = document.getElementById('crosshair');
  ch.style.display = 'block'; ch.style.left = (e.clientX - r.left) + 'px'; ch.style.top = (e.clientY - r.top) + 'px';
});
canvas.addEventListener('mousedown', (e) => { if (e.button === 0) { state.mouse.down = true; shoot(); } });
window.addEventListener('mouseup', () => { state.mouse.down = false; });

function nearestCar(x, y, maxD = 60) {
  let best = null, bd = maxD;
  for (const v of [...state.parked, ...state.traffic]) {
    const d = dist(x, y, v.x, v.y);
    if (d < bd) { bd = d; best = v; }
  }
  return best;
}
function tryEnterCar() {
  if (state.playerCar) {
    // exit car
    const c = state.playerCar;
    state.player.x = c.x + Math.cos(c.angle + Math.PI / 2) * 30;
    state.player.y = c.y + Math.sin(c.angle + Math.PI / 2) * 30;
    state.playerCar = null;
    toast('You got out of the ' + c.model.name);
    return;
  }
  const v = nearestCar(state.player.x, state.player.y, 64);
  if (!v) { toast('No car nearby — walk to a parked car and press E'); return; }
  // steal it
  state.parked = state.parked.filter(c => c !== v);
  state.traffic = state.traffic.filter(c => c !== v);
  if (v.driver === 'traffic') { toast('You yanked the driver out!'); state.addHeat(crimeHeatFor('stealCar')); }
  else if (v.police) { state.addHeat(crimeHeatFor('hitPolice')); }
  else state.addHeat(crimeHeatFor('stealCar'));
  v.driver = 'player'; v.speed = 0;
  state.playerCar = v; state.carsStolen++;
  audio.pickup();
  toast('🚗 Stole the ' + v.model.name + (state.wanted > 0 ? ' — the cops saw that!' : ''));
  renderer.floater(v.x, v.y - 30, v.model.name, '#7CFC9A');
  if (state.missions.active && state.missions.active.id === 'm6' && v.model.name === 'Comet GT') {
    state.missions.stage = 1; state.missions.setMarkerForStage();
  }
}
function punch() {
  if (state.playerCar) return;
  audio.punch();
  const px = state.player.x + Math.cos(state.player.aimAngle) * 30;
  const py = state.player.y + Math.sin(state.player.aimAngle) * 30;
  renderer.burst(px, py, '#fff', 6, 90);
  for (const p of state.peds) {
    if (p.hp !== undefined && p.hp <= 0) continue;
    if (dist(px, py, p.x, p.y) < 30) {
      p.hp = (p.hp ?? 100) - 34;
      if (p.hp <= 0) { state.kills++; state.cash += p.cash; state.addHeat(crimeHeatFor('killPed')); renderer.floater(p.x, p.y - 20, '+$' + p.cash, '#7CFC9A'); }
      else state.addHeat(crimeHeatFor('punchPed'));
      renderer.burst(p.x, p.y, '#ff5a5a', 10, 120);
    }
  }
}
function shoot() {
  if (!state.running || state.paused || state.dead || state.playerCar) return;
  if (state.player.weapon !== 'pistol') { punch(); return; }
  if (state.player.ammo <= 0) { toast('Out of ammo — find a yellow ammo pickup'); return; }
  state.player.ammo--;
  audio.shoot();
  state.addHeat(crimeHeatFor('shoot'));
  const a = state.player.aimAngle;
  state.bullets.push({ x: state.player.x + Math.cos(a) * 20, y: state.player.y + Math.sin(a) * 20, vx: Math.cos(a) * 900, vy: Math.sin(a) * 900, life: 0.7, fromPlayer: true });
}
function respawn() {
  const h = state.city.landmarks.find(l => l.id === 'hospital');
  state.player.x = h.x + 40; state.player.y = h.y + 40;
  state.player.health = 100; state.heat = 0; state.wanted = 0; state.police.clear();
  state.cash = Math.max(0, state.cash - 100);
  state.playerCar = null; state.dead = false;
  document.getElementById('wasted').classList.add('hidden');
  toast('You woke up at Coral General Hospital (-$100)');
  state.saveGame();
}
function die(kind) {
  if (state.dead) return;
  state.dead = true; state.deadKind = kind;
  document.getElementById('wasted').classList.remove('hidden');
  document.getElementById('wastedSub').textContent = kind === 'busted'
    ? 'The Solmar PD caught you. Your car is impounded.' : 'Mara is down. The crew will pick you up.';
  if (kind === 'busted') { state.playerCar = null; state.heat = 0; state.wanted = 0; state.police.clear(); }
}

// ---- menus ----
function togglePause() {
  state.paused = !state.paused;
  document.getElementById('pauseMenu').classList.toggle('hidden', !state.paused);
  if (state.paused) {
    document.getElementById('pauseStats').innerHTML =
      `💰 Cash $${fmtMoney(state.cash)} &nbsp;·&nbsp; ⭐ Wanted ${state.wanted}<br>` +
      `🎯 Missions done ${state.missionsDone}/6 &nbsp;·&nbsp; 🚗 Cars stolen ${state.carsStolen}<br>` +
      `📍 ${districtAt(state.player.x, state.player.y)} &nbsp;·&nbsp; Day ${state.day}<br>` +
      `📻 Radio: ${audio.stations[audio.station].name}`;
  }
}
function toggleMissions() {
  const panel = document.getElementById('missionPanel');
  const show = panel.classList.contains('hidden');
  panel.classList.toggle('hidden', !show);
  state.paused = show;
  if (show) {
    const list = document.getElementById('missionList');
    list.innerHTML = STORY.map((m, i) => {
      const cls = i < state.missionsDone ? 'done' : (state.missions.active && state.missions.active.id === m.id ? 'active' : '');
      const mark = i < state.missionsDone ? '✅' : (state.missions.active && state.missions.active.id === m.id ? '▶' : '○');
      return `<div class="mrow ${cls}">${mark} ${m.title} — ${m.giver} · $${m.reward}<br><small>${m.brief}</small></div>`;
    }).join('') + `<div class="mrow">Side jobs: Taxi $150 · Pizza Delivery $120 · Street Race $400 (start from the pause menu mission list by pressing M, story first)</div>`;
  }
}
document.getElementById('btnResume').onclick = togglePause;
document.getElementById('btnMissions').onclick = () => { document.getElementById('pauseMenu').classList.add('hidden'); toggleMissions(); };
document.getElementById('btnCloseMissions').onclick = toggleMissions;
document.getElementById('btnSaveQuit').onclick = () => {
  state.saveGame(); state.running = false; state.paused = false;
  document.getElementById('pauseMenu').classList.add('hidden');
  document.getElementById('hud').classList.add('hidden');
  document.getElementById('menu').classList.remove('hidden');
  showContinue();
};
document.getElementById('btnPlay').onclick = () => startGame(false);
document.getElementById('btnContinue').onclick = () => startGame(true);

function showContinue() {
  const s = loadGameData();
  const btn = document.getElementById('btnContinue');
  if (s) {
    btn.classList.remove('hidden');
    document.getElementById('continueInfo').textContent = `Day ${s.day}, $${fmtMoney(s.cash)}, ${s.missionsDone}/6 missions`;
  } else btn.classList.add('hidden');
}

function startGame(continueSave) {
  audio.ensure(); audio.startMusic();
  resetWorld();
  if (continueSave) {
    const s = loadGameData();
    if (s) {
      state.cash = s.cash; state.missionsDone = s.missionsDone; state.carsStolen = s.carsStolen || 0;
      state.day = s.day; state.clockMinutes = s.clockMinutes;
      state.player.x = s.player.x; state.player.y = s.player.y; state.player.health = s.player.health;
      state.player.weapon = s.player.weapon || 'fists'; state.player.ammo = s.player.ammo || 0;
    }
  } else {
    state.cash = 250; state.missionsDone = 0; state.carsStolen = 0; state.day = 1; state.clockMinutes = 9 * 60;
    state.player.x = 520; state.player.y = 460; state.player.health = 100; state.player.weapon = 'fists'; state.player.ammo = 0;
  }
  state.heat = 0; state.wanted = 0; state.playerCar = null; state.dead = false;
  document.getElementById('menu').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  document.getElementById('wasted').classList.add('hidden');
  state.running = true; state.paused = false;
  state.cam.x = state.player.x; state.cam.y = state.player.y;
  toast('Welcome to Solmar Bay, Mara. Press M for your first mission.');
  state.feed('🎯 Mission 1 available — press M');
  applyShotMode();
}

// ---- screenshot presets (?shot=...) ----
function applyShotMode() {
  const q = new URLSearchParams(location.search);
  const shot = q.get('shot');
  if (!shot) return;
  state.shotMode = shot;
  const rng = mulberry32(7);
  if (shot === 'cover' || shot === 'chase') {
    // player driving a Comet GT through downtown, 3-star chase, mission active
    const car = new Vehicle(CAR_MODELS[0], 1450, 600, 0, { driver: 'player' });
    car.speed = 420; state.playerCar = car; state.parked = state.parked.filter(c => c !== car);
    state.player.x = car.x; state.player.y = car.y;
    state.heat = 2.6; state.wanted = 3;
    state.missions.active = { ...STORY[4], kind: 'story' }; state.missions.stage = 1; state.missions.setMarkerForStage();
    state.feed('Mission: 5 — Casino Score');
    state.cash = 4850;
    for (let i = 0; i < 3; i++) state.police.cars.push(new Vehicle(POLICE_MODEL, car.x - 200 - i * 90, car.y + (i % 2 ? 60 : -60), 0, { police: true, driver: 'police' }));
    state.cam.x = car.x; state.cam.y = car.y;
  } else if (shot === 'foot') {
    state.player.x = 900; state.player.y = 730; state.player.weapon = 'pistol'; state.player.ammo = 24;
    state.missions.startStory();
    state.cash = 1250;
    state.cam.x = 900; state.cam.y = 730;
  } else if (shot === 'mission') {
    state.player.x = 2230; state.player.y = 660; state.player.weapon = 'pistol'; state.player.ammo = 18;
    state.missions.active = { ...STORY[2], kind: 'story' }; state.missions.stage = 0; state.missions.setMarkerForStage();
    state.feed('Mission: 3 — Mall Run');
    state.heat = 1.2; state.wanted = 2;
    state.cam.x = 2230; state.cam.y = 660;
  }
}

// ---- update ----
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (!state.running || state.paused) return;
  state.time += dt;
  state.clockMinutes += dt * 0.6; // ~1 game hour per 100 real seconds
  if (state.clockMinutes >= 24 * 60) { state.clockMinutes -= 24 * 60; state.day++; }
  const hour = state.clockMinutes / 60;
  state.dayFactor = hour >= 7 && hour < 18 ? 1 : hour >= 18 && hour < 20 ? 0.55 : 0.25;
  // aim
  const camX = clamp(state.cam.x - canvas.width / 2, 0, WORLD_W - canvas.width);
  const camY = clamp(state.cam.y - canvas.height / 2, 0, WORLD_H - canvas.height);
  const wx = state.mouse.x + camX, wy = state.mouse.y + camY;
  state.player.aimAngle = Math.atan2(wy - state.player.y, wx - state.player.x);
  // heat decay when calm
  if (state.wanted > 0) state.heat = Math.max(0, state.heat - dt * 0.03);
  else state.heat = Math.max(0, state.heat - dt * 0.08);
  state.wanted = wantedStars(state.heat);
  // player movement
  if (state.playerCar) {
    const c = state.playerCar;
    const k = state.keys;
    const fwd = (k['w'] || k['arrowup'] ? 1 : 0) - (k['s'] || k['arrowdown'] ? 0.55 : 0);
    const steer = (k['a'] || k['arrowleft'] ? -1 : 0) + (k['d'] || k['arrowright'] ? 1 : 0);
    c.speed += fwd * c.model.accel * dt * (c.speed < 0 ? 1.4 : 1);
    if (!fwd) c.speed -= Math.sign(c.speed) * 160 * dt;
    if (Math.abs(c.speed) < 4 && !fwd) c.speed = 0;
    c.angle += steer * dt * 1.9 * clamp(Math.abs(c.speed) / 180, 0, 1) * (c.speed < 0 ? -1 : 1);
    const ox = c.x, oy = c.y;
    c.update(dt, state.city);
    if (Math.abs(c.speed) > 200 && isOnRoad(state.city, c.x, c.y)) state.addHeat(0.02 * dt);
    if (Math.hypot(c.x - ox, c.y - oy) < 0.01 && Math.abs(c.speed) > 120) { /* stuck */ }
    // run over peds (dark, but it is a crime game: counts as a crime)
    for (const p of state.peds) {
      if (p.hp !== undefined && p.hp <= 0) continue;
      if (dist(c.x, c.y, p.x, p.y) < 26 && Math.abs(c.speed) > 60) {
        p.hp = 0; state.kills++; state.cash += p.cash; state.addHeat(crimeHeatFor('killPed'));
        renderer.burst(p.x, p.y, '#ff5a5a', 12, 140); audio.crash();
      }
    }
    // crash into traffic
    for (const v of [...state.traffic, ...state.parked]) {
      if (v === c) continue;
      if (dist(c.x, c.y, v.x, v.y) < 40 && Math.abs(c.speed) > 150) {
        c.health -= 8; v.health -= 10; c.speed *= 0.5; audio.crash();
        renderer.burst((c.x + v.x) / 2, (c.y + v.y) / 2, '#ffb03a', 12, 150);
        if (v.health <= 0) { state.traffic = state.traffic.filter(t => t !== v); state.parked = state.parked.filter(t => t !== v); }
      }
    }
    if (c.health <= 0) { renderer.burst(c.x, c.y, '#ff8030', 26, 220); audio.crash(); state.playerCar = null; state.player.x = c.x + 30; state.player.y = c.y; state.player.health -= 20; toast('Your car is wrecked!'); }
    state.player.x = c.x; state.player.y = c.y;
    state.cam.x = c.x; state.cam.y = c.y;
  } else {
    const k = state.keys;
    const sp = (k['shift'] ? 260 : 165);
    let mx = (k['d'] || k['arrowright'] ? 1 : 0) - (k['a'] || k['arrowleft'] ? 1 : 0);
    let my = (k['s'] || k['arrowdown'] ? 1 : 0) - (k['w'] || k['arrowup'] ? 1 : 0);
    if (mx || my) {
      const len = Math.hypot(mx, my); mx /= len; my /= len;
      state.player.angle = Math.atan2(my, mx);
      const nx = state.player.x + mx * sp * dt, ny = state.player.y + my * sp * dt;
      if (!collideBuildings(state.city, nx, state.player.y, 12)) state.player.x = nx;
      if (!collideBuildings(state.city, state.player.x, ny, 12)) state.player.y = ny;
    }
    state.player.x = clamp(state.player.x, 20, WORLD_W - 20);
    state.player.y = clamp(state.player.y, 20, WORLD_H - 20);
    state.cam.x = state.player.x; state.cam.y = state.player.y;
  }
  // camera smoothing is implicit (cam follows player); traffic / peds
  for (const v of state.traffic) updateTrafficCar(v, dt, state.city, state.playerCar);
  const danger = state.playerCar && Math.abs(state.playerCar.speed) > 200 ? state.playerCar : state.player;
  for (const p of state.peds) p.update(dt, state.city, danger);
  state.police.update(dt, state, state.city, audio);
  // bullets
  for (const b of state.bullets) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (collideBuildings(state.city, b.x, b.y, 2)) { b.life = 0; renderer.burst(b.x, b.y, '#ccc', 5, 80); }
    for (const g of state.missions.guards) {
      if (g.hp > 0 && dist(b.x, b.y, g.x, g.y) < 14) { g.hp -= 34; b.life = 0; renderer.burst(g.x, g.y, '#ff5a5a', 10, 120); if (g.hp <= 0) { state.kills++; state.cash += 60; } }
    }
    for (const p of state.peds) {
      if (p.hp !== undefined && p.hp <= 0) continue;
      if (dist(b.x, b.y, p.x, p.y) < 12) { p.hp = (p.hp ?? 100) - 50; b.life = 0; if (p.hp <= 0) { state.kills++; state.cash += p.cash; state.addHeat(crimeHeatFor('killPed')); } }
    }
    for (const c of state.police.cars) {
      if (dist(b.x, b.y, c.x, c.y) < 20) { c.health -= 25; b.life = 0; state.addHeat(crimeHeatFor('hitPolice')); if (c.health <= 0) { state.police.cars = state.police.cars.filter(x => x !== c); renderer.burst(c.x, c.y, '#ff8030', 20, 200); } }
    }
  }
  state.bullets = state.bullets.filter(b => b.life > 0);
  // pickups
  for (const pk of state.pickups) {
    if (pk.taken) continue;
    if (dist(state.player.x, state.player.y, pk.x, pk.y) < 30) {
      pk.taken = true; audio.pickup();
      if (pk.kind === 'health') { state.player.health = clamp(state.player.health + 50, 0, 100); toast('+50 health'); }
      if (pk.kind === 'ammo') { state.player.weapon = 'pistol'; state.player.ammo += 24; toast('Pistol + 24 bullets'); }
      if (pk.kind === 'cash') { state.cash += 200; toast('+$200 found cash'); }
    }
  }
  state.pickups = state.pickups.filter(p => !p.taken || p.respawnT);
  // mission guards spawn for m4
  if (state.missions.active && state.missions.active.id === 'm4' && state.missions.guards.length === 0) {
    const d = state.city.landmarks.find(l => l.id === 'docks');
    for (let i = 0; i < 3; i++) state.missions.guards.push({ x: d.x + (i - 1) * 60, y: d.y + (i % 2 ? 40 : -40), angle: 0, hp: 100 });
  }
  state.missions.update(dt);
  // busted: police very close on foot for a while, or health 0
  if (state.player.health <= 0) die('wasted');
  if (!state.playerCar && state.wanted >= 3) {
    for (const c of state.police.cars) if (dist(c.x, c.y, state.player.x, state.player.y) < 40) die('busted');
  }
  if (state.playerCar && state.playerCar.health <= 0) { /* handled above */ }
  // autosave every ~20s
  state._saveT = (state._saveT || 0) + dt;
  if (state._saveT > 20) { state._saveT = 0; state.saveGame(); }
  renderer.render(state, dt);
  renderer.updateHud(state);
}
requestAnimationFrame(frame);
showContinue();
// auto-start for screenshot mode (?shot=...) so Playwright captures gameplay, not the menu
if (new URLSearchParams(location.search).has('shot')) {
  setTimeout(() => { if (!state.running) startGame(false); }, 300);
}

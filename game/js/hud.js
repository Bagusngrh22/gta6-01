// hud.js — canvas renderer: city, traffic, player, effects, plus the DOM HUD and minimap.
import { WORLD_W, WORLD_H, districtAt } from './city.js';
import { clamp, fmtMoney, fmtTime } from './utils.js';

export class Renderer {
  constructor(canvas, minimap) {
    this.cv = canvas; this.ctx = canvas.getContext('2d');
    this.mm = minimap; this.mctx = minimap.getContext('2d');
    this.particles = []; this.floaters = [];
  }
  burst(x, y, color, n = 14, speed = 160) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      this.particles.push({ x, y, vx: Math.cos(a) * speed * (0.4 + Math.random()), vy: Math.sin(a) * speed * (0.4 + Math.random()), life: 0.5 + Math.random() * 0.4, color });
    }
  }
  floater(x, y, text, color = '#ffd23f') { this.floaters.push({ x, y, text, color, life: 1.4 }); }
  drawCar(ctx, x, y, angle, model, opts = {}) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    const L = opts.police ? 46 : 42, W = 22;
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(-L / 2 + 3, -W / 2 + 4, L, W);
    ctx.fillStyle = model.color; ctx.beginPath();
    ctx.roundRect(-L / 2, -W / 2, L, W, 6); ctx.fill();
    if (opts.police) {
      ctx.fillStyle = '#fff'; ctx.fillRect(-6, -W / 2, 12, W);
      ctx.fillStyle = '#e33f3f'; ctx.fillRect(-L / 2 + 2, -W / 2, 7, 7);
      ctx.fillStyle = '#3f7fe3'; ctx.fillRect(-L / 2 + 2, W / 2 - 7, 7, 7);
      if (opts.siren) { ctx.fillStyle = Math.floor(performance.now() / 200) % 2 ? '#ff4040' : '#4080ff'; ctx.beginPath(); ctx.arc(0, 0, 9, 0, 7); ctx.fill(); }
    }
    ctx.fillStyle = 'rgba(20,30,50,.85)';
    ctx.beginPath(); ctx.roundRect(-8, -W / 2 + 3, 16, W - 6, 4); ctx.fill();
    ctx.fillStyle = '#cfe8ff'; ctx.fillRect(L / 2 - 8, -W / 2 + 3, 4, 5); ctx.fillRect(L / 2 - 8, W / 2 - 8, 4, 5);
    ctx.fillStyle = '#ff5a4a'; ctx.fillRect(-L / 2, -W / 2 + 3, 3, 5); ctx.fillRect(-L / 2, W / 2 - 8, 3, 5);
    if (opts.smoke > 0) { ctx.fillStyle = 'rgba(120,120,120,.6)'; ctx.beginPath(); ctx.arc(-L / 2 - 8, 0, 8 + Math.random() * 6, 0, 7); ctx.fill(); }
    ctx.restore();
  }
  drawPerson(ctx, x, y, angle, color, opts = {}) {
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(0, 4, 9, 5, 0, 0, 7); ctx.fill();
    ctx.rotate(angle);
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(0, 0, 9, 0, 7); ctx.fill();
    if (opts.player) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, 0, 11, 0, 7); ctx.stroke(); }
    ctx.fillStyle = '#f2c89b'; ctx.beginPath(); ctx.arc(5, 0, 4.5, 0, 7); ctx.fill();
    if (opts.aim) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(20, 0); ctx.stroke(); }
    if (opts.down) { ctx.rotate(-Math.PI / 2); ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.ellipse(0, 0, 10, 6, 0, 0, 7); ctx.fill(); }
    ctx.restore();
  }
  render(state, dt) {
    const ctx = this.ctx; const W = this.cv.width, H = this.cv.height;
    const camX = clamp(state.cam.x - W / 2, 0, WORLD_W - W);
    const camY = clamp(state.cam.y - H / 2, 0, WORLD_H - H);
    // sky-ground: sun-baked sand/grass base with day tint
    const dayF = state.dayFactor;
    ctx.fillStyle = dayF > 0.6 ? '#c9d68a' : (dayF > 0.3 ? '#b8a878' : '#5a5a78');
    ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.translate(-camX, -camY);
    // beach + sea on the west edge
    ctx.fillStyle = '#ffe9a8'; ctx.fillRect(0, 0, 230, WORLD_H);
    ctx.fillStyle = '#3fa8d8'; ctx.fillRect(0, 0, 60, WORLD_H);
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    for (let y = 0; y < WORLD_H; y += 120) { ctx.beginPath(); ctx.arc(28 + Math.sin(y * 0.01) * 8, (y + (state.time * 20) % 120), 14, 0, 7); ctx.fill(); }
    // parks
    for (const p of state.city.parks) {
      ctx.fillStyle = '#7ec850'; ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.fillStyle = '#5aa838'; ctx.beginPath(); ctx.arc(p.x + p.w / 2, p.y + p.h / 2, Math.min(p.w, p.h) * 0.28, 0, 7); ctx.fill();
      ctx.fillStyle = '#3f8fd8'; ctx.beginPath(); ctx.arc(p.x + p.w * 0.75, p.y + p.h * 0.7, 16, 0, 7); ctx.fill();
    }
    // roads
    ctx.fillStyle = '#3a3f4a';
    for (const rx of state.city.roadsV) ctx.fillRect(rx - 34, 0, 68, WORLD_H);
    for (const ry of state.city.roadsH) ctx.fillRect(0, ry - 34, WORLD_W, 68);
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 2; ctx.setLineDash([18, 16]);
    for (const rx of state.city.roadsV) { ctx.beginPath(); ctx.moveTo(rx, 0); ctx.lineTo(rx, WORLD_H); ctx.stroke(); }
    for (const ry of state.city.roadsH) { ctx.beginPath(); ctx.moveTo(0, ry); ctx.lineTo(WORLD_W, ry); ctx.stroke(); }
    ctx.setLineDash([]);
    // sidewalks / crosswalks at intersections
    ctx.fillStyle = 'rgba(255,255,255,.25)';
    for (const rx of state.city.roadsV) for (const ry of state.city.roadsH) ctx.fillRect(rx - 34, ry - 34, 68, 68);
    // trees
    for (const t of state.city.trees) {
      ctx.fillStyle = '#6a4a2a'; ctx.fillRect(t.x - 2, t.y - 2, 4, 8);
      ctx.fillStyle = t.palm ? '#2fae5a' : '#3f8a3f';
      ctx.beginPath(); ctx.arc(t.x, t.y - 6, 9, 0, 7); ctx.fill();
    }
    // buildings with height shading + names on big ones
    for (const b of state.city.buildings) {
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
      ctx.fillStyle = b.color; ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = b.roof; ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
      ctx.fillStyle = 'rgba(255,240,180,.85)';
      const cols = Math.floor(b.w / 22), rows = Math.floor(b.h / 20);
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
        if ((i * 7 + j * 3 + b.height) % 3 !== 0) ctx.fillRect(b.x + 8 + i * 22, b.y + 8 + j * 20, 10, 8);
      }
      if (b.height >= 4) { ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.font = 'bold 12px Verdana'; ctx.textAlign = 'center'; ctx.fillText(b.name, b.x + b.w / 2, b.y + b.h + 14); }
    }
    // landmarks
    for (const lm of state.city.landmarks) {
      ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(lm.x, lm.y, 12, 0, 7); ctx.fill();
      ctx.fillStyle = '#231303'; ctx.font = 'bold 11px Verdana'; ctx.textAlign = 'center'; ctx.fillText('★', lm.x, lm.y + 4);
      ctx.fillStyle = 'rgba(0,0,0,.65)'; ctx.font = 'bold 11px Verdana'; ctx.fillText(lm.name, lm.x, lm.y - 18);
    }
    // mission marker
    if (state.missions.marker) {
      const m = state.missions.marker; const pulse = 18 + Math.sin(state.time * 5) * 5;
      ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(m.x, m.y, pulse, 0, 7); ctx.stroke();
      ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.moveTo(m.x, m.y - 34); ctx.lineTo(m.x - 10, m.y - 14); ctx.lineTo(m.x + 10, m.y - 14); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#231303'; ctx.font = 'bold 12px Verdana'; ctx.textAlign = 'center'; ctx.fillText('▼ ' + m.name, m.x, m.y - 42);
    }
    // pickups (cash, health, ammo)
    for (const pk of state.pickups) {
      ctx.fillStyle = pk.kind === 'health' ? '#ff5a5a' : pk.kind === 'ammo' ? '#ffd23f' : '#7CFC9A';
      ctx.beginPath(); ctx.arc(pk.x, pk.y, 10, 0, 7); ctx.fill();
      ctx.fillStyle = '#000'; ctx.font = 'bold 12px Verdana'; ctx.textAlign = 'center';
      ctx.fillText(pk.kind === 'health' ? '+' : pk.kind === 'ammo' ? 'A' : '$', pk.x, pk.y + 4);
    }
    // traffic + parked cars
    for (const v of state.traffic) this.drawCar(ctx, v.x, v.y, v.angle, v.model, { smoke: v.smoke });
    for (const v of state.parked) this.drawCar(ctx, v.x, v.y, v.angle, v.model, {});
    for (const c of state.police.cars) this.drawCar(ctx, c.x, c.y, c.angle, c.model, { police: true, siren: true, smoke: c.smoke });
    // guards (mission 4)
    for (const g of state.missions.guards) if (g.hp > 0) this.drawPerson(ctx, g.x, g.y, g.angle, '#3a3a3a', { aim: true });
    // pedestrians
    for (const p of state.peds) {
      if (p.hp !== undefined && p.hp <= 0) { this.drawPerson(ctx, p.x, p.y, p.angle, p.color, { down: true }); continue; }
      this.drawPerson(ctx, p.x, p.y, p.angle, p.color, {});
    }
    // player car or player on foot
    if (state.playerCar) {
      this.drawCar(ctx, state.playerCar.x, state.playerCar.y, state.playerCar.angle, state.playerCar.model, { police: state.playerCar.police, siren: false, smoke: state.playerCar.smoke });
    } else {
      this.drawPerson(ctx, state.player.x, state.player.y, state.player.aimAngle, state.player.color, { aim: state.player.weapon !== 'fists', player: true });
      // aim line
      if (state.player.weapon !== 'fists') {
        ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(state.player.x, state.player.y);
        ctx.lineTo(state.player.x + Math.cos(state.player.aimAngle) * 90, state.player.y + Math.sin(state.player.aimAngle) * 90); ctx.stroke();
      }
    }
    // bullets
    for (const b of state.bullets) {
      ctx.fillStyle = '#ffe27a'; ctx.beginPath(); ctx.arc(b.x, b.y, 3.5, 0, 7); ctx.fill();
    }
    // particles
    for (const pt of this.particles) {
      ctx.globalAlpha = Math.max(0, pt.life * 1.6);
      ctx.fillStyle = pt.color; ctx.beginPath(); ctx.arc(pt.x, pt.y, 4, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const f of this.floaters) {
      ctx.globalAlpha = Math.min(1, f.life);
      ctx.fillStyle = f.color; ctx.font = 'bold 16px Verdana'; ctx.textAlign = 'center'; ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
    // night tint
    if (dayF < 0.45) { ctx.fillStyle = `rgba(10,10,50,${(0.45 - dayF) * 0.7})`; ctx.fillRect(camX, camY, W, H); }
    ctx.restore();
    // update particles
    for (const pt of this.particles) { pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.life -= dt; }
    this.particles = this.particles.filter(p => p.life > 0);
    for (const f of this.floaters) { f.y -= 24 * dt; f.life -= dt; }
    this.floaters = this.floaters.filter(f => f.life > 0);
    this.renderMinimap(state, camX, camY);
  }
  renderMinimap(state, camX, camY) {
    const m = this.mctx; const mw = this.mm.width, mh = this.mm.height;
    const sx = mw / WORLD_W, sy = mh / WORLD_H;
    m.fillStyle = '#1a2a3a'; m.fillRect(0, 0, mw, mh);
    m.fillStyle = '#3fa8d8'; m.fillRect(0, 0, 230 * sx, mh);
    m.fillStyle = '#7ec850';
    for (const p of state.city.parks) m.fillRect(p.x * sx, p.y * sy, p.w * sx, p.h * sy);
    m.strokeStyle = '#5a5f6a'; m.lineWidth = 2;
    for (const rx of state.city.roadsV) { m.beginPath(); m.moveTo(rx * sx, 0); m.lineTo(rx * sx, mh); m.stroke(); }
    for (const ry of state.city.roadsH) { m.beginPath(); m.moveTo(0, ry * sy); m.lineTo(mw, ry * sy); m.stroke(); }
    m.fillStyle = '#ffd23f';
    for (const lm of state.city.landmarks) m.fillRect(lm.x * sx - 2, lm.y * sy - 2, 4, 4);
    if (state.missions.marker) {
      m.fillStyle = '#ff4040'; m.beginPath(); m.arc(state.missions.marker.x * sx, state.missions.marker.y * sy, 5, 0, 7); m.fill();
    }
    const px = state.playerCar ? state.playerCar.x : state.player.x;
    const py = state.playerCar ? state.playerCar.y : state.player.y;
    m.strokeStyle = '#fff'; m.lineWidth = 1; m.strokeRect((camX) * sx, (camY) * sy, this.cv.width * sx, this.cv.height * sy);
    m.fillStyle = '#fff'; m.beginPath(); m.arc(px * sx, py * sy, 4, 0, 7); m.fill();
    for (const c of state.police.cars) { m.fillStyle = '#4080ff'; m.beginPath(); m.arc(c.x * sx, c.y * sy, 3, 0, 7); m.fill(); }
  }
  updateHud(state) {
    const $ = (id) => document.getElementById(id);
    $('cashVal').textContent = fmtMoney(state.cash);
    $('healthFill').style.width = clamp(state.player.health, 0, 100) + '%';
    $('healthText').textContent = Math.ceil(state.player.health);
    $('timeText').textContent = fmtTime(state.clockMinutes);
    $('dayText').textContent = 'Day ' + state.day;
    const stars = $('wanted');
    stars.innerHTML = '';
    for (let i = 0; i < 5; i++) {
      const s = document.createElement('span');
      s.className = 'star' + (i < state.wanted ? '' : ' off'); s.textContent = '★';
      stars.appendChild(s);
    }
    const car = state.playerCar;
    $('speedVal').textContent = car ? Math.round(Math.abs(car.speed) * 0.12) : 0;
    $('carName').textContent = car ? car.model.name + (car.police ? ' (STOLEN PD)' : '') : 'On foot — ' + districtAt(state.player.x, state.player.y);
    $('weaponName').textContent = state.player.weapon === 'fists' ? 'Fists' : 'Pistol';
    $('ammoVal').textContent = state.player.weapon === 'fists' ? '' : '· ' + state.player.ammo + ' bullets';
    const m = state.missions.active;
    if (m) {
      $('objTitle').textContent = m.title;
      $('objText').textContent = m.brief;
      $('objDist').textContent = state.objectiveDist || '';
    } else {
      const next = state.missionsDone >= 6 ? null : state.missions.currentStory();
      $('objTitle').textContent = next ? 'Next mission: ' + next.title : 'Free Roam — story complete!';
      $('objText').textContent = next ? next.brief + ' (press M to start)' : 'All 6 story missions done. Keep hustling: taxi, delivery and races pay cash.';
      $('objDist').textContent = '';
    }
  }
}

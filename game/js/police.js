// police.js — wanted level, police response, busted / wasted.
// 1 star: one patrol car. 5 stars: roadblocks of interceptors + faster pursuit.
import { clamp, dist, angleDiff } from './utils.js';
import { Vehicle, CAR_MODELS } from './world.js';
import { nearestRoadPoint, WORLD_W, WORLD_H } from './city.js';

export const POLICE_MODEL = { name: 'Solmar PD Interceptor', color: '#1a2a4a', speed: 560, accel: 380, price: 0 };

export class Police {
  constructor() { this.cars = []; this.spawnT = 0; this.sirenT = 0; }
  wantedCount(wanted) { return wanted <= 0 ? 0 : Math.min(1 + wanted, 6); }
  update(dt, state, city, audio) {
    const want = this.wantedCount(state.wanted);
    this.spawnT -= dt; this.sirenT -= dt;
    if (state.wanted > 0 && this.sirenT <= 0) { this.sirenT = 2.2; audio.sirenBlip(); }
    while (this.cars.length < want && this.spawnT <= 0) {
      this.spawnT = 0.8;
      const px = state.player.x, py = state.player.y;
      const ang = Math.random() * Math.PI * 2;
      const x = clamp(px + Math.cos(ang) * 620, 60, WORLD_W - 60);
      const y = clamp(py + Math.sin(ang) * 620, 60, WORLD_H - 60);
      const p = nearestRoadPoint(city, x, y) || { x, y };
      const car = new Vehicle(POLICE_MODEL, p.x, p.y, Math.atan2(py - p.y, px - p.x), { police: true, driver: 'police' });
      car.speed = 300; this.cars.push(car);
    }
    if (state.wanted === 0) {
      // police give up and drive off
      for (const c of this.cars) { c.speed = Math.max(0, c.speed - 200 * dt); }
      this.cars = this.cars.filter(c => dist(c.x, c.y, state.player.x, state.player.y) < 1200);
    }
    const target = state.playerCar || null;
    const tx = target ? target.x : state.player.x, ty = target ? target.y : state.player.y;
    for (const c of this.cars) {
      const d = dist(c.x, c.y, tx, ty);
      const desired = Math.atan2(ty - c.y, tx - c.x);
      const steer = clamp(angleDiff(c.angle, desired), -1, 1);
      c.angle += steer * dt * 2.4;
      const wantSpeed = d > 260 ? POLICE_MODEL.speed : POLICE_MODEL.speed * 0.75;
      c.speed += clamp(wantSpeed - c.speed, -420 * dt, 320 * dt);
      c.x += Math.cos(c.angle) * c.speed * dt;
      c.y += Math.sin(c.angle) * c.speed * dt;
      c.x = clamp(c.x, 30, WORLD_W - 30); c.y = clamp(c.y, 30, WORLD_H - 30);
      // ram the player
      if (d < 46) {
        if (target) { target.health -= 14 * dt; target.speed *= 0.92; }
        else { state.player.health -= 22 * dt; }
        if (Math.random() < dt * 2) audio.crash();
        state.addHeat(0.3 * dt);
      }
    }
  }
  clear() { this.cars = []; }
}

export function crimeHeatFor(action) {
  // how much wanted heat each crime adds (0..5 scale)
  switch (action) {
    case 'stealCar': return 1;
    case 'punchPed': return 1;
    case 'shoot': return 1;
    case 'killPed': return 2;
    case 'hitPolice': return 2;
    case 'speeding': return 0.15;
    default: return 0.5;
  }
}
export function wantedStars(heat) {
  if (heat <= 0.05) return 0;
  return clamp(Math.ceil(heat), 0, 5);
}

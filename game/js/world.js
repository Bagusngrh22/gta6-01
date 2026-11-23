// world.js — cars, traffic and pedestrians of Solmar Bay.
// All vehicles are original designs with invented names.
import { mulberry32, pick, clamp, angleDiff, dist } from './utils.js';
import { isOnRoad, nearestRoadPoint, collideBuildings, WORLD_W, WORLD_H } from './city.js';

export const CAR_MODELS = [
  { name: 'Comet GT', color: '#e33f3f', speed: 520, accel: 340, price: 1200 },
  { name: 'Sunrunner', color: '#f2c230', speed: 430, accel: 280, price: 650 },
  { name: 'Bay Cruiser', color: '#3f7fe3', speed: 400, accel: 250, price: 500 },
  { name: 'Dune Buggy', color: '#7ad07a', speed: 460, accel: 300, price: 800 },
  { name: 'Vesper Sedan', color: '#c0c8d0', speed: 420, accel: 270, price: 550 },
  { name: 'Tide Van', color: '#8a6fd8', speed: 360, accel: 220, price: 400 },
  { name: 'Palma Pickup', color: '#e38a3f', speed: 440, accel: 290, price: 700 },
  { name: 'Neon Coupe', color: '#e33fa8', speed: 540, accel: 360, price: 1500 },
];
const PED_NAMES = ['Rosa', 'Tomas', 'Aisha', 'Leo', 'Nina', 'Carlos', 'Maya', 'Omar', 'Lena', 'Felix', 'Ivy', 'Hugo'];
const PED_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#fd79a8'];

export class Vehicle {
  constructor(model, x, y, angle, opts = {}) {
    this.model = model; this.x = x; this.y = y; this.angle = angle;
    this.speed = 0; this.steer = 0; this.police = !!opts.police; this.taxi = !!opts.taxi;
    this.health = 100; this.driver = opts.driver ?? null; this.id = Math.random().toString(36).slice(2, 8);
    this.smoke = 0; this.hornT = 0;
  }
  update(dt, city, traffic) {
    // simple arcade car physics: forward accel, steering scales with speed
    const maxSp = this.model.speed * (this.health < 30 ? 0.55 : 1);
    this.speed = clamp(this.speed, -maxSp * 0.35, maxSp);
    this.x += Math.cos(this.angle) * this.speed * dt;
    this.y += Math.sin(this.angle) * this.speed * dt;
    this.x = clamp(this.x, 30, WORLD_W - 30); this.y = clamp(this.y, 30, WORLD_H - 30);
    if (collideBuildings(city, this.x, this.y, 16)) {
      // bounce back off a building
      this.x -= Math.cos(this.angle) * this.speed * dt * 2;
      this.y -= Math.sin(this.angle) * this.speed * dt * 2;
      if (Math.abs(this.speed) > 180) { this.health -= 6; this.smoke = 1; }
      this.speed *= -0.25;
    }
    if (this.smoke > 0) this.smoke = Math.max(0, this.smoke - dt * 0.4);
  }
}

export class Pedestrian {
  constructor(rng, city) {
    const p = nearestRoadPoint(city, 400 + rng() * 2600, 400 + rng() * 1800) || { x: 500, y: 500 };
    this.x = p.x + (rng() - 0.5) * 40; this.y = p.y + (rng() - 0.5) * 40;
    this.name = pick(rng, PED_NAMES);
    this.color = pick(rng, PED_COLORS);
    this.speed = 28 + rng() * 30; this.angle = rng() * Math.PI * 2;
    this.state = 'walk'; this.fleeT = 0; this.changeT = rng() * 4;
    this.cash = 5 + Math.floor(rng() * 40);
  }
  update(dt, city, danger) {
    this.changeT -= dt;
    if (danger && dist(this.x, this.y, danger.x, danger.y) < 220) { this.state = 'flee'; this.fleeT = 2.5; }
    if (this.fleeT > 0) {
      this.fleeT -= dt;
      const a = Math.atan2(this.y - danger.y, this.x - danger.x);
      this.angle = a; this.x += Math.cos(a) * 130 * dt; this.y += Math.sin(a) * 130 * dt;
      if (this.fleeT <= 0) this.state = 'walk';
    } else if (this.changeT <= 0) {
      this.changeT = 2 + Math.random() * 4;
      // wander along roads: pick a nearby road axis
      this.angle = Math.random() < 0.5 ? (Math.random() < 0.5 ? 0 : Math.PI) : (Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
    }
    if (this.state === 'walk') { this.x += Math.cos(this.angle) * this.speed * dt; this.y += Math.sin(this.angle) * this.speed * dt; }
    this.x = clamp(this.x, 20, WORLD_W - 20); this.y = clamp(this.y, 20, WORLD_H - 20);
    if (collideBuildings(city, this.x, this.y, 8)) { this.angle += Math.PI; this.x += Math.cos(this.angle) * 20; this.y += Math.sin(this.angle) * 20; }
  }
}

export function spawnTraffic(city, count, rng) {
  const cars = [];
  for (let i = 0; i < count; i++) {
    const vertical = rng() < 0.5;
    const road = vertical ? pick(rng, city.roadsV) : pick(rng, city.roadsH);
    const along = 100 + rng() * (vertical ? WORLD_H - 200 : WORLD_W - 200);
    const x = vertical ? road + (rng() < 0.5 ? -14 : 14) : along;
    const y = vertical ? along : road + (rng() < 0.5 ? -14 : 14);
    const angle = vertical ? (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rng() < 0.5 ? 0 : Math.PI);
    const v = new Vehicle(pick(rng, CAR_MODELS), x, y, angle, { driver: 'traffic' });
    v.speed = v.model.speed * (0.35 + rng() * 0.25);
    v.ai = { vertical, cruise: v.speed, waitT: 0 };
    cars.push(v);
  }
  return cars;
}

export function updateTrafficCar(v, dt, city, playerCar) {
  if (!v.ai) return;
  // follow its road, slow for the car ahead / the player, stop at random pauses
  const aheadX = v.x + Math.cos(v.angle) * 70, aheadY = v.y + Math.sin(v.angle) * 70;
  let blocked = false;
  if (playerCar && dist(aheadX, aheadY, playerCar.x, playerCar.y) < 34) blocked = true;
  if (v.ai.waitT > 0) { v.ai.waitT -= dt; blocked = true; }
  else if (Math.random() < dt * 0.01) v.ai.waitT = 1 + Math.random() * 2;
  const target = blocked ? 0 : v.ai.cruise;
  v.speed += clamp(target - v.speed, -260 * dt, 200 * dt);
  // keep on the road: gently steer back to the road line
  const onRoad = isOnRoad(city, v.x, v.y);
  if (!onRoad) {
    const p = nearestRoadPoint(city, v.x, v.y);
    if (p) v.angle += angleDiff(v.angle, Math.atan2(p.y - v.y, p.x - v.x)) * dt * 1.2;
  }
  v.x += Math.cos(v.angle) * v.speed * dt;
  v.y += Math.sin(v.angle) * v.speed * dt;
  v.x = clamp(v.x, 30, WORLD_W - 30); v.y = clamp(v.y, 30, WORLD_H - 30);
  if (collideBuildings(city, v.x, v.y, 16)) { v.angle += Math.PI / 2; v.speed *= 0.4; }
}

export function spawnParkedCars(city, rng, count = 26) {
  const cars = [];
  for (let i = 0; i < count; i++) {
    const vertical = rng() < 0.5;
    const road = vertical ? pick(rng, city.roadsV) : pick(rng, city.roadsH);
    const along = 120 + rng() * (vertical ? WORLD_H - 240 : WORLD_W - 240);
    const x = vertical ? road + 26 : along;
    const y = vertical ? along : road + 26;
    if (collideBuildings(city, x, y, 20)) continue;
    const angle = vertical ? Math.PI / 2 : 0;
    cars.push(new Vehicle(pick(rng, CAR_MODELS), x, y, angle, { driver: null }));
  }
  return cars;
}

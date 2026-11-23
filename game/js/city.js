// city.js — Solmar Bay: a seeded grid city on the Coral Coast.
// World is 3400 x 2600. Roads every 340px, blocks hold buildings, parks, beach on the west edge.
import { mulberry32, pick } from './utils.js';

export const WORLD_W = 3400;
export const WORLD_H = 2600;

export const DISTRICTS = [
  { name: 'Old Marina', x: 0, y: 0, w: 700, h: 900, color: '#e8b04b' },
  { name: 'Downtown Solmar', x: 700, y: 0, w: 1300, h: 1100, color: '#7fb3e8' },
  { name: 'Palm Heights', x: 2000, y: 0, w: 1400, h: 900, color: '#a8d8a0' },
  { name: 'Little Havana Row', x: 700, y: 1100, w: 1100, h: 800, color: '#f0a0a0' },
  { name: 'Sunset Industrial', x: 1800, y: 1100, w: 1600, h: 900, color: '#c9c9c9' },
  { name: 'Coral Beach', x: 0, y: 900, w: 700, h: 1700, color: '#ffe9a8' },
  { name: 'South Docks', x: 700, y: 1900, w: 2700, h: 700, color: '#b0a8d8' },
];

const BUILDING_NAMES = ['Solmar Tower', 'Coral Plaza', 'Bayview Hotel', 'Palm Court', 'Marina Offices', 'Sunset Mall', 'Harbor Court', 'Vista Apartments', 'Trade Center', 'Lido Residences', 'Cactus Motel', 'Pier 9 Warehouse', 'Neon Arcade', 'Tidewater Bank', 'Mango Market', 'The Gull Hotel'];

export function buildCity(seed = 20261123) {
  const rng = mulberry32(seed);
  const roadsV = []; const roadsH = [];
  for (let x = 340; x < WORLD_W; x += 340) roadsV.push(x);
  for (let y = 300; y < WORLD_H; y += 300) roadsH.push(y);
  const buildings = [];
  const parks = [];
  const trees = [];
  // Beach strip on the west edge (x < 220) and a park band
  for (let y = 0; y < WORLD_H; y += 90) trees.push({ x: 60 + rng() * 120, y, palm: true });
  for (let bx = 0; bx < 9; bx++) {
    for (let by = 0; by < 8; by++) {
      const x0 = 340 * bx + 340 + 26, y0 = 300 * by + 300 + 24;
      const w = 340 - 52, h = 300 - 48;
      if (x0 > WORLD_W - 120 || y0 > WORLD_H - 120) continue;
      const roll = rng();
      if (roll < 0.14) { parks.push({ x: x0, y: y0, w, h, name: pick(rng, ['Palm Park', 'Coral Gardens', 'Sunset Green']) }); continue; }
      const n = 1 + Math.floor(rng() * 2);
      for (let i = 0; i < n; i++) {
        const bw = 70 + rng() * 90, bh = 60 + rng() * 80;
        const px = x0 + (i === 0 ? 8 : w / 2 + 4) + rng() * 10;
        const py = y0 + 8 + rng() * (h - bh - 16);
        buildings.push({
          x: px, y: py, w: bw, h: bh,
          height: 1 + Math.floor(rng() * (bx < 3 && by < 3 ? 5 : 3)),
          color: pick(rng, ['#d8a06a', '#c98f7a', '#a8b8c8', '#e0c090', '#b8a8c8', '#90b8a0', '#d8d0c0']),
          roof: pick(rng, ['#7a5a40', '#5a6a7a', '#8a4a3a', '#4a6a5a']),
          name: pick(rng, BUILDING_NAMES),
        });
      }
      for (let t = 0; t < 3; t++) trees.push({ x: x0 + rng() * w, y: y0 + rng() * h, palm: rng() < 0.7 });
    }
  }
  // Landmarks (mission / save spots) placed on roads so they are reachable
  const landmarks = [
    { id: 'home', name: "Mara's Apartment", x: 520, y: 430, kind: 'home' },
    { id: 'garage', name: "Dante's Garage", x: 1560, y: 1330, kind: 'garage' },
    { id: 'diner', name: 'Sunset Diner', x: 900, y: 760, kind: 'diner' },
    { id: 'pier', name: 'Old Pier', x: 180, y: 1500, kind: 'pier' },
    { id: 'mall', name: 'Sunset Mall', x: 2230, y: 460, kind: 'mall' },
    { id: 'docks', name: 'South Docks', x: 2900, y: 2150, kind: 'docks' },
    { id: 'hospital', name: 'Coral General Hospital', x: 1240, y: 1960, kind: 'hospital' },
    { id: 'police', name: 'Solmar PD HQ', x: 1900, y: 760, kind: 'police' },
    { id: 'casino', name: 'Neon Palms Casino', x: 2580, y: 1330, kind: 'casino' },
    { id: 'beach', name: 'Coral Beach', x: 200, y: 2100, kind: 'beach' },
  ];
  return { roadsV, roadsH, buildings, parks, trees, landmarks, seed };
}

export function isOnRoad(city, x, y) {
  const ROAD_HALF = 34;
  for (const rx of city.roadsV) if (Math.abs(x - rx) < ROAD_HALF) return true;
  for (const ry of city.roadsH) if (Math.abs(y - ry) < ROAD_HALF) return true;
  // beach strip is walkable/drivable sand road
  if (x < 230) return true;
  return false;
}
export function nearestRoadPoint(city, x, y) {
  let best = null; let bd = 1e9;
  for (const rx of city.roadsV) for (const ry of city.roadsH) {
    const d = Math.hypot(rx - x, ry - y);
    if (d < bd) { bd = d; best = { x: rx, y: ry }; }
  }
  return best;
}
export function collideBuildings(city, x, y, r) {
  for (const b of city.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
  }
  return null;
}
export function districtAt(x, y) {
  for (const d of DISTRICTS) if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d.name;
  return 'Solmar Bay';
}

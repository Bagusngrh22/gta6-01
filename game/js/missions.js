// missions.js — story missions and side jobs for Mara Quinn & Dante Cole.
// Six story missions + repeatable side jobs (taxi, delivery, street race).
import { dist } from './utils.js';

export const STORY = [
  { id: 'm1', title: '1 — First Wheels', giver: 'Dante Cole', reward: 300,
    brief: 'Dante needs wheels. Steal any car and bring it to Dante\'s Garage.',
    hint: 'Walk up to a parked car and press E to steal it, then drive to the yellow marker at the garage.' },
  { id: 'm2', title: '2 — Diner Drop', giver: 'Mara Quinn', reward: 450,
    brief: 'Pick up the package at the Sunset Diner and deliver it to the Old Pier. No cops.',
    hint: 'Reach the diner marker, then drive to the pier. Keep your wanted level low.' },
  { id: 'm3', title: '3 — Mall Run', giver: 'Dante Cole', reward: 600,
    brief: 'A rival crew is watching the Sunset Mall. Grab the cash bag and lose any heat.',
    hint: 'Reach the mall, grab the bag, then stay out of sight until your wanted level drops to 0.' },
  { id: 'm4', title: '4 — Dockside Deal', giver: 'Mara Quinn', reward: 800,
    brief: 'Meet the buyer at the South Docks. Armed guards are on site — come ready.',
    hint: 'You start this mission with a pistol and 24 bullets. Reach the docks and clear the guards.' },
  { id: 'm5', title: '5 — Casino Score', giver: 'Dante Cole', reward: 1200,
    brief: 'Hit the Neon Palms Casino vault, grab the loot and escape to the beach.',
    hint: 'Reach the casino, grab the loot, then escape to Coral Beach with the police on your tail.' },
  { id: 'm6', title: '6 — King of Solmar Bay', giver: 'Mara Quinn', reward: 2000,
    brief: 'The final job: steal the Comet GT from Solmar PD HQ and deliver it to the garage.',
    hint: 'Steal the Comet GT at PD HQ, survive 3 wanted stars, and bring it home to the garage.' },
];

export const SIDE_JOBS = [
  { id: 'taxi', title: 'Taxi Fare', reward: 150, brief: 'A pedestrian needs a ride across town. Pick them up in a car.' },
  { id: 'delivery', title: 'Pizza Delivery', reward: 120, brief: 'Deliver hot food before the timer runs out.' },
  { id: 'race', title: 'Street Race', reward: 400, brief: 'Beat the checkpoint timer around Downtown Solmar.' },
];

export class MissionManager {
  constructor(state) { this.state = state; this.active = null; this.stage = 0; this.timer = 0; this.marker = null; this.guards = []; }
  get storyIndex() { return this.state.missionsDone; }
  currentStory() { return STORY[Math.min(this.storyIndex, STORY.length - 1)]; }
  startStory() {
    const m = this.currentStory();
    if (this.state.missionsDone >= STORY.length) return false;
    this.active = { ...m, kind: 'story' }; this.stage = 0; this.timer = 0;
    this.setMarkerForStage();
    if (m.id === 'm4') { this.state.player.weapon = 'pistol'; this.state.player.ammo = 24; }
    if (m.id === 'm6') { this.state.addHeat(2); }
    this.state.feed(`Mission started: ${m.title}`);
    this.state.toast(`${m.title} — ${m.giver}`);
    return true;
  }
  startSide(id) {
    const job = SIDE_JOBS.find(j => j.id === id);
    if (!job || this.active) return false;
    this.active = { ...job, kind: 'side' }; this.stage = 0; this.timer = id === 'delivery' ? 90 : 0;
    this.setMarkerForStage();
    this.state.feed(`Side job: ${job.title}`);
    return true;
  }
  landmark(id) { return this.state.city.landmarks.find(l => l.id === id); }
  setMarkerForStage() {
    const m = this.active; if (!m) { this.marker = null; return; }
    const L = (id) => this.landmark(id);
    const map = {
      m1: ['garage'], m2: ['diner', 'pier'], m3: ['mall', null], m4: ['docks'], m5: ['casino', 'beach'], m6: ['police', 'garage'],
      taxi: ['diner'], delivery: ['mall'], race: ['police'],
    };
    const stops = map[m.id] || ['diner'];
    const stopId = stops[Math.min(this.stage, stops.length - 1)];
    const lm = stopId ? L(stopId) : null;
    this.marker = lm ? { x: lm.x, y: lm.y, name: lm.name } : null;
  }
  arrive() {
    const m = this.active; if (!m) return;
    if (m.id === 'm1' && this.stage === 0) { if (this.state.playerCar) this.complete('Car delivered to the garage.'); }
    else if (m.id === 'm2') {
      if (this.stage === 0) { this.stage = 1; this.setMarkerForStage(); this.state.feed('Package collected — now to the Old Pier.'); }
      else this.complete('Package delivered. Mara is impressed.');
    } else if (m.id === 'm3') {
      if (this.stage === 0) { this.stage = 1; this.setMarkerForStage(); this.state.feed('Cash bag grabbed! Lose the cops — wanted level must hit 0.'); }
      else this.complete('Clean getaway. The crew eats tonight.');
    } else if (m.id === 'm4') {
      if (this.guards.every(g => g.hp <= 0)) this.complete('Deal done. The docks are yours.');
      else this.state.feed('Guards remain — clear them first.');
    } else if (m.id === 'm5') {
      if (this.stage === 0) { this.stage = 1; this.setMarkerForStage(); this.state.feed('Loot grabbed! Escape to Coral Beach!'); }
      else this.complete('Casino score complete. Legends are made of this.');
    } else if (m.id === 'm6') {
      if (this.stage === 0) { this.stage = 1; this.setMarkerForStage(); this.state.feed('Comet GT stolen! Bring it to the garage!'); }
      else this.complete('King of Solmar Bay. The city is yours.');
    } else if (m.kind === 'side') this.complete('Side job complete.');
  }
  complete(text) {
    const m = this.active;
    this.state.cash += m.reward;
    this.state.audio.cash(); this.state.audio.missionDone();
    this.state.feed(`✅ ${m.title} complete — +$${m.reward}`);
    this.state.toast(text + `  +$${m.reward}`);
    if (m.kind === 'story') this.state.missionsDone++;
    this.active = null; this.stage = 0; this.marker = null; this.guards = [];
    this.state.saveGame();
  }
  fail(text) {
    this.state.feed(`❌ Mission failed: ${text}`);
    this.state.toast('Mission failed — ' + text);
    this.active = null; this.stage = 0; this.marker = null; this.guards = [];
  }
  update(dt) {
    if (!this.active) return;
    const m = this.active;
    if (m.id === 'delivery') { this.timer -= dt; if (this.timer <= 0) this.fail('Delivery went cold.'); }
    if (m.id === 'm3' && this.stage === 1 && this.state.wanted === 0) this.complete('Clean getaway. The crew eats tonight.');
    if (m.id === 'm5' && this.stage === 0 && this.marker) {
      // grabbing loot happens on arrival
    }
    if (this.marker) {
      const px = this.state.playerCar ? this.state.playerCar.x : this.state.player.x;
      const py = this.state.playerCar ? this.state.playerCar.y : this.state.player.y;
      const d = dist(px, py, this.marker.x, this.marker.y);
      this.state.objectiveDist = Math.round(d) + ' m to ' + this.marker.name;
      if (d < 70) this.arrive();
    }
  }
}

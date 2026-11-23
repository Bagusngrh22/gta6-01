# Solmar Bay — Open World Crime Game

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/Bagusngrh22/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/Bagusngrh22/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

An original open-world crime game in the spirit of GTA 6, built for the
[make.fun GTA 6 bounty](https://make.fun/bounty/gta6-01). Explore the sun-soaked
city of **Solmar Bay** on foot and by car, steal vehicles, outrun the Solmar PD,
and climb from street hustler to King of Solmar Bay.

## The game

You are **Mara Quinn**, new in town with **Dante Cole** as your fixer. The city
is yours to explore: seven districts from Old Marina to Coral Beach, traffic,
pedestrians, a day/night cycle, and a wanted system that answers back.

- **Open world** — a 3400×2600 city: Downtown Solmar, Palm Heights, Little Havana Row, Sunset Industrial, South Docks, Coral Beach and Old Marina
- **Driving** — 8 original cars to steal and drive (Comet GT, Sunrunner, Neon Coupe…), with traffic AI, crashes and wrecked-car smoke
- **Wanted level** — 5 stars; Solmar PD interceptors chase, ram and bust you
- **Missions & story** — 6 story missions (First Wheels, Diner Drop, Mall Run, Dockside Deal, Casino Score, King of Solmar Bay) plus taxi, delivery and street-race side jobs
- **Combat** — fists and pistol with mouse aim, armed guards, health/ammo/cash pickups
- **HUD** — wanted stars, cash, health, clock, speed, live minimap, mission tracker
- **Polish** — start screen, pause menu, mission list, 3 synthesized radio stations, engine/siren/gunshot SFX, auto-save (localStorage) with Continue

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move / drive |
| Mouse + click | Aim / shoot |
| E | Enter / steal car, exit car |
| F | Punch |
| Shift | Sprint |
| R | Change radio station |
| H | Horn |
| M | Missions |
| P | Pause |

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

`game/` is plain static files — no build step, no network request. Every script,
style, sound (synthesized with WebAudio) and image is local.

## Screenshots

The cover (`screenshots/1-cover-chase.jpg`) shows a 3-star police chase in the
Comet GT during the Casino Score mission; the others show the city on foot, a
mission in progress, and downtown driving.

## Originality

Everything in Solmar Bay is original: the city, districts, characters, vehicles,
story, art and music were made for this game. Nothing is taken from Rockstar's
Grand Theft Auto or any other commercial game.

## License

MIT — see [LICENSE](LICENSE).

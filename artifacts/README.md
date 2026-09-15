# Design samples (published Artifacts)

Five self-contained pages, one per sales view, each a different visual treatment of the same data. Regenerate the bundle with:

```bash
npx tsx scripts/export-artifacts.ts
npx esbuild src/lib/browser.ts --bundle --format=iife --minify --outfile=artifacts/hrt-lib.js --target=es2020
```

| Page | Treatment | Published |
|---|---|---|
| `globe.html` | Situation room: globe + wire replay | https://claude.ai/code/artifact/2f634dbd-0cf3-4f1e-98b1-677da224c2ff |
| `dossier.html` | Account dossier: gauge, why-the-score bars, stack map, say-this | https://claude.ai/code/artifact/0c1a82dd-4ef4-43bf-82f0-6da331873b20 |
| `campaign.html` | Campaign funnel + sequence board + CSV | https://claude.ai/code/artifact/b60effd1-36d2-45a8-b947-1891eb1a0324 |
| `mekko.html` | Stack Marimekko: vendor share by sector | https://claude.ai/code/artifact/e5c25d4f-7e45-4a58-b335-6f2ffa17ccfe |
| `stream.html` | Trigger stream: weekly stacked area + wire | https://claude.ai/code/artifact/1469375c-2007-4018-b829-9624691a5af7 |

| `desk.html` | **Sales Desk (plain direction)**: Today / Lists / Settings + account brief, white paper, Archivo + Source Sans 3 | https://claude.ai/code/artifact/821efd0c-b686-4332-8dde-6d58267a26c3 |
| `desk2.html` | **Desk (the midpoint)**: feed + account brief + book on one screen, graphite, Hanken Grotesk + Plex Mono for numbers, keyboard-driven | https://claude.ai/code/artifact/79cf8278-3e09-448a-976e-e325733ac499 |
| `home-a.html` | **Situations home, option A (graphite)**: globe + situation tiles + list with proof + CSV | https://claude.ai/code/artifact/08dca69c-47c8-497e-9270-7838e74662c3 |
| `home-b.html` | **Situations home, option B (paper)**: same on a light ground | https://claude.ai/code/artifact/0939c494-d12a-4808-8562-0a19848ba299 |
| `room.html` | **Situation Room (current direction)**: dark, night globe with coloured points + arcs, wire replay on the left, tickers top and bottom, situation tiles + lists + story on the right | https://claude.ai/code/artifact/6801b515-0a5b-40a9-8f15-82b80d6c00d5 |

Shared files: `data.js` (exported snapshot), `hrt-lib.js` (scoring, why-now, battlecard, playbook), `hrt-ui.js` (chrome, profile switcher, helpers), `earth-night.jpg` (globe texture).

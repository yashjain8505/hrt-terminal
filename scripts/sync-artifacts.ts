/** Build the publishable artifact copy of the room from the app's files + a data snapshot. */
import fs from "node:fs";
import path from "node:path";
const pub = path.join(process.cwd(), "public", "room"), out = path.join(process.cwd(), "artifacts");
fs.mkdirSync(out, { recursive: true });
for (const f of ["room.js", "hrt-lib.js", "earth-night.jpg", "night-sky.png"]) fs.copyFileSync(path.join(pub, f), path.join(out, f));
let html = fs.readFileSync(path.join(pub, "index.html"), "utf8");
const v = Date.now();
html = html.replace('<script>window.HRT_ASSET_BASE="/room/"</script><script src="/room/hrt-lib.js"></script>', `<script src="hrt-lib.js?v=${v}"></script><script src="data.js?v=${v}"></script>`)
  .replace('<script src="/room/globe.gl.min.js"></script>', '<script src="https://cdn.jsdelivr.net/npm/globe.gl@2.46.2/dist/globe.gl.min.js"></script>')
  .replace('<script src="/room/room.js"></script>', `<script src="room.js?v=${v}"></script>`)
  .replace("<title>HRT · HR buying situations</title>", "<title>HRT Situation Room</title>");
fs.writeFileSync(path.join(out, "room.html"), html);
console.log("artifacts synced from public/room");

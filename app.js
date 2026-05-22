import { VisualizerManager } from "./visualizers.js";

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d", { alpha: false });
const textInput = document.getElementById("overlay-text");
const btnApply = document.getElementById("apply-text");

let viz = null;
let overlayText = "";

// Inițializare Audio sigură
function ensureAudio() {
  if (viz) return;
  const ac = new (window.AudioContext || window.webkitAudioContext)();
  const analyser = ac.createAnalyser();
  analyser.connect(ac.destination);
  viz = new VisualizerManager(ctx, analyser, { mode: "bars", intensity: 1.5, color: "#ffffff" });
}

// Control Text - se actualizează când apeși butonul
btnApply.addEventListener("click", () => {
  overlayText = textInput.value.trim();
});

// Bucla principală (Loop) - optimizată
function loop() {
  // 1. Curățăm canvas-ul pentru a evita înghețarea imaginii
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 2. Randăm vizualizarea
  if (viz) viz.render(canvas.width, canvas.height, 0.016);

  // 3. Randăm textul (dacă există)
  if (overlayText) {
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 48px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(overlayText, canvas.width / 2, canvas.height * 0.85);
  }

  requestAnimationFrame(loop);
}

// Pornire
ensureAudio();
loop();

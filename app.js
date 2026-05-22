import { VisualizerManager } from "./visualizers.js"; // Asigură-te că există acest fișier!

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d", { alpha: false });
let dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

// Funcția de resize pentru a preveni deformarea imaginii
function resize() {
  const { innerWidth: w, innerHeight: h } = window;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.width = w + "px";
  canvas.style.height = h + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener("resize", resize);
resize();

// Variabile globale
let viz, ac, analyser, gainA;
let current = { index: -1, audio: null };
const clips = [];
let playing = false, lastT = performance.now();
let overlayText = "";

function ensureAudio() {
  if (ac) return;
  ac = new (window.AudioContext || window.webkitAudioContext)();
  analyser = ac.createAnalyser();
  analyser.fftSize = 2048;
  gainA = ac.createGain();
  gainA.connect(analyser);
  analyser.connect(ac.destination);
  
  viz = new VisualizerManager(ctx, analyser, {
    mode: "bars",
    intensity: 1.5,
    color: "#ffffff",
    background: { type: "solid", color1: "#000000" }
  });
}

// Control Text
document.getElementById("apply-text").addEventListener("click", () => {
  overlayText = document.getElementById("overlay-text").value.trim();
});

// Loop-ul de randare (Fără erori)
function loop(t) {
  const dt = Math.min(0.05, (t - lastT) / 1000);
  lastT = t;
  const w = canvas.width / dpr, h = canvas.height / dpr;
  
  // Desenare
  if (viz) {
    viz.render(w, h, dt);
  } else {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
  }

  // Desenare Text
  if (overlayText) {
    ctx.save();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 40px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(overlayText, w / 2, h * 0.9);
    ctx.restore();
  }
  
  requestAnimationFrame(loop);
}
ensureAudio();
requestAnimationFrame(loop);

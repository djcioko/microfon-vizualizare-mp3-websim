import { VisualizerManager } from "./visualizers.js";

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d", { alpha: false });
let viz = null;
let overlayText = "";

// Inițializare sigură
function ensureViz() {
    if (viz) return;
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = ac.createAnalyser();
    analyser.connect(ac.destination);
    viz = new VisualizerManager(ctx, analyser, { mode: "bars", intensity: 1.5, color: "#ffffff" });
}

// Control Text Overlay (fără să blocheze bucla)
document.getElementById("apply-text").addEventListener("click", () => {
    overlayText = document.getElementById("overlay-text").value.trim();
});

// Loop-ul principal
function loop() {
    // Curățăm canvas-ul pentru a evita ecranul alb/înghețat
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (viz) {
        viz.render(canvas.width, canvas.height, 0.016);
    }

    // Desenare text simplificată
    if (overlayText) {
        ctx.fillStyle = "white";
        ctx.font = "bold 50px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(overlayText, canvas.width / 2, canvas.height * 0.8);
    }

    requestAnimationFrame(loop);
}
ensureViz();
loop();

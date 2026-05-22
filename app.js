import { VisualizerManager } from "./visualizers.js";

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d", { alpha: false });
let viz = null;
let overlayText = "";

// 1. Inițializare sigură (apelată o singură dată)
function ensureViz() {
    if (viz) return;
    try {
        const ac = new (window.AudioContext || window.webkitAudioContext)();
        const analyser = ac.createAnalyser();
        analyser.connect(ac.destination);
        viz = new VisualizerManager(ctx, analyser, { mode: "bars", intensity: 1.5, color: "#ffffff" });
    } catch (e) {
        console.error("Eroare inițializare audio:", e);
    }
}

// 2. Control text (simplificat)
const textInput = document.getElementById("overlay-text");
const btnApply = document.getElementById("apply-text");

if (btnApply) {
    btnApply.addEventListener("click", () => {
        overlayText = textInput ? textInput.value : "";
    });
}

// 3. Bucla principală (stabilă)
function loop() {
    // Desenăm fundalul negru pentru a evita orice "flicker"
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Randăm vizualizatorul
    if (viz) {
        viz.render(canvas.width, canvas.height, 0.016);
    }

    // Desenăm textul (dacă există) într-un mod sigur
    if (overlayText && overlayText.length > 0) {
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 40px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(overlayText, canvas.width / 2, canvas.height * 0.9);
    }

    requestAnimationFrame(loop);
}

// Start
ensureViz();
loop();

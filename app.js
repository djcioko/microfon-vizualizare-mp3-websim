const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d", { alpha: false });
let ac, analyser, viz, playing = false, overlayText = "";

// Inițializare Audio
function ensureAudio() {
    if (ac) return;
    ac = new (window.AudioContext || window.webkitAudioContext)();
    analyser = ac.createAnalyser();
    analyser.connect(ac.destination);
}

// Logica Microfon
async function populateAudioDevices() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const sel = document.getElementById("audio-device");
    devices.filter(d => d.kind === "audioinput").forEach(d => {
        const opt = document.createElement("option");
        opt.value = d.deviceId; opt.textContent = d.label || "Mic";
        sel.appendChild(opt);
    });
}
populateAudioDevices();

// Buton Text
document.getElementById("apply-text").addEventListener("click", () => {
    overlayText = document.getElementById("overlay-text").value;
});

// Bucla de desenare
function loop() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (analyser) {
        const buffer = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(buffer);
        // Vizualizare bare simplă
        ctx.fillStyle = "#ffffff";
        for (let i = 0; i < 64; i++) {
            ctx.fillRect(i * (canvas.width/64), canvas.height - buffer[i]*1.5, 10, buffer[i]*1.5);
        }
    }

    if (overlayText) {
        ctx.fillStyle = "#fff";
        ctx.font = "bold 50px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(overlayText, canvas.width / 2, canvas.height * 0.9);
    }
    requestAnimationFrame(loop);
}

ensureAudio();
loop();

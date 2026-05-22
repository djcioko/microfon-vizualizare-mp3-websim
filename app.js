import { VisualizerManager } from "./visualizers.js";

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d", { alpha: false });
const audioDeviceSel = document.getElementById("audio-device");
const btnMicListen = document.getElementById("mic-listen");
const btnApplyText = document.getElementById("apply-text");
const overlayTextInput = document.getElementById("overlay-text");

let viz, ac, analyser, micStream, micSource;
let overlayText = "";
let playing = false, lastT = performance.now();

function ensureAudio() {
  if (ac) return;
  ac = new (window.AudioContext || window.webkitAudioContext)();
  analyser = ac.createAnalyser();
  analyser.connect(ac.destination);
  viz = new VisualizerManager(ctx, analyser, { mode: "bars", intensity: 1.5, color: "#ffffff" });
}

// Microfon Logic
async function populateAudioDevices() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  devices.filter(d => d.kind === "audioinput").forEach(d => {
    const opt = document.createElement("option");
    opt.value = d.deviceId; opt.textContent = d.label || "Microfon";
    audioDeviceSel.appendChild(opt);
  });
}
populateAudioDevices();

btnMicListen.addEventListener("click", async () => {
  ensureAudio();
  if (ac.state === "suspended") await ac.resume();
  micStream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: audioDeviceSel.value ? { exact: audioDeviceSel.value } : undefined } });
  micSource = ac.createMediaStreamSource(micStream);
  micSource.connect(analyser);
  playing = true;
});

btnApplyText.addEventListener("click", () => { overlayText = overlayTextInput.value; });

function loop(t) {
  const dt = (t - lastT) / 1000; lastT = t;
  ctx.fillStyle = "#000"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (viz) viz.render(canvas.width, canvas.height, dt);
  if (overlayText) {
    ctx.fillStyle = "#fff"; ctx.font = "40px sans-serif";
    ctx.textAlign = "center"; ctx.fillText(overlayText, canvas.width / 2, canvas.height * 0.9);
  }
  requestAnimationFrame(loop);
}
ensureAudio();
loop(performance.now());

const $ = id => document.getElementById(id);
const canvas = $("canvas");
const ctx = canvas.getContext("2d");
const playBtn = $("playpause");
const audioDeviceSel = $("audio-device");
const micListenBtn = $("mic-listen");
const trackDisplay = $("current-track-display");
const toast = $("status-toast");
const hiddenAudio = $("hidden-audio");

let audioCtx, analyser, sourceNode;
let clips = [], index = 0, playing = false;
let micStream, micSource, micOn = false;
let overlayText = "";
let centerMedia = null, centerOn = true;
let pngOn = false, scrollOn = false, suggestionOn = false, suggestionImg = null;
let cameraOn = false, cameraStream = null;
let videoFileOn = false;
let recorder = null, chunks = [];

function toastMsg(msg) {
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 1600);
}

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(innerWidth * dpr);
  canvas.height = Math.floor(innerHeight * dpr);
  canvas.style.width = innerWidth + "px";
  canvas.style.height = innerHeight + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
resize();
window.addEventListener("resize", resize);

async function ensureAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.8;
    analyser.connect(audioCtx.destination);
  }
  if (audioCtx.state === "suspended") await audioCtx.resume();
}

async function refreshMicList() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(t => t.stop());
    const devices = await navigator.mediaDevices.enumerateDevices();
    const mics = devices.filter(d => d.kind === "audioinput");
    const current = audioDeviceSel.value;
    audioDeviceSel.innerHTML = `<option value="">🎤 Default Mic</option>`;
    mics.forEach((d, i) => {
      const opt = document.createElement("option");
      opt.value = d.deviceId;
      opt.textContent = d.label || `Microfon ${i + 1}`;
      audioDeviceSel.appendChild(opt);
    });
    if (current) audioDeviceSel.value = current;
    toastMsg(mics.length ? `${mics.length} microfoane` : "Niciun microfon");
  } catch (e) {
    toastMsg("Permisiune microfon refuzată");
  }
}

// Files
$("file-input").addEventListener("change", e => {
  [...e.target.files].forEach(file => {
    const url = URL.createObjectURL(file);
    clips.push({ name: file.name, url, type: file.type.startsWith("video") ? "video" : "audio" });
  });
  renderList();
  e.target.value = "";
  if (clips.length && !playing) { index = clips.length - 1; }
});

function renderList() {
  const ul = $("clip-list");
  ul.innerHTML = "";
  clips.forEach((c, i) => {
    const li = document.createElement("li");
    li.textContent = `${i + 1}. ${c.name}`;
    if (i === index) li.classList.add("active");
    li.onclick = () => { index = i; playCurrent(); };
    ul.appendChild(li);
  });
}

async function playCurrent() {
  await ensureAudio();
  const clip = clips[index];
  if (!clip) return toastMsg("Adaugă un clip");
  hiddenAudio.pause();
  hiddenAudio.src = clip.url;
  if (!hiddenAudio._node) hiddenAudio._node = audioCtx.createMediaElementSource(hiddenAudio);
  if (sourceNode) sourceNode.disconnect();
  sourceNode = hiddenAudio._node;
  sourceNode.connect(analyser);
  await hiddenAudio.play();
  playing = true;
  playBtn.textContent = "Pause";
  trackDisplay.textContent = "Sursă: " + clip.name;
  renderList();
}

playBtn.addEventListener("click", () => {
  if (playing) {
    hiddenAudio.pause();
    playing = false;
    playBtn.textContent = "Play";
  } else playCurrent();
});

$("stop").addEventListener("click", () => {
  hiddenAudio.pause();
  hiddenAudio.currentTime = 0;
  playing = false;
  playBtn.textContent = "Play";
});

$("prev").addEventListener("click", () => {
  if (!clips.length) return;
  index = (index - 1 + clips.length) % clips.length;
  playCurrent();
});
$("next").addEventListener("click", () => {
  if (!clips.length) return;
  index = (index + 1) % clips.length;
  playCurrent();
});

// Mic
micListenBtn.addEventListener("click", async () => {
  await ensureAudio();
  if (micOn) {
    micSource?.disconnect();
    micStream?.getTracks().forEach(t => t.stop());
    micOn = false;
    micListenBtn.classList.remove("active");
    micListenBtn.textContent = "🎤 Listen Mic";
    trackDisplay.textContent = "Sursă: Nicio piesă";
    return;
  }
  await refreshMicList();
  try {
    const constraints = { audio: audioDeviceSel.value ? { deviceId: { exact: audioDeviceSel.value } } : true };
    micStream = await navigator.mediaDevices.getUserMedia(constraints);
    micSource = audioCtx.createMediaStreamSource(micStream);
    micSource.connect(analyser);
    micOn = true;
    micListenBtn.classList.add("active");
    micListenBtn.textContent = "🎤 Mic ON";
    trackDisplay.textContent = "Sursă: Microfon";
  } catch (e) {
    toastMsg("Microfon indisponibil");
  }
});

// Overlays simple
$("image-input").addEventListener("change", e => {
  const f = e.target.files[0];
  if (!f) return;
  const img = new Image();
  img.onload = () => { centerMedia = img; centerOn = true; $("toggle-center").classList.add("active"); toastMsg("Center media ON"); };
  img.src = URL.createObjectURL(f);
  e.target.value = "";
});

$("png-input").addEventListener("change", e => {
  const f = e.target.files[0];
  if (!f) return;
  $("png-image").onload = () => { pngOn = true; $("toggle-png").classList.add("active"); toastMsg("PNG ON"); };
  $("png-image").src = URL.createObjectURL(f);
  e.target.value = "";
});

$("scroll-image").addEventListener("change", e => {
  const f = e.target.files[0];
  if (!f) return;
  $("scroll-img").onload = () => { scrollOn = true; $("toggle-scroll").classList.add("active"); toastMsg("Scroll ON"); };
  $("scroll-img").src = URL.createObjectURL(f);
  e.target.value = "";
});

$("add-suggestion").addEventListener("click", () => {
  const img = new Image();
  img.onload = () => { suggestionImg = img; suggestionOn = true; $("toggle-suggest").classList.add("active"); toastMsg("Suggestion ON"); };
  img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><circle cx="200" cy="200" r="150" fill="#4ef05d"/><text x="200" y="220" text-anchor="middle" font-size="60" fill="#000">VIZ</text></svg>`);
});

$("apply-text").addEventListener("click", () => {
  overlayText = $("overlay-text").value.trim();
  if (overlayText) toastMsg("Text adăugat");
});

// Toggles
["png","video","camera","center","scroll","suggest"].forEach(name => {
  $(`toggle-${name}`).addEventListener("click", () => {
    const key = name === "suggest" ? "suggestionOn" : name === "png" ? "pngOn" : name === "scroll" ? "scrollOn" : name === "center" ? "centerOn" : name === "video" ? "videoFileOn" : "cameraOn";
    if (name === "camera") {
      if (cameraOn) {
        cameraStream?.getTracks().forEach(t => t.stop());
        cameraOn = false;
      } else {
        navigator.mediaDevices.getUserMedia({ video: true }).then(s => {
          cameraStream = s;
          $("camera-video").srcObject = s;
          cameraOn = true;
          toastMsg("Camera ON");
        }).catch(() => toastMsg("Camera indisponibilă"));
      }
    } else {
      window[key] = !window[key];
    }
    $(`toggle-${name}`).classList.toggle("active");
  });
});

// Fullscreen + Hide UI
$("fullscreen-btn").addEventListener("click", () => {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => toastMsg("Fullscreen nu e permis"));
  else document.exitFullscreen();
});

$("toggle-ui").addEventListener("click", () => {
  document.body.classList.toggle("ui-hidden");
  $("toggle-ui").textContent = document.body.classList.contains("ui-hidden") ? "👁 Arată comenzi" : "✕ Ascunde comenzi";
});

// Simple visualizer loop
function loop() {
  requestAnimationFrame(loop);
  const w = canvas.width / (window.devicePixelRatio || 1);
  const h = canvas.height / (window.devicePixelRatio || 1);
  ctx.fillStyle = $("bg-color1").value || "#000";
  ctx.fillRect(0, 0, w, h);

  if ((playing || micOn) && analyser) {
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
    const mode = $("mode").value;
    const color = $("viz-color").value;
    const intensity = parseFloat($("intensity").value);
    ctx.fillStyle = color;
    if (mode === "bars") {
      const barW = w / 64;
      for (let i = 0; i < 64; i++) {
        const bh = data[i] * intensity * 1.5;
        ctx.fillRect(i * barW, h - bh, barW - 2, bh);
      }
    } else if (mode === "wave") {
      analyser.getByteTimeDomainData(data);
      ctx.beginPath();
      ctx.strokeStyle = color;
      for (let i = 0; i < data.length; i++) {
        const x = (i / data.length) * w;
        const y = (data[i] / 128) * h / 2;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  if (overlayText) {
    ctx.fillStyle = "#fff";
    ctx.font = "bold 36px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(overlayText, w / 2, h - 80);
  }
}
loop();

// Init
refreshMicList();

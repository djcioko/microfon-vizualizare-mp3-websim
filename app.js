const $ = (id) => document.getElementById(id);

const canvas = $("canvas");
const ctx = canvas.getContext("2d", { alpha: false });

const fileInput = $("file-input");
const imageInput = $("image-input");
const scrollImageInput = $("scroll-image");
const pngInput = $("png-input");
const videoFileInput = $("video-file-input");

const playBtn = $("playpause");
const prevBtn = $("prev");
const nextBtn = $("next");
const stopBtn = $("stop");
const recordBtn = $("record");
const exportBtn = $("export");
const modeSel = $("mode");
const intensityEl = $("intensity");
const colorEl = $("viz-color");
const strobeEl = $("strobe");
const bgTypeEl = $("bg-type");
const bg1El = $("bg-color1");
const bg2El = $("bg-color2");
const overlayTextEl = $("overlay-text");
const applyTextBtn = $("apply-text");
const clipList = $("clip-list");
const trackDisplay = $("current-track-display");
const audioDeviceSel = $("audio-device");
const micListenBtn = $("mic-listen");
const addSuggestionBtn = $("add-suggestion");
const toggleUiBtn = $("toggle-ui");
const fullscreenBtn = $("fullscreen-btn");
const toast = $("status-toast");

const hiddenAudio = $("hidden-audio");
const hiddenVideo = $("hidden-video");
const overlayVideo = $("overlay-video");
const cameraVideo = $("camera-video");
const centerMediaEl = $("center-media");
const pngImage = $("png-image");
const scrollImg = $("scroll-img");

const state = {
  clips: [],
  index: 0,
  playing: false,
  audioCtx: null,
  analyser: null,
  sourceNode: null,
  micStream: null,
  micSource: null,
  micOn: false,
  freq: new Uint8Array(1024),
  time: new Uint8Array(1024),
  overlayText: "",
  texts: [],
  centerMedia: null,
  centerKind: null,
  centerOn: true,
  pngOn: false,
  videoFileOn: false,
  cameraOn: false,
  cameraStream: null,
  scrollOn: false,
  scrollX: 0,
  suggestionOn: false,
  suggestionImg: null,
  recorder: null,
  chunks: [],
  recording: false,
  lastExportUrl: null,
  uiHidden: false,
  particles: [],
  ripples: [],
  t: 0,
  pngY: 0,
  pngV: 0,
  pngSquash: 1,
  pngLastBeat: 0,
};

function toastMsg(msg) {
  toast.textContent = msg;
  toast.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.classList.remove("show"), 1600);
}

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(innerWidth * dpr);
  canvas.height = Math.floor(innerHeight * dpr);
  canvas.style.width = innerWidth + "px";
  canvas.style.height = innerHeight + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener("resize", resize);
resize();

async function ensureAudio() {
  if (!state.audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    state.audioCtx = new Ctx();
    state.analyser = state.audioCtx.createAnalyser();
    state.analyser.fftSize = 2048;
    state.analyser.smoothingTimeConstant = 0.78;
    state.freq = new Uint8Array(state.analyser.frequencyBinCount);
    state.time = new Uint8Array(state.analyser.fftSize);
    const gain = state.audioCtx.createGain();
    gain.gain.value = 1;
    state.analyser.connect(gain);
    gain.connect(state.audioCtx.destination);
    state.outGain = gain;
  }
  if (state.audioCtx.state === "suspended") await state.audioCtx.resume();
}

function disconnectSource() {
  try { state.sourceNode && state.sourceNode.disconnect(); } catch {}
  state.sourceNode = null;
}

function hookMediaElement(el) {
  disconnectSource();
  if (!state.audioCtx) return;
  try {
    if (!el._mediaNode) el._mediaNode = state.audioCtx.createMediaElementSource(el);
    state.sourceNode = el._mediaNode;
    state.sourceNode.connect(state.analyser);
  } catch (e) {
    console.warn(e);
  }
}

function updateTrackLabel() {
  const clip = state.clips[state.index];
  trackDisplay.textContent = clip
    ? `Sursă: ${clip.name}${state.playing ? "  ▶" : ""}`
    : state.micOn
      ? "Sursă: Microfon"
      : "Sursă: Nicio piesă încărcată";
}

function renderClipList() {
  clipList.innerHTML = "";
  state.clips.forEach((c, i) => {
    const li = document.createElement("li");
    li.textContent = `${i + 1}. ${c.name}`;
    if (i === state.index) li.classList.add("playing");
    li.onclick = () => { state.index = i; playCurrent(); };
    clipList.appendChild(li);
  });
}

function addFiles(fileList, asClips = true) {
  [...fileList].forEach((file) => {
    const url = URL.createObjectURL(file);
    const isVideo = file.type.startsWith("video/");
    const isAudio = file.type.startsWith("audio/");
    if (asClips && (isAudio || isVideo)) {
      state.clips.push({ name: file.name, url, type: isVideo ? "video" : "audio", file });
    }
  });
  renderClipList();
  updateTrackLabel();
  if (state.clips.length && !state.playing) {
    state.index = state.clips.length - 1;
    renderClipList();
    updateTrackLabel();
  }
}

fileInput.addEventListener("change", (e) => {
  addFiles(e.target.files, true);
  e.target.value = "";
});

function setCenterFromFile(file) {
  if (!file) return;
  const url = URL.createObjectURL(file);
  if (file.type.startsWith("video/")) {
    centerMediaEl.pause?.();
    hiddenVideo.src = url;
    hiddenVideo.loop = true;
    hiddenVideo.muted = true;
    hiddenVideo.play().catch(() => {});
    state.centerMedia = hiddenVideo;
    state.centerKind = "video";
  } else {
    const img = new Image();
    img.onload = () => {
      state.centerMedia = img;
      state.centerKind = "image";
    };
    img.src = url;
    centerMediaEl.src = url;
  }
  state.centerOn = true;
  $("toggle-center").classList.add("active");
  toastMsg("Media centrală încărcată");
}

imageInput.addEventListener("change", (e) => {
  const f = e.target.files[0];
  setCenterFromFile(f);
  e.target.value = "";
});

pngInput.addEventListener("change", (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const url = URL.createObjectURL(f);
  pngImage.onload = () => {
    state.pngOn = true;
    $("toggle-png").classList.add("active");
    toastMsg("PNG overlay ON");
  };
  pngImage.src = url;
  e.target.value = "";
});

videoFileInput.addEventListener("change", (e) => {
  const f = e.target.files[0];
  if (!f) return;
  overlayVideo.src = URL.createObjectURL(f);
  overlayVideo.loop = true;
  overlayVideo.muted = true;
  overlayVideo.play().catch(() => {});
  state.videoFileOn = true;
  $("toggle-video").classList.add("active");
  toastMsg("Video overlay ON");
  e.target.value = "";
});

scrollImageInput.addEventListener("change", (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const url = URL.createObjectURL(f);
  scrollImg.onload = () => {
    state.scrollOn = true;
    $("toggle-scroll").classList.add("active");
    toastMsg("Imagine scrolling ON");
  };
  scrollImg.src = url;
  e.target.value = "";
});

addSuggestionBtn.addEventListener("click", () => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640">
    <defs>
      <radialGradient id="g" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#6ee7ff"/>
        <stop offset="55%" stop-color="#4ef05d"/>
        <stop offset="100%" stop-color="#08100c"/>
      </radialGradient>
    </defs>
    <rect width="100%" height="100%" fill="#050505"/>
    <circle cx="320" cy="320" r="240" fill="url(#g)" opacity="0.9"/>
    <text x="320" y="340" text-anchor="middle" font-size="72" fill="#fff" font-family="Noto Sans">VIZ</text>
  </svg>`;
  const img = new Image();
  img.onload = () => {
    state.suggestionImg = img;
    state.suggestionOn = true;
    $("toggle-suggest").classList.add("active");
    toastMsg("Suggestion image ON");
  };
  img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
});

$("toggle-png").addEventListener("click", () => {
  if (!pngImage.src) {
    pngInput.click();
    return;
  }
  state.pngOn = !state.pngOn;
  $("toggle-png").classList.toggle("active", state.pngOn);
});

$("toggle-video").addEventListener("click", () => {
  if (!overlayVideo.src) {
    videoFileInput.click();
    return;
  }
  state.videoFileOn = !state.videoFileOn;
  $("toggle-video").classList.toggle("active", state.videoFileOn);
  if (state.videoFileOn) overlayVideo.play().catch(() => {});
  else overlayVideo.pause();
});

$("toggle-center").addEventListener("click", () => {
  state.centerOn = !state.centerOn;
  $("toggle-center").classList.toggle("active", state.centerOn);
});

$("toggle-scroll").addEventListener("click", () => {
  if (!scrollImg.src) {
    scrollImageInput.click();
    return;
  }
  state.scrollOn = !state.scrollOn;
  $("toggle-scroll").classList.toggle("active", state.scrollOn);
});

$("toggle-suggest").addEventListener("click", () => {
  state.suggestionOn = !state.suggestionOn;
  $("toggle-suggest").classList.toggle("active", state.suggestionOn);
});

async function toggleCamera() {
  if (state.cameraOn) {
    state.cameraStream?.getTracks().forEach((t) => t.stop());
    cameraVideo.srcObject = null;
    state.cameraStream = null;
    state.cameraOn = false;
    $("toggle-camera").classList.remove("active");
    toastMsg("Cameră OFF");
    return;
  }
  try {
    state.cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false,
    });
    cameraVideo.srcObject = state.cameraStream;
    await cameraVideo.play();
    state.cameraOn = true;
    $("toggle-camera").classList.add("active");
    toastMsg("Cameră ON — fullscreen");
  } catch (err) {
    toastMsg("Camera indisponibilă: " + err.message);
  }
}
$("toggle-camera").addEventListener("click", toggleCamera);

applyTextBtn.addEventListener("click", () => {
  const t = overlayTextEl.value.trim();
  if (!t) return;
  state.overlayText = t;
  state.texts.push({
    text: t,
    x: 0.5,
    y: 0.18 + (state.texts.length % 5) * 0.08,
    life: 1,
  });
  toastMsg("Text adăugat");
});

async function playCurrent() {
  await ensureAudio();
  const clip = state.clips[state.index];
  if (!clip) {
    toastMsg("Adaugă un clip audio/video");
    return;
  }
  hiddenAudio.pause();
  hiddenVideo.pause();
  hiddenAudio.removeAttribute("src");
  if (clip.type === "video") {
    hiddenVideo.src = clip.url;
    hiddenVideo.loop = false;
    hookMediaElement(hiddenVideo);
    await hiddenVideo.play();
    state.centerMedia = hiddenVideo;
    state.centerKind = "video";
    state.centerOn = true;
    $("toggle-center").classList.add("active");
  } else {
    hiddenAudio.src = clip.url;
    hookMediaElement(hiddenAudio);
    await hiddenAudio.play();
  }
  state.playing = true;
  playBtn.textContent = "Pause";
  updateTrackLabel();
  renderClipList();
}

function pauseAll() {
  hiddenAudio.pause();
  hiddenVideo.pause();
  state.playing = false;
  playBtn.textContent = "Play";
  updateTrackLabel();
}

playBtn.addEventListener("click", async () => {
  if (state.playing) pauseAll();
  else await playCurrent();
});

stopBtn.addEventListener("click", () => {
  pauseAll();
  hiddenAudio.currentTime = 0;
  hiddenVideo.currentTime = 0;
});

prevBtn.addEventListener("click", () => {
  if (!state.clips.length) return;
  state.index = (state.index - 1 + state.clips.length) % state.clips.length;
  playCurrent();
});

nextBtn.addEventListener("click", () => {
  if (!state.clips.length) return;
  state.index = (state.index + 1) % state.clips.length;
  playCurrent();
});

hiddenAudio.addEventListener("ended", () => {
  if (state.clips.length > 1) {
    state.index = (state.index + 1) % state.clips.length;
    playCurrent();
  } else {
    state.playing = false;
    playBtn.textContent = "Play";
    updateTrackLabel();
  }
});
hiddenVideo.addEventListener("ended", () => {
  if (state.clips.length > 1) {
    state.index = (state.index + 1) % state.clips.length;
    playCurrent();
  } else {
    state.playing = false;
    playBtn.textContent = "Play";
    updateTrackLabel();
  }
});

async function listMics() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const mics = devices.filter((d) => d.kind === "audioinput");
    const current = audioDeviceSel.value;
    audioDeviceSel.innerHTML = `<option value="">🎤 Default Mic</option>`;
    mics.forEach((d) => {
      const opt = document.createElement("option");
      opt.value = d.deviceId;
      opt.textContent = d.label || "Microfon";
      audioDeviceSel.appendChild(opt);
    });
    if (current) audioDeviceSel.value = current;
  } catch {}
}
listMics();
navigator.mediaDevices?.addEventListener?.("devicechange", listMics);

micListenBtn.addEventListener("click", async () => {
  await ensureAudio();
  if (state.micOn) {
    state.micSource?.disconnect();
    state.micStream?.getTracks().forEach((t) => t.stop());
    state.micOn = false;
    micListenBtn.classList.remove("active");
    micListenBtn.textContent = "🎤 Listen Mic";
    updateTrackLabel();
    return;
  }
  try {
    const constraints = {
      audio: audioDeviceSel.value ? { deviceId: { exact: audioDeviceSel.value } } : true,
      video: false,
    };
    state.micStream = await navigator.mediaDevices.getUserMedia(constraints);
    state.micSource = state.audioCtx.createMediaStreamSource(state.micStream);
    state.micSource.connect(state.analyser);
    state.micOn = true;
    micListenBtn.classList.add("active");
    micListenBtn.textContent = "🎤 Mic ON";
    updateTrackLabel();
    listMics();
  } catch (e) {
    toastMsg("Microfon indisponibil");
  }
});

function canvasStream() {
  return canvas.captureStream(30);
}

function mixAudioForRecord() {
  if (!state.audioCtx) return canvasStream();
  const dest = state.audioCtx.createMediaStreamDestination();
  try { state.analyser.connect(dest); } catch {}
  const mixed = new MediaStream([
    ...canvasStream().getVideoTracks(),
    ...dest.stream.getAudioTracks(),
  ]);
  return mixed;
}

function startRecord() {
  if (state.recording) return;
  const stream = mixAudioForRecord();
  const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
    ? "video/webm;codecs=vp9,opus"
    : MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")
      ? "video/webm;codecs=vp8,opus"
      : "video/webm";
  state.chunks = [];
  state.recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 });
  state.recorder.ondataavailable = (e) => { if (e.data.size) state.chunks.push(e.data); };
  state.recorder.onstop = () => {
    const blob = new Blob(state.chunks, { type: "video/webm" });
    if (state.lastExportUrl) URL.revokeObjectURL(state.lastExportUrl);
    state.lastExportUrl = URL.createObjectURL(blob);
    toastMsg("Înregistrare gata — apasă Export Video");
  };
  state.recorder.start(200);
  state.recording = true;
  recordBtn.classList.add("active", "danger");
  recordBtn.textContent = "Recording…";
}

function stopRecord() {
  if (!state.recording) return;
  state.recorder.stop();
  state.recording = false;
  recordBtn.classList.remove("active", "danger");
  recordBtn.textContent = "Record";
}

recordBtn.addEventListener("click", () => {
  if (state.recording) stopRecord();
  else startRecord();
});

exportBtn.addEventListener("click", () => {
  if (!state.lastExportUrl) {
    if (!state.recording) {
      toastMsg("Pornește Record, apoi oprește și exportă");
    } else {
      toastMsg("Oprește înregistrarea întâi");
    }
    return;
  }
  const a = document.createElement("a");
  a.href = state.lastExportUrl;
  a.download = "visualizer.webm";
  a.click();
});

toggleUiBtn.addEventListener("click", () => {
  state.uiHidden = !state.uiHidden;
  $("ui").classList.toggle("hidden-ui", state.uiHidden);
  toggleUiBtn.textContent = state.uiHidden ? "☰ Comenzi" : "✕ Ascunde comenzi";
});

async function toggleFullscreen() {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
      fullscreenBtn.classList.add("active");
    } else {
      await document.exitFullscreen();
      fullscreenBtn.classList.remove("active");
    }
  } catch (e) {
    toastMsg("Fullscreen indisponibil");
  }
}
fullscreenBtn.addEventListener("click", toggleFullscreen);
document.addEventListener("fullscreenchange", () => {
  fullscreenBtn.classList.toggle("active", !!document.fullscreenElement);
});

document.addEventListener("keydown", (e) => {
  if (e.target.matches("input, textarea")) return;
  if (e.code === "Space") { e.preventDefault(); playBtn.click(); }
  if (e.key === "f" || e.key === "F") toggleFullscreen();
  if (e.key === "h" || e.key === "H") toggleUiBtn.click();
  if (e.key === "ArrowRight") nextBtn.click();
  if (e.key === "ArrowLeft") prevBtn.click();
});

function bassEnergy(freq) {
  let s = 0;
  const n = Math.min(24, freq.length);
  for (let i = 0; i < n; i++) s += freq[i];
  return s / (n * 255);
}

function midEnergy(freq) {
  let s = 0;
  const a = 24, b = Math.min(120, freq.length);
  for (let i = a; i < b; i++) s += freq[i];
  return s / ((b - a) * 255);
}

function hexToRgb(hex) {
  const n = hex.replace("#", "");
  return {
    r: parseInt(n.slice(0, 2), 16),
    g: parseInt(n.slice(2, 4), 16),
    b: parseInt(n.slice(4, 6), 16),
  };
}

function coverDraw(source, w, h, alpha = 1) {
  if (!source) return;
  const sw = source.videoWidth || source.naturalWidth || source.width;
  const sh = source.videoHeight || source.naturalHeight || source.height;
  if (!sw || !sh) return;
  const scale = Math.max(w / sw, h / sh);
  const dw = sw * scale;
  const dh = sh * scale;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(source, (w - dw) / 2, (h - dh) / 2, dw, dh);
  ctx.restore();
}

function containDraw(source, cx, cy, size, alpha = 1) {
  if (!source) return;
  const sw = source.videoWidth || source.naturalWidth || source.width;
  const sh = source.videoHeight || source.naturalHeight || source.height;
  if (!sw || !sh) return;
  const scale = Math.min(size / sw, size / sh);
  const dw = sw * scale;
  const dh = sh * scale;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(source, cx - dw / 2, cy - dh / 2, dw, dh);
  ctx.restore();
}

function drawBackground(w, h, beat) {
  if (state.cameraOn && cameraVideo.readyState >= 2) {
    coverDraw(cameraVideo, w, h, 1);
    ctx.fillStyle = `rgba(0,0,0,${0.22 + beat * 0.08})`;
    ctx.fillRect(0, 0, w, h);
    return;
  }

  if (bgTypeEl.value === "gradient") {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, bg1El.value);
    g.addColorStop(1, bg2El.value);
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = bg1El.value;
  }
  ctx.fillRect(0, 0, w, h);

  if (state.videoFileOn && overlayVideo.readyState >= 2) {
    coverDraw(overlayVideo, w, h, 0.55);
  }
  if (state.suggestionOn && state.suggestionImg) {
    coverDraw(state.suggestionImg, w, h, 0.28);
  }
}

function drawScroll(w, h, beat) {
  if (!state.scrollOn || !scrollImg.complete || !scrollImg.naturalWidth) return;
  const ih = Math.max(90, Math.min(180, h * 0.16));
  const scale = ih / scrollImg.naturalHeight;
  const iw = scrollImg.naturalWidth * scale;
  state.scrollX -= 1.4 + beat * 8;
  if (state.scrollX < -iw) state.scrollX += iw;
  ctx.save();
  ctx.globalAlpha = 0.72;
  for (let x = state.scrollX % iw - iw; x < w + iw; x += iw) {
    ctx.drawImage(scrollImg, x, h - ih - 84, iw, ih);
  }
  ctx.restore();
}

function drawPng(w, h, beat, mid = 0) {
  if (!state.pngOn || !pngImage.complete || !pngImage.naturalWidth) return;

  const gravity = 2200;
  const floor = 0;
  const kick = Math.max(0, beat - 0.28) * 920 + mid * 180;
  if (beat > 0.42 && beat - state.pngLastBeat > 0.06) {
    state.pngV = -Math.max(280, kick);
    state.pngSquash = 0.82;
  }
  state.pngLastBeat = beat;

  const dt = 1 / 60;
  state.pngV += gravity * dt;
  state.pngY += state.pngV * dt;

  if (state.pngY >= floor) {
    state.pngY = floor;
    if (state.pngV > 80) {
      state.pngV *= -0.38;
      state.pngSquash = Math.max(0.72, 1 - state.pngV * 0.0012);
    } else {
      state.pngV = 0;
      state.pngSquash += (1 - state.pngSquash) * 0.18;
        const angle = (i / 120) * Math.PI * 2;
        const v = this.dataArray[i % this.bufferLength] * intensity * 0.4;
        const r = baseRadius + v;
        const x = centerX + Math.cos(angle) * r;
        const y = centerY + Math.sin(angle) * r;
        if (i === 0) this.ctx.moveTo(x, y); else this.ctx.lineTo(x, y);
      }
      this.ctx.closePath();
      this.ctx.stroke();
    } else if (mode === 'wave') {
      // Mod Waveform (Osciloscop liniar)
      this.analyser.getByteTimeDomainData(this.dataArray);
      this.ctx.beginPath();
      const sliceWidth = w / this.bufferLength;
      let x = 0;
      for (let i = 0; i < this.bufferLength; i++) {
        const v = this.dataArray[i] / 128.0;
        const y = (v * h / 2) + ((v - 1) * intensity * 50);
        if (i === 0) this.ctx.moveTo(x, y); else this.ctx.lineTo(x, y);
        x += sliceWidth;
      }
      this.ctx.lineTo(w, h / 2);
      this.ctx.stroke();
    } else {
      // Mod standard: BARS (Bare spectru verticale)
      const barWidth = (w / 64);
      let x = 0;
      for (let i = 0; i < 64; i++) {
        const barHeight = this.dataArray[i] * intensity * 1.5;
        this.ctx.fillRect(x, h - barHeight, barWidth - 4, barHeight);
        x += barWidth;
      }
    }
    this.ctx.restore();

    // Imagine/Video din Centru (Center Media)
    if (this.centerMedia && this.centerMedia.el) {
      const cm = this.centerMedia;
      let sum = 0; for(let i=0; i<40; i++) sum += this.dataArray[i];
      const pulse = 1 + (sum / 40 / 255) * 0.12 * intensity;
      const size = Math.min(w, h) * 0.25 * pulse;
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.arc(w/2, h/2, size/2, 0, Math.PI*2);
      this.ctx.clip();
      this.ctx.drawImage(cm.el, w/2 - size/2, h/2 - size/2, size, size);
      this.ctx.restore();
    }
  }
}

// ── LOGICA DE UI ȘI CONTROL INTERFAȚĂ ──
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d", { alpha: false });
let dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
function resize() {
  const { innerWidth: w, innerHeight: h } = window;
  canvas.style.width = w + "px";
  canvas.style.height = h + "px";
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
resize();
window.addEventListener("resize", resize);

const fileInput = document.getElementById("file-input");
const listEl = document.getElementById("clip-list");
const btnPlay = document.getElementById("playpause");
const btnStop = document.getElementById("stop");
const btnPrev = document.getElementById("prev");
const btnNext = document.getElementById("next");
const modeSel = document.getElementById("mode");
const intensityEl = document.getElementById("intensity");
const strobeEl = document.getElementById("strobe");
const imageInput = document.getElementById("image-input");
const scrollImageInput = document.getElementById("scroll-image");
const btnSuggestion = document.getElementById("add-suggestion");
const btnRecord = document.getElementById("record");
const btnExport = document.getElementById("export");
const colorInput = document.getElementById("viz-color");
const audioDeviceSel = document.getElementById("audio-device");
const btnMicListen = document.getElementById("mic-listen");
const overlayTextInput = document.getElementById("overlay-text");
const btnApplyText = document.getElementById("apply-text");
const trackDisplay = document.getElementById("current-track-display");

const bgTypeSel = document.getElementById("bg-type");
const bgColor1 = document.getElementById("bg-color1");
const bgColor2 = document.getElementById("bg-color2");
const bgImageInput = document.getElementById("bg-image");
const bgImageWrap = document.getElementById("bg-image-wrap");
const bgColor1Wrap = document.getElementById("bg-color1-wrap");
const bgColor2Wrap = document.getElementById("bg-color2-wrap");

let ac, analyser, gainA, gainB;
let current = { index: -1, audio: null, src: null };
let nextAudio = null;
const clips = [];
let mediaDest, recorder = null, recChunks = [];

let micStream = null, micSource = null, micListening = false;
let overlayText = "", overlayAlpha = 0, overlayFadeDir = 0, overlayTimer = null;
let viz;
let playing = false, lastT = performance.now(), exportMode = false;

function ensureAudio() {
  if (ac) return;
  ac = new (window.AudioContext || window.webkitAudioContext)();
  analyser = ac.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.82;
  gainA = ac.createGain();
  gainB = ac.createGain();
  gainA.gain.value = 1;
  gainB.gain.value = 0;

  const merger = ac.createGain();
  gainA.connect(merger);
  gainB.connect(merger);
  merger.connect(analyser);
  analyser.connect(ac.destination);
  mediaDest = ac.createMediaStreamDestination();
  analyser.connect(mediaDest);

  viz = new VisualizerManager(ctx, analyser, {
    mode: modeSel.value,
    intensity: parseFloat(intensityEl.value),
    strobe: strobeEl.checked,
    color: colorInput?.value || "#ffffff",
    background: {
      type: bgTypeSel.value,
      color1: bgColor1.value,
      color2: bgColor2.value,
    }
  });
}

async function populateAudioDevices() {
  try {
    await navigator.mediaDevices.getUserMedia({ audio: true }).then(s => s.getTracks().forEach(t => t.stop()));
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = devices.filter(d => d.kind === "audioinput");
    audioDeviceSel.innerHTML = "";
    audioInputs.forEach((d, i) => {
      const opt = document.createElement("option");
      opt.value = d.deviceId;
      opt.textContent = d.label || `Microfon ${i + 1}`;
      audioDeviceSel.appendChild(opt);
    });
  } catch (err) { console.warn(err); }
}
populateAudioDevices();

btnMicListen.addEventListener("click", async () => {
  ensureAudio();
  if (ac.state === "suspended") await ac.resume();
  if (micListening) { stopMicHardware(); trackDisplay.textContent = "Sursă: Playlist"; return; }
  stopAllMediaClips();
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: audioDeviceSel.value ? { deviceId: { exact: audioDeviceSel.value } } : true });
    micSource = ac.createMediaStreamSource(micStream);
    micSource.connect(analyser);
    micListening = true;
    playing = true;
    btnMicListen.textContent = "🛑 Stop Mic";
    btnMicListen.classList.add("active");
    trackDisplay.textContent = "Sursă Activă: Microfon/Live Input";
  } catch (err) { alert(err.message); }
});

function stopMicHardware() {
  if (micSource) { micSource.disconnect(); micSource = null; }
  if (micStream) { micStream.getTracks().forEach(t => t.stop()); micStream = null; }
  micListening = false;
  btnMicListen.textContent = "🎤 Listen Mic";
  btnMicListen.classList.remove("active");
}

function stopAllMediaClips() {
  if (current.audio) { current.audio.pause(); try { current.audio.currentTime = 0; } catch{} }
  if (nextAudio) { nextAudio.pause(); try { nextAudio.currentTime = 0; } catch{} }
  playing = false;
  btnPlay.textContent = "Play";
}

function addClip(file) {
  const url = URL.createObjectURL(file);
  const isVideo = (file.type || "").startsWith("video") || /\.mp4$/i.test(file.name);
  clips.push({ name: file.name, url, file, isVideo });
  renderList();
  if (current.index === -1) {
    current.index = 0;
    trackDisplay.textContent = `Piesă selectată: ${file.name} (Gata de pornire)`;
  }
}

fileInput.addEventListener("change", (e) => {
  ensureAudio();
  Array.from(e.target.files || []).forEach(addClip);
  fileInput.value = "";
});

// ── RENDER LISTĂ PIESE CU BUTOANE INTEGRATE PLAY ȘI STOP ÎN DREAPTA ──
function renderList() {
  listEl.innerHTML = "";
  clips.forEach((c, i) => {
    const li = document.createElement("li");
    if (i === current.index && !micListening) li.classList.add("active");
    
    // Nume piesă stânga
    const nameSpan = document.createElement("span");
    nameSpan.textContent = truncate(c.name, 26);
    li.appendChild(nameSpan);

    // Container butoane acțiuni dreapta
    const actionWrap = document.createElement("div");
    actionWrap.style.display = "inline-flex";
    actionWrap.style.gap = "4px";
    actionWrap.style.marginLeft = "10px";

    // Buton mic PLAY dedicat piesei
    const itemPlay = document.createElement("button");
    itemPlay.textContent = "▶";
    itemPlay.title = "Play piesa asta";
    itemPlay.style.padding = "2px 6px";
    itemPlay.style.fontSize = "11px";
    itemPlay.addEventListener("click", () => { stopMicHardware(); playIndex(i); });

    // Buton mic STOP dedicat piesei
    const itemStop = document.createElement("button");
    itemStop.textContent = "⏹";
    itemStop.title = "Oprește piesa asta";
    itemStop.style.padding = "2px 6px";
    itemStop.style.fontSize = "11px";
    itemStop.style.color = "#ff6b6b";
    itemStop.addEventListener("click", () => { if(current.index === i) { stopAllMediaClips(); trackDisplay.textContent = "Sursă: Oprită"; } });

    actionWrap.appendChild(itemPlay);
    actionWrap.appendChild(itemStop);
    li.appendChild(actionWrap);
    listEl.appendChild(li);
  });
}

function truncate(s, n) { return s.length > n ? s.slice(0, n - 1) + "…" : s; }

async function playIndex(index) {
  ensureAudio();
  const clip = clips[index];
  if (!clip) return;
  if (current.audio) { current.audio.pause(); try { current.audio.currentTime = 0; } catch{} }

  const media = clip.isVideo ? document.createElement("video") : new Audio();
  Object.assign(media, { src: clip.url, preload: "auto", crossOrigin: "anonymous", loop: false, playsInline: true });
  media.addEventListener("ended", () => { if (exportMode) { stopRecording(); exportMode = false; } else { btnNext.click(); } });

  const srcNode = ac.createMediaElementSource(media);
  srcNode.connect(gainA);
  
  gainA.gain.setValueAtTime(1, ac.currentTime);
  
  try {
    if (ac.state === "suspended") await ac.resume();
    await media.play();
    playing = true;
    btnPlay.textContent = "Pause";
    trackDisplay.textContent = `Sursă: ${clip.name}`;
  } catch(err) { console.error(err); }

  current = { index, audio: media };
  renderList();
}

btnPlay.addEventListener("click", async () => {
  ensureAudio();
  if (!clips.length) return;
  if (micListening) stopMicHardware();
  if (!playing) {
    if (current.audio) current.audio.play(); else playIndex(current.index !== -1 ? current.index : 0);
    btnPlay.textContent = "Pause"; playing = true;
  } else {
    if (current.audio) current.audio.pause(); btnPlay.textContent = "Play"; playing = false;
  }
});

btnStop.addEventListener("click", () => { stopAllMediaClips(); stopMicHardware(); trackDisplay.textContent = "Sursă: Oprită complet"; });
btnPrev.addEventListener("click", () => { if(clips.length) playIndex((current.index - 1 + clips.length) % clips.length); });
btnNext.addEventListener("click", () => { if(clips.length) playIndex((current.index + 1) % clips.length); });

modeSel.addEventListener("change", () => viz && viz.setOptions({ mode: modeSel.value }));
intensityEl.addEventListener("input", () => viz && viz.setOptions({ intensity: parseFloat(intensityEl.value) }));
colorInput.addEventListener("input", () => viz && viz.setOptions({ color: colorInput.value }));

bgTypeSel.addEventListener("change", () => viz && viz.setBackground({ type: bgTypeSel.value, color1: bgColor1.value, color2: bgColor2.value }));
bgColor1.addEventListener("input", () => viz && viz.setBackground({ type: bgTypeSel.value, color1: bgColor1.value, color2: bgColor2.value }));
bgColor2.addEventListener("input", () => viz && viz.setBackground({ type: bgTypeSel.value, color1: bgColor1.value, color2: bgColor2.value }));

imageInput.addEventListener("change", (e) => {
  ensureAudio(); const file = (e.target.files || [])[0];
  if (file && viz) { const u = URL.createObjectURL(file); if (file.type.startsWith("video")) viz.setCenterMedia(u, "video"); else viz.setCenterMedia(u, "image"); }
});

btnApplyText.addEventListener("click", () => { overlayText = overlayTextInput.value.trim(); overlayAlpha = 1; });

function loop(t) {
  const dt = Math.min(0.05, (t - lastT) / 1000); lastT = t;
  const w = canvas.width / dpr, h = canvas.height / dpr;
  if (playing || micListening) { if (viz) viz.render(w, h, dt); } else { ctx.fillStyle = bgColor1.value || "#000000"; ctx.fillRect(0, 0, w, h); }
  if (overlayText) { ctx.save(); ctx.fillStyle = "#fff"; ctx.font = "30px Arial"; ctx.textAlign = "center"; ctx.fillText(overlayText, w/2, h - 50); ctx.restore(); }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

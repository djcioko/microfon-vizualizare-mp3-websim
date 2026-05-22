// ── MOTORUL VIZUAL INTEGRAT DIRECT ──
class VisualizerManager {
  constructor(ctx, analyser, options) {
    this.ctx = ctx;
    this.analyser = analyser;
    this.options = options;
    this.bufferLength = analyser.frequencyBinCount;
    this.dataArray = new Uint8Array(this.bufferLength);
    this.centerMedia = null;
    this.scrollingImage = null;
    this.scrollX = 0;
  }
  setOptions(opts) { Object.assign(this.options, opts); }
  setBackground(bg) { Object.assign(this.options.background, bg); }
  setCenterMedia(url, type) { this.centerMedia = { url, type, el: null }; if(type==='video'){const v=document.createElement('video');v.src=url;v.loop=true;v.muted=true;v.play().catch(()=>{});this.centerMedia.el=v;}else{const img=new Image();img.src=url;this.centerMedia.el=img;} }
  setScrollingImage(url) { const img=new Image();img.src=url;this.scrollingImage=img; }
  
  render(w, h, dt) {
    this.analyser.getByteFrequencyData(this.dataArray);
    
    const bg = this.options.background;
    if (bg.type === 'gradient') {
      const grad = this.ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, bg.color1);
      grad.addColorStop(1, bg.color2);
      this.ctx.fillStyle = grad;
    } else {
      this.ctx.fillStyle = bg.color1 || '#000000';
    }
    this.ctx.fillRect(0, 0, w, h);

    if (this.scrollingImage && this.scrollingImage.complete) {
      this.scrollX += dt * 40;
      if (this.scrollX > this.scrollingImage.width) this.scrollX = 0;
      this.ctx.save();
      this.ctx.globalAlpha = 0.3;
      for (let x = -this.scrollX; x < w; x += this.scrollingImage.width) {
        this.ctx.drawImage(this.scrollingImage, x, 0, this.scrollingImage.width, h);
      }
      this.ctx.restore();
    }

    this.ctx.save();
    const mode = this.options.mode;
    const intensity = this.options.intensity || 1.5;
    this.ctx.strokeStyle = this.options.color || '#ffffff';
    this.ctx.fillStyle = this.options.color || '#ffffff';
    this.ctx.lineWidth = 3;

    if (mode === 'radial' || mode === 'radialwave') {
      const centerX = w / 2, centerY = h / 2;
      let sum = 0; for(let i=0; i<100; i++) sum += this.dataArray[i];
      const avg = sum / 100;
      const baseRadius = Math.min(w, h) * 0.15 + (avg * intensity * 0.2);
      
      this.ctx.beginPath();
      for (let i = 0; i < 120; i++) {
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
      const barWidth = (w / 64);
      let x = 0;
      for (let i = 0; i < 64; i++) {
        const barHeight = this.dataArray[i] * intensity * 1.5;
        this.ctx.fillRect(x, h - barHeight, barWidth - 4, barHeight);
        x += barWidth;
      }
    }
    this.ctx.restore();

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

// ── LOGICA INTERFEȚEI ──
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
const colorInput = document.getElementById("viz-color");
const audioDeviceSel = document.getElementById("audio-device");
const btnMicListen = document.getElementById("mic-listen");
const overlayTextInput = document.getElementById("overlay-text");
const btnApplyText = document.getElementById("apply-text");
const trackDisplay = document.getElementById("current-track-display");

const bgTypeSel = document.getElementById("bg-type");
const bgColor1 = document.getElementById("bg-color1");
const bgColor2 = document.getElementById("bg-color2");
const imageInput = document.getElementById("image-input");

let ac, analyser, gainA, gainB;
let current = { index: -1, audio: null };
const clips = [];

let micStream = null, micSource = null, micListening = false;
let overlayText = "";
let viz;
let playing = false, lastT = performance.now();

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

  viz = new VisualizerManager(ctx, analyser, {
    mode: modeSel.value,
    intensity: parseFloat(intensityEl.value),
    color: colorInput?.value || "#ffffff",
    background: {
      type: bgTypeSel.value,
      color1: bgColor1.value,
      color2: bgColor2.value,
    }
  });
}

// ── CITIRE ȘI SCHIMBARE CORECTĂ AUDIO SOURCE DIN LAPTOP ──
async function populateAudioDevices() {
  try {
    await navigator.mediaDevices.getUserMedia({ audio: true }).then(s => s.getTracks().forEach(t => t.stop()));
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = devices.filter(d => d.kind === "audioinput");
    
    audioDeviceSel.innerHTML = "";
    audioInputs.forEach((d, i) => {
      const opt = document.createElement("option");
      opt.value = d.deviceId;
      opt.textContent = d.label || `Sursă Audio ${i + 1}`;
      audioDeviceSel.appendChild(opt);
    });
  } catch (err) { console.warn("Eroare la citirea listei audio:", err); }
}
populateAudioDevices();
navigator.mediaDevices.addEventListener("devicechange", populateAudioDevices);

// Re-legare dinamică la schimbarea selecției din drop-down în timp ce mic-ul merge
audioDeviceSel.addEventListener("change", async () => {
  if (micListening) {
    // Repornim stream-ul automat pe noua placă/sursă aleasă
    stopMicHardware();
    startMicStream();
  }
});

async function startMicStream() {
  ensureAudio();
  if (ac.state === "suspended") await ac.resume();
  stopAllMediaClips();
  
  const chosenDeviceId = audioDeviceSel.value;
  const constraints = {
    audio: chosenDeviceId ? { deviceId: { exact: chosenDeviceId } } : true
  };

  try {
    micStream = await navigator.mediaDevices.getUserMedia(constraints);
    micSource = ac.createMediaStreamSource(micStream);
    micSource.connect(analyser);
    micListening = true;
    playing = true;
    btnMicListen.textContent = "🛑 Stop Mic";
    btnMicListen.classList.add("active");
    
    const label = audioDeviceSel.options[audioDeviceSel.selectedIndex]?.textContent || "Microfon";
    trackDisplay.textContent = `Sursă activată din laptop: ${label}`;
  } catch (err) {
    alert("Nu s-a putut deschide sursa selectată: " + err.message);
    micListening = false;
    btnMicListen.textContent = "🎤 Listen Mic";
    btnMicListen.classList.remove("active");
  }
}

btnMicListen.addEventListener("click", () => {
  if (micListening) {
    stopMicHardware();
    trackDisplay.textContent = "Sursă: Playlist";
  } else {
    startMicStream();
  }
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
  playing = false;
  btnPlay.textContent = "Play";
}

function addClip(file) {
  const url = URL.createObjectURL(file);
  const isVideo = (file.type || "").startsWith("video") || /\.mp4$/i.test(file.name);
  clips.push({ name: file.name, url, isVideo });
  renderList();
  if (current.index === -1) {
    current.index = 0;
    trackDisplay.textContent = `Piesă pregătită: ${file.name}`;
  }
}

fileInput.addEventListener("change", (e) => {
  ensureAudio();
  Array.from(e.target.files || []).forEach(addClip);
  fileInput.value = "";
});

// ── RENDER LISTĂ PIESE CU BUTOANE PLAY ȘI STOP ÎN DREAPTA ──
function renderList() {
  listEl.innerHTML = "";
  clips.forEach((c, i) => {
    const li = document.createElement("li");
    if (i === current.index && !micListening) li.classList.add("active");
    
    const nameSpan = document.createElement("span");
    nameSpan.textContent = truncate(c.name, 24);
    li.appendChild(nameSpan);

    const actionWrap = document.createElement("div");
    actionWrap.style.display = "inline-flex";
    actionWrap.style.gap = "6px";
    actionWrap.style.marginLeft = "12px";

    // Buton ▶ lângă track
    const itemPlay = document.createElement("button");
    itemPlay.textContent = "▶";
    itemPlay.style.padding = "2px 6px";
    itemPlay.style.fontSize = "11px";
    itemPlay.addEventListener("click", () => { stopMicHardware(); playIndex(i); });

    // Buton ⏹ lângă track
    const itemStop = document.createElement("button");
    itemStop.textContent = "⏹";
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
  media.addEventListener("ended", () => { btnNext.click(); });

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

btnApplyText.addEventListener("click", () => { overlayText = overlayTextInput.value.trim(); });

function loop(t) {
  const dt = Math.min(0.05, (t - lastT) / 1000); lastT = t;
  const w = canvas.width / dpr, h = canvas.height / dpr;
  if (playing || micListening) { if (viz) viz.render(w, h, dt); } else { ctx.fillStyle = bgColor1.value || "#000000"; ctx.fillRect(0, 0, w, h); }
  if (overlayText) { ctx.save(); ctx.fillStyle = "#fff"; ctx.font = "30px Arial"; ctx.textAlign = "center"; ctx.fillText(overlayText, w/2, h - 50); ctx.restore(); }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

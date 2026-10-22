const $ = id => document.getElementById(id);
const canvas = $("canvas");
const ctx = canvas.getContext("2d");
const playBtn = $("playpause");
const audioDeviceSel = $("audio-device");
const micListenBtn = $("mic-listen");
const trackDisplay = $("current-track-display");
const toast = $("status-toast");
const hiddenAudio = $("hidden-audio");
const overlayVideo = $("overlay-video");
const cameraVideo = $("camera-video");
const pngImage = $("png-image");
const scrollImg = $("scroll-img");

let audioCtx, analyser, sourceNode;
let clips = [], index = 0, playing = false;
let micStream, micSource, micOn = false;
let overlayText = "";
let centerMedia = null, centerOn = true;
let pngOn = false, scrollOn = false, suggestionOn = false, suggestionImg = null;
let cameraOn = false, cameraStream = null;
let videoFileOn = false;
let recorder = null, chunks = [], recording = false;
let scrollX = 0;

// Free form positions (drag with mouse)
let pngPos = { x: 0.5, y: 0.5, scale: 1 };
let textPos = { x: 0.5, y: 0.85 };
let centerPos = { x: 0.5, y: 0.5, scale: 1 };
let dragging = null;
let dragOffset = { x: 0, y: 0 };

// Particles
let particles = [];
function spawnParticles(n = 3) {
  for (let i = 0; i < n; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: canvas.height,
      vx: (Math.random() - 0.5) * 4,
      vy: -Math.random() * 6 - 2,
      life: 1,
      size: Math.random() * 6 + 2,
      color: $("viz-color").value
    });
  }
}

function toastMsg(msg) {
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 1800);
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

// Mouse free-form drag
canvas.addEventListener("mousedown", e => {
  const rect = canvas.getBoundingClientRect();
  const mx = (e.clientX - rect.left) / rect.width;
  const my = (e.clientY - rect.top) / rect.height;

  // Check PNG
  if (pngOn && Math.abs(mx - pngPos.x) < 0.15 && Math.abs(my - pngPos.y) < 0.15) {
    dragging = "png";
    dragOffset = { x: mx - pngPos.x, y: my - pngPos.y };
  }
  // Check Text
  else if (overlayText && Math.abs(mx - textPos.x) < 0.2 && Math.abs(my - textPos.y) < 0.08) {
    dragging = "text";
    dragOffset = { x: mx - textPos.x, y: my - textPos.y };
  }
  // Check Center
  else if (centerOn && centerMedia && Math.abs(mx - centerPos.x) < 0.15 && Math.abs(my - centerPos.y) < 0.15) {
    dragging = "center";
    dragOffset = { x: mx - centerPos.x, y: my - centerPos.y };
  }
});

window.addEventListener("mousemove", e => {
  if (!dragging) return;
  const rect = canvas.getBoundingClientRect();
  const mx = (e.clientX - rect.left) / rect.width;
  const my = (e.clientY - rect.top) / rect.height;
  if (dragging === "png") { pngPos.x = mx - dragOffset.x; pngPos.y = my - dragOffset.y; }
  if (dragging === "text") { textPos.x = mx - dragOffset.x; textPos.y = my - dragOffset.y; }
  if (dragging === "center") { centerPos.x = mx - dragOffset.x; centerPos.y = my - dragOffset.y; }
});

window.addEventListener("mouseup", () => dragging = null);

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
  } catch (e) { toastMsg("Permisiune microfon refuzată"); }
}

// Clips (neschimbat)
$("file-input").addEventListener("change", e => {
  [...e.target.files].forEach(file => {
    const url = URL.createObjectURL(file);
    clips.push({ name: file.name, url, type: file.type.startsWith("video") ? "video" : "audio" });
  });
  renderList();
  e.target.value = "";
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
  if (playing) { hiddenAudio.pause(); playing = false; playBtn.textContent = "Play"; }
  else playCurrent();
});
$("stop").addEventListener("click", () => {
  hiddenAudio.pause(); hiddenAudio.currentTime = 0; playing = false; playBtn.textContent = "Play";
});
$("prev").addEventListener("click", () => { if (clips.length) { index = (index - 1 + clips.length) % clips.length; playCurrent(); } });
$("next").addEventListener("click", () => { if (clips.length) { index = (index + 1) % clips.length; playCurrent(); } });

// Mic (neschimbat)
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
  } catch (e) { toastMsg("Microfon indisponibil"); }
});

// Media overlays (se activează automat)
$("image-input").addEventListener("change", e => {
  const f = e.target.files[0]; if (!f) return;
  const img = new Image();
  img.onload = () => { centerMedia = img; centerOn = true; $("toggle-center").classList.add("active"); toastMsg("Center activat"); };
  img.src = URL.createObjectURL(f); e.target.value = "";
});
$("png-input").addEventListener("change", e => {
  const f = e.target.files[0]; if (!f) return;
  pngImage.onload = () => { pngOn = true; $("toggle-png").classList.add("active"); toastMsg("PNG activat"); };
  pngImage.src = URL.createObjectURL(f); e.target.value = "";
});
$("scroll-image").addEventListener("change", e => {
  const f = e.target.files[0]; if (!f) return;
  scrollImg.onload = () => { scrollOn = true; $("toggle-scroll").classList.add("active"); toastMsg("Scroll activat"); };
  scrollImg.src = URL.createObjectURL(f); e.target.value = "";
});
$("video-file-input").addEventListener("change", e => {
  const f = e.target.files[0]; if (!f) return;
  overlayVideo.src = URL.createObjectURL(f);
  overlayVideo.play().catch(() => {});
  videoFileOn = true;
  $("toggle-video").classList.add("active");
  toastMsg("Video activat");
  e.target.value = "";
});
$("add-suggestion").addEventListener("click", () => {
  const img = new Image();
  img.onload = () => { suggestionImg = img; suggestionOn = true; $("toggle-suggest").classList.add("active"); toastMsg("Suggestion activat"); };
  img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><circle cx="200" cy="200" r="150" fill="#4ef05d"/><text x="200" y="220" text-anchor="middle" font-size="60" fill="#000">VIZ</text></svg>`);
});
$("apply-text").addEventListener("click", () => {
  overlayText = $("overlay-text").value.trim();
  if (overlayText) toastMsg("Text adăugat (trage cu mouse-ul)");
});

// Toggles
$("toggle-png").onclick = () => { pngOn = !pngOn; $("toggle-png").classList.toggle("active", pngOn); };
$("toggle-video").onclick = () => { videoFileOn = !videoFileOn; $("toggle-video").classList.toggle("active", videoFileOn); if (videoFileOn) overlayVideo.play().catch(()=>{}); else overlayVideo.pause(); };
$("toggle-center").onclick = () => { centerOn = !centerOn; $("toggle-center").classList.toggle("active", centerOn); };
$("toggle-scroll").onclick = () => { scrollOn = !scrollOn; $("toggle-scroll").classList.toggle("active", scrollOn); };
$("toggle-suggest").onclick = () => { suggestionOn = !suggestionOn; $("toggle-suggest").classList.toggle("active", suggestionOn); };
$("toggle-camera").onclick = async () => {
  if (cameraOn) {
    cameraStream?.getTracks().forEach(t => t.stop());
    cameraOn = false;
    $("toggle-camera").classList.remove("active");
  } else {
    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
      cameraVideo.srcObject = cameraStream;
      cameraOn = true;
      $("toggle-camera").classList.add("active");
    } catch { toastMsg("Camera indisponibilă"); }
  }
};

// Record
$("record").onclick = () => {
  if (recording) {
    recorder?.stop();
    recording = false;
    $("record").textContent = "Record";
    return;
  }
  const stream = canvas.captureStream(30);
  chunks = [];
  recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
  recorder.ondataavailable = e => chunks.push(e.data);
  recorder.onstop = () => {
    const blob = new Blob(chunks, { type: "video/webm" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "visualizer.webm";
    a.click();
    toastMsg("Video descărcat");
  };
  recorder.start();
  recording = true;
  $("record").textContent = "Stop Rec";
};
$("export").onclick = () => { if (recording) $("record").click(); else toastMsg("Pornește Record mai întâi"); };

// Fullscreen + Hide
$("fullscreen-btn").onclick = () => {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
  else document.exitFullscreen();
};
$("toggle-ui").onclick = () => {
  document.body.classList.toggle("ui-hidden");
  $("toggle-ui").textContent = document.body.classList.contains("ui-hidden") ? "👁 Arată comenzi" : "✕ Ascunde comenzi";
};

// LOOP cu pulse + free form + efecte complete
function loop() {
  requestAnimationFrame(loop);
  const w = canvas.width / (window.devicePixelRatio || 1);
  const h = canvas.height / (window.devicePixelRatio || 1);
  const bg1 = $("bg-color1").value || "#000";
  const bg2 = $("bg-color2").value || "#202020";

  if ($("bg-type").value === "gradient") {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, bg1); g.addColorStop(1, bg2);
    ctx.fillStyle = g;
  } else ctx.fillStyle = bg1;
  ctx.fillRect(0, 0, w, h);

  if (cameraOn && cameraVideo.readyState >= 2) ctx.drawImage(cameraVideo, 0, 0, w, h);
  if (videoFileOn && overlayVideo.readyState >= 2) ctx.drawImage(overlayVideo, 0, 0, w, h);

  if (scrollOn && scrollImg.complete && scrollImg.width) {
    scrollX = (scrollX + 2) % scrollImg.width;
    ctx.drawImage(scrollImg, -scrollX, h / 2 - 80, scrollImg.width, 160);
    ctx.drawImage(scrollImg, scrollImg.width - scrollX, h / 2 - 80, scrollImg.width, 160);
  }

  let bass = 0;
  if ((playing || micOn) && analyser) {
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
    bass = data.slice(0, 20).reduce((a, b) => a + b, 0) / 20 / 255;

    const mode = $("mode").value;
    const color = $("viz-color").value;
    const intensity = parseFloat($("intensity").value);
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;

    if (mode === "bars" || mode === "mirror") {
      const barW = w / 64;
      for (let i = 0; i < 64; i++) {
        const bh = data[i] * intensity * 1.8;
        ctx.fillRect(i * barW, h - bh, barW - 2, bh);
        if (mode === "mirror") ctx.fillRect(i * barW, 0, barW - 2, bh * 0.55);
      }
    } else if (mode === "wave" || mode === "radialwave") {
      analyser.getByteTimeDomainData(data);
      ctx.beginPath();
      for (let i = 0; i < data.length; i++) {
        const x = (i / data.length) * w;
        const y = (data[i] / 128.0) * h / 2;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    } else if (mode === "radial") {
      const cx = w / 2, cy = h / 2;
      for (let i = 0; i < 64; i++) {
        const ang = (i / 64) * Math.PI * 2;
        const len = data[i] * intensity * 1.4;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(ang) * len, cy + Math.sin(ang) * len);
        ctx.stroke();
      }
    } else if (mode === "rings") {
      const cx = w / 2, cy = h / 2;
      for (let i = 0; i < 24; i++) {
        const r = (data[i * 2] / 255) * Math.min(w, h) * 0.42 * intensity;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (mode === "spiral") {
      const cx = w / 2, cy = h / 2;
      ctx.beginPath();
      for (let i = 0; i < 250; i++) {
        const ang = i * 0.18;
        const r = (data[i % data.length] / 255) * 200 * intensity + i * 0.9;
        const x = cx + Math.cos(ang) * r;
        const y = cy + Math.sin(ang) * r;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    } else if (mode === "particles") {
      if (Math.random() < bass * 0.6) spawnParticles(2);
    } else if (mode === "aurora") {
      ctx.globalAlpha = 0.6;
      for (let i = 0; i < 8; i++) {
        const y = (data[i * 10] / 255) * h * 0.6 + h * 0.2;
        ctx.beginPath();
        ctx.moveTo(0, y);
        for (let x = 0; x < w; x += 20) {
          const ny = y + Math.sin(x * 0.02 + i) * 40 * intensity;
          ctx.lineTo(x, ny);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }

  // Update particles
  particles = particles.filter(p => p.life > 0);
  particles.forEach(p => {
    p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.life -= 0.012;
    ctx.fillStyle = p.color;
    ctx.globalAlpha = p.life;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  });

  // PNG cu pulse / jump
  if (pngOn && pngImage.complete && pngImage.width) {
    const pulse = 1 + bass * 0.35;
    const size = Math.min(w, h) * 0.32 * pulse * pngPos.scale;
    const px = pngPos.x * w - size / 2;
    const py = pngPos.y * h - size / 2 - bass * 30; // jump
    ctx.drawImage(pngImage, px, py, size, size);
  }

  // Center cu pulse
  if (centerOn && centerMedia) {
    const pulse = 1 + bass * 0.25;
    const size = Math.min(w, h) * 0.28 * pulse * centerPos.scale;
    const cx = centerPos.x * w;
    const cy = centerPos.y * h - bass * 20;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(centerMedia, cx - size / 2, cy - size / 2, size, size);
    ctx.restore();
  }

  if (suggestionOn && suggestionImg) {
    ctx.drawImage(suggestionImg, w - 190, 30, 150, 150);
  }

  // Text cu pulse / jump + free form
  if (overlayText) {
    const pulse = 1 + bass * 0.4;
    ctx.save();
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${42 * pulse}px sans-serif`;
    ctx.textAlign = "center";
    ctx.shadowColor = "#000";
    ctx.shadowBlur = 10;
    ctx.fillText(overlayText, textPos.x * w, textPos.y * h - bass * 25);
    ctx.restore();
  }
}
loop();

refreshMicList();

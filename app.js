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

// Clips
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
  } catch (e) { toastMsg("Microfon indisponibil"); }
});

// Media overlays — se activează automat la încărcare
$("image-input").addEventListener("change", e => {
  const f = e.target.files[0]; if (!f) return;
  const img = new Image();
  img.onload = () => {
    centerMedia = img;
    centerOn = true;
    $("toggle-center").classList.add("active");
    toastMsg("Center media activat");
  };
  img.src = URL.createObjectURL(f);
  e.target.value = "";
});

$("png-input").addEventListener("change", e => {
  const f = e.target.files[0]; if (!f) return;
  pngImage.onload = () => {
    pngOn = true;
    $("toggle-png").classList.add("active");
    toastMsg("PNG Overlay activat");
  };
  pngImage.src = URL.createObjectURL(f);
  e.target.value = "";
});

$("scroll-image").addEventListener("change", e => {
  const f = e.target.files[0]; if (!f) return;
  scrollImg.onload = () => {
    scrollOn = true;
    $("toggle-scroll").classList.add("active");
    toastMsg("Scrolling Image activat");
  };
  scrollImg.src = URL.createObjectURL(f);
  e.target.value = "";
});

$("video-file-input").addEventListener("change", e => {
  const f = e.target.files[0]; if (!f) return;
  overlayVideo.src = URL.createObjectURL(f);
  overlayVideo.play().catch(() => {});
  videoFileOn = true;
  $("toggle-video").classList.add("active");
  toastMsg("Video File activat");
  e.target.value = "";
});

$("add-suggestion").addEventListener("click", () => {
  const img = new Image();
  img.onload = () => {
    suggestionImg = img;
    suggestionOn = true;
    $("toggle-suggest").classList.add("active");
    toastMsg("Suggestion activat");
  };
  img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><circle cx="200" cy="200" r="150" fill="#4ef05d"/><text x="200" y="220" text-anchor="middle" font-size="60" fill="#000">VIZ</text></svg>`);
});

$("apply-text").addEventListener("click", () => {
  overlayText = $("overlay-text").value.trim();
  if (overlayText) toastMsg("Text adăugat");
});

// Toggles (on/off)
$("toggle-png").onclick = () => { pngOn = !pngOn; $("toggle-png").classList.toggle("active", pngOn); };
$("toggle-video").onclick = () => {
  videoFileOn = !videoFileOn;
  $("toggle-video").classList.toggle("active", videoFileOn);
  if (videoFileOn) overlayVideo.play().catch(() => {});
  else overlayVideo.pause();
};
$("toggle-center").onclick = () => { centerOn = !centerOn; $("toggle-center").classList.toggle("active", centerOn); };
$("toggle-scroll").onclick = () => { scrollOn = !scrollOn; $("toggle-scroll").classList.toggle("active", scrollOn); };
$("toggle-suggest").onclick = () => { suggestionOn = !suggestionOn; $("toggle-suggest").classList.toggle("active", suggestionOn); };

$("toggle-camera").onclick = async () => {
  if (cameraOn) {
    cameraStream?.getTracks().forEach(t => t.stop());
    cameraOn = false;
    $("toggle-camera").classList.remove("active");
    toastMsg("Camera OFF");
  } else {
    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
      cameraVideo.srcObject = cameraStream;
      cameraOn = true;
      $("toggle-camera").classList.add("active");
      toastMsg("Camera ON");
    } catch { toastMsg("Camera indisponibilă"); }
  }
};

// Record + Export
$("record").onclick = () => {
  if (recording) {
    recorder?.stop();
    recording = false;
    $("record").textContent = "Record";
    toastMsg("Recording oprit");
    return;
  }
  const stream = canvas.captureStream(30);
  chunks = [];
  recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
  recorder.ondataavailable = e => chunks.push(e.data);
  recorder.onstop = () => {
    const blob = new Blob(chunks, { type: "video/webm" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "visualizer.webm"; a.click();
    toastMsg("Video descărcat");
  };
  recorder.start();
  recording = true;
  $("record").textContent = "Stop Rec";
  toastMsg("Recording...");
};
$("export").onclick = () => {
  if (recording) $("record").click();
  else if (chunks.length) toastMsg("Folosește Record mai întâi");
  else toastMsg("Înregistrează mai întâi");
};

// Fullscreen + Hide UI (rămân unde sunt)
$("fullscreen-btn").onclick = () => {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => toastMsg("Fullscreen blocat"));
  else document.exitFullscreen();
};
$("toggle-ui").onclick = () => {
  document.body.classList.toggle("ui-hidden");
  $("toggle-ui").textContent = document.body.classList.contains("ui-hidden") ? "👁 Arată comenzi" : "✕ Ascunde comenzi";
};

// Visualizer loop — toate modurile + overlay-urile
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

  if ((playing || micOn) && analyser) {
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
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
        const len = data[i] * intensity * 1.3;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(ang) * len, cy + Math.sin(ang) * len);
        ctx.stroke();
      }
    } else if (mode === "rings") {
      const cx = w / 2, cy = h / 2;
      for (let i = 0; i < 20; i++) {
        const r = (data[i * 3] / 255) * Math.min(w, h) * 0.45 * intensity;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (mode === "spiral") {
      const cx = w / 2, cy = h / 2;
      ctx.beginPath();
      for (let i = 0; i < 200; i++) {
        const ang = i * 0.15;
        const r = (data[i % data.length] / 255) * 180 * intensity + i * 0.8;
        const x = cx + Math.cos(ang) * r;
        const y = cy + Math.sin(ang) * r;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  if (centerOn && centerMedia) {
    const size = Math.min(w, h) * 0.3;
    ctx.save();
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, size / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(centerMedia, w / 2 - size / 2, h / 2 - size / 2, size, size);
    ctx.restore();
  }
  if (pngOn && pngImage.complete && pngImage.width) {
    const size = Math.min(w, h) * 0.35;
    ctx.drawImage(pngImage, w / 2 - size / 2, h / 2 - size / 2, size, size);
  }
  if (suggestionOn && suggestionImg) {
    ctx.drawImage(suggestionImg, w - 200, 30, 160, 160);
  }
  if (overlayText) {
    ctx.fillStyle = "#fff";
    ctx.font = "bold 42px sans-serif";
    ctx.textAlign = "center";
    ctx.shadowColor = "#000";
    ctx.shadowBlur = 8;
    ctx.fillText(overlayText, w / 2, h - 70);
    ctx.shadowBlur = 0;
  }
}
loop();

refreshMicList();

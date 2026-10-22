const $ = id => document.getElementById(id);
const canvas = $("canvas");
const ctx = canvas.getContext("2d");
const playBtn = $("playpause");
const audioDeviceSel = $("audio-device");
const micListenBtn = $("mic-listen");
const trackDisplay = $("current-track-display");
const toast = $("status-toast");

let audioCtx, analyser, sourceNode;
let clips = [], index = 0, playing = false;
let micStream, micSource, micOn = false;

function toastMsg(msg) {
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 1600);
}

function resize() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
}
resize();
window.addEventListener("resize", resize);

async function ensureAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
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
    audioDeviceSel.innerHTML = `<option value="">🎤 Default Mic</option>`;
    mics.forEach((d, i) => {
      const opt = document.createElement("option");
      opt.value = d.deviceId;
      opt.textContent = d.label || `Microfon ${i + 1}`;
      audioDeviceSel.appendChild(opt);
    });
    toastMsg(mics.length ? `${mics.length} microfoane` : "Niciun microfon");
  } catch (e) {
    toastMsg("Permisiune microfon refuzată");
  }
}

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
    li.textContent = c.name;
    if (i === index) li.style.border = "1px solid #4ef05d";
    li.onclick = () => { index = i; playCurrent(); };
    ul.appendChild(li);
  });
}

async function playCurrent() {
  await ensureAudio();
  const clip = clips[index];
  if (!clip) return toastMsg("Adaugă un clip");
  const audio = $("hidden-audio");
  audio.src = clip.url;
  if (!audio._node) audio._node = audioCtx.createMediaElementSource(audio);
  if (sourceNode) sourceNode.disconnect();
  sourceNode = audio._node;
  sourceNode.connect(analyser);
  await audio.play();
  playing = true;
  playBtn.textContent = "Pause";
  trackDisplay.textContent = "Sursă: " + clip.name;
}

playBtn.addEventListener("click", () => {
  if (playing) {
    $("hidden-audio").pause();
    playing = false;
    playBtn.textContent = "Play";
  } else playCurrent();
});

$("stop").addEventListener("click", () => {
  const a = $("hidden-audio");
  a.pause(); a.currentTime = 0;
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

micListenBtn.addEventListener("click", async () => {
  await ensureAudio();
  if (micOn) {
    micSource?.disconnect();
    micStream?.getTracks().forEach(t => t.stop());
    micOn = false;
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
    micListenBtn.textContent = "🎤 Mic ON";
    trackDisplay.textContent = "Sursă: Microfon";
  } catch (e) {
    toastMsg("Microfon indisponibil");
  }
});

// Fullscreen + Ascunde comenzi
$("fullscreen-btn").addEventListener("click", () => {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen();
  else document.exitFullscreen();
});

$("toggle-ui").addEventListener("click", () => {
  document.body.classList.toggle("ui-hidden");
  $("toggle-ui").textContent = document.body.classList.contains("ui-hidden") ? "👁 Arată comenzi" : "✕ Ascunde comenzi";
});

// Vizualizator simplu (bars)
function loop() {
  requestAnimationFrame(loop);
  if (!analyser || (!playing && !micOn)) {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return;
  }
  const data = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(data);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const barW = canvas.width / 64;
  for (let i = 0; i < 64; i++) {
    const h = data[i] * 2;
    ctx.fillStyle = $("viz-color").value;
    ctx.fillRect(i * barW, canvas.height - h, barW - 2, h);
  }
}
loop();

// La încărcare
refreshMicList();

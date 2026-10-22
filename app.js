// ── MICROFOANE ──
async function refreshMicList() {
  try {
    // Cere permisiune (necesar ca să apară etichetele)
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(t => t.stop()); // oprim imediat, doar am vrut permisiunea

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
    toastMsg(mics.length ? `${mics.length} microfoane găsite` : "Niciun microfon găsit");
  } catch (err) {
    console.warn(err);
    toastMsg("Permisiune microfon refuzată sau indisponibil");
  }
}

// Populează lista când utilizatorul interacționează
micListenBtn.addEventListener("click", async () => {
  await ensureAudio();
  if (state.micOn) {
    // oprește microfonul (codul tău existent)
    state.micSource?.disconnect();
    state.micStream?.getTracks().forEach(t => t.stop());
    state.micOn = false;
    micListenBtn.classList.remove("active");
    micListenBtn.textContent = "🎤 Listen Mic";
    updateTrackLabel();
    return;
  }

  // Înainte de a porni, reîmprospătează lista (cere permisiune dacă e nevoie)
  await refreshMicList();

  try {
    const constraints = {
      audio: audioDeviceSel.value
        ? { deviceId: { exact: audioDeviceSel.value } }
        : true,
      video: false
    };
    state.micStream = await navigator.mediaDevices.getUserMedia(constraints);
    state.micSource = state.audioCtx.createMediaStreamSource(state.micStream);
    state.micSource.connect(state.analyser);
    state.micOn = true;
    micListenBtn.classList.add("active");
    micListenBtn.textContent = "🎤 Mic ON";
    updateTrackLabel();
  } catch (e) {
    toastMsg("Microfon indisponibil: " + e.message);
  }
});

// Opțional: reîmprospătează lista și când se schimbă dispozitivele
navigator.mediaDevices?.addEventListener?.("devicechange", refreshMicList);

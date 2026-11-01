/* =========================================================
   BUMPUMDOM — juego completo en JavaScript vanilla
   Terror de vigilancia nocturna inspirado en cámaras fijas.
   ========================================================= */
(() => {
  "use strict";

  /* =========================================================
     1. CONFIGURACIÓN GENERAL
     ========================================================= */
  const CONFIG = Object.freeze({
    HOUR_MS: 36000,                 // 36 s reales por hora -> 3:36 por noche
    HOURS: 6,
    NIGHT_MS: 36000 * 6,
    START_POWER: 100,

    BASE_DRAIN: 0.09,               // energía por segundo sólo por existir
    CAMERA_DRAIN: 0.48,
    DOOR_DRAIN: 0.62,
    LIGHT_DRAIN: 1.05,

    DOOR_PATIENCE_MIN: 9.0,
    DOOR_PATIENCE_MAX: 12.0,
    DOOR_BLOCK_TIME: 0.9,           // segundos con la puerta cerrada para ahuyentar

    PUZZLE_TIMES: [14, 13, 12],     // segundos para resolver cada visita
    PUZZLE_PENALTIES: [8, 12],      // energía perdida al fallar las dos primeras
    STUN_TIME: 3.1,

    SCARE_TIME: 1850,               // ms de jump scare antes de la pantalla de muerte
    BLACKOUT_TIME: 2.8,
    TOAST_TIME: 2400,

    CAMERA_ORDER: ["stage", "dining", "west", "east", "storage", "kitchen"],
    HOUR_LABELS: ["12 AM", "1 AM", "2 AM", "3 AM", "4 AM", "5 AM", "6 AM"],
    CAMERA_DATA: {
      stage: {
        code: "CAM 01",
        name: "ESCENARIO",
        caption: "El escenario. El lugar donde todo comienza.",
        signal: "SEÑAL ESTABLE"
      },
      dining: {
        code: "CAM 02",
        name: "COMEDOR",
        caption: "Las mesas siguen puestas. Nadie ha venido a cenar.",
        signal: "SEÑAL ESTABLE"
      },
      west: {
        code: "CAM 03",
        name: "PASILLO OESTE",
        caption: "Pasillo oeste. La salida de emergencia está bloqueada.",
        signal: "INTERFERENCIA LEVE"
      },
      east: {
        code: "CAM 04",
        name: "PASILLO ESTE",
        caption: "Pasillo este. Las luces parpadean sin motivo.",
        signal: "SEÑAL INESTABLE"
      },
      storage: {
        code: "CAM 05",
        name: "ALMACÉN",
        caption: "Cajas apiladas hasta el techo. Alguna se ha movido.",
        signal: "SEÑAL DÉBIL"
      },
      kitchen: {
        code: "CAM 06",
        name: "COCINA",
        caption: "La cocina no tiene cámara de audio. Reza para no oír nada.",
        signal: "SIN AUDIO"
      }
    }
  });

  const BOT_INFO = Object.freeze({
    bombom: {
      name: "BomBom",
      display: "BOMBOM",
      side: "right",
      path: ["stage", "dining", "east", "door"],
      colors: "Morado y azul",
      deathCode: "ERROR // 01"
    },
    pumpum: {
      name: "PumPum",
      display: "PUMPUM",
      side: "left",
      path: ["stage", "dining", "west", "door"],
      colors: "Blanco y rosado",
      deathCode: "ERROR // 02"
    },
    domdom: {
      name: "DomDom",
      display: "DOMDOM",
      side: "inside",
      colors: "Negro y ojos rojos",
      deathCode: "ERROR // 00"
    }
  });

  const SYMBOLS = Object.freeze([
    { glyph: "✦", name: "estrella", tone: 392 },
    { glyph: "◇", name: "rombo", tone: 523.25 },
    { glyph: "✚", name: "cruz", tone: 659.25 },
    { glyph: "☾", name: "luna", tone: 783.99 }
  ]);

  const FUSE_POLARITIES = Object.freeze([
    { glyph: "+", name: "POSITIVA" },
    { glyph: "−", name: "NEGATIVA" },
    { glyph: "~", name: "ALTERNA" }
  ]);

  // Ajustes de dificultad por noche: IA, fusibles y calendario de DomDom.
  const NIGHT_SETTINGS = Object.freeze([
    {
      name: "FÁCIL",
      aiSpeed: 1,
      doorPatience: 1,
      maxHotFuses: 1,
      fuseDrain: 0.25,
      repairBoost: 7,
      fuseFirst: [30, 44],
      fuseInterval: [22, 34],
      domdomScale: 1
    },
    {
      name: "INTERMEDIA",
      aiSpeed: 1.22,
      doorPatience: 0.9,
      maxHotFuses: 2,
      fuseDrain: 0.4,
      repairBoost: 6,
      fuseFirst: [24, 36],
      fuseInterval: [18, 28],
      domdomScale: 0.8
    },
    {
      name: "DIFÍCIL",
      aiSpeed: 1.45,
      doorPatience: 0.8,
      maxHotFuses: 3,
      fuseDrain: 0.6,
      repairBoost: 5,
      fuseFirst: [18, 28],
      fuseInterval: [14, 22],
      domdomScale: 0.64
    }
  ]);
  //Algo increible que la IA quizo ocupar las cosas como Jquery
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const rand = (min, max) => min + Math.random() * (max - min);
  const choose = (items) => items[Math.floor(Math.random() * items.length)];
  const pad2 = (value) => String(value).padStart(2, "0");

  /* =========================================================
     2. ESTADO Y ELEMENTOS
     ========================================================= */
  let game = null;
  let ui = {};
  let audio = null;
  let lastFrame = performance.now();
  let loopId = null;
  let currentNight = 1;
  let contractSeen = false;
  const managedTimeouts = new Set();

  function getNightConfig(night = currentNight) {
    return NIGHT_SETTINGS[clamp(night, 1, 3) - 1];
  }

  function scheduleTimeout(callback, delay) {
    const id = window.setTimeout(() => {
      managedTimeouts.delete(id);
      callback();
    }, delay);
    managedTimeouts.add(id);
    return id;
  }

  function clearManagedTimeouts() {
    managedTimeouts.forEach((id) => window.clearTimeout(id));
    managedTimeouts.clear();
  }

  function cachedUI() {
    ui = {
      menuScreen: $("#menuScreen"),
      gameScreen: $("#gameScreen"),
      startButton: $("#startButton"),
      helpButton: $("#helpButton"),
      helpModal: $("#helpModal"),
      closeHelpButton: $("#closeHelpButton"),
      helpStartButton: $("#helpStartButton"),
      helpBackButton: $("#helpBackButton"),
      menuBots: $("#menuBots"),

      hourLabel: $("#hourLabel"),
      nightValue: $("#nightValue"),
      nightProgress: $("#nightProgress"),
      powerValue: $("#powerValue"),
      powerBar: $("#powerBar"),
      powerTrack: $(".power-track"),
      usageBars: $("#usageBars"),
      camToggle: $("#camToggle"),
      deskClock: $("#deskClock"),

      officeStage: $("#officeStage"),
      officeTrio: $("#officeTrio"),
      viewCenter: $("#viewCenter"),
      viewDoor: $("#viewDoor"),
      doorScene: $("#doorScene"),
      doorPosterLeft: $("#doorPosterLeft"),
      doorPosterRight: $("#doorPosterRight"),
      doorShutter: $("#doorShutter"),
      doorSideLabel: $("#doorSideLabel"),
      doorSideCode: $("#doorSideCode"),
      doorStatus: $("#doorStatus"),
      doorStatusText: $("#doorStatusText"),
      lightButton: $("#lightButton"),
      doorButton: $("#doorButton"),
      lightButtonLabel: $("#lightButtonLabel"),
      doorButtonLabel: $("#doorButtonLabel"),
      footerLight: $("#footerLight"),
      footerDoor: $("#footerDoor"),
      statusHint: $("#statusHint"),

      cameraOverlay: $("#cameraOverlay"),
      cameraFeed: $("#cameraFeed"),
      cameraCharacters: $("#cameraCharacters"),
      cameraButtons: $("#cameraButtons"),
      cameraCode: $("#cameraCode"),
      cameraLocation: $("#cameraLocation"),
      cameraSignal: $("#cameraSignal"),
      cameraCaption: $("#cameraCaption"),
      cameraTime: $("#cameraTime"),
      cameraTitleBlock: $(".cam-title-block"),

      fusePanel: $("#fusePanel"),
      fuseRoom: $("#fuseRoom"),
      fuseStatus: $("#fuseStatus"),
      fuseSocketLabel: $("#fuseSocketLabel"),
      fuseRequired: $("#fuseRequired"),
      fuseHint: $("#fuseHint"),
      fuseOptions: $("#fuseOptions"),

      blackoutOverlay: $("#blackoutOverlay"),
      toast: $("#toast"),

      puzzleOverlay: $("#puzzleOverlay"),
      puzzleDom: $("#puzzleDom"),
      puzzleVisit: $("#puzzleVisit"),
      puzzleVisitDots: $("#puzzleVisitDots"),
      puzzlePreview: $("#puzzlePreview"),
      puzzleStatus: $("#puzzleStatus"),
      puzzleTimerBar: $("#puzzleTimerBar"),
      puzzleInputProgress: $("#puzzleInputProgress"),
      puzzleGrid: $("#puzzleGrid"),
      puzzleWarning: $("#puzzleWarning"),

      stunOverlay: $("#stunOverlay"),
      stunPenalty: $("#stunPenalty"),
      stunTimerBar: $("#stunTimerBar"),

      scareOverlay: $("#scareOverlay"),
      scareBot: $("#scareBot"),
      scareName: $("#scareName"),

      deathOverlay: $("#deathOverlay"),
      deathPortrait: $("#deathPortrait"),
      deathTitle: $("#deathTitle"),
      deathDescription: $("#deathDescription"),
      deathNight: $("#deathNight"),
      deathCode: $("#deathCode"),
      deathPower: $("#deathPower"),
      deathTime: $("#deathTime"),
      deathHour: $("#deathHour"),
      retryButton: $("#retryButton"),
      menuFromDeath: $("#menuFromDeath"),

      victoryOverlay: $("#victoryOverlay"),
      victoryEyebrow: $("#victoryEyebrow"),
      victoryDescription: $("#victoryDescription"),
      victoryPower: $("#victoryPower"),
      victoryDomdom: $("#victoryDomdom"),
      victoryDoors: $("#victoryDoors"),
      playAgainButton: $("#playAgainButton"),
      menuFromVictory: $("#menuFromVictory"),

      contractModal: $("#contractModal"),
      contractAccept: $("#contractAccept")
    };

    ui.lastHUD = {};
    ui.lastToastId = 0;
    ui.toastTimeout = null;
  }

  /* =========================================================
     3. ARTE CSS DE LOS ANIMATRÓNICOS
     ========================================================= */
  function botMarkup(id) {
    const botClass = id === "bombom" ? "bot--bombom" : id === "pumpum" ? "bot--pumpum" : "bot--domdom";
    return `
      <div class="bot ${botClass}" aria-hidden="true">
        <div class="bot-ear bot-ear--l"></div>
        <div class="bot-ear bot-ear--r"></div>
        <div class="bot-head">
          <div class="bot-seam"></div>
          <div class="bot-brow bot-brow--l"></div>
          <div class="bot-brow bot-brow--r"></div>
          <div class="bot-eye bot-eye--l"></div>
          <div class="bot-eye bot-eye--r"></div>
          <div class="bot-muzzle">
            <div class="bot-nose"></div>
            <div class="bot-mouth"><span></span><span></span><span></span><span></span></div>
          </div>
          <div class="bot-cheek bot-cheek--l"></div>
          <div class="bot-cheek bot-cheek--r"></div>
          <div class="bot-bow"></div>
        </div>
        <div class="bot-arm bot-arm--l"></div>
        <div class="bot-arm bot-arm--r"></div>
        <div class="bot-torso">
          <div class="bot-belly"></div>
          <div class="bot-button"></div>
        </div>
      </div>`;
  }

  function buildMenuBots() {
    ui.menuBots.innerHTML = ["bombom", "pumpum", "domdom"]
      .map((id) => `
        <div class="menu-bot">
          ${botMarkup(id)}
          <span class="menu-bot-label">${BOT_INFO[id].name}</span>
        </div>`)
      .join("");
  }

  function buildOfficeTrio() {
    if (!ui.officeTrio) return;
    ui.officeTrio.innerHTML = ["bombom", "pumpum", "domdom"]
      .map((id) => botMarkup(id))
      .join("");
  }

  /* =========================================================
     4. AUDIO PROCEDURAL — Web Audio API
     ========================================================= */
  function initAudio() {
    if (audio) {
      if (audio.ctx.state === "suspended") {
        audio.ctx.resume().catch(() => {});
      }
      return;
    }

    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;

    try {
      const ctx = new AudioCtor();
      const master = ctx.createGain();
      master.gain.value = 0.72;
      master.connect(ctx.destination);

      const noiseLength = Math.floor(ctx.sampleRate * 2);
      const noiseBuffer = ctx.createBuffer(1, noiseLength, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < noiseLength; i += 1) {
        data[i] = Math.random() * 2 - 1;
      }

      audio = { ctx, master, noiseBuffer, ambient: null, menuMusic: null, menuBuffer: null };
      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }
    } catch (error) {
      audio = null;
    }
  }

  function audioNow() {
    if (!audio) return null;
    if (audio.ctx.state === "suspended") audio.ctx.resume().catch(() => {});
    return audio.ctx;
  }

  function tone({
    freq,
    endFreq = null,
    type = "sine",
    duration = 0.25,
    volume = 0.05,
    when = 0,
    filter = null
  }) {
    const ctx = audioNow();
    if (!ctx) return;

    const start = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(1, freq), start);
    if (endFreq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), start + duration);
    }

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), start + Math.min(0.018, duration * 0.2));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    let output = gain;
    if (filter) {
      const filterNode = ctx.createBiquadFilter();
      filterNode.type = filter.type || "lowpass";
      filterNode.frequency.setValueAtTime(filter.freq || 500, start);
      if (filter.endFreq) {
        filterNode.frequency.exponentialRampToValueAtTime(Math.max(40, filter.endFreq), start + duration);
      }
      filterNode.Q.value = filter.q || 0.7;
      gain.connect(filterNode);
      output = filterNode;
    }

    output.connect(audio.master);
    osc.connect(gain);
    osc.start(start);
    osc.stop(start + duration + 0.06);
  }

  function noiseBurst({
    duration = 0.2,
    volume = 0.04,
    when = 0,
    filterType = "lowpass",
    freq = 900,
    endFreq = null,
    q = 0.8
  } = {}) {
    const ctx = audioNow();
    if (!ctx || !audio) return;

    const start = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    src.buffer = audio.noiseBuffer;
    src.loop = true;

    const filterNode = ctx.createBiquadFilter();
    filterNode.type = filterType;
    filterNode.frequency.setValueAtTime(freq, start);
    if (endFreq) {
      filterNode.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), start + duration);
    }
    filterNode.Q.value = q;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), start + Math.min(0.025, duration * 0.25));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    src.connect(filterNode);
    filterNode.connect(gain);
    gain.connect(audio.master);
    src.start(start);
    src.stop(start + duration + 0.05);
  }

  function startAmbient() {
    if (!audio) return;
    stopAmbient(0.12);

    const ctx = audio.ctx;
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.055, now + 2.2);
    gain.connect(audio.master);

    const low = ctx.createOscillator();
    low.type = "sine";
    low.frequency.value = 42;
    const lowGain = ctx.createGain();
    lowGain.gain.value = 0.32;
    low.connect(lowGain);
    lowGain.connect(gain);

    const mid = ctx.createOscillator();
    mid.type = "triangle";
    mid.frequency.value = 57.5;
    const midFilter = ctx.createBiquadFilter();
    midFilter.type = "lowpass";
    midFilter.frequency.value = 170;
    const midGain = ctx.createGain();
    midGain.gain.value = 0.16;
    mid.connect(midFilter);
    midFilter.connect(midGain);
    midGain.connect(gain);

    const air = ctx.createBufferSource();
    air.buffer = audio.noiseBuffer;
    air.loop = true;
    const airFilter = ctx.createBiquadFilter();
    airFilter.type = "lowpass";
    airFilter.frequency.value = 330;
    const airGain = ctx.createGain();
    airGain.gain.value = 0.2;
    air.connect(airFilter);
    airFilter.connect(airGain);
    airGain.connect(gain);

    low.start(now);
    mid.start(now);
    air.start(now);
    audio.ambient = { gain, sources: [low, mid, air] };
  }

  function stopAmbient(fade = 0.35) {
    if (!audio || !audio.ambient) return;
    const ctx = audio.ctx;
    const ambient = audio.ambient;
    const now = ctx.currentTime;
    try {
      ambient.gain.gain.cancelScheduledValues(now);
      ambient.gain.gain.setValueAtTime(Math.max(0.0001, ambient.gain.gain.value), now);
      ambient.gain.gain.exponentialRampToValueAtTime(0.0001, now + fade);
      ambient.sources.forEach((source) => {
        try { source.stop(now + fade + 0.04); } catch (error) { /* ya detenido */ }
      });
    } catch (error) {
      /* El contexto puede estar cerrado al abandonar la pestaña. */
    }
    audio.ambient = null;
  }

  function buildMenuMusicBuffer() {
    if (!audio) return null;
    if (audio.menuBuffer) return audio.menuBuffer;

    const ctx = audio.ctx;
    const duration = 20;
    const rate = ctx.sampleRate;
    const length = Math.floor(rate * duration);
    const buffer = ctx.createBuffer(1, length, rate);
    const data = buffer.getChannelData(0);

    // Drone armónico en La menor, con una respiración lenta.
    const drones = [
      { freq: 55, amp: 0.13, rate: 0.073, phase: 0.4 },
      { freq: 82.41, amp: 0.065, rate: 0.11, phase: 2.1 },
      { freq: 110, amp: 0.042, rate: 0.052, phase: 4.2 },
      { freq: 130.81, amp: 0.03, rate: 0.087, phase: 1.3 },
      { freq: 164.81, amp: 0.022, rate: 0.067, phase: 5 }
    ];

    let noise = 0;
    for (let i = 0; i < length; i += 1) {
      const t = i / rate;
      let sample = 0;
      for (const drone of drones) {
        const wobble = 0.6 + 0.4 * Math.sin(Math.PI * 2 * drone.rate * t + drone.phase);
        sample += Math.sin(Math.PI * 2 * drone.freq * t + drone.phase) * drone.amp * wobble;
      }
      // Viento grave filtrado.
      noise += (Math.random() * 2 - 1 - noise) * 0.012;
      sample += noise * 0.07 * (0.55 + 0.45 * Math.sin(Math.PI * 2 * 0.03 * t));
      data[i] = sample;
    }

    const addNote = (start, freq, noteDuration, volume) => {
      const startIndex = Math.floor(start * rate);
      const noteLength = Math.floor(noteDuration * rate);
      for (let n = 0; n < noteLength; n += 1) {
        const index = startIndex + n;
        if (index >= length) break;
        const t = n / rate;
        const attack = Math.min(1, t / 0.02);
        const decay = Math.exp(-3.2 * t / noteDuration);
        const wobble = 1 + Math.sin(Math.PI * 2 * 0.7 * t) * 0.003;
        data[index] += volume * attack * decay * (
          Math.sin(Math.PI * 2 * freq * wobble * t) +
          0.28 * Math.sin(Math.PI * 2 * freq * 2.01 * t) +
          0.08 * Math.sin(Math.PI * 2 * freq * 3.98 * t)
        );
      }
    };

    // Motivo de caja de música desafinada.
    addNote(1.2, 440, 3.4, 0.04);
    addNote(4.4, 523.25, 3.1, 0.036);
    addNote(7.9, 392, 3.8, 0.038);
    addNote(11.6, 415.3, 3.2, 0.033);
    addNote(14.2, 493.88, 3.6, 0.03);
    addNote(17.2, 329.63, 2.6, 0.026);

    // Latidos graves bajo la melodía.
    [2.1, 6.2, 10.3, 14.4, 18.2].forEach((start, index) => {
      const bass = 48 - index * 1.2;
      addNote(start, bass, 0.6, 0.08);
      addNote(start + 0.28, bass * 0.92, 0.45, 0.05);
    });

    // Suavizado de los extremos para que el bucle no chasquee.
    const fade = Math.floor(rate * 0.35);
    for (let i = 0; i < fade; i += 1) {
      const factor = i / fade;
      data[i] *= factor;
      data[length - 1 - i] *= factor;
    }

    audio.menuBuffer = buffer;
    return buffer;
  }

  function startMenuMusic() {
    if (!audio) initAudio();
    if (!audio || audio.menuMusic) return;
    if (!ui.menuScreen || ui.menuScreen.classList.contains("is-hidden")) return;

    const ctx = audioNow();
    if (!ctx) return;
    const buffer = buildMenuMusicBuffer();
    if (!buffer) return;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const gain = ctx.createGain();
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.22, now + 2.4);
    source.connect(gain);
    gain.connect(audio.master);
    source.start(now);
    audio.menuMusic = { source, gain };
  }

  function stopMenuMusic(fade = 0.6) {
    if (!audio || !audio.menuMusic) return;

    const { source, gain } = audio.menuMusic;
    const now = audio.ctx.currentTime;
    try {
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + fade);
      source.stop(now + fade + 0.05);
    } catch (error) {
      /* El contexto puede estar cerrado al abandonar la pestaña. */
    }
    audio.menuMusic = null;
  }

  function playDoorCue(id) {
    if (!audioNow()) return;
    if (id === "bombom") {
      // Rugido grave de BomBom.
      noiseBurst({ duration: 0.95, volume: 0.085, freq: 520, endFreq: 120, filterType: "bandpass", q: 0.6 });
      tone({ freq: 88, endFreq: 34, type: "sawtooth", duration: 1.05, volume: 0.075, filter: { type: "lowpass", freq: 340, endFreq: 90 } });
      tone({ freq: 57, endFreq: 29, type: "square", duration: 0.85, volume: 0.038, when: 0.08, filter: { type: "lowpass", freq: 160, endFreq: 70 } });
      noiseBurst({ duration: 0.55, volume: 0.06, when: 0.48, freq: 300, endFreq: 80, filterType: "lowpass" });
    } else if (id === "pumpum") {
      // Rugido agudo y chirriante de PumPum.
      noiseBurst({ duration: 0.72, volume: 0.07, freq: 2200, endFreq: 480, filterType: "bandpass", q: 1.1 });
      tone({ freq: 196, endFreq: 74, type: "sawtooth", duration: 0.8, volume: 0.06, filter: { type: "bandpass", freq: 1250, q: 0.8 } });
      tone({ freq: 294, endFreq: 116, type: "square", duration: 0.55, volume: 0.025, when: 0.05, filter: { type: "bandpass", freq: 1900, q: 1.2 } });
      noiseBurst({ duration: 0.4, volume: 0.05, when: 0.35, freq: 1500, endFreq: 360, filterType: "bandpass", q: 1.4 });
    }
  }

  function playLightClick() {
    noiseBurst({ duration: 0.045, volume: 0.04, freq: 2600, filterType: "highpass" });
    tone({ freq: 210, endFreq: 95, type: "square", duration: 0.055, volume: 0.015 });
  }

  function playDoorSound(closing) {
    if (!audioNow()) return;
    if (closing) {
      noiseBurst({ duration: 0.42, volume: 0.08, freq: 420, endFreq: 80, filterType: "lowpass" });
      tone({ freq: 56, endFreq: 32, type: "sine", duration: 0.42, volume: 0.09 });
      tone({ freq: 145, endFreq: 78, type: "square", duration: 0.14, volume: 0.018, when: 0.21, filter: { type: "lowpass", freq: 900 } });
    } else {
      tone({ freq: 92, endFreq: 132, type: "sawtooth", duration: 0.25, volume: 0.02, filter: { type: "lowpass", freq: 480 } });
      noiseBurst({ duration: 0.22, volume: 0.028, freq: 800, endFreq: 240 });
    }
  }

  function playRetreatSound() {
    noiseBurst({ duration: 0.3, volume: 0.05, freq: 280, endFreq: 90, filterType: "lowpass" });
    tone({ freq: 74, endFreq: 45, type: "triangle", duration: 0.5, volume: 0.03 });
  }

  function playCameraStatic() {
    noiseBurst({ duration: 0.16, volume: 0.025, freq: 3200, filterType: "highpass" });
    tone({ freq: 740, endFreq: 380, type: "square", duration: 0.045, volume: 0.009, when: 0.03 });
  }

  function playCameraBlip() {
    tone({ freq: 315, endFreq: 400, type: "square", duration: 0.06, volume: 0.014 });
    noiseBurst({ duration: 0.075, volume: 0.014, freq: 2500, filterType: "highpass" });
  }

  function playRuneTone(symbolIndex) {
    const symbol = SYMBOLS[symbolIndex] || SYMBOLS[0];
    tone({ freq: symbol.tone, type: "sine", duration: 0.22, volume: 0.035 });
    tone({ freq: symbol.tone * 1.5, type: "triangle", duration: 0.16, volume: 0.009 });
  }

  function playWrongTone() {
    tone({ freq: 130, endFreq: 74, type: "sawtooth", duration: 0.32, volume: 0.035, filter: { type: "lowpass", freq: 420 } });
    noiseBurst({ duration: 0.16, volume: 0.025, freq: 180, filterType: "lowpass" });
  }

  function playDomDomArrival() {
    if (!audioNow()) return;
    tone({ freq: 120, endFreq: 34, type: "sawtooth", duration: 1.25, volume: 0.055, filter: { type: "lowpass", freq: 500, endFreq: 100 } });
    tone({ freq: 2200, endFreq: 760, type: "sine", duration: 0.9, volume: 0.012, when: 0.12 });
    noiseBurst({ duration: 1.4, volume: 0.035, freq: 500, endFreq: 80, filterType: "lowpass" });
  }

  function playDomDomSuccess() {
    tone({ freq: 98, endFreq: 48, type: "triangle", duration: 0.8, volume: 0.04 });
    [392, 523.25, 659.25].forEach((freq, index) => {
      tone({ freq, type: "sine", duration: 0.5, volume: 0.022, when: 0.28 + index * 0.12 });
    });
  }

  function playStunSound() {
    tone({ freq: 180, endFreq: 34, type: "sawtooth", duration: 1.15, volume: 0.05, filter: { type: "lowpass", freq: 1200, endFreq: 130 } });
    tone({ freq: 1900, endFreq: 220, type: "sine", duration: 1.1, volume: 0.012 });
    noiseBurst({ duration: 0.35, volume: 0.08, freq: 900, endFreq: 80 });
  }

  function playRecoverSound() {
    tone({ freq: 180, endFreq: 300, type: "sine", duration: 0.25, volume: 0.015 });
  }

  function playPowerDown() {
    tone({ freq: 110, endFreq: 26, type: "sawtooth", duration: 2.1, volume: 0.05, filter: { type: "lowpass", freq: 550, endFreq: 80 } });
    noiseBurst({ duration: 0.65, volume: 0.05, freq: 600, endFreq: 40 });
  }

  function playFuseOverheat() {
    noiseBurst({ duration: 0.2, volume: 0.035, freq: 1400, endFreq: 320, filterType: "bandpass", q: 0.9 });
    tone({ freq: 155, endFreq: 68, type: "square", duration: 0.24, volume: 0.02, filter: { type: "lowpass", freq: 700 } });
  }

  function playFuseRepair() {
    noiseBurst({ duration: 0.08, volume: 0.045, freq: 2400, filterType: "highpass" });
    tone({ freq: 392, endFreq: 784, type: "sine", duration: 0.2, volume: 0.022 });
    tone({ freq: 659.25, type: "sine", duration: 0.26, volume: 0.014, when: 0.1 });
  }

  function playVictorySound() {
    if (!audioNow()) return;
    const chord = [261.63, 329.63, 392, 523.25];
    chord.forEach((freq, index) => {
      tone({ freq, type: "sine", duration: 2.2, volume: 0.022, when: index * 0.12 });
      tone({ freq: freq * 2, type: "triangle", duration: 1.4, volume: 0.007, when: 0.1 + index * 0.12 });
    });
    tone({ freq: 196, endFreq: 130.81, type: "triangle", duration: 2.7, volume: 0.02, when: 0.1 });
  }

  function playJumpscareSound(id) {
    if (!audioNow()) return;
    const base = id === "bombom" ? 62 : id === "pumpum" ? 145 : 46;
    noiseBurst({ duration: 1.45, volume: 0.15, freq: 2800, endFreq: 130, filterType: "bandpass", q: 0.4 });
    tone({ freq: base * 3.2, endFreq: base * 0.7, type: "sawtooth", duration: 1.3, volume: 0.075, filter: { type: "lowpass", freq: 1700, endFreq: 170 } });
    tone({ freq: base * 8.1, endFreq: base * 1.8, type: "square", duration: 0.9, volume: 0.035, filter: { type: "bandpass", freq: 1200, q: 0.7 } });
    tone({ freq: base * 18, endFreq: base * 4, type: "sine", duration: 0.65, volume: 0.018 });
    noiseBurst({ duration: 0.65, volume: 0.11, freq: 200, endFreq: 45, filterType: "lowpass", when: 0.34 });
    if (id === "pumpum") {
      tone({ freq: 2100, endFreq: 490, type: "triangle", duration: 1.0, volume: 0.026 });
    }
  }

  /* =========================================================
     5. ESTADO, INICIO Y FIN DE PARTIDA
     ========================================================= */
  function createCharacterState(id, aiSpeed) {
    // BomBom empieza un poco antes para que no lleguen siempre a la vez.
    const initialDelay = (id === "bombom" ? rand(7, 11) : rand(12, 18)) / aiSpeed;
    return {
      id,
      side: BOT_INFO[id].side,
      location: "stage",
      moveTimer: initialDelay,
      doorTimer: 0,
      blockedTimer: CONFIG.DOOR_BLOCK_TIME,
      cueTimer: 0.05
    };
  }

  function createFuseState() {
    const fuses = {};
    CONFIG.CAMERA_ORDER.forEach((room) => {
      fuses[room] = {
        polarity: Math.floor(Math.random() * FUSE_POLARITIES.length),
        hot: false
      };
    });
    return fuses;
  }

  function createInitialState() {
    const settings = getNightConfig(currentNight);
    const schedule = [
      rand(34000, 52000) * settings.domdomScale,      // ~1 AM
      rand(105000, 124000) * settings.domdomScale,    // ~3 AM
      rand(172000, 191000) * settings.domdomScale     // ~5 AM
    ];

    return {
      mode: "playing",
      night: currentNight,
      elapsed: 0,
      power: CONFIG.START_POWER,
      view: "center",
      cameraOpen: false,
      activeCamera: "stage",
      doors: { left: false, right: false },
      lights: { left: false, right: false },
      chars: {
        bombom: createCharacterState("bombom", settings.aiSpeed),
        pumpum: createCharacterState("pumpum", settings.aiSpeed)
      },
      domdom: {
        appearances: 0,
        active: false,
        schedule
      },
      fuses: createFuseState(),
      fuseTimer: rand(settings.fuseFirst[0], settings.fuseFirst[1]),
      fuseStats: {
        overheats: 0,
        repaired: 0,
        wrong: 0
      },
      puzzle: null,
      stun: { remaining: 0, total: CONFIG.STUN_TIME, penalty: 0 },
      blackoutTimer: 0,
      cameraDirty: false,
      killedBy: null,
      deathReason: null,
      stats: {
        doorsClosed: 0,
        cameraUses: 0,
        domdomEscapes: 0
      }
    };
  }

  function hideAllOverlays() {
    [
      ui.cameraOverlay,
      ui.blackoutOverlay,
      ui.puzzleOverlay,
      ui.stunOverlay,
      ui.scareOverlay,
      ui.deathOverlay,
      ui.victoryOverlay,
      ui.contractModal
    ].forEach((element) => {
      if (!element) return;
      element.classList.add("is-hidden");
      element.setAttribute("aria-hidden", "true");
    });
    if (ui.toast) {
      ui.toast.classList.remove("visible", "danger");
    }
  }

  function startGame() {
    clearManagedTimeouts();
    initAudio();
    stopMenuMusic(0.45);
    stopAmbient(0.1);

    game = createInitialState();
    hideAllOverlays();
    ui.menuScreen.classList.add("is-hidden");
    ui.helpModal.classList.add("is-hidden");
    ui.gameScreen.classList.remove("is-hidden");
    ui.lastHUD = {};
    ui.toast.textContent = "";
    ui.nightValue.textContent = String(game.night);

    game.view = "center";
    game.cameraOpen = false;
    game.activeCamera = "stage";
    refreshViewUI();
    renderHUD();
    updateInteractionUI(true);
    renderFusePanel();

    // El contrato sólo aparece la primera vez que comienza la noche 1.
    if (game.night === 1 && !contractSeen) {
      game.mode = "contract";
      ui.contractModal.classList.remove("is-hidden");
      ui.contractModal.setAttribute("aria-hidden", "false");
      ui.contractAccept.focus({ preventScroll: true });
      return;
    }

    beginShift();
  }

  function beginShift() {
    if (!game) return;
    ui.contractModal.classList.add("is-hidden");
    ui.contractModal.setAttribute("aria-hidden", "true");
    game.mode = "playing";
    startAmbient();
    lastFrame = performance.now();
    showToast(`Noche ${game.night} de 3 — dificultad ${getNightConfig(game.night).name.toLowerCase()}. Turno iniciado.`);
  }

  function acceptContract() {
    if (!game || game.mode !== "contract") return;
    contractSeen = true;
    beginShift();
  }

  function returnToMenu() {
    clearManagedTimeouts();
    stopAmbient(0.25);
    if (game) game.mode = "menu";
    game = null;
    hideAllOverlays();
    ui.helpModal.classList.add("is-hidden");
    ui.gameScreen.classList.add("is-hidden");
    ui.menuScreen.classList.remove("is-hidden");
    ui.toast.textContent = "";
    startMenuMusic();
    lastFrame = performance.now();
  }

  function formatHour(hourIndex) {
    return CONFIG.HOUR_LABELS[clamp(hourIndex, 0, 6)];
  }

  function currentHourIndex() {
    if (!game) return 0;
    return clamp(Math.floor(game.elapsed / CONFIG.HOUR_MS), 0, 6);
  }

  function isTerminalMode() {
    return Boolean(game && ["jumpscare", "death", "victory"].includes(game.mode));
  }

  /* =========================================================
     6. HUD Y ESTADO VISUAL
     ========================================================= */
  function getUsageLevel() {
    if (!game) return 1;
    let level = 1;
    if (game.cameraOpen) level += 1;
    if (game.doors.left) level += 1;
    if (game.doors.right) level += 1;
    if (game.lights.left || game.lights.right) level += 1;
    return clamp(level, 1, 5);
  }

  function renderHUD() {
    if (!game) return;

    const hour = currentHourIndex();
    const hourText = formatHour(hour);
    const progress = clamp(game.elapsed / CONFIG.NIGHT_MS, 0, 1) * 100;
    const power = clamp(game.power, 0, 100);
    const powerText = `${Math.ceil(power)}%`;
    const powerKey = power.toFixed(1);
    const usage = getUsageLevel();

    if (ui.lastHUD.night !== game.night) {
      ui.nightValue.textContent = String(game.night);
      ui.lastHUD.night = game.night;
    }

    if (ui.lastHUD.hour !== hourText) {
      ui.hourLabel.textContent = hourText;
      ui.deskClock.textContent = hour === 0 ? "12:00 AM" : `${hour}:00 AM`;
      ui.lastHUD.hour = hourText;
    }

    if (ui.lastHUD.progress !== progress.toFixed(1)) {
      ui.nightProgress.style.width = `${progress.toFixed(1)}%`;
      ui.lastHUD.progress = progress.toFixed(1);
    }

    if (ui.lastHUD.power !== powerKey) {
      ui.powerValue.textContent = powerText;
      ui.powerBar.style.width = `${power.toFixed(1)}%`;
      ui.powerBar.classList.toggle("power-warning", power <= 35 && power > 18);
      ui.powerBar.classList.toggle("power-critical", power <= 18);
      ui.powerTrack.setAttribute("aria-valuenow", String(Math.round(power)));
      ui.lastHUD.power = powerKey;
    }

    if (ui.lastHUD.usage !== usage) {
      $$("i", ui.usageBars).forEach((bar, index) => {
        bar.classList.toggle("active", index < usage);
        bar.classList.toggle("hot", index < usage && usage >= 4 && index >= 3);
      });
      ui.lastHUD.usage = usage;
    }

    const elapsedSeconds = Math.floor(game.elapsed / 1000);
    const cameraStamp = `00:${pad2(Math.floor(elapsedSeconds / 60) % 60)}:${pad2(elapsedSeconds % 60)}`;
    if (ui.lastHUD.cameraStamp !== cameraStamp && ui.cameraTime) {
      ui.cameraTime.textContent = cameraStamp;
      ui.lastHUD.cameraStamp = cameraStamp;
    }
  }

  function refreshViewUI() {
    if (!game) return;

    const center = game.view === "center";
    const side = game.view === "left" ? "left" : game.view === "right" ? "right" : null;

    ui.viewCenter.classList.toggle("is-active", center);
    ui.viewDoor.classList.toggle("is-active", !center);
    ui.viewCenter.setAttribute("aria-hidden", String(!center));
    ui.viewDoor.setAttribute("aria-hidden", String(center));
    ui.officeStage.dataset.view = game.view;

    if (side) {
      const sideName = side === "left" ? "IZQUIERDA" : "DERECHA";
      ui.doorScene.dataset.side = side;
      ui.doorSideLabel.textContent = `PUERTA ${sideName}`;
      ui.doorSideCode.textContent = side === "left" ? "L" : "R";
      renderDoorPosters(side);
    }

    updateInteractionUI(true);
  }

  function renderDoorPosters(side) {
    if (!ui.doorPosterLeft || !ui.doorPosterRight) return;

    const id = side === "left" ? "pumpum" : "bombom";
    if (ui.doorPosterLeft.dataset.bot === id) return;

    const artwork = botMarkup(id);
    ui.doorPosterLeft.innerHTML = artwork;
    ui.doorPosterRight.innerHTML = artwork;
    ui.doorPosterLeft.dataset.bot = id;
    ui.doorPosterRight.dataset.bot = id;
  }

  function updateInteractionUI(force = false) {
    if (!game) return;

    const side = game.view === "left" ? "left" : game.view === "right" ? "right" : null;
    const atDoor = Boolean(side) && !game.cameraOpen;
    const activeLight = atDoor && game.lights[side];
    const activeDoorClosed = atDoor && game.doors[side];

    const stateKey = [
      game.view,
      game.cameraOpen,
      activeLight,
      activeDoorClosed,
      side ? game.lights[side] : false,
      side ? game.doors[side] : false
    ].join("|");

    if (!force && ui.lastHUD.interaction === stateKey) return;
    ui.lastHUD.interaction = stateKey;

    ui.lightButton.disabled = !atDoor;
    ui.doorButton.disabled = !atDoor;
    ui.footerLight.disabled = !atDoor;
    ui.footerDoor.disabled = !atDoor;

    ui.lightButton.classList.toggle("active", activeLight);
    ui.doorButton.classList.toggle("active", activeDoorClosed);
    ui.footerLight.classList.toggle("active", activeLight);
    ui.footerDoor.classList.toggle("active", activeDoorClosed);
    ui.camToggle.classList.toggle("is-open", game.cameraOpen);

    if (side) {
      const closed = game.doors[side];
      const light = game.lights[side];
      ui.doorScene.classList.toggle("door-closed", closed);
      ui.doorScene.classList.toggle("light-on", light && atDoor);
      ui.doorStatus.classList.toggle("closed", closed);
      ui.doorStatusText.textContent = closed ? "PUERTA CERRADA" : "PUERTA ABIERTA";
      ui.lightButtonLabel.textContent = light ? "Apagar luz" : "Encender luz";
      ui.doorButtonLabel.textContent = closed ? "Abrir puerta" : "Cerrar puerta";
    } else {
      ui.doorScene.classList.remove("door-closed", "light-on");
    }

    if (game.cameraOpen) {
      const hotFuses = countHotFuses();
      ui.statusHint.textContent = hotFuses > 0
        ? `${hotFuses} fusible${hotFuses === 1 ? "" : "s"} sobrecalentado${hotFuses === 1 ? "" : "s"}. Repáralo${hotFuses === 1 ? "" : "s"} en su cámara.`
        : "Cámaras en línea. El consumo extra está activo.";
    } else if (!side) {
      ui.statusHint.textContent = "Mira una puerta para usar la luz y el cierre.";
    } else if (activeDoorClosed) {
      ui.statusHint.textContent = "La puerta cerrada consume energía. Escucha antes de abrir.";
    } else if (activeLight) {
      ui.statusHint.textContent = "El foco está encendido. Iluminar una puerta ocupada es fatal.";
    } else {
      ui.statusHint.textContent = "La puerta está abierta. Escucha con atención.";
    }

    ui.camToggle.textContent = game.cameraOpen ? "Bajar cámaras  C" : "Cámaras  C";
    // El <kbd> se recrea para conservar el formato del atajo.
    if (game.cameraOpen) {
      ui.camToggle.innerHTML = 'Bajar cámaras <kbd>C</kbd>';
    } else {
      ui.camToggle.innerHTML = 'Cámaras <kbd>C</kbd>';
    }
  }

  /* =========================================================
     7. NAVEGACIÓN, PUERTAS, LUCES Y CÁMARAS
     ========================================================= */
  function turnOffAllLights() {
    if (!game) return;
    game.lights.left = false;
    game.lights.right = false;
  }

  function setView(nextView, { silent = false } = {}) {
    if (!game || game.mode !== "playing" || game.cameraOpen) return;
    if (!["center", "left", "right"].includes(nextView)) return;
    if (game.view === nextView) return;

    turnOffAllLights();
    game.view = nextView;
    if (!silent) {
      const quip = nextView === "center" ? "Vuelves al centro de la oficina." : "Te acercas a la puerta.";
      // Sin sonidos de pista: sólo un pequeño ruido ambiental de movimiento.
      if (nextView !== "center") noiseBurst({ duration: 0.06, volume: 0.007, freq: 430 });
      if (quip && false) showToast(quip);
    }

    if (nextView === "left" || nextView === "right") {
      const char = game.chars[nextView === "left" ? "pumpum" : "bombom"];
      if (char.location === "door") char.cueTimer = 0.06;
    }

    refreshViewUI();
    updateInteractionUI(true);
  }

  function toggleLight() {
    if (!game || game.mode !== "playing") return;
    if (game.cameraOpen) {
      showToast("Baja las cámaras antes de usar los controles de la puerta.", true);
      return;
    }
    if (game.view === "center") {
      showToast("Acércate a una puerta para encender su luz.", true);
      return;
    }

    const side = game.view;
    const wasOn = game.lights[side];
    game.lights[side] = !wasOn;
    playLightClick();

    if (!wasOn) {
      const char = side === "left" ? game.chars.pumpum : game.chars.bombom;
      if (char.location === "door") {
        triggerDeath(char.id, "light");
        return;
      }
    }

    updateInteractionUI(true);
  }

  function toggleDoor() {
    if (!game || game.mode !== "playing") return;
    if (game.cameraOpen) {
      showToast("Baja las cámaras antes de cerrar una puerta.", true);
      return;
    }
    if (game.view === "center") {
      showToast("Acércate a una puerta para accionar el cierre.", true);
      return;
    }

    const side = game.view;
    const closing = !game.doors[side];
    game.doors[side] = closing;
    playDoorSound(closing);
    if (closing) game.stats.doorsClosed += 1;

    if (closing) {
      const char = side === "left" ? game.chars.pumpum : game.chars.bombom;
      if (char.location === "door") {
        char.blockedTimer = CONFIG.DOOR_BLOCK_TIME;
      }
    }

    updateInteractionUI(true);
  }

  function selectCamera(cameraId) {
    if (!game || game.mode !== "playing" || !game.cameraOpen) return;
    if (!CONFIG.CAMERA_ORDER.includes(cameraId)) return;
    if (game.activeCamera === cameraId) return;
    game.activeCamera = cameraId;
    playCameraBlip();
    renderCamera();
  }

  function setCameraOpen(open) {
    if (!game || game.mode !== "playing") return;
    if (open === game.cameraOpen) return;

    if (open) {
      turnOffAllLights();
      game.cameraOpen = true;
      game.view = "center";
      game.activeCamera = game.activeCamera || "stage";
      refreshViewUI();
      ui.cameraOverlay.classList.remove("is-hidden");
      ui.cameraOverlay.setAttribute("aria-hidden", "false");
      renderCamera();
      playCameraStatic();
      game.stats.cameraUses += 1;
    } else {
      game.cameraOpen = false;
      ui.cameraOverlay.classList.add("is-hidden");
      ui.cameraOverlay.setAttribute("aria-hidden", "true");
      playCameraBlip();
    }

    updateInteractionUI(true);
    renderHUD();
  }

  function toggleCameras() {
    if (!game || game.mode !== "playing") return;
    setCameraOpen(!game.cameraOpen);
  }

  function showToast(message, dangerous = false) {
    if (!ui.toast) return;
    if (ui.toastTimeout) {
      window.clearTimeout(ui.toastTimeout);
      managedTimeouts.delete(ui.toastTimeout);
      ui.toastTimeout = null;
    }
    ui.toast.textContent = message;
    ui.toast.classList.toggle("danger", dangerous);
    ui.toast.classList.add("visible");
    ui.toastTimeout = scheduleTimeout(() => {
      ui.toast.classList.remove("visible", "danger");
      ui.toastTimeout = null;
    }, CONFIG.TOAST_TIME);
  }

  /* =========================================================
     8. CÁMARAS: PROGRESO VISUAL
     ========================================================= */
  function buildCameraButtons() {
    ui.cameraButtons.innerHTML = CONFIG.CAMERA_ORDER.map((id, index) => {
      const data = CONFIG.CAMERA_DATA[id];
      return `
        <button type="button" class="cam-button" data-camera="${id}">
          <span>CAM ${pad2(index + 1)}</span>
          <b>${data.name}</b>
          <i class="cam-badge" aria-hidden="true"></i>
        </button>`;
    }).join("");
  }

  function renderCamera() {
    if (!game || !game.cameraOpen) return;
    const data = CONFIG.CAMERA_DATA[game.activeCamera];
    ui.cameraFeed.dataset.cam = game.activeCamera;
    ui.cameraCode.textContent = data.code;
    ui.cameraLocation.textContent = data.name;
    ui.cameraSignal.textContent = data.signal;
    ui.cameraCaption.textContent = data.caption;

    $$("button", ui.cameraButtons).forEach((button) => {
      button.classList.toggle("active", button.dataset.camera === game.activeCamera);
    });

    renderCameraCharacters();
    renderFusePanel();
    renderHUD();
  }

  function renderCameraCharacters() {
    if (!game || !ui.cameraCharacters) return;
    const visibleBots = Object.values(game.chars).filter(
      (char) => char.location === game.activeCamera
    );

    ui.cameraCharacters.innerHTML = visibleBots
      .map((char) => `
        <div class="cam-bot">
          ${botMarkup(char.id)}
          <span>${BOT_INFO[char.id].name.toUpperCase()} // ${CONFIG.CAMERA_DATA[game.activeCamera].name}</span>
        </div>`)
      .join("");
    game.cameraDirty = false;
  }

  /* =========================================================
     8.5. FUSIBLES: SOBRECALENTAMIENTO Y REPARACIÓN
     ========================================================= */
  function countHotFuses() {
    if (!game) return 0;
    return Object.values(game.fuses).filter((fuse) => fuse.hot).length;
  }

  function updateCameraFuseBadges() {
    if (!ui.cameraButtons) return;
    $$("button[data-camera]", ui.cameraButtons).forEach((button) => {
      const fuse = game ? game.fuses[button.dataset.camera] : null;
      button.classList.toggle("fuse-hot", Boolean(fuse && fuse.hot));
    });
  }

  function renderFusePanel() {
    if (!game || !ui.fusePanel) return;

    const fuse = game.fuses[game.activeCamera];
    if (!fuse) return;

    const polarity = FUSE_POLARITIES[fuse.polarity];
    const settings = getNightConfig(game.night);

    ui.fuseRoom.textContent = CONFIG.CAMERA_DATA[game.activeCamera].name;
    ui.fusePanel.classList.remove("is-wrong");
    ui.fusePanel.classList.toggle("is-hot", fuse.hot);
    ui.fusePanel.classList.toggle("is-stable", !fuse.hot);
    ui.fuseStatus.textContent = fuse.hot ? "SOBRECALENTADO" : "ESTABLE";
    ui.fuseRequired.textContent = polarity.glyph;

    if (fuse.hot) {
      ui.fuseSocketLabel.textContent = "POLARIDAD REQUERIDA";
      ui.fuseHint.textContent = `${polarity.name}. Instala un fusible compatible para recuperar +${settings.repairBoost}% de energía.`;
      ui.fuseOptions.innerHTML = FUSE_POLARITIES
        .map((option, index) => `
          <button class="fuse-option" type="button" data-fuse-polarity="${index}" aria-label="Instalar fusible ${option.name.toLowerCase()}">
            <b>${option.glyph}</b>
            <span>${option.name}</span>
          </button>`)
        .join("");
    } else {
      ui.fuseSocketLabel.textContent = "POLARIDAD INSTALADA";
      ui.fuseHint.textContent = "Circuito estable. No requiere reemplazo.";
      ui.fuseOptions.innerHTML = "";
    }

    updateCameraFuseBadges();
  }

  function overheatRandomFuse() {
    if (!game) return false;
    const candidates = CONFIG.CAMERA_ORDER.filter((room) => !game.fuses[room].hot);
    if (!candidates.length) return false;

    const room = choose(candidates);
    game.fuses[room].hot = true;
    game.fuseStats.overheats += 1;
    updateCameraFuseBadges();
    playFuseOverheat();

    if (game.cameraOpen && game.activeCamera === room) {
      renderFusePanel();
    }

    showToast(`SOBRECARGA EN ${CONFIG.CAMERA_DATA[room].name}. Revisa el panel de fusibles.`, true);
    return true;
  }

  function updateFuses(dt) {
    if (!game || game.mode !== "playing") return;

    const settings = getNightConfig(game.night);
    if (countHotFuses() >= settings.maxHotFuses) return;

    game.fuseTimer -= dt;
    if (game.fuseTimer > 0) return;

    if (overheatRandomFuse()) {
      game.fuseTimer = rand(settings.fuseInterval[0], settings.fuseInterval[1]);
    } else {
      game.fuseTimer = 2.5;
    }
  }

  function handleFuseRepair(polarityIndex) {
    if (!game || game.mode !== "playing" || !game.cameraOpen) return;

    const fuse = game.fuses[game.activeCamera];
    if (!fuse || !fuse.hot) return;

    const chosen = FUSE_POLARITIES[polarityIndex];
    const required = FUSE_POLARITIES[fuse.polarity];
    if (!chosen) return;

    if (polarityIndex === fuse.polarity) {
      const boost = getNightConfig(game.night).repairBoost;
      fuse.hot = false;
      game.fuseStats.repaired += 1;
      game.power = clamp(game.power + boost, 0, CONFIG.START_POWER);
      playFuseRepair();
      renderFusePanel();
      renderHUD();
      showToast(`Fusible ${chosen.name.toLowerCase()} instalado. +${boost}% de energía.`);
      return;
    }

    game.fuseStats.wrong += 1;
    playWrongTone();
    ui.fusePanel.classList.remove("is-wrong");
    void ui.fusePanel.offsetWidth;
    ui.fusePanel.classList.add("is-wrong");
    ui.fuseHint.textContent = `Polaridad incorrecta. El hueco exige ${required.glyph} ${required.name}.`;
    scheduleTimeout(() => ui.fusePanel.classList.remove("is-wrong"), 450);
  }

  /* =========================================================
     9. ANIMATRÓNICOS: RECORRIDO Y PUERTAS
     ========================================================= */
  function movementDelay(location) {
    if (!game) return rand(7, 12);
    const progress = clamp(game.elapsed / CONFIG.NIGHT_MS, 0, 1);
    const speed = (1 + progress * 0.38) * getNightConfig(game.night).aiSpeed;
    if (location === "stage") return rand(8, 13) / speed;
    if (location === "dining") return rand(7, 12) / speed;
    return rand(6, 10) / speed;
  }

  function arriveAtDoor(id) {
    if (!game) return;
    const char = game.chars[id];
    if (!char) return;

    char.location = "door";
    char.doorTimer = rand(CONFIG.DOOR_PATIENCE_MIN, CONFIG.DOOR_PATIENCE_MAX)
      * (1 - clamp(game.elapsed / CONFIG.NIGHT_MS, 0, 1) * 0.12)
      * getNightConfig(game.night).doorPatience;
    char.blockedTimer = CONFIG.DOOR_BLOCK_TIME;
    char.cueTimer = 0.08;
    game.cameraDirty = true;

    if (game.view === char.side && game.lights[char.side] && !game.cameraOpen) {
      triggerDeath(id, "light");
      return;
    }

    if (game.doors[char.side]) {
      char.blockedTimer = CONFIG.DOOR_BLOCK_TIME;
    }
  }

  function retreatCharacter(id) {
    if (!game) return;
    const char = game.chars[id];
    char.location = "stage";
    char.moveTimer = rand(10, 15) / getNightConfig(game.night).aiSpeed;
    char.doorTimer = 0;
    char.blockedTimer = CONFIG.DOOR_BLOCK_TIME;
    char.cueTimer = 0.05;
    game.cameraDirty = true;

    if (game.view === char.side && !game.cameraOpen) {
      playRetreatSound();
    }
  }

  function updateCharacter(id, dt) {
    if (!game || game.mode !== "playing") return;
    const char = game.chars[id];
    if (!char) return;

    if (char.location === "door") {
      const side = char.side;

      if (game.doors[side]) {
        // La puerta cerrada bloquea al animatrónico. Tras unos instantes, se retira.
        char.blockedTimer -= dt;
        if (char.blockedTimer <= 0) {
          retreatCharacter(id);
        }
      } else {
        char.blockedTimer = CONFIG.DOOR_BLOCK_TIME;
        char.doorTimer -= dt;
        if (char.doorTimer <= 0) {
          triggerDeath(id, "timeout");
        }
      }
      return;
    }

    char.moveTimer -= dt;
    if (char.moveTimer > 0) return;

    const path = BOT_INFO[id].path;
    const index = path.indexOf(char.location);
    if (index < 0) {
      char.location = "stage";
      char.moveTimer = movementDelay("stage");
      return;
    }

    const nextLocation = path[index + 1];
    if (!nextLocation) return;

    if (nextLocation === "door") {
      arriveAtDoor(id);
    } else {
      char.location = nextLocation;
      char.moveTimer = movementDelay(nextLocation);
      game.cameraDirty = true;
    }
  }

  function updateCharacters(dt) {
    if (!game || game.mode !== "playing") return;
    updateCharacter("bombom", dt);
    if (game.mode !== "playing") return;
    updateCharacter("pumpum", dt);
    if (game.mode !== "playing") return;

    // Pistas de audio: sólo se escuchan al mirar la puerta correspondiente.
    if (!game.cameraOpen) {
      const chars = Object.values(game.chars);
      for (const char of chars) {
        if (char.location !== "door" || game.view !== char.side) {
          char.cueTimer = 0.05;
          continue;
        }
        char.cueTimer -= dt;
        if (char.cueTimer <= 0) {
          playDoorCue(char.id);
          char.cueTimer = 2.65;
        }
      }
    }

    if (game.cameraOpen && game.cameraDirty) {
      renderCameraCharacters();
    }
  }

  function updateDomDomSchedule() {
    if (!game || game.mode !== "playing") return;
    const { appearances, schedule } = game.domdom;
    if (appearances < 3 && game.elapsed >= schedule[appearances]) {
      startDomDom(appearances + 1);
    }
  }

  function getPowerDrainRate() {
    if (!game) return 0;
    let drain = CONFIG.BASE_DRAIN;
    if (game.cameraOpen) drain += CONFIG.CAMERA_DRAIN;
    if (game.doors.left) drain += CONFIG.DOOR_DRAIN;
    if (game.doors.right) drain += CONFIG.DOOR_DRAIN;
    if (game.lights.left) drain += CONFIG.LIGHT_DRAIN;
    if (game.lights.right) drain += CONFIG.LIGHT_DRAIN;
    drain += countHotFuses() * getNightConfig(game.night).fuseDrain;
    return drain;
  }

  function updatePlaying(dt) {
    if (!game || game.mode !== "playing") return;

    game.elapsed += dt * 1000;

    if (game.elapsed >= CONFIG.NIGHT_MS) {
      triggerVictory();
      return;
    }

    updateFuses(dt);
    game.power = Math.max(0, game.power - getPowerDrainRate() * dt);
    if (game.power <= 0) {
      beginBlackout();
      return;
    }

    updateDomDomSchedule();
    if (game.mode !== "playing") return;

    updateCharacters(dt);
    if (game.mode !== "playing") return;

    renderHUD();
  }

  /* =========================================================
     10. DOMDOM: PUZZLE DE SECUENCIA
     ========================================================= */
  function closeCameraImmediate() {
    if (!game) return;
    game.cameraOpen = false;
    ui.cameraOverlay.classList.add("is-hidden");
    ui.cameraOverlay.setAttribute("aria-hidden", "true");
  }

  function buildPuzzleSequence(length) {
    const sequence = [];
    for (let i = 0; i < length; i += 1) {
      let index = Math.floor(Math.random() * SYMBOLS.length);
      if (i > 0 && index === sequence[i - 1]) {
        index = (index + 1 + Math.floor(Math.random() * (SYMBOLS.length - 1))) % SYMBOLS.length;
      }
      sequence.push(index);
    }
    return sequence;
  }

  function puzzleWarningForVisit(visit) {
    if (visit === 1) return "Primera visita: fallar te aturdirá y perderás 8% de energía.";
    if (visit === 2) return "Segunda visita: fallar te aturdirá y perderás 12% de energía.";
    return "ÚLTIMA VISITA. Si el tiempo llega a cero, DomDom no te dejará despertar.";
  }

  function startDomDom(visit) {
    if (!game || game.mode !== "playing") return;
    if (visit < 1 || visit > 3) return;

    game.mode = "puzzle";
    game.domdom.appearances = Math.max(game.domdom.appearances, visit);
    game.domdom.active = true;

    turnOffAllLights();
    closeCameraImmediate();
    game.view = "center";
    refreshViewUI();

    const sequenceLength = 2 + visit; // 3, 4 y 5 símbolos
    const sequence = buildPuzzleSequence(sequenceLength);
    const timeLimit = CONFIG.PUZZLE_TIMES[visit - 1];

    game.puzzle = {
      visit,
      sequence,
      progress: 0,
      timeLeft: timeLimit,
      totalTime: timeLimit,
      finished: false,
      success: false,
      finishDelay: 0,
      wrongs: 0
    };

    ui.puzzleVisit.textContent = String(visit);
    ui.puzzleVisitDots.innerHTML = [1, 2, 3]
      .map((number) => {
        const className = number < visit ? "past" : number === visit ? "current" : "";
        return `<i class="${className}"></i>`;
      })
      .join("");

    ui.puzzlePreview.innerHTML = sequence
      .map((symbolIndex) => `<span class="sequence-chip">${SYMBOLS[symbolIndex].glyph}</span>`)
      .join("");

    ui.puzzleInputProgress.innerHTML = sequence
      .map(() => "<i></i>")
      .join("");

    ui.puzzleGrid.innerHTML = SYMBOLS
      .map((symbol, index) => `
        <button class="rune-button" type="button" data-rune="${index}" aria-label="${symbol.name}, tecla ${index + 1}">
          <kbd>${index + 1}</kbd>
          <span class="rune-glyph">${symbol.glyph}</span>
          <small>${symbol.name}</small>
        </button>`)
      .join("");

    $$(".rune-button", ui.puzzleGrid).forEach((button) => {
      button.disabled = false;
    });

    ui.puzzleStatus.textContent = "REPITE EL SELLO EN ORDEN";
    ui.puzzleStatus.classList.add("input-phase");
    ui.puzzleWarning.textContent = puzzleWarningForVisit(visit);
    ui.puzzleWarning.classList.toggle("urgent", visit === 3);
    ui.puzzleWarning.classList.remove("shake");
    ui.puzzleTimerBar.style.width = "100%";

    ui.puzzleOverlay.classList.remove("is-hidden");
    ui.puzzleOverlay.setAttribute("aria-hidden", "false");
    ui.stunOverlay.classList.add("is-hidden");
    ui.stunOverlay.setAttribute("aria-hidden", "true");
    ui.puzzleStatus.focus?.();

    playDomDomArrival();
    renderHUD();
    updateInteractionUI(true);
  }

  function renderPuzzleInputProgress() {
    if (!game || !game.puzzle) return;
    const puzzle = game.puzzle;
    $$("i", ui.puzzleInputProgress).forEach((dot, index) => {
      dot.classList.toggle("filled", index < puzzle.progress);
    });
  }

  function finishPuzzle(success) {
    if (!game || game.mode !== "puzzle" || !game.puzzle || game.puzzle.finished) return;
    const puzzle = game.puzzle;
    puzzle.finished = true;
    puzzle.success = success;

    $$(".rune-button", ui.puzzleGrid).forEach((button) => {
      button.disabled = true;
    });

    if (success) {
      puzzle.finishDelay = 0.8;
      ui.puzzleStatus.textContent = "SELLO COMPLETO — DOMDOM SE DETIENE";
      ui.puzzleStatus.classList.remove("input-phase");
      ui.puzzleWarning.textContent = "La figura desaparece de la habitación.";
      ui.puzzleWarning.classList.remove("urgent", "shake");
      playDomDomSuccess();
    } else {
      puzzle.finishDelay = 1.05;
      ui.puzzleStatus.textContent = "EL SELLO SE HA ROTO";
      ui.puzzleStatus.classList.remove("input-phase");
      ui.puzzleWarning.textContent = puzzle.visit === 3
        ? "DomDom se acerca. No hay una cuarta oportunidad."
        : "La oscuridad cae sobre tus ojos.";
      ui.puzzleWarning.classList.add("urgent");
      playStunSound();
    }
  }

  function resolvePuzzle() {
    if (!game || !game.puzzle) return;
    const puzzle = game.puzzle;
    const visit = puzzle.visit;

    game.puzzle = null;
    game.domdom.active = false;
    ui.puzzleOverlay.classList.add("is-hidden");
    ui.puzzleOverlay.setAttribute("aria-hidden", "true");
    ui.puzzleStatus.classList.remove("input-phase");

    if (puzzle.success) {
      game.mode = "playing";
      game.stats.domdomEscapes += 1;
      updateInteractionUI(true);
      renderHUD();
      showToast(
        visit === 3
          ? "DomDom se retiró por última vez. El amanecer está cerca."
          : "La figura se desvanece. DomDom volverá."
      );
      return;
    }

    if (visit === 3) {
      triggerDeath("domdom", "puzzle");
      return;
    }

    const penalty = CONFIG.PUZZLE_PENALTIES[visit - 1];
    game.power = Math.max(0, game.power - penalty);
    startStun(penalty);
  }

  function handleRuneInput(symbolIndex) {
    if (!game || game.mode !== "puzzle" || !game.puzzle || game.puzzle.finished) return;
    const puzzle = game.puzzle;
    const expected = puzzle.sequence[puzzle.progress];

    if (symbolIndex === expected) {
      puzzle.progress += 1;
      playRuneTone(symbolIndex);
      renderPuzzleInputProgress();

      if (puzzle.progress >= puzzle.sequence.length) {
        finishPuzzle(true);
      } else {
        ui.puzzleWarning.textContent = "Bien. La figura sigue tus movimientos.";
        ui.puzzleWarning.classList.remove("urgent", "shake");
      }
      return;
    }

    // Fallo: la secuencia vuelve a empezar y pierde una fracción de tiempo.
    puzzle.progress = 0;
    puzzle.wrongs += 1;
    puzzle.timeLeft = Math.max(0, puzzle.timeLeft - 0.75);
    renderPuzzleInputProgress();
    playWrongTone();
    ui.puzzleStatus.textContent = "SECUENCIA INCORRECTA — REINICIANDO";
    ui.puzzleStatus.classList.add("input-phase");
    ui.puzzleWarning.textContent = puzzleWarningForVisit(puzzle.visit);
    ui.puzzleWarning.classList.toggle("urgent", puzzle.visit === 3);
    ui.puzzleWarning.classList.remove("shake");
    void ui.puzzleWarning.offsetWidth;
    ui.puzzleWarning.classList.add("shake");

    const clickedButton = ui.puzzleGrid.querySelector(`[data-rune="${symbolIndex}"]`);
    if (clickedButton) {
      clickedButton.classList.add("wrong");
      scheduleTimeout(() => clickedButton.classList.remove("wrong"), 340);
    }

    if (puzzle.timeLeft <= 0) finishPuzzle(false);
  }

  function updatePuzzle(dt) {
    if (!game || game.mode !== "puzzle" || !game.puzzle) return;
    const puzzle = game.puzzle;

    if (puzzle.finished) {
      puzzle.finishDelay -= dt;
      if (puzzle.finishDelay <= 0) resolvePuzzle();
      return;
    }

    puzzle.timeLeft -= dt;
    const ratio = clamp(puzzle.timeLeft / puzzle.totalTime, 0, 1);
    ui.puzzleTimerBar.style.width = `${(ratio * 100).toFixed(1)}%`;

    if (ratio <= 0.25) {
      ui.puzzleWarning.classList.add("urgent");
    }

    if (puzzle.timeLeft <= 0) {
      puzzle.timeLeft = 0;
      ui.puzzleTimerBar.style.width = "0%";
      finishPuzzle(false);
    }
  }

  /* =========================================================
     11. ATURDIMIENTO Y APAGÓN
     ========================================================= */
  function startStun(penalty) {
    if (!game) return;

    game.mode = "stunned";
    game.stun.remaining = CONFIG.STUN_TIME;
    game.stun.total = CONFIG.STUN_TIME;
    game.stun.penalty = penalty;

    turnOffAllLights();
    closeCameraImmediate();
    game.view = "center";
    refreshViewUI();

    ui.stunPenalty.textContent = `−${penalty}% ENERGÍA`;
    ui.stunTimerBar.style.width = "100%";
    ui.stunOverlay.classList.remove("is-hidden");
    ui.stunOverlay.setAttribute("aria-hidden", "false");
    playStunSound();
    renderHUD();
  }

  function updateStun(dt) {
    if (!game || game.mode !== "stunned") return;
    game.stun.remaining -= dt;
    const ratio = clamp(game.stun.remaining / game.stun.total, 0, 1);
    ui.stunTimerBar.style.width = `${(ratio * 100).toFixed(1)}%`;

    if (game.stun.remaining > 0) return;

    ui.stunOverlay.classList.add("is-hidden");
    ui.stunOverlay.setAttribute("aria-hidden", "true");

    if (game.power <= 0) {
      beginBlackout();
      return;
    }

    game.mode = "playing";
    playRecoverSound();
    renderHUD();
    updateInteractionUI(true);
    showToast("Recuperas el conocimiento. La vigilancia continúa.", true);
  }

  function beginBlackout() {
    if (!game || isTerminalMode()) return;

    game.mode = "blackout";
    game.blackoutTimer = CONFIG.BLACKOUT_TIME;
    game.power = 0;

    turnOffAllLights();
    closeCameraImmediate();
    game.view = "center";
    refreshViewUI();

    ui.blackoutOverlay.classList.remove("is-hidden");
    ui.blackoutOverlay.setAttribute("aria-hidden", "false");
    stopAmbient(0.7);
    playPowerDown();
    renderHUD();
  }

  function updateBlackout(dt) {
    if (!game || game.mode !== "blackout") return;
    game.blackoutTimer -= dt;
    if (game.blackoutTimer <= 0) {
      triggerDeath("domdom", "power");
    }
  }

  /* =========================================================
     12. MUERTE, JUMP SCARES Y VICTORIA
     ========================================================= */
  function getDeathCopy(killer, reason) {
    if (killer === "bombom") {
      if (reason === "light") {
        return "Encendiste el foco sobre la puerta derecha. BomBom llevaba demasiado tiempo esperando en la oscuridad. El morado y el azul fueron lo último que viste.";
      }
      return "El rugido grave y metálico era BomBom. Estaba frente a la puerta derecha, pero nunca la cerraste. Cruzó la oficina y el estruendo retumbó en tus oídos.";
    }

    if (killer === "pumpum") {
      if (reason === "light") {
        return "La luz del pasillo izquierdo reveló una sonrisa rosada. PumPum ya estaba frente a la puerta. La trampilla se cerró demasiado tarde.";
      }
      return "Escuchaste el rugido agudo y chirriante de PumPum detrás de la puerta izquierda. No cerraste a tiempo. La puerta se abrió sola y el chillido cesó.";
    }

    if (reason === "puzzle") {
      return "DomDom apareció por tercera vez. La secuencia se deshizo entre tus dedos y sus ojos rojos cubrieron la habitación. Esta vez no hubo aturdimiento ni amanecer.";
    }

    if (reason === "power") {
      return "La energía se agotó por completo. En la oscuridad absoluta, DomDom entró en la oficina. Nadie oyó cómo se cerró la puerta.";
    }

    return "DomDom te encontró dentro de la habitación. Sus ojos rojos fueron lo último que recordaste antes de que todo se apagara.";
  }

  function triggerDeath(killer, reason) {
    if (!game || isTerminalMode()) return;

    game.mode = "jumpscare";
    game.killedBy = killer;
    game.deathReason = reason;
    clearManagedTimeouts();
    hideAllOverlays();
    turnOffAllLights();
    game.cameraOpen = false;
    game.view = "center";
    stopAmbient(0.08);
    playJumpscareSound(killer);

    ui.scareOverlay.dataset.killer = killer;
    ui.scareBot.innerHTML = botMarkup(killer);
    ui.scareName.textContent = BOT_INFO[killer].display;
    ui.scareOverlay.classList.remove("is-hidden");
    ui.scareOverlay.setAttribute("aria-hidden", "false");

    scheduleTimeout(() => showDeathScreen(killer, reason), CONFIG.SCARE_TIME);
  }

  function showDeathScreen(killer, reason) {
    if (!game) return;

    game.mode = "death";
    const hourText = formatHour(currentHourIndex());
    const bot = BOT_INFO[killer] || BOT_INFO.domdom;

    ui.scareOverlay.classList.add("is-hidden");
    ui.scareOverlay.setAttribute("aria-hidden", "true");

    ui.deathPortrait.innerHTML = botMarkup(killer);
    ui.deathTitle.textContent = `${bot.display} TE ENCONTRÓ`;
    ui.deathDescription.textContent = getDeathCopy(killer, reason);
    ui.deathNight.textContent = `NOCHE ${game.night}`;
    ui.deathCode.textContent = bot.deathCode;
    ui.deathPower.textContent = `${Math.ceil(clamp(game.power, 0, 100))}%`;
    ui.deathTime.textContent = hourText;
    ui.deathHour.textContent = hourText;

    ui.deathOverlay.classList.remove("is-hidden");
    ui.deathOverlay.setAttribute("aria-hidden", "false");
    ui.retryButton.focus({ preventScroll: true });
  }

  function triggerVictory() {
    if (!game || isTerminalMode()) return;

    const completedNight = game.night;
    const isFinalNight = completedNight >= 3;
    game.mode = "victory";
    game.elapsed = CONFIG.NIGHT_MS;
    game.power = clamp(game.power, 0, 100);
    clearManagedTimeouts();
    turnOffAllLights();
    closeCameraImmediate();
    hideAllOverlays();
    game.view = "center";
    refreshViewUI();
    renderHUD();
    stopAmbient(0.65);
    playVictorySound();

    ui.victoryEyebrow.textContent = isFinalNight
      ? "TRES NOCHES // CONTRATO COMPLETADO"
      : `NOCHE ${completedNight} SUPERADA // 06:00 AM`;
    ui.victoryDescription.textContent = isFinalNight
      ? "Has sobrevivido a las tres noches. El contrato ha terminado y el sol vuelve a salir sobre la oficina."
      : `Sobreviviste a la noche ${completedNight}. La noche ${completedNight + 1} será más difícil: más vigilancia, más fusibles y menos margen.`;
    ui.playAgainButton.textContent = isFinalNight
      ? "Volver a la noche 1"
      : `Comenzar noche ${completedNight + 1}`;
    ui.victoryPower.textContent = `${Math.ceil(game.power)}%`;
    ui.victoryDomdom.textContent = `${Math.min(game.domdom.appearances, 3)} / 3`;
    ui.victoryDoors.textContent = String(game.stats.doorsClosed);
    ui.victoryOverlay.classList.remove("is-hidden");
    ui.victoryOverlay.setAttribute("aria-hidden", "false");
    ui.playAgainButton.focus({ preventScroll: true });

    // La siguiente partida empieza en la noche 2/3, o vuelve a la 1 tras el contrato.
    currentNight = isFinalNight ? 1 : completedNight + 1;
  }

  /* =========================================================
     13. CONTROLES
     ========================================================= */
  function openHelp() {
    initAudio();
    ui.helpModal.classList.remove("is-hidden");
    ui.helpModal.setAttribute("aria-hidden", "false");
    ui.helpStartButton.focus({ preventScroll: true });
  }

  function closeHelp() {
    ui.helpModal.classList.add("is-hidden");
    ui.helpModal.setAttribute("aria-hidden", "true");
  }

  function handleAction(action) {
    if (!game || game.mode !== "playing") return;
    switch (action) {
      case "look-left":
        setView("left");
        break;
      case "look-center":
        setView("center");
        break;
      case "look-right":
        setView("right");
        break;
      case "light":
        toggleLight();
        break;
      case "door":
        toggleDoor();
        break;
      case "toggle-cameras":
        toggleCameras();
        break;
      default:
        break;
    }
  }

  function bindEvents() {
    ui.startButton.addEventListener("click", () => {
      initAudio();
      startGame();
    });

    ui.helpButton.addEventListener("click", openHelp);
    ui.closeHelpButton.addEventListener("click", closeHelp);
    ui.helpBackButton.addEventListener("click", closeHelp);
    ui.helpStartButton.addEventListener("click", () => {
      closeHelp();
      initAudio();
      startGame();
    });

    ui.helpModal.addEventListener("click", (event) => {
      if (event.target === ui.helpModal) closeHelp();
    });

    document.addEventListener("click", (event) => {
      const audioDemo = event.target.closest("[data-demo-sound]");
      if (audioDemo) {
        initAudio();
        playDoorCue(audioDemo.dataset.demoSound);
        return;
      }

      const actionElement = event.target.closest("[data-action]");
      if (actionElement && !actionElement.disabled) {
        handleAction(actionElement.dataset.action);
        return;
      }

      const fuseButton = event.target.closest("[data-fuse-polarity]");
      if (fuseButton) {
        handleFuseRepair(Number(fuseButton.dataset.fusePolarity));
        return;
      }

      const cameraButton = event.target.closest("[data-camera]");
      if (cameraButton) {
        selectCamera(cameraButton.dataset.camera);
        return;
      }

      const runeButton = event.target.closest("[data-rune]");
      if (runeButton) {
        handleRuneInput(Number(runeButton.dataset.rune));
      }
    });

    ui.contractAccept.addEventListener("click", acceptContract);
    ui.retryButton.addEventListener("click", startGame);
    ui.playAgainButton.addEventListener("click", startGame);
    ui.menuFromDeath.addEventListener("click", returnToMenu);
    ui.menuFromVictory.addEventListener("click", returnToMenu);

    document.addEventListener("keydown", (event) => {
      const key = event.key.toLowerCase();
      const code = event.code;

      if (!ui.helpModal.classList.contains("is-hidden")) {
        if (key === "escape") {
          event.preventDefault();
          closeHelp();
        }
        return;
      }

      if (!game) {
        if (key === "enter") {
          event.preventDefault();
          initAudio();
          startGame();
        }
        return;
      }

      if (game.mode === "contract") {
        if (key === "enter") {
          event.preventDefault();
          acceptContract();
        }
        return;
      }

      if (game.mode === "puzzle") {
        if (["1", "2", "3", "4"].includes(key)) {
          event.preventDefault();
          if (!event.repeat) handleRuneInput(Number(key) - 1);
        }
        return;
      }

      if (game.mode === "death" || game.mode === "victory") {
        if (key === "enter" || key === "r") {
          event.preventDefault();
          startGame();
        } else if (key === "escape") {
          event.preventDefault();
          returnToMenu();
        }
        return;
      }

      if (game.mode !== "playing") return;

      if (!game.cameraOpen && !event.repeat) {
        if (key === "a" || key === "arrowleft") {
          event.preventDefault();
          setView("left");
          return;
        }
        if (key === "d" || key === "arrowright") {
          event.preventDefault();
          setView("right");
          return;
        }
        if (key === "s" || key === "arrowdown") {
          event.preventDefault();
          setView("center");
          return;
        }
        if (key === "l") {
          event.preventDefault();
          toggleLight();
          return;
        }
        if (key === " " || code === "Space") {
          // Permite activar con teclado los fusibles que tengan el foco.
          if (event.target.closest("[data-fuse-polarity]")) return;
          event.preventDefault();
          toggleDoor();
          return;
        }
      }

      if (key === "c") {
        event.preventDefault();
        if (!event.repeat) toggleCameras();
        return;
      }

      if (game.cameraOpen && !event.repeat) {
        if (key === "escape") {
          event.preventDefault();
          setCameraOpen(false);
          return;
        }
        const cameraKey = Number(key);
        if (cameraKey >= 1 && cameraKey <= 6) {
          event.preventDefault();
          selectCamera(CONFIG.CAMERA_ORDER[cameraKey - 1]);
        }
      }
    });

    // Los navegadores exigen una interacción para habilitar el audio.
    const unlockMenuAudio = () => {
      if (game || ui.menuScreen.classList.contains("is-hidden")) return;
      initAudio();
      startMenuMusic();
    };
    window.addEventListener("pointerdown", unlockMenuAudio, { once: true });
    window.addEventListener("keydown", unlockMenuAudio, { once: true });

    window.addEventListener("beforeunload", () => {
      clearManagedTimeouts();
      if (loopId) cancelAnimationFrame(loopId);
      stopMenuMusic(0);
      stopAmbient(0);
    });
  }

  /* =========================================================
     14. BUCLE PRINCIPAL
     ========================================================= */
  function gameLoop(now) {
    loopId = requestAnimationFrame(gameLoop);
    const dt = clamp((now - lastFrame) / 1000, 0, 0.1);
    lastFrame = now;

    if (!game) return;

    if (game.mode === "playing") {
      updatePlaying(dt);
    } else if (game.mode === "puzzle") {
      updatePuzzle(dt);
    } else if (game.mode === "stunned") {
      updateStun(dt);
    } else if (game.mode === "blackout") {
      updateBlackout(dt);
    }
  }

  /* =========================================================
     15. INICIALIZACIÓN
     ========================================================= */
  function init() {
    cachedUI();
    buildMenuBots();
    buildOfficeTrio();
    buildCameraButtons();
    ui.puzzleDom.innerHTML = botMarkup("domdom");
    bindEvents();

    ui.gameScreen.classList.add("is-hidden");
    ui.helpModal.classList.add("is-hidden");
    ui.helpModal.setAttribute("aria-hidden", "true");
    ui.nightValue.textContent = String(currentNight);
    ui.cameraOverlay.setAttribute("aria-hidden", "true");
    ui.puzzleOverlay.setAttribute("aria-hidden", "true");
    ui.stunOverlay.setAttribute("aria-hidden", "true");
    ui.scareOverlay.setAttribute("aria-hidden", "true");
    ui.deathOverlay.setAttribute("aria-hidden", "true");
    ui.victoryOverlay.setAttribute("aria-hidden", "true");
    ui.contractModal.setAttribute("aria-hidden", "true");

    lastFrame = performance.now();
    loopId = requestAnimationFrame(gameLoop);
  }

  init();
})();

import { TableDisk, readChecked } from './adf.mjs';

const launcher = document.getElementById('launcher');
const chooser = document.getElementById('disk');
const choose = document.getElementById('choose');
const play = document.getElementById('play');
const status = document.getElementById('status');
const game = document.getElementById('game');
const display = document.getElementById('display');
const canvas = document.getElementById('canvas');
const fullscreen = document.getElementById('fullscreen');
const toolbar = document.getElementById('toolbar');
const controls = document.getElementById('touch');
const controlsOption = document.getElementById('show-controls');
const scoreStatus = document.getElementById('score-status');
const desktopOverlay = document.getElementById('desktop-overlay');
const volume = document.getElementById('game-volume');
const portraitPrompt = document.getElementById('portrait-prompt');
const landscape = matchMedia('(orientation: landscape)');
const volumeKey = 'slamtilt:volume';
const runtimeVersion = new URL(import.meta.url).search;

let imported;
let pending = false;
let playing = false;
let runtimeFailed = false;
let gameAspect;
let stopFrameLoop;
let wakeFrameLoop;

// A reload returns to the disk chooser, even if the last page was playing.
if (history.state?.slamTiltPlaying) history.replaceState({ ...history.state, slamTiltPlaying: false }, '');

// A mouse can give a phone or tablet a fine pointer, including iPadOS in desktop mode.
const mobileDevice = Boolean(navigator.userAgentData?.mobile
  || /\b(?:Android|iPad|iPhone|iPod)\b/.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
desktopOverlay.hidden = mobileDevice;

try {
  const saved = localStorage.getItem(volumeKey);
  if (saved !== null && /^\d{1,3}$/.test(saved)) volume.value = saved;
} catch (error) {
  console.warn('Could not read the saved game volume:', error);
}

volume.addEventListener('input', () => {
  if (playing) Module._slamtilt_web_volume(volume.valueAsNumber);
});
volume.addEventListener('change', () => {
  try {
    localStorage.setItem(volumeKey, volume.value);
  } catch (error) {
    console.warn('Could not save the game volume:', error);
  }
});
volume.addEventListener('pointerup', () => {
  if (playing) canvas.focus({ preventScroll: true });
});

function message(text, error = false) {
  status.textContent = text;
  status.classList.toggle('error', error);
}

function scoreWarning(text) {
  scoreStatus.textContent = text;
  scoreStatus.hidden = !text;
}

function scoreKey(table) {
  return `slamtilt:high-scores:v1:${table}`;
}

function restoreScores(table, bytes) {
  try {
    const encoded = localStorage.getItem(scoreKey(table));
    if (encoded === null) return false;
    if (encoded.length !== 4 * Math.ceil(bytes.length / 3)) throw new Error('Invalid score size');
    const records = atob(encoded);
    if (records.length !== bytes.length) throw new Error('Invalid score size');
    bytes.set(Uint8Array.from(records, character => character.charCodeAt(0)));
    return true;
  } catch (error) {
    console.error('Could not read saved Slam Tilt scores:', error);
    scoreWarning('Could not read saved high scores for this table.');
    return false;
  }
}

function saveScores(table, bytes) {
  try {
    localStorage.setItem(scoreKey(table), btoa(String.fromCharCode(...bytes)));
    scoreWarning('');
    return true;
  } catch (error) {
    console.error('Could not save Slam Tilt scores:', error);
    scoreWarning('Could not save high scores in this browser.');
    return false;
  }
}

async function get(url, type) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load ${url} (HTTP ${response.status}).`);
  return response[type]();
}

function startupPacket(prefix, files, digest) {
  const size = prefix.byteLength + files.reduce((total, bytes) => total + 4 + bytes.length, 32);
  const packet = new Uint8Array(size);
  const data = new DataView(packet.buffer);
  packet.set(new Uint8Array(prefix));
  let offset = prefix.byteLength;
  for (const bytes of files) {
    data.setUint32(offset, bytes.length);
    packet.set(bytes, offset + 4);
    offset += 4 + bytes.length;
  }
  for (let i = 0; i < 32; ++i) packet[offset + i] = Number.parseInt(digest.slice(2 * i, 2 * i + 2), 16);
  return packet;
}

function resize() {
  if (!playing) return;
  const viewport = display.getBoundingClientRect();
  const density = devicePixelRatio * (window.visualViewport?.scale ?? 1);
  const cssWidth = gameAspect ? Math.min(viewport.width, viewport.height * gameAspect) : viewport.width;
  const cssHeight = gameAspect ? Math.min(viewport.height, viewport.width / gameAspect) : viewport.height;
  const width = Math.max(1, Math.floor(cssWidth * density));
  const height = Math.max(1, Math.floor(cssHeight * density));
  canvas.style.setProperty('width', `${width / density}px`, 'important');
  canvas.style.setProperty('height', `${height / density}px`, 'important');
}

function showLauncher(error) {
  stopFrameLoop?.();
  playing = false;
  gameAspect = undefined;
  releaseTouch();
  document.body.append(portraitPrompt, desktopOverlay);
  game.hidden = true;
  launcher.hidden = false;
  if (document.fullscreenElement === game) document.exitFullscreen().catch(console.error);
  if (history.state?.slamTiltPlaying) history.back();
  imported = undefined;
  play.disabled = true;
  choose.disabled = runtimeFailed;
  const warning = error || scoreStatus.textContent;
  message(warning || 'Choose an ADF to play another table.', Boolean(warning));
  choose.focus();
}

function startFrameLoop() {
  const { port1, port2 } = new MessageChannel();
  let timer;
  let refresh;
  let deadline;
  const cancelRefresh = () => {
    if (refresh === undefined) return;
    cancelAnimationFrame(refresh);
    refresh = undefined;
  };
  stopFrameLoop = () => {
    clearTimeout(timer);
    cancelRefresh();
    port1.onmessage = null;
    port1.close();
    port2.close();
    stopFrameLoop = undefined;
    wakeFrameLoop = undefined;
  };
  const post = () => {
    timer = undefined;
    cancelRefresh();
    port2.postMessage(null);
  };
  const frame = () => {
    timer = undefined;
    cancelRefresh();
    const delay = Module._slamtilt_web_frame();
    if (delay < 0 || !playing) return;
    deadline = performance.now() + delay;
    // Ordinary waits can run from the timer directly. A message breaks
    // the nested timer chain when fields are close to their deadlines.
    if (delay >= 4 || document.hidden) timer = setTimeout(frame, Math.ceil(delay));
    else if (delay > 0) timer = setTimeout(post, Math.ceil(delay));
    else post();
  };
  const onRefresh = () => {
    refresh = undefined;
    if (document.hidden) return;
    if (performance.now() < deadline) {
      refresh = requestAnimationFrame(onRefresh);
      return;
    }
    clearTimeout(timer);
    frame();
  };
  // A browser can defer timers during a touch gesture. Let the next
  // display refresh also run the pending PAL field once it is due.
  wakeFrameLoop = () => {
    if (timer !== undefined && refresh === undefined && !document.hidden) {
      refresh = requestAnimationFrame(onRefresh);
    }
  };
  port1.onmessage = frame;
  post();
}

function portraitRequired() {
  return mobileDevice && landscape.matches;
}

function syncOrientation() {
  const blocked = portraitRequired();
  if (portraitPrompt.hidden === !blocked) return;
  if (blocked) releaseTouch();
  portraitPrompt.hidden = !blocked;
  for (const element of [launcher, toolbar, display, controls]) element.inert = blocked;
  if (!blocked && playing) {
    resize();
    canvas.focus({ preventScroll: true });
  }
}

function readGamepads() {
  if (!document.hasFocus() || !navigator.getGamepads) return 0;
  let pads;
  try {
    pads = navigator.getGamepads();
  } catch (error) {
    if (error.name === 'SecurityError') return 0;
    throw error;
  }
  // Use the Standard Gamepad indices shared with GamepadButton in C++.
  let buttons = 0;
  for (const pad of pads) {
    if (!pad?.connected || pad.mapping !== 'standard') continue;
    for (let index = 0; index < Math.min(16, pad.buttons.length); index++) {
      const button = pad.buttons[index];
      const trigger = index === 6 || index === 7;
      if (trigger ? button.value >= 0.5 : button.pressed) buttons |= 1 << index;
    }
  }
  return buttons;
}

const runtime = new Promise((resolve, reject) => {
  globalThis.Module = {
    canvas,
    onRuntimeInitialized: resolve,
    onSlamTiltEnd: showLauncher,
    readSlamTiltGamepads: readGamepads,
    slamTiltPortraitRequired: portraitRequired,
    setSlamTiltAspect: (width, height) => {
      gameAspect = width / height;
      resize();
    },
    locateFile: (file, prefix) => prefix + file + (file === 'slamtilt.wasm' ? runtimeVersion : ''),
    restoreSlamTiltScores: restoreScores,
    saveSlamTiltScores: saveScores,
    slamTiltScoreWarning: scoreWarning,
    onAbort: reason => {
      runtimeFailed = true;
      reject(new Error(String(reason)));
      showLauncher(`Slam Tilt stopped: ${reason}. Reload the page to try again.`);
    },
  };
  const script = document.createElement('script');
  script.src = `slamtilt.js${runtimeVersion}`;
  script.onerror = () => reject(new Error('Could not load the browser runtime.'));
  document.head.append(script);
});
runtime.catch(error => {
  runtimeFailed = true;
  showLauncher(error.message);
});

async function importDisk(files) {
  if (pending || playing || runtimeFailed || files.length === 0) return;
  imported = undefined;
  play.disabled = true;
  choose.disabled = true;
  pending = true;
  message('Reading the ADF…');
  try {
    if (files.length !== 1) throw new Error('Choose one ADF for the table you want to play.');
    const [file] = files;
    if (file.size !== 901120) throw new Error('Choose a standard 880 KiB Slam Tilt table ADF.');
    if (!crypto.subtle) throw new Error('Open the launcher over HTTPS or localhost to verify the ADF.');
    const disk = new TableDisk(new Uint8Array(await file.arrayBuffer()));
    const tables = await get('tables.json', 'json');
    const table = tables.find(entry => entry.volume.toLowerCase() === disk.volume.toLowerCase());
    if (!table) throw new Error('Choose a Slam Tilt table ADF from Disks 2–5.');
    const filesFromDisk = await Promise.all(table.files.map(entry => readChecked(disk, entry)));
    const [prefix] = await Promise.all([get(table.startup, 'arrayBuffer'), runtime]);
    imported = { table, packet: startupPacket(prefix, filesFromDisk, table.preparedChipSha256) };
    message(`${table.title} is ready.`);
    play.disabled = false;
    play.focus();
  } catch (error) {
    message(error.message, true);
  } finally {
    pending = false;
    chooser.value = '';
    choose.disabled = runtimeFailed;
  }
}

choose.addEventListener('click', () => chooser.click());
chooser.addEventListener('change', () => importDisk(chooser.files));
document.addEventListener('dragover', event => {
  if (!event.dataTransfer.types.includes('Files')) return;
  event.preventDefault();
  if (!playing && !pending) launcher.classList.add('dragging');
});
document.addEventListener('dragleave', event => {
  if (!event.relatedTarget) launcher.classList.remove('dragging');
});
document.addEventListener('drop', event => {
  if (!event.dataTransfer.files.length) return;
  event.preventDefault();
  launcher.classList.remove('dragging');
  importDisk(event.dataTransfer.files);
});

play.addEventListener('click', () => {
  if (!imported || playing || portraitRequired()) return;
  try {
    const { table, packet } = imported;
    Module.FS.writeFile('/startup.bin', packet);
    document.getElementById('table-name').textContent = table.title;
    scoreWarning('');
    toolbar.hidden = controls.hidden = !controlsOption.checked;
    game.classList.toggle('with-controls', controlsOption.checked);
    display.append(desktopOverlay);
    game.append(portraitPrompt);
    history.pushState({ slamTiltPlaying: true }, '');
    playing = true;
    launcher.hidden = true;
    game.hidden = false;
    resize();
    canvas.focus({ preventScroll: true });
    Module._slamtilt_web_volume(volume.valueAsNumber);
    Module._slamtilt_web_start(table.id);
    if (playing) startFrameLoop();
    if (playing && mobileDevice && screen.orientation?.lock && document.fullscreenEnabled) {
      game.requestFullscreen().catch(() => { /* Portrait is enforced in the browser tab as well. */ });
    }
  } catch (error) {
    showLauncher(error.message);
  }
});

new ResizeObserver(resize).observe(display);
window.visualViewport?.addEventListener('resize', resize);
document.addEventListener('fullscreenchange', () => {
  fullscreen.textContent = document.fullscreenElement ? 'Exit fullscreen' : 'Fullscreen';
  if (mobileDevice && document.fullscreenElement === game) {
    screen.orientation?.lock?.('portrait').catch(() => { /* The rotate prompt handles unsupported locks. */ });
  }
  resize();
});
fullscreen.hidden = !document.fullscreenEnabled;
async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await game.requestFullscreen();
  } catch (error) {
    console.error('Could not change the display mode:', error);
  }
  if (playing) canvas.focus({ preventScroll: true });
}
fullscreen.addEventListener('click', toggleFullscreen);
document.getElementById('close').addEventListener('click', () => Module._slamtilt_web_close());
window.addEventListener('popstate', () => {
  if (playing && !history.state?.slamTiltPlaying) Module._slamtilt_web_close();
});
for (const type of ['keydown', 'keyup']) {
  document.addEventListener(type, event => {
    if (!playing || !event.altKey || event.code !== 'Enter' || !document.fullscreenEnabled) return;
    event.preventDefault();
    event.stopPropagation();
    if (type === 'keydown' && !event.repeat) toggleFullscreen();
  }, true);
}

const leftFlipper = 0x60;
const rightFlipper = 0x61;
const nudgeKey = 0x40;
const startKey = 0x50;
const launchKey = 0x44;
const holdAction = { none: 0, start: 1, launch: 3 };
const holdDelay = 350;
const flickDistance = 32;
const flickTime = 230;
const pointers = new Map();
const pulses = new Map();
let launchPointer;

function sendKey(key, down) {
  if (!playing) return;
  Module._slamtilt_web_key(key, down);
  wakeFrameLoop?.();
}

function keyHeld(key) {
  return pulses.has(key) || [...pointers.values()].some(pointer => pointer.key === key);
}

function pulseKey(key) {
  if (keyHeld(key)) return;
  sendKey(key, true);
  pulses.set(key, setTimeout(() => {
    pulses.delete(key);
    if (!keyHeld(key)) sendKey(key, false);
  }, 80));
}

function press(event, element, key, button) {
  event.preventDefault();
  const wasHeld = keyHeld(key);
  const pointer = { key, button, x: event.clientX, y: event.clientY, time: event.timeStamp };
  element.setPointerCapture(event.pointerId);
  pointers.set(event.pointerId, pointer);
  button?.classList.add('held');
  if (!wasHeld) sendKey(key, true);
  return pointer;
}

function release(pointerId) {
  const pointer = pointers.get(pointerId);
  if (!pointer) return;
  clearTimeout(pointer.hold);
  pointers.delete(pointerId);
  if (launchPointer === pointer) launchPointer = undefined;
  if (pointer.button && ![...pointers.values()].some(entry => entry.button === pointer.button))
    pointer.button.classList.remove('held');
  if (!keyHeld(pointer.key)) sendKey(pointer.key, false);
}

function releaseTouch() {
  for (const pointerId of pointers.keys()) release(pointerId);
  for (const [key, timer] of pulses) {
    clearTimeout(timer);
    sendKey(key, false);
  }
  pulses.clear();
}

function holdToLaunch(pointer) {
  if (!playing || portraitRequired() || launchPointer) return;
  const action = Module._slamtilt_web_hold_action();
  if (action === holdAction.none) return;
  launchPointer = pointer;
  if (action === holdAction.launch) {
    pulseKey(launchKey);
    return;
  }
  // Attract mode needs the original F1 edge before the shooter lane is ready.
  if (action === holdAction.start) pulseKey(startKey);
  function launchWhenReady() {
    if (!playing || launchPointer !== pointer) return;
    if (Module._slamtilt_web_hold_action() === holdAction.launch) pulseKey(launchKey);
    else setTimeout(launchWhenReady, 20);
  }
  launchWhenReady();
}

display.addEventListener('pointerdown', event => {
  if (!playing || portraitRequired() || event.button !== 0 || event.pointerType === 'mouse') return;
  const rect = display.getBoundingClientRect();
  const key = event.clientX < rect.left + rect.width / 2 ? leftFlipper : rightFlipper;
  const pointer = press(event, display, key);
  pointer.hold = setTimeout(() => holdToLaunch(pointer), holdDelay);
});
display.addEventListener('pointermove', event => {
  const pointer = pointers.get(event.pointerId);
  if (!pointer || pointer.moved) return;
  if (Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) < flickDistance) return;
  pointer.moved = true;
  clearTimeout(pointer.hold);
  if (launchPointer === pointer) launchPointer = undefined;
  if (event.timeStamp - pointer.time <= flickTime) pulseKey(nudgeKey);
});

for (const button of controls.querySelectorAll('[data-key]')) {
  const key = Number(button.dataset.key);
  button.addEventListener('pointerdown', event => {
    if (playing && !portraitRequired() && event.button === 0) press(event, button, key, button);
  });
  button.addEventListener('click', event => {
    if (playing && !portraitRequired() && event.detail === 0) pulseKey(key);
  });
}
for (const element of [display, controls]) {
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    element.addEventListener(type, event => release(event.pointerId));
  }
}
window.addEventListener('blur', releaseTouch);
document.addEventListener('visibilitychange', () => { if (document.hidden) releaseTouch(); });
landscape.addEventListener('change', syncOrientation);
syncOrientation();

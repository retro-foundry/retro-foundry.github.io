const version = self.location.search;
importScripts('worker-renderer.js' + version);

let renderer;
let active = false;
let paused = false;
let timer;
let stepQueued = false;
let gamepadButtons = 0;
let action = 0;
let aspect = 0;
let audio;
let audioClockCorrection = 0;
let lastAudioClockReport = 0;
let storedScores;
let scoreWrite;
let writeSequence = 0;

const { port1, port2 } = new MessageChannel();
port1.onmessage = () => {
  stepQueued = false;
  if (active) step();
};

function queueStep() {
  timer = undefined;
  if (!stepQueued) {
    stepQueued = true;
    port2.postMessage(null);
  }
}

function updateAction() {
  const next = Module._slamtilt_web_hold_action();
  if (next !== action) {
    action = next;
    postMessage({ type: 'hold', action });
  }
}

function step() {
  timer = undefined;
  const delay = Module._slamtilt_web_frame();
  if (!active || delay < 0) return;
  updateAction();
  if (delay >= 4) timer = setTimeout(step, Math.ceil(delay));
  else if (delay > 0) timer = setTimeout(queueStep, Math.ceil(delay));
  else queueStep();
}

function finish(error) {
  clearTimeout(timer);
  active = false;
  audio?.close();
  audio = undefined;
  postMessage({ type: 'ended', error });
}

self.Module = {
  locateFile: (name, prefix) => prefix + name + version,
  onRuntimeInitialized() { postMessage({ type: 'ready' }); },
  onSlamTiltEnd: finish,
  onAbort(reason) { postMessage({ type: 'fatal', error: String(reason) }); },
  readInitialGamepadButtons() { return gamepadButtons; },
  readAudioClockCorrection() {
    // A suspended audio device should not keep steering the simulation.
    return audioClockCorrection && performance.now() - lastAudioClockReport < 500 ? audioClockCorrection : 0;
  },
  slamTiltPortraitRequired() { return paused; },
  publishWorkerField(heap, pixels, width, height, changed, sameFramebuffer, logicalWidth, logicalHeight) {
    renderer.draw(heap, pixels, width, height, changed, sameFramebuffer);
    const ratio = logicalWidth / logicalHeight;
    if (ratio !== aspect) {
      aspect = ratio;
      postMessage({ type: 'aspect', ratio });
    }
  },
  captureWorkerAudio(bytes) {
    const pcm = bytes.slice().buffer;
    audio.postMessage(pcm, [pcm]);
  },
  restoreSlamTiltScores(_table, bytes) {
    if (!storedScores) return false;
    if (bytes.length !== storedScores.length) {
      Module.slamTiltScoreWarning('Could not read saved high scores for this table.');
      return false;
    }
    bytes.set(storedScores);
    return true;
  },
  saveSlamTiltScores(table, bytes) {
    if (scoreWrite?.table === table && bytes.every((byte, index) => byte === scoreWrite.bytes[index])) {
      if (scoreWrite.saved === undefined) return 2;
      const saved = scoreWrite.saved;
      scoreWrite = undefined;
      return saved;
    }
    scoreWrite = { table, id: ++writeSequence, bytes: bytes.slice() };
    postMessage({ type: 'scores', table, id: scoreWrite.id, bytes: scoreWrite.bytes });
    return 2;
  },
  slamTiltScoreWarning(error) { postMessage({ type: 'scoreWarning', error }); },
};

onmessage = ({ data }) => {
  switch (data.type) {
    case 'init':
      renderer = createRenderer(data.canvas);
      data.canvas.addEventListener('webglcontextlost', () => {
        postMessage({ type: 'fatal', error: 'The graphics context was lost.' });
      });
      importScripts('worker-runtime.js' + version);
      break;
    case 'start':
      active = true;
      gamepadButtons = data.gamepad;
      action = aspect = 0;
      paused = data.paused;
      storedScores = data.scores;
      scoreWrite = undefined;
      audio = data.audio;
      audioClockCorrection = 0;
      audio.onmessage = ({ data: correction }) => {
        if (active && !paused) {
          audioClockCorrection = correction;
          lastAudioClockReport = performance.now();
        }
      };
      renderer.reset();
      Module.FS.writeFile('/startup.bin', data.packet);
      Module._slamtilt_web_start(data.table);
      if (active) {
        updateAction();
        queueStep();
      }
      break;
    case 'key':
      if (active) Module._slamtilt_web_key(data.key, data.down);
      break;
    case 'keyboard':
      if (active) Module._slamtilt_web_keyboard(data.key, data.down);
      break;
    case 'view':
      if (active) Module._slamtilt_web_switch_view();
      break;
    case 'gamepad':
      gamepadButtons = data.buttons;
      if (active && !paused) Module._slamtilt_web_gamepad(gamepadButtons);
      break;
    case 'pause':
      if (active && paused && !data.paused) Module._slamtilt_web_gamepad(gamepadButtons);
      paused = data.paused;
      if (paused) audioClockCorrection = 0;
      break;
    case 'close':
      if (active) {
        Module._slamtilt_web_close();
        clearTimeout(timer);
        queueStep();
      }
      break;
    case 'saved':
      if (scoreWrite?.id === data.id) scoreWrite.saved = data.saved;
      break;
  }
};

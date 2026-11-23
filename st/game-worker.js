const version = self.location.search;

let video;
let videoWidth = 0;
let videoHeight = 0;
let fullUpload = true;
const videoBurstLimit = 4;
let videoLimit = videoBurstLimit;
let videoInFlight = 0;
let videoBuffer;
let skippedRows;
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

function sendVideo(heap, pixels, width, height, changed, sameFramebuffer) {
  if (width !== videoWidth || height !== videoHeight || !changed || !sameFramebuffer) {
    fullUpload = true;
    skippedRows = undefined;
  }

  // Keep changes from fields skipped while the render queue is full.
  let dirty;
  if (!fullUpload) {
    dirty = new Uint16Array(heap.buffer, changed, height * 2);
    if (skippedRows) {
      for (let i = 0; i < dirty.length; i += 2) {
        skippedRows[i] = Math.min(skippedRows[i], dirty[i]);
        skippedRows[i + 1] = Math.max(skippedRows[i + 1], dirty[i + 1]);
      }
      dirty = skippedRows;
    } else if (videoInFlight >= videoLimit) {
      skippedRows = dirty.slice();
    }
  }
  if (videoInFlight >= videoLimit) return;

  const rectangles = [];
  let length = 0;
  if (fullUpload) {
    rectangles.push(0, 0, width, height);
    length = width * height * 4;
  } else {
    for (let first = 0; first < height;) {
      while (first < height && dirty[2 * first] >= dirty[2 * first + 1]) ++first;
      if (first === height) break;
      let end = first + 1;
      let left = dirty[2 * first];
      let right = dirty[2 * first + 1];
      // Upload small gaps with their neighbours to avoid a separate WebGL call.
      for (let row = end; row < height && row - end <= 4; ++row) {
        const rowLeft = dirty[2 * row];
        const rowRight = dirty[2 * row + 1];
        if (rowLeft >= rowRight) continue;
        left = Math.min(left, rowLeft);
        right = Math.max(right, rowRight);
        end = row + 1;
      }
      rectangles.push(left, first, right - left, end - first);
      length += (right - left) * (end - first) * 4;
      first = end;
    }
  }
  skippedRows = undefined;
  if (!length) return;

  const pitch = width * 4;
  const buffer = videoBuffer?.byteLength >= length ? videoBuffer : new ArrayBuffer(length);
  const frame = new Uint8Array(buffer, 0, length);
  let offset = 0;
  for (let i = 0; i < rectangles.length; i += 4) {
    let source = pixels + rectangles[i + 1] * pitch + rectangles[i] * 4;
    const rowBytes = rectangles[i + 2] * 4;
    const rows = rectangles[i + 3];
    if (rowBytes === pitch) {
      const bytes = rows * pitch;
      frame.set(heap.subarray(source, source + bytes), offset);
      offset += bytes;
    } else {
      for (let row = 0; row < rows; ++row) {
        frame.set(heap.subarray(source, source + rowBytes), offset);
        source += pitch;
        offset += rowBytes;
      }
    }
  }
  videoWidth = width;
  videoHeight = height;
  fullUpload = false;
  ++videoInFlight;
  videoBuffer = undefined;
  video.postMessage({ width, height, rectangles, pixels: frame }, [buffer]);
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
    sendVideo(heap, pixels, width, height, changed, sameFramebuffer);
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
      video = data.video;
      video.onmessage = ({ data: { buffer, renderMs } }) => {
        // Keep short bursts of frame traffic and limit a slow renderer to one field.
        videoLimit = renderMs > 20 ? 1 : videoBurstLimit;
        if (!videoBuffer || buffer.byteLength > videoBuffer.byteLength) videoBuffer = buffer;
        --videoInFlight;
      };
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
      if (paused) audio.postMessage(true);
      audio.onmessage = ({ data: correction }) => {
        if (active && !paused) {
          audioClockCorrection = correction;
          lastAudioClockReport = performance.now();
        }
      };
      fullUpload = true;
      skippedRows = undefined;
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
      if (active && paused !== data.paused) {
        paused = data.paused;
        audio.postMessage(paused);
        audioClockCorrection = 0;
        if (!paused) Module._slamtilt_web_gamepad(gamepadButtons);
      }
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

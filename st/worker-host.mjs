export function createWorkerHost(canvas, version, callbacks) {
  const screen = canvas.transferControlToOffscreen();
  const worker = new Worker(new URL('game-worker.js' + version, import.meta.url));
  let renderer;
  try {
    renderer = new Worker(new URL('worker-renderer.js' + version, import.meta.url));
  } catch (error) {
    worker.terminate();
    throw error;
  }
  const send = (type, fields = {}) => worker.postMessage({ type, ...fields });
  let resolveReady;
  let rejectReady;
  let workersInitializing = 2;
  let failed = false;
  const ready = new Promise((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  let session;
  let action = 0;
  let volume = 1;

  function releaseSession() {
    if (!session) return;
    cancelAnimationFrame(session.gamepadFrame);
    session.audio?.disconnect();
    session.context?.close().catch(console.error);
    session = undefined;
  }

  function stopWorkers() {
    worker.terminate();
    renderer.terminate();
  }

  function fail(error) {
    if (failed) return;
    failed = true;
    stopWorkers();
    releaseSession();
    if (workersInitializing) rejectReady(new Error(error));
    else callbacks.failed(error);
  }

  function workerReady() {
    if (--workersInitializing === 0) resolveReady();
  }

  function pollGamepads(current) {
    if (session !== current) return;
    const buttons = callbacks.readGamepads();
    if (buttons !== current.gamepad) {
      current.gamepad = buttons;
      send('gamepad', { buttons });
    }
    current.gamepadFrame = requestAnimationFrame(() => pollGamepads(current));
  }

  worker.onerror = renderer.onerror = event => {
    event.preventDefault();
    fail(event.message || 'Could not load the worker player.');
  };
  worker.onmessageerror = renderer.onmessageerror = () => fail('Could not receive data from the worker player.');
  renderer.onmessage = ({ data }) => {
    if (data.type === 'ready') workerReady();
    else if (data.type === 'fatal') fail(data.error);
  };
  worker.onmessage = ({ data }) => {
    switch (data.type) {
      case 'ready':
        workerReady();
        break;
      case 'fatal':
        fail(data.error);
        break;
      case 'aspect':
        if (session) callbacks.aspect(data.ratio);
        break;
      case 'hold':
        action = data.action;
        break;
      case 'ended':
        releaseSession();
        callbacks.ended(data.error);
        break;
      case 'scores':
        send('saved', { id: data.id, saved: callbacks.saveScores(data.table, data.bytes) });
        break;
      case 'scoreWarning':
        callbacks.scoreWarning(data.error);
        break;
    }
  };
  try {
    const { port1, port2 } = new MessageChannel();
    renderer.postMessage({ canvas: screen, video: port1 }, [screen, port1]);
    worker.postMessage({ type: 'init', video: port2 }, [port2]);
  } catch (error) {
    stopWorkers();
    throw error;
  }

  return {
    ready,
    async start(table, packet) {
      action = 0;
      const current = {};
      session = current;
      try {
        const context = new AudioContext({ sampleRate: 44100 });
        current.context = context;
        if (context.sampleRate !== 44100) throw new Error('The audio rate is unavailable.');
        await Promise.all([
          context.resume(),
          context.audioWorklet.addModule(new URL('worker-audio.js' + version, import.meta.url)),
        ]);
        if (session !== current) return;
        const audio = new AudioWorkletNode(context, 'slam-tilt-pcm', { outputChannelCount: [2] });
        current.audio = audio;
        audio.onprocessorerror = () => fail('The browser audio processor stopped.');
        audio.connect(context.destination);
        audio.port.postMessage(volume);
        const pcm = new MessageChannel();
        audio.port.postMessage(pcm.port1, [pcm.port1]);
        current.gamepad = callbacks.readGamepads();
        worker.postMessage({
          type: 'start', table, packet, audio: pcm.port2,
          paused: callbacks.paused(), scores: callbacks.readScores(table), gamepad: current.gamepad,
        }, [pcm.port2]);
        pollGamepads(current);
      } catch (error) {
        if (session === current) fail(error.message);
      }
    },
    close() {
      if (!session) return;
      if (session.audio) send('close');
      else {
        releaseSession();
        callbacks.ended();
      }
    },
    key(key, down) { send('key', { key, down }); },
    keyboard(key, down) { send('keyboard', { key, down }); },
    switchView() { send('view'); },
    syncPause() { send('pause', { paused: callbacks.paused() }); },
    holdAction() { return action; },
    setVolume(percent) {
      volume = percent / 100;
      session?.audio?.port.postMessage(volume);
    },
  };
}

// The browser equivalents of the SDL physical key mappings in amiga_keycode.hpp.
const rawKeys = {
  ControlLeft: 0x60,
  ControlRight: 0x61,
  Backquote: 0x00,
  Digit1: 0x01,
  Digit2: 0x02,
  Digit3: 0x03,
  Digit4: 0x04,
  Digit5: 0x05,
  Digit6: 0x06,
  Digit7: 0x07,
  Digit8: 0x08,
  Digit9: 0x09,
  Digit0: 0x0a,
  Minus: 0x0b,
  Equal: 0x0c,
  Backslash: 0x0d,
  Numpad0: 0x0f,
  KeyQ: 0x10,
  KeyW: 0x11,
  KeyE: 0x12,
  KeyR: 0x13,
  KeyT: 0x14,
  KeyY: 0x15,
  KeyU: 0x16,
  KeyI: 0x17,
  KeyO: 0x18,
  KeyP: 0x19,
  BracketLeft: 0x1a,
  BracketRight: 0x1b,
  Numpad1: 0x1d,
  Numpad2: 0x1e,
  Numpad3: 0x1f,
  KeyA: 0x20,
  KeyS: 0x21,
  KeyD: 0x22,
  KeyF: 0x23,
  KeyG: 0x24,
  KeyH: 0x25,
  KeyJ: 0x26,
  KeyK: 0x27,
  KeyL: 0x28,
  Semicolon: 0x29,
  Quote: 0x2a,
  Numpad4: 0x2d,
  Numpad5: 0x2e,
  Numpad6: 0x2f,
  KeyZ: 0x31,
  KeyX: 0x32,
  KeyC: 0x33,
  KeyV: 0x34,
  KeyB: 0x35,
  KeyN: 0x36,
  KeyM: 0x37,
  Comma: 0x38,
  Period: 0x39,
  Slash: 0x3a,
  NumpadDecimal: 0x3c,
  Numpad7: 0x3d,
  Numpad8: 0x3e,
  Numpad9: 0x3f,
  Space: 0x40,
  Backspace: 0x41,
  Tab: 0x42,
  NumpadEnter: 0x43,
  Enter: 0x44,
  Escape: 0x45,
  Delete: 0x46,
  NumpadSubtract: 0x4a,
  ArrowUp: 0x4c,
  ArrowDown: 0x4d,
  ArrowRight: 0x4e,
  ArrowLeft: 0x4f,
  F1: 0x50,
  F2: 0x51,
  F3: 0x52,
  F4: 0x53,
  F5: 0x54,
  F6: 0x55,
  F7: 0x56,
  F8: 0x57,
  F9: 0x58,
  F10: 0x59,
  NumpadDivide: 0x5c,
  NumpadMultiply: 0x5d,
  NumpadAdd: 0x5e,
  Home: 0x5f,
  CapsLock: 0x62,
  AltLeft: 0x64,
  AltRight: 0x65,
  MetaLeft: 0x66,
  MetaRight: 0x67
};
export function bindWorkerKeyboard(canvas, host, enabled) {
  const heldKeyboard = new Set();
  canvas.addEventListener('keydown', event => {
    if (!enabled()) return;
    if (event.code === 'F12') {
      event.preventDefault();
      if (!event.repeat) host.switchView();
    } else if (Object.hasOwn(rawKeys, event.code)) {
      event.preventDefault();
      const key = rawKeys[event.code];
      if (!event.repeat && !heldKeyboard.has(key)) {
        heldKeyboard.add(key);
        host.keyboard(key, true);
      }
    }
  });
  canvas.addEventListener('keyup', event => {
    const key = rawKeys[event.code];
    if (heldKeyboard.delete(key)) {
      event.preventDefault();
      host.keyboard(key, false);
    }
  });
  canvas.addEventListener('blur', () => {
    for (const key of heldKeyboard) host.keyboard(key, false);
    heldKeyboard.clear();
  });
}

const captureMs = 15000;
const limit = 4096;

export function createTimingTrace({ launcher, game, display, controls, version, getHost }) {
  const help = document.createElement('p');
  help.className = 'help';
  help.textContent = 'Play the table, then record 15 seconds while reproducing the stutter. The timing file includes browser and graphics details and stays on your device until you share it.';
  launcher.append(help);

  const button = document.createElement('button');
  button.type = 'button';
  button.id = 'timing-trace';
  button.textContent = 'Record 15 s';
  button.disabled = true;
  launcher.append(button);

  let table;
  let nextId = 0;
  let capture;
  let report;
  let timer;
  let refresh;

  function sampleRefresh(time) {
    if (report.refresh.length < limit) report.refresh.push(time);
    refresh = requestAnimationFrame(sampleRefresh);
  }

  function record() {
    const id = ++nextId;
    const host = getHost();
    const sources = host?.trace(id, true) ?? [];
    capture = { id, host, pending: new Set(sources) };
    report = {
      format: 1, version, table, backend: host ? 'workers' : 'sdl', sources,
      browser: navigator.userAgent,
      viewport: [innerWidth, innerHeight, devicePixelRatio],
      started: performance.now(), pointer: [], refresh: [], workers: {},
    };
    button.textContent = 'Recording…';
    button.disabled = true;
    refresh = requestAnimationFrame(sampleRefresh);
    timer = setTimeout(() => stop('duration'), captureMs);
  }

  function ready() {
    clearTimeout(timer);
    report.missing = [...capture.pending];
    capture = undefined;
    button.textContent = 'Save trace';
    button.disabled = false;
  }

  function stop(reason) {
    if (!capture || report.ended !== undefined) return;
    clearTimeout(timer);
    cancelAnimationFrame(refresh);
    report.ended = performance.now();
    report.reason = reason;
    capture.host?.trace(capture.id, false);
    if (capture.pending.size) timer = setTimeout(ready, 1000);
    else ready();
  }

  function save() {
    const link = document.createElement('a');
    const url = URL.createObjectURL(new Blob([JSON.stringify(report)], { type: 'application/json' }));
    link.href = url;
    link.download = 'slam-tilt-timing.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    report = undefined;
    button.textContent = 'Record 15 s';
    button.disabled = table === undefined;
  }

  button.addEventListener('click', () => {
    if (report) save();
    else record();
  });

  for (const element of [display, controls]) {
    for (const event of ['pointerdown', 'pointerup', 'pointercancel']) {
      element.addEventListener(event, input => {
        if (capture && report.ended === undefined && report.pointer.length < limit) {
          report.pointer.push([input.timeStamp, performance.now(), event]);
        }
      }, { capture: true, passive: true });
    }
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop('hidden');
  });

  return {
    enter(title) {
      table = title;
      game.append(button);
      button.disabled = Boolean(capture);
    },
    leave() {
      table = undefined;
      stop('left table');
      launcher.append(button);
      button.disabled = Boolean(capture) || !report;
    },
    receive({ source, id, timeOrigin, ...payload }) {
      if (!capture || id !== capture.id || !capture.pending.delete(source)) return;
      report.workers[source] = payload;
      if (timeOrigin !== undefined) payload.clockOffsetMs = timeOrigin - performance.timeOrigin;
      if (report.ended !== undefined && !capture.pending.size) ready();
    },
  };
}

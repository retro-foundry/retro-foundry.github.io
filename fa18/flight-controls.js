/* Flight hardware has no browser-standard mapping. Learn the controls the
 * driver actually exposes rather than guessing axes from a product name.
 * This adapter only produces shared PhysicalGamepadState channels; the C
 * action layer retains modifier safety, analog shaping and source ramps. */
(() => {
  'use strict';
  const key = 'fa18-interceptor:flight-controls:v1';
  const families = [
    ['gamepad', 'Gamepad / keyboard', ''],
    ['extreme3d', 'Logitech Extreme 3D Pro', 'stick', /extreme.*3d/i],
    ['t16000', 'Thrustmaster T.16000M / T.16000M + TWCS', 'hotas', /t.?16000/i],
    ['tflight', 'Thrustmaster T.Flight HOTAS X / 4 / One / Neo', 'hotas', /t.?flight|hotas (x|4|one|neo)/i],
    ['x52', 'Logitech / Saitek X52 or X52 Pro', 'hotas', /x.?52/i],
    ['x56', 'Logitech / Saitek X56', 'hotas', /x.?56/i],
    ['vkb', 'VKB Gladiator NXT / EVO (+ optional STECS)', 'hotas', /vkb|gladiator/i],
    ['winwing', 'Winwing / WinCtrl Ursa Minor / Orion', 'hotas', /winwing|winctrl|ursa|orion/i],
    ['velocity', 'Turtle Beach VelocityOne Flightstick / Flightdeck', 'hotas', /velocity|turtle.?beach/i],
    ['other', 'Other USB flight stick / HOTAS', 'hotas', /./]
  ];
  // Order is NativePadButton in input/gamepad.h, shared with the numbered
  // native stick preset. Human-facing button numbers start at one.
  const buttons = ['Fire (hold)', 'Flare', 'Next target', 'Next weapon',
    'Throttle down', 'Throttle up', 'Map / hold modifier', 'Pause / resume',
    'Gear', 'Arrestor hook', 'Radar range', 'Brake / airbrake', 'Chaff', 'ECM'];
  // Order is NativeDirectButton in input/gamepad.h. These never synthesize
  // a View chord, so independent HOTAS controls can be used together.
  const direct = ['External view', 'HUD toggle', 'Max normal thrust', 'Afterburner',
    'Idle thrust', 'Zoom in', 'Zoom out', 'Rescue pod', 'Eject'];
  const axes = {
    roll: ['Roll', 'Centre the stick, click Learn, then move fully RIGHT and fully LEFT.'],
    pitch: ['Pitch', 'Centre the stick, click Learn, then pull fully BACK and push fully FORWARD.'],
    rudder: ['Rudder (optional)', 'Centre the twist/pedals, click Learn, then move fully RIGHT and fully LEFT.'],
    throttle: ['Analog throttle', 'Put the lever at IDLE, click Learn, then move to FULL power and back to IDLE.']
  };
  const hats = ['up', 'right', 'down', 'left'];
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const finite = v => typeof v === 'number' && Number.isFinite(v);
  const deviceKey = pad => ({id: pad.id, index: pad.index});
  const allPads = () => Array.from(navigator.getGamepads?.() || []).filter(p => p?.connected);
  function findPad(device, pads) {
    if (!device) return null;
    const exact = pads.find(p => p.id === device.id && p.index === device.index);
    if (exact) return exact;
    const matches = pads.filter(p => p.id === device.id);
    return matches.length === 1 ? matches[0] : null;
  }
  function sameDevice(a, b, pads = allPads()) {
    const resolved = findPad(a, pads);
    return !!resolved && resolved === findPad(b, pads);
  }
  function validBinding(b, axis = false) {
    if (!b || typeof b.device?.id !== 'string' || !Number.isInteger(b.device.index) ||
        b.device.index < 0 || !Number.isInteger(b.index) || b.index < 0 || b.index > 127) return false;
    if (axis) return b.kind === 'axis' && finite(b.low) && finite(b.high) &&
      finite(b.centre) && b.high - b.low >= 0.8 && typeof b.invert === 'boolean' &&
      b.centre >= b.low && b.centre <= b.high;
    return b.kind === 'button' || (b.kind === 'hat' && finite(b.value));
  }
  function validate(s) {
    if (s?.version !== 1 || !families.some(f => f[0] === s.family) || !s.axes || !s.buttons || !s.hat)
      throw new Error('Saved flight controls are invalid. Use Reset flight setup.');
    if (s.direct === undefined) s.direct = {};
    if (!s.direct || typeof s.direct !== 'object' || Array.isArray(s.direct))
      throw new Error('Invalid saved direct flight controls.');
    for (const [role, b] of Object.entries(s.axes))
      if (!axes[role] || !validBinding(b, true)) throw new Error('Invalid saved flight axis: ' + role);
    for (const [slot, b] of Object.entries(s.buttons))
      if (!/^\d+$/.test(slot) || +slot >= buttons.length || b.kind !== 'button' || !validBinding(b))
        throw new Error('Invalid saved flight button: ' + slot);
    for (const [direction, b] of Object.entries(s.hat))
      if (!hats.includes(direction) || !validBinding(b)) throw new Error('Invalid saved look control: ' + direction);
    for (const [slot, b] of Object.entries(s.direct))
      if (!/^\d+$/.test(slot) || +slot >= direct.length || !validBinding(b))
        throw new Error('Invalid saved direct flight action: ' + slot);
    return s;
  }
  function axisValue(b, pads, throttle = false) {
    const pad = findPad(b?.device, pads), value = pad?.axes[b?.index];
    if (!pad || !finite(value)) return null;
    let normalized;
    if (throttle) normalized = clamp((value - b.low) / (b.high - b.low), 0, 1);
    else if (value >= b.centre) normalized = (value - b.centre) / (b.high - b.centre || 1);
    else normalized = (value - b.centre) / (b.centre - b.low || 1);
    normalized = clamp(normalized, throttle ? 0 : -1, 1);
    return b.invert ? (throttle ? 1 - normalized : -normalized) : normalized;
  }
  function pressed(b, pads) {
    const pad = findPad(b?.device, pads);
    if (!pad) return false;
    if (b.kind === 'button') return !!pad.buttons[b.index]?.pressed;
    const value = pad.axes[b.index];
    return finite(value) && Math.abs(value - b.value) < 0.05;
  }
  function sample(s, pads = allPads()) {
    const roll = axisValue(s.axes.roll, pads), pitch = axisValue(s.axes.pitch, pads);
    const name = findPad(s.axes.roll?.device, pads)?.id || 'Flight stick disconnected';
    if (roll === null || pitch === null) return {name, direct: 0, values: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]};
    const rudder = axisValue(s.axes.rudder, pads) ?? 0;
    const throttle = axisValue(s.axes.throttle, pads, true);
    let bits = 0;
    for (const [slot, binding] of Object.entries(s.buttons)) if (pressed(binding, pads)) bits |= 1 << +slot;
    let directBits = 0;
    for (const [slot, binding] of Object.entries(s.direct || {})) if (pressed(binding, pads)) directBits |= 1 << +slot;
    const x = +pressed(s.hat.right, pads) - +pressed(s.hat.left, pads);
    const y = +pressed(s.hat.down, pads) - +pressed(s.hat.up, pads);
    return {name, direct: directBits, values: [1, roll, pitch, x, y, Math.max(0, -rudder), Math.max(0, rudder),
      throttle ?? 0, +(throttle !== null), bits]};
  }
  const empty = () => ({version: 1, family: 'gamepad', axes: {}, buttons: {}, hat: {}, direct: {}});
  class FlightControls {
    constructor(root) {
      this.root = root; this.state = empty(); this.presets = {}; this.learning = null;
      let error = '';
      try {
        const saved = localStorage.getItem(key);
        if (saved) {
          const {presets = {}, ...state} = JSON.parse(saved);
          for (const [name, preset] of Object.entries(presets))
            if (validate(preset).family !== name) throw new Error('Invalid saved device preset.');
          this.state = validate(state); this.presets = presets;
        }
      } catch (e) { this.state = empty(); this.presets = {}; error = 'Cannot restore flight controls: ' + e.message; }
      this.build(); this.updateBindings(); this.message(error || 'Choose your hardware, then learn its axes.');
      if (error) { this.panel.hidden = false; document.getElementById('flight-setup').open = true; }
      this.poll = this.poll.bind(this); requestAnimationFrame(this.poll);
    }
    message(text) { this.status.textContent = text; }
    save() {
      try { localStorage.setItem(key, JSON.stringify({...this.state, presets: this.presets})); }
      catch (e) { this.message('Cannot save flight controls: ' + e.message); }
    }
    select(label, options) {
      const wrap = document.createElement('label'); wrap.textContent = label;
      const select = document.createElement('select'); wrap.append(select);
      for (const [value, text] of options) select.add(new Option(text, value));
      return [wrap, select];
    }
    build() {
      const [familyWrap, family] = this.select('Controller layout', families.map(f => [f[0], f[1]]));
      this.root.append(familyWrap); this.family = family; family.id = 'flight-family'; family.value = this.state.family;
      this.panel = document.createElement('div'); this.panel.hidden = this.state.family === 'gamepad';
      this.root.append(this.panel);
      const intro = document.createElement('p');
      intro.textContent = 'Use PC/USB mode. Learn axes once for your driver; assignments are saved in this browser. A separate USB throttle is supported.';
      this.panel.append(intro);
      for (const [field, label] of [['stick', 'Stick device'], ['throttle', 'Throttle device'], ['source', 'Device for learning buttons / hat']]) {
        const [wrap, select] = this.select(label, []); this[field] = select; select.id = 'flight-' + field;
        this.panel.append(wrap);
        select.addEventListener('change', () => { this.cancelLearning(); });
      }
      const diagram = document.createElement('p');
      diagram.innerHTML = '<a href="flightstick-controls.svg" target="_blank" rel="noopener">Stick + throttle diagram</a> · <a href="hotas-controls.svg" target="_blank" rel="noopener">HOTAS diagram</a>';
      this.panel.append(diagram);
      this.status = document.createElement('p'); this.status.id = 'flight-status';
      this.status.setAttribute('role', 'status'); this.status.setAttribute('aria-live', 'polite');
      this.panel.append(this.status);
      this.rows = {};
      for (const [role, [label, instructions]] of Object.entries(axes)) this.row('axes', role, label, instructions);
      const finish = document.createElement('button'); finish.type = 'button'; finish.id = 'flight-finish';
      finish.textContent = 'Finish axis sweep'; finish.hidden = true;
      finish.addEventListener('click', () => this.finishAxis()); this.finish = finish; this.panel.append(finish);
      const numbered = document.createElement('button'); numbered.type = 'button'; numbered.id = 'flight-numbered';
      numbered.textContent = 'Use numbered button preset';
      numbered.addEventListener('click', () => {
        const pad = this.selected(this.source); if (!pad) return this.message('Connect a controller and press a button first.');
        this.cancelLearning(); this.state.buttons = {};
        for (let i = 0; i < Math.min(buttons.length, pad.buttons.length); ++i) {
          const binding = {device: deviceKey(pad), kind: 'button', index: i};
          this.unique(binding, 'buttons', i); this.state.buttons[i] = binding;
        }
        this.updateBindings(); this.save(); this.message('Numbered preset applied. Learn individual buttons to change it.');
      });
      this.numbered = numbered; this.panel.append(numbered);
      const note = document.createElement('p');
      note.textContent = 'For VelocityOne, learn buttons individually: its lever end-stops also report as buttons.';
      this.velocityNote = note; this.panel.append(note);
      numbered.disabled = this.state.family === 'velocity'; note.hidden = !numbered.disabled;
      const optional = document.createElement('details'), summary = document.createElement('summary');
      summary.textContent = 'Buttons and cockpit-look hat'; optional.append(summary); this.panel.append(optional);
      this.buttonPanel = optional; optional.id = 'flight-buttons';
      buttons.forEach((name, i) => this.row('buttons', i, name, 'Release the buttons, click Learn, then press the button you want.', optional));
      hats.forEach(direction => this.row('hat', direction, 'Look ' + direction,
        'Centre the hat, click Learn, then press hat ' + direction.toUpperCase() + '.', optional));
      const shortcuts = document.createElement('details'), shortcutSummary = document.createElement('summary');
      shortcuts.id = 'flight-direct'; shortcutSummary.textContent = 'Direct actions — no modifier';
      shortcuts.append(shortcutSummary); this.panel.append(shortcuts);
      const directNote = document.createElement('p');
      directNote.textContent = 'Optional: assign spare buttons or hat directions on either device. Each action works with one press, without holding button 7. Existing combinations also remain available.';
      shortcuts.append(directNote);
      direct.forEach((name, i) => this.row('direct', i, name,
        'Release the control, click Learn, then press the button or hat direction you want.', shortcuts));
      const reset = document.createElement('button'); reset.type = 'button'; reset.textContent = 'Reset flight setup';
      reset.addEventListener('click', () => {
        this.cancelLearning(); this.state = empty(); this.presets = {}; family.value = 'gamepad'; this.panel.hidden = true;
        this.updateBindings(); this.save();
      }); this.panel.append(reset);
      family.addEventListener('change', () => {
        this.cancelLearning(); this.presets[this.state.family] = JSON.parse(JSON.stringify(this.state));
        this.state = this.presets[family.value] ? JSON.parse(JSON.stringify(this.presets[family.value])) : {...empty(), family: family.value};
        this.panel.hidden = family.value === 'gamepad';
        numbered.disabled = family.value === 'velocity'; note.hidden = !numbered.disabled;
        this.deviceSignature = ''; this.updateBindings(); this.save();
      });
    }
    row(group, role, title, instructions, parent = this.panel) {
      const row = document.createElement('div'); row.className = 'flight-binding';
      const label = document.createElement('span'); label.textContent = title;
      const value = document.createElement('small'); value.id = 'flight-value-' + group + '-' + role;
      const learn = document.createElement('button'); learn.type = 'button'; learn.textContent = 'Learn';
      learn.id = 'flight-learn-' + group + '-' + role;
      learn.addEventListener('click', () => this.learn(group, role, instructions));
      const clear = document.createElement('button'); clear.type = 'button'; clear.textContent = 'Clear';
      clear.setAttribute('aria-label', 'Clear ' + title);
      clear.addEventListener('click', () => {
        this.cancelLearning(); delete this.state[group][role]; this.updateBindings(); this.save();
      });
      label.append(value); row.append(label, learn, clear); parent.append(row);
      this.rows[group + '-' + role] = value;
    }
    selected(select) { return allPads().find(p => String(p.index) === select.value); }
    refreshDevices(pads) {
      const signature = pads.map(p => p.id + ':' + p.index).join('|') + this.state.family;
      if (signature === this.deviceSignature) return;
      this.deviceSignature = signature;
      const family = families.find(f => f[0] === this.state.family);
      const primary = pads.find(p => family?.[3]?.test(p.id) && !/throttle|twcs|stecs/i.test(p.id)) || pads[0];
      const throttle = pads.find(p => /throttle|twcs|stecs/i.test(p.id));
      for (const [select, preferred, same] of [[this.stick, primary, false], [this.source, primary, false], [this.throttle, throttle, true]]) {
        const previous = select.value; select.replaceChildren();
        if (same) select.add(new Option('Same as stick', 'same'));
        for (const pad of pads) select.add(new Option(pad.id + ' [device ' + (pad.index + 1) + ']', String(pad.index)));
        if (Array.from(select.options).some(o => o.value === previous)) select.value = previous;
        else if (preferred) select.value = String(preferred.index);
      }
    }
    updateBindings() {
      for (const [name, label] of Object.entries(this.rows)) {
        const split = name.indexOf('-'), group = name.slice(0, split), role = name.slice(split + 1);
        const b = this.state[group][role];
        label.textContent = !b ? 'Not assigned' : (b.kind === 'button' ? 'Button ' + (b.index + 1) :
          b.kind === 'hat' ? 'Hat direction' : 'Axis ' + (b.index + 1) + (b.invert ? ' · reversed' : '')) + ' · ' + b.device.id;
      }
    }
    cancelLearning() { this.learning = null; if (this.finish) this.finish.hidden = true; }
    learn(group, role, instructions) {
      this.cancelLearning();
      const select = group !== 'axes' ? this.source : role === 'throttle' && this.throttle.value !== 'same' ? this.throttle : this.stick;
      const pad = this.selected(select);
      if (!pad) return this.message('Connect the selected controller and press a button to let the browser detect it.');
      this.learning = {group, role, device: deviceKey(pad), baseline: [...pad.axes],
        buttons: pad.buttons.map(b => b.pressed), min: [...pad.axes], max: [...pad.axes], candidate: null};
      this.message(instructions);
      this.finish.hidden = group !== 'axes';
    }
    unique(binding, group, role) {
      for (const category of ['buttons', 'hat', 'direct']) for (const [other, b] of Object.entries(this.state[category])) {
        if (category === group && String(role) === other) continue;
        if (sameDevice(b.device, binding.device) && b.index === binding.index &&
            b.kind === binding.kind && (b.kind !== 'hat' || b.value === binding.value)) delete this.state[category][other];
      }
    }
    finishAxis() {
      const l = this.learning;
      if (!l || l.group !== 'axes') return;
      const index = l.candidate?.index;
      if (index === undefined || l.max[index] - l.min[index] < 0.8)
        return this.message('Move this control through its full range, then choose Finish axis sweep.');
      if (l.role !== 'throttle' && (l.baseline[index] <= l.min[index] + 0.1 * (l.max[index] - l.min[index]) ||
          l.baseline[index] >= l.max[index] - 0.1 * (l.max[index] - l.min[index])))
        return this.message('Start this axis centred. Centre the control, click Learn again, then sweep its full range.');
      const firstPositive = l.candidate.delta > 0;
      const b = {device: l.device, kind: 'axis', index, low: l.min[index], high: l.max[index],
        centre: clamp(l.baseline[index], l.min[index], l.max[index]),
        invert: !firstPositive};
      for (const [role, other] of Object.entries(this.state.axes))
        if (role !== l.role && sameDevice(other.device, b.device) && other.index === b.index)
          delete this.state.axes[role];
      this.state.axes[l.role] = b; this.cancelLearning(); this.updateBindings(); this.save();
      this.message('Axis saved. Learn the remaining controls, or start the game when ready.');
    }
    poll() {
      const pads = allPads();
      if (!document.getElementById('launcher')?.hidden) {
        this.refreshDevices(pads);
        const l = this.learning, pad = l && findPad(l.device, pads);
        if (l && !pad) { this.cancelLearning(); this.message('Controller disconnected. Reconnect it and learn that control again.'); }
        else if (l) {
          if (l.group === 'axes') {
            let largest = 0, candidate = null;
            pad.axes.forEach((value, index) => {
              if (!finite(value) || !finite(l.baseline[index])) return;
              l.min[index] = Math.min(l.min[index], value); l.max[index] = Math.max(l.max[index], value);
              const delta = value - l.baseline[index];
              if (Math.abs(delta) > Math.max(0.45, largest)) { largest = Math.abs(delta); candidate = {index, delta}; }
            });
            if (!l.candidate && candidate) l.candidate = candidate;
          } else {
            const index = pad.buttons.findIndex((button, i) => button.pressed && !l.buttons[i]);
            let binding = index >= 0 ? {device: l.device, kind: 'button', index} : null;
            if (!binding && (l.group === 'hat' || l.group === 'direct')) {
              const axis = pad.axes.findIndex((v, i) => finite(v) && finite(l.baseline[i]) && Math.abs(v - l.baseline[i]) > 0.2);
              if (axis >= 0) binding = {device: l.device, kind: 'hat', index: axis, value: pad.axes[axis]};
            }
            if (binding) {
              this.unique(binding, l.group, l.role); this.state[l.group][l.role] = binding;
              this.cancelLearning(); this.updateBindings(); this.save(); this.message('Control saved. Release it before learning the next control.');
            }
          }
        }
      }
      requestAnimationFrame(this.poll);
    }
    begin() {
      if (this.state.family === 'gamepad') return null;
      validate(this.state);
      for (const role of ['roll', 'pitch', 'throttle'])
        if (!this.state.axes[role]) throw new Error('Learn the flight stick ' + role + ' control before starting, or select Gamepad / keyboard.');
      const state = JSON.parse(JSON.stringify(this.state)); this.cancelLearning();
      return {sample: () => sample(state)};
    }
  }
  window.Fa18FlightControls = {FlightControls, sample, validate, families};
})();

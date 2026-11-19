/* HTML display selection. SDL consumes the exact selected ratio; CSS/backing
 * dimensions fit that view and never decide simulation or camera timing. */
(() => {
  'use strict';
  const storageKey = 'revs:display-aspect:v1';
  const presets = ['3:2', '16:10', '16:9', '21:9', '43:18', '64:27', '12:5',
    '32:10', '32:9', '48:10', '48:9', '6:1', '64:9', '43:6', '36:5'];

  function columns(width, height) {
    if (![width, height].every(n => Number.isInteger(n) && n > 0 && n <= 65535))
      throw new Error('Display dimensions must be whole numbers from 1 through 65535.');
    const value = Math.floor((240 * width + height) / (2 * height)) * 2;
    if (value > 2048) throw new Error('Unsupported display aspect: the Revs camera supports up to 2048 columns (one complete turn).');
    return Math.max(320, value);
  }
  function parse(value) {
    if (value === 'auto') value = 'window';
    if (value === 'monitor') value = 'screen';
    if (value === '4:3') value = 'original';
    if (['window', 'screen', 'original'].includes(value)) return value;
    if (typeof value !== 'string' || !/^\d+:\d+$/.test(value))
      throw new Error('Unsupported display aspect. Choose automatic, screen, original, or W:H.');
    const ratio = value.split(':').map(Number);
    columns(...ratio);
    return ratio.join(':');
  }
  function fitRatio(ratio) {
    columns(...ratio);
    return ratio[0] * 3 < ratio[1] * 4 ? [4, 3] : ratio;
  }

  class Display {
    constructor(module) {
      this.module = module;
      this.panel = document.getElementById('display-panel');
      this.select = document.getElementById('display-aspect');
      this.custom = document.getElementById('display-custom');
      this.error = document.getElementById('display-error');
      for (const [value, label] of [['window', 'Window / fullscreen (automatic)'],
        ['screen', 'Screen at launch'], ['original', 'Original 4:3'],
        ...presets.map(value => [value, value]), ['custom', 'Custom ratio…']])
        this.select.add(new Option(label, value));
      // Let key releases reach SDL so a driving key held before opening this
      // panel cannot remain latched. New key presses belong to the editor.
      for (const type of ['keydown', 'keypress', 'pointerdown', 'pointerup', 'wheel'])
        this.panel.addEventListener(type, event => event.stopPropagation());
      this.panel.addEventListener('keydown', event => {
        if (event.code === 'Escape') {
          event.preventDefault(); this.panel.open = false;
          module.canvas.focus();
        }
      });
      this.select.onchange = () => {
        this.custom.hidden = this.select.value !== 'custom';
        if (!this.custom.hidden) { document.getElementById('display-ratio').focus(); return; }
        this.choose(this.select.value);
      };
      this.custom.onsubmit = event => {
        event.preventDefault(); this.choose(document.getElementById('display-ratio').value);
      };
      try {
        const query = new URLSearchParams(location.search).get('aspect');
        const saved = query === null ? localStorage.getItem(storageKey) : null;
        this.choice = parse(query !== null ? query : saved !== null ? saved : 'window');
        if (this.choice === 'screen') this.screen = this.screenRatio();
        this.refreshSelection();
        this.fit();
      } catch (error) { this.invalidate(error.message); }
      window.addEventListener('resize', () => this.fit());
      document.addEventListener('fullscreenchange', () => this.fit());
      if (window.visualViewport) {
        visualViewport.addEventListener('resize', () => this.fit());
        visualViewport.addEventListener('scroll', () => this.fit());
      }
    }
    screenRatio() { return fitRatio([window.screen.width, window.screen.height]); }
    ratio(choice = this.choice, screen = this.screen) {
      const visible = window.visualViewport || {width: innerWidth, height: innerHeight};
      if (choice === 'window') return fitRatio([Math.floor(visible.width), Math.floor(visible.height)]);
      if (choice === 'screen') return screen;
      return choice === 'original' ? [4, 3] : fitRatio(choice.split(':').map(Number));
    }
    refreshSelection() {
      const listed = Array.from(this.select.options).some(option => option.value === this.choice);
      this.select.value = listed ? this.choice : 'custom';
      this.custom.hidden = listed;
      if (!listed) document.getElementById('display-ratio').value = this.choice;
    }
    choose(value) {
      try {
        const choice = parse(value);
        const screen = choice === 'screen' ? this.screenRatio() : this.screen;
        this.ratio(choice, screen); // Validate the candidate before saving/replacing the live choice.
        localStorage.setItem(storageKey, choice);
        this.choice = choice; this.screen = screen;
        this.error.textContent = ''; this.refreshSelection(); this.fit();
        // SDL also needs a resize event while stationary in a retained menu.
        window.dispatchEvent(new Event('resize'));
      } catch (error) { this.error.textContent = error.message; }
    }
    invalidate(message) {
      this.module.revsDisplayAspect = {valid: false};
      this.module.noInitialRun = true;
      this.error.textContent = message;
      document.getElementById('status').textContent = message;
      document.getElementById('loader').classList.remove('hidden');
      this.module.setStatus = () => {};
      this.module.monitorRunDependencies = () => {};
    }
    fit() {
      if (!this.choice || this.module.revsDisplayAspect?.valid === false) return;
      try {
        const ratio = this.ratio();
        const visible = window.visualViewport;
        const width = visible ? visible.width : innerWidth;
        const height = visible ? visible.height : innerHeight;
        const density = devicePixelRatio * (visible ? visible.scale : 1);
        const scale = Math.min(width / ratio[0], height / ratio[1]);
        const w = Math.max(1, Math.min(Math.floor(width * density), Math.round(ratio[0] * scale * density)));
        const h = Math.max(1, Math.min(Math.floor(height * density), Math.round(ratio[1] * scale * density)));
        this.module.revsDisplayAspect = {valid: true, original: this.choice === 'original', width: ratio[0], height: ratio[1]};
        this.module.revsDisplayChoice = this.choice;
        this.module.revsCanvasWidth = w; this.module.revsCanvasHeight = h;
        const viewport = document.getElementById('game-viewport');
        viewport.style.left = (visible ? visible.offsetLeft : 0) + 'px';
        viewport.style.top = (visible ? visible.offsetTop : 0) + 'px';
        viewport.style.right = Math.max(0, innerWidth - width - (visible ? visible.offsetLeft : 0)) + 'px';
        viewport.style.bottom = Math.max(0, innerHeight - height - (visible ? visible.offsetTop : 0)) + 'px';
        const canvas = this.module.canvas;
        canvas.style.width = (w / density) + 'px'; canvas.style.height = (h / density) + 'px';
        const x = (width * density - w) / 2, y = (height * density - h) / 2;
        canvas.style.transform = `translate(${(Math.floor(x)-x)/density}px,${(Math.floor(y)-y)/density}px)`;
      } catch (error) { this.invalidate(error.message); }
    }
  }
  window.RevsDisplay = {Display, parse, columns, storageKey};
})();

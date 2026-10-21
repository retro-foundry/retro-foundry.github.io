/* Modal controller editor. The active adapter stays frozen until Apply;
 * browser suspension shares the visibility/audio clock boundary. */
(() => {
  'use strict';
  class ControllerOverlay {
    constructor(controls, module, playing) {
      this.controls = controls; this.module = module; this.playing = playing;
      this.dialog = document.getElementById('controller-dialog');
      this.button = document.getElementById('controller-button');
      this.error = document.getElementById('controller-error');
      this.button.addEventListener('click', () => this.open());
      document.getElementById('controller-apply').addEventListener('click', () => this.close(true));
      for (const id of ['controller-cancel', 'controller-close'])
        document.getElementById(id).addEventListener('click', () => this.close(false));
      this.dialog.addEventListener('cancel', event => {event.preventDefault(); this.close(false);});
      for (const type of ['keydown', 'keyup', 'keypress', 'mousedown', 'mouseup', 'mousemove',
                          'pointerdown', 'pointerup', 'wheel', 'touchstart', 'touchend', 'touchmove'])
        this.dialog.addEventListener(type, event => event.stopPropagation());
      this.keys = new Set(); this.blockedKeys = new Set();
      window.addEventListener('keydown', event => {
        this.keys.add(event.code);
        if (this.blockedKeys.has(event.code)) {event.preventDefault(); event.stopImmediatePropagation();}
      }, true);
      window.addEventListener('keyup', event => {
        this.keys.delete(event.code);
        if (this.blockedKeys.delete(event.code)) {event.preventDefault(); event.stopImmediatePropagation();}
      }, true);
      for (const button of this.dialog.querySelectorAll('[data-controller-panel]'))
        button.addEventListener('click', () => this.show(button.dataset.controllerPanel));
      if (controls.restoreError) this.open();
    }
    show(panel) {
      for (const name of ['setup', 'diagrams']) {
        document.getElementById('controller-' + name).hidden = name !== panel;
        this.dialog.querySelector(`[data-controller-panel="${name}"]`).setAttribute('aria-pressed', String(name === panel));
      }
    }
    changed() { document.dispatchEvent(new Event('fa18controlschange')); }
    open() {
      if (this.dialog.open) return;
      this.error.textContent = '';
      try {this.saved = this.controls.checkpoint();}
      catch (error) {this.error.textContent = error.message; return;}
      this.show('setup');
      document.getElementById('controller-play-state').hidden = !this.playing();
      document.getElementById('controller-apply').textContent = this.playing() ? 'Apply and resume' : 'Apply';
      this.module.fa18ControlsOpen = true;
      if (this.playing()) this.module.fa18InputReset = true;
      this.dialog.showModal(); this.button.setAttribute('aria-expanded', 'true');
      this.changed();
    }
    close(apply) {
      if (!this.dialog.open) return;
      try {
        if (apply) {
          const input = this.controls.begin();
          this.controls.save(true);
          this.module.fa18FlightInput = input;
          this.module.fa18FlightRevision = (this.module.fa18FlightRevision || 0) + 1;
        } else this.controls.restore(this.saved);
      } catch (error) {this.error.textContent = error.message; return;}
      this.controls.cancelLearning();
      for (const key of this.keys) this.blockedKeys.add(key);
      if (this.playing()) this.module.fa18InputReset = true;
      this.module.fa18ControlsOpen = false;
      this.dialog.close(); this.button.setAttribute('aria-expanded', 'false');
      this.changed();
      if (this.playing()) document.getElementById('canvas').focus();
      else this.button.focus();
    }
  }
  window.Fa18ControllerOverlay = ControllerOverlay;
})();

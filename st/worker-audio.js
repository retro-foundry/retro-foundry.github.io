class SlamTiltAudio extends AudioWorkletProcessor {
  constructor() {
    super();
    this.queue = [];
    this.offset = 0;
    this.available = 0;
    // Leave headroom for the first two field deliveries to reach the worklet.
    this.leadingFrames = Math.ceil(sampleRate * 0.015);
    this.reserveFrames = 0;
    this.deliveries = 0;
    this.paused = false;
    this.missingFrames = 0;
    this.lastUnderrun = -Infinity;
    this.recoverySince = -Infinity;
    this.volume = 1;
    this.port.onmessage = ({ data }) => {
      if (typeof data === 'number') {
        this.volume = data;
      } else {
        data.onmessage = ({ data: block }) => {
          if (typeof block === 'boolean') {
            this.paused = block;
            this.missingFrames = this.reserveFrames = this.deliveries = 0;
            this.lastUnderrun = this.recoverySince = -Infinity;
            return;
          }
          const samples = new Int16Array(block);
          if (this.available > sampleRate / 8) {
            this.queue.length = 0;
            this.available = this.offset = 0;
          }
          if (!this.leadingFrames) {
            this.observeUnderrun();
            // Average the reserve before delivery because the browser renders in blocks.
            this.reserveFrames += this.available;
            if (++this.deliveries === 8) {
              const reserveMs = 1000 * this.reserveFrames / (sampleRate * this.deliveries);
              const boost = this.reserveBoost();
              const target = Math.min(14 + boost, Math.max(10 + boost, reserveMs));
              const correction = Math.max(-160, Math.min(160, Math.round(30 * (reserveMs - target))));
              data.postMessage(correction);
              this.reserveFrames = this.deliveries = 0;
            }
          }
          this.queue.push(samples);
          this.available += samples.length / 2;
        };
      }
    };
  }

  observeUnderrun() {
    const missing = this.missingFrames;
    this.missingFrames = 0;
    if (missing >= sampleRate * 0.002 && missing < sampleRate * 0.1) {
      // Count each delivery gap once, even when it spans several render quanta.
      if (currentFrame - this.lastUnderrun < 4 * sampleRate || this.reserveBoost()) {
        this.recoverySince = currentFrame;
      }
      this.lastUnderrun = currentFrame;
    } else if (missing >= sampleRate * 0.1) {
      // Device interruptions this long cannot be covered with a low-latency queue.
      this.lastUnderrun = this.recoverySince = -Infinity;
    }
  }

  reserveBoost() {
    // Hold the extra reserve through short interruptions, then give it back gradually.
    const secondsSinceRecovery = (currentFrame - this.recoverySince) / sampleRate;
    return 12 * Math.max(0, Math.min(1, (9 - secondsSinceRecovery) / 4));
  }

  process(_inputs, outputs) {
    if (!this.available && this.leadingFrames) return true;
    const [left, right] = outputs[0];
    const gain = this.volume / 32768;
    const first = Math.min(left.length, this.leadingFrames);
    this.leadingFrames -= first;
    let frame = first;
    for (; frame < left.length && this.available; ++frame) {
      const block = this.queue[0];
      left[frame] = block[this.offset++] * gain;
      right[frame] = block[this.offset++] * gain;
      --this.available;
      if (this.offset === block.length) {
        this.queue.shift();
        this.offset = 0;
      }
    }
    if (!this.paused) this.missingFrames += left.length - frame;
    return true;
  }
}
registerProcessor('slam-tilt-pcm', SlamTiltAudio);

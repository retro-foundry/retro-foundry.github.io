class SlamTiltAudio extends AudioWorkletProcessor {
  constructor() {
    super();
    this.queue = [];
    this.offset = 0;
    this.available = 0;
    // Leave headroom for the first two field deliveries to reach the worklet.
    this.leadingFrames = Math.ceil(sampleRate * 0.015);
    this.volume = 1;
    this.port.onmessage = ({ data }) => {
      if (typeof data === 'number') {
        this.volume = data;
      } else {
        data.onmessage = ({ data: block }) => {
          const samples = new Int16Array(block);
          if (this.available > sampleRate / 8) {
            this.queue.length = 0;
            this.available = this.offset = 0;
          }
          this.queue.push(samples);
          this.available += samples.length / 2;
        };
      }
    };
  }

  process(_inputs, outputs) {
    if (!this.available) return true;
    const [left, right] = outputs[0];
    const gain = this.volume / 32768;
    const first = Math.min(left.length, this.leadingFrames);
    this.leadingFrames -= first;
    for (let frame = first; frame < left.length && this.available; ++frame) {
      const block = this.queue[0];
      left[frame] = block[this.offset++] * gain;
      right[frame] = block[this.offset++] * gain;
      --this.available;
      if (this.offset === block.length) {
        this.queue.shift();
        this.offset = 0;
      }
    }
    return true;
  }
}
registerProcessor('slam-tilt-pcm', SlamTiltAudio);

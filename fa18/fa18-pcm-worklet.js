/* Device-thread playback of the native mixer's timestamped PAL blocks.
 * No shared memory or cross-origin isolation headers are required. */
class Fa18PcmProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.capacity = 16384;
    this.samples = new Float32Array(this.capacity * 2);
    this.tags = new Float64Array(this.capacity).fill(-1);
    this.lastOutput = new Int16Array(256);
    this.origin = null;
    this.firstFrame = Infinity;
    this.active = true;
    this.playedFrames = 0;
    this.underrunFrames = 0;
    this.longestUnderrun = 0;
    this.underrunRun = 0;
    this.lateFrames = 0;
    this.renderEnd = 0;
    this.sourceEnd = 0;
    this.port.onmessage = event => {
      const packet = event.data;
      if (packet.kind === 'pcm') {
        if (this.origin === null) {
          this.origin = packet.startFrame - packet.sourceFrame;
          this.firstFrame = packet.startFrame;
        }
        const end = packet.startFrame + packet.frames;
        if (end > currentFrame + this.capacity) {
          this.port.postMessage({kind: 'error', message: 'PCM timestamp exceeds the fixed device ring'});
        } else {
          const first = Math.max(currentFrame, packet.startFrame);
          this.lateFrames += Math.min(packet.frames, first - packet.startFrame);
          for (let frame = first; frame < end; ++frame) {
            const slot = frame % this.capacity;
            const source = 2 * (frame - packet.startFrame);
            this.samples[2 * slot] = packet.samples[source];
            this.samples[2 * slot + 1] = packet.samples[source + 1];
            this.tags[slot] = frame;
          }
        }
        // Recycle the original fixed-size transport buffer immediately after
        // copying it. The audio render loop never allocates a PCM buffer.
        this.port.postMessage({kind: 'recycle', id: packet.id, samples: packet.samples},
                              [packet.samples.buffer]);
      } else if (packet.kind === 'snapshot') {
        this.port.postMessage({kind: 'snapshot', id: packet.id,
          playedFrames: this.playedFrames, underrunFrames: this.underrunFrames,
          longestUnderrun: this.longestUnderrun, lateFrames: this.lateFrames,
          renderEnd: this.renderEnd, sourceEnd: this.sourceEnd,
          samples: this.lastOutput});
      } else if (packet.kind === 'reset-metrics') {
        this.underrunFrames = this.longestUnderrun = this.underrunRun = this.lateFrames = 0;
      } else if (packet.kind === 'stop') {
        this.active = false;
        this.port.close();
      }
    };
  }

  process(inputs, outputs) {
    if (!this.active) return false;
    const left = outputs[0][0], right = outputs[0][1];
    for (let i = 0; i < left.length; ++i) {
      const frame = currentFrame + i;
      const slot = frame % this.capacity;
      let l = 0, r = 0;
      if (this.tags[slot] === frame) {
        l = this.samples[2 * slot];
        r = this.samples[2 * slot + 1];
        ++this.playedFrames;
        this.sourceEnd = frame - this.origin + 1;
        this.underrunRun = 0;
      } else if (frame >= this.firstFrame) {
        ++this.underrunFrames;
        if (++this.underrunRun > this.longestUnderrun) this.longestUnderrun = this.underrunRun;
      }
      left[i] = l; right[i] = r;
      // Retain the last 128 device frames for diagnostic byte comparisons.
      const capture = 2 * (frame % 128);
      this.lastOutput[capture] = Math.round(l * 32768);
      this.lastOutput[capture + 1] = Math.round(r * 32768);
    }
    this.renderEnd = currentFrame + left.length;
    return true;
  }
}

registerProcessor('fa18-pcm', Fa18PcmProcessor);

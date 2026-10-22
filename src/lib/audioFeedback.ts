// Web Audio API feedback synthesizer with safety guards.
// Ported from Neurosight (src/utils/audioFeedback.ts) for the NeuroCheck battery.

class SoundEngine {
  private ctx: AudioContext | null = null;

  private getContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    try {
      if (!this.ctx) {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) this.ctx = new AudioCtx();
      }
      if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
      return this.ctx;
    } catch {
      return null;
    }
  }

  playTone(freq: number, type: OscillatorType = "sine", duration = 0.15, volume = 0.1) {
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {
      /* autoplay policy fallback */
    }
  }

  playCorrect() {
    this.playTone(587.33, "sine", 0.1, 0.08);
    setTimeout(() => this.playTone(880, "sine", 0.15, 0.08), 80);
  }

  playIncorrect() {
    this.playTone(220, "sawtooth", 0.2, 0.06);
  }

  playDigitTick() {
    this.playTone(440, "triangle", 0.08, 0.05);
  }

  playCompleteFanfare() {
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
      setTimeout(() => this.playTone(freq, "sine", 0.25, 0.09), idx * 100);
    });
  }
}

export const soundFx = new SoundEngine();

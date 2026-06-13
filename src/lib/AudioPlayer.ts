export class AudioPlayer {
  private ctx: AudioContext | null = null;
  private nextStartTime: number = 0;
  private isPlaying: boolean = false;
  private onSpeakingStart?: () => void;
  private onSpeakingEnd?: () => void;
  private onVolumeChange?: (pct: number) => void;
  private activeSources: AudioBufferSourceNode[] = [];
  private analyzer: AnalyserNode | null = null;
  private animationFrameId: number | null = null;

  constructor(
    onSpeakingStart?: () => void,
    onSpeakingEnd?: () => void,
    onVolumeChange?: (volumePercentage: number) => void
  ) {
    this.onSpeakingStart = onSpeakingStart;
    this.onSpeakingEnd = onSpeakingEnd;
    this.onVolumeChange = onVolumeChange;
  }

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      this.analyzer = this.ctx.createAnalyser();
      this.analyzer.fftSize = 256;
      this.analyzer.connect(this.ctx.destination);
      this.nextStartTime = this.ctx.currentTime;
      
      // Start polling volume levels for visualizations
      this.startVolumePolling();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  private startVolumePolling() {
    if (!this.analyzer) return;
    const dataArray = new Uint8Array(this.analyzer.frequencyBinCount);
    
    const poll = () => {
      if (!this.analyzer || !this.isPlaying) {
        if (this.onVolumeChange) this.onVolumeChange(0);
        this.animationFrameId = requestAnimationFrame(poll);
        return;
      }
      this.analyzer.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const average = sum / dataArray.length;
      // Convert average frequency magnitude [0, 255] to a dynamic level [0, 100]
      const percentage = Math.min(100, (average / 128) * 100);
      if (this.onVolumeChange) {
        this.onVolumeChange(percentage);
      }
      this.animationFrameId = requestAnimationFrame(poll);
    };
    
    this.animationFrameId = requestAnimationFrame(poll);
  }

  playChunk(base64Data: string) {
    this.init();
    if (!this.ctx || !this.analyzer) return;

    // Decode base64 to binary
    const binaryString = atob(base64Data);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Convert PCM 16-bit to Float32Array
    const sampleCount = len / 2;
    const floatData = new Float32Array(sampleCount);
    const view = new DataView(bytes.buffer);
    for (let i = 0; i < sampleCount; i++) {
      const intVal = view.getInt16(i * 2, true); // little-endian
      floatData[i] = intVal / 32768.0;
    }

    // Create AudioBuffer
    const audioBuffer = this.ctx.createBuffer(1, sampleCount, 24000);
    audioBuffer.copyToChannel(floatData, 0);

    const source = this.ctx.createBufferSource();
    source.buffer = audioBuffer;
    
    // Connect through analyzer for volume dynamics
    source.connect(this.analyzer);

    const currentTime = this.ctx.currentTime;
    if (this.nextStartTime < currentTime) {
      // Maintain a slight buffer to compensate for latency jitters
      this.nextStartTime = currentTime + 0.05;
    }

    source.start(this.nextStartTime);
    const duration = audioBuffer.duration;

    this.activeSources.push(source);

    source.onended = () => {
      this.activeSources = this.activeSources.filter((s) => s !== source);
      if (this.activeSources.length === 0) {
        this.isPlaying = false;
        if (this.onSpeakingEnd) {
          this.onSpeakingEnd();
        }
      }
    };

    if (!this.isPlaying) {
      this.isPlaying = true;
      if (this.onSpeakingStart) {
        this.onSpeakingStart();
      }
    }

    this.nextStartTime += duration;
  }

  stop() {
    this.activeSources.forEach((source) => {
      try {
        source.stop();
      } catch (err) {
        // Safe to ignore
      }
    });
    this.activeSources = [];
    this.isPlaying = false;
    this.nextStartTime = this.ctx ? this.ctx.currentTime : 0;
    if (this.onSpeakingEnd) {
      this.onSpeakingEnd();
    }
    if (this.onVolumeChange) {
      this.onVolumeChange(0);
    }
  }

  destroy() {
    this.stop();
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
    this.analyzer = null;
  }
}

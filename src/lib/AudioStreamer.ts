export class AudioStreamer {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private analyzer: AnalyserNode | null = null;
  private animationFrameId: number | null = null;
  private onAudioChunk: (base64Audio: string) => void;
  private onVolumeChange?: (pct: number) => void;

  constructor(
    onAudioChunk: (base64Audio: string) => void,
    onVolumeChange?: (pct: number) => void
  ) {
    this.onAudioChunk = onAudioChunk;
    this.onVolumeChange = onVolumeChange;
  }

  async start() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
    } catch (err) {
      console.error("Microphone access denied or unavailable:", err);
      throw new Error("Microphone permission is required to converse with Myraa.");
    }

    // Capture standard low-latency audio context at 16kHz
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    this.source = this.ctx.createMediaStreamSource(this.stream);
    
    // Analyzer for user speech visual dynamics
    this.analyzer = this.ctx.createAnalyser();
    this.analyzer.fftSize = 256;
    this.source.connect(this.analyzer);

    // Create processor for raw audio processing
    this.processor = this.ctx.createScriptProcessor(4096, 1, 1);
    this.processor.onaudioprocess = (e) => {
      const channelData = e.inputBuffer.getChannelData(0);
      const pcmBuffer = this.floatToPCM16(channelData);
      const base64 = this.arrayBufferToBase64(pcmBuffer);
      this.onAudioChunk(base64);
    };

    this.source.connect(this.processor);
    this.processor.connect(this.ctx.destination);

    // Dynamic state polling
    this.startMicrophonePolling();
  }

  private startMicrophonePolling() {
    if (!this.analyzer) return;
    const dataArray = new Uint8Array(this.analyzer.frequencyBinCount);

    const poll = () => {
      if (!this.analyzer || !this.stream) {
        if (this.onVolumeChange) this.onVolumeChange(0);
        return;
      }
      this.analyzer.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const average = sum / dataArray.length;
      // Convert frequency magnitude [0, 255] to level [0, 100]
      const percentage = Math.min(100, (average / 128) * 100 * 2.5); // Boost gain for visual effect
      if (this.onVolumeChange) {
        this.onVolumeChange(percentage);
      }
      this.animationFrameId = requestAnimationFrame(poll);
    };

    this.animationFrameId = requestAnimationFrame(poll);
  }

  stop() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
    this.analyzer = null;
    if (this.onVolumeChange) {
      this.onVolumeChange(0);
    }
  }

  private floatToPCM16(floatBuffer: Float32Array): ArrayBuffer {
    const pcmBuffer = new ArrayBuffer(floatBuffer.length * 2);
    const view = new DataView(pcmBuffer);
    for (let i = 0; i < floatBuffer.length; i++) {
      let s = Math.max(-1, Math.min(1, floatBuffer[i]));
      const pcm = s < 0 ? s * 0x8000 : s * 0x7FFF;
      view.setInt16(i * 2, pcm, true);
    }
    return pcmBuffer;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}

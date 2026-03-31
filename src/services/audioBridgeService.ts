import { GoogleGenAI, Modality } from "@google/genai";

export class AudioBridgeService {
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private isCapturing = false;
  private onTranscription: (text: string) => void;

  constructor(onTranscription: (text: string) => void) {
    this.onTranscription = onTranscription;
  }

  private getAI() {
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || "";
    return new GoogleGenAI({ apiKey });
  }

  async start() {
    if (this.isCapturing) return;

    try {
      // 1. Request tab audio capture
      // Note: User must select "Share tab audio" in the browser prompt
      this.stream = await navigator.mediaDevices.getDisplayMedia({
        video: true, // Required by some browsers to get audio
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        } as any
      });

      const audioTrack = this.stream.getAudioTracks()[0];
      if (!audioTrack) {
        throw new Error("No audio track found. Did you check 'Share tab audio'?");
      }

      // 2. Setup Audio Context for PCM extraction
      this.audioContext = new AudioContext({ sampleRate: 16000 });
      this.source = this.audioContext.createMediaStreamSource(this.stream);
      
      // We use a ScriptProcessorNode to buffer audio chunks
      // 4096 samples at 16kHz is ~250ms
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
      
      let audioBuffer: Int16Array[] = [];
      let totalSamples = 0;

      this.processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        // Convert Float32 to Int16 PCM
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
        }
        
        audioBuffer.push(pcmData);
        totalSamples += pcmData.length;

        // When we have ~5 seconds of audio (80,000 samples at 16kHz)
        if (totalSamples >= 80000) {
          const combined = new Int16Array(totalSamples);
          let offset = 0;
          for (const buf of audioBuffer) {
            combined.set(buf, offset);
            offset += buf.length;
          }
          
          this.sendToGemini(combined);
          
          audioBuffer = [];
          totalSamples = 0;
        }
      };

      this.source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);
      
      this.isCapturing = true;
      console.log("Audio Bridge started. Capturing tab audio...");

      // Handle stream end (user clicks "Stop sharing")
      audioTrack.onended = () => this.stop();

    } catch (err) {
      console.error("Failed to start Audio Bridge:", err);
      this.stop();
      throw err;
    }
  }

  private async sendToGemini(pcmData: Int16Array) {
    try {
      const ai = this.getAI();
      
      // Convert Int16Array to Base64 efficiently
      const buffer = pcmData.buffer;
      const uint8 = new Uint8Array(buffer);
      let binary = "";
      const chunkSize = 8192;
      for (let i = 0; i < uint8.length; i += chunkSize) {
        binary += String.fromCharCode.apply(null, uint8.subarray(i, i + chunkSize) as any);
      }
      const base64 = btoa(binary);

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            parts: [
              {
                inlineData: {
                  data: base64,
                  mimeType: "audio/pcm;rate=16000",
                },
              },
              {
                text: "Transcribe the streamer's commentary from this audio. Focus on what the streamer is saying about the game, the action, or their current mood. Return ONLY the transcript text, no meta-commentary.",
              },
            ],
          },
        ],
      });

      const transcript = response.text?.trim();
      if (transcript && transcript.length > 5) {
        this.onTranscription(transcript);
      }
    } catch (err) {
      console.error("Transcription error:", err);
    }
  }

  stop() {
    this.isCapturing = false;
    
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    console.log("Audio Bridge stopped.");
  }

  isActive() {
    return this.isCapturing;
  }
}

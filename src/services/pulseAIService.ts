import { GoogleGenAI, Modality, GenerateContentResponse, LiveServerMessage } from "@google/genai";

// We'll use this service to interact with Gemini and Lyria
export class PulseAIService {
  private getAI() {
    // Create a new instance right before making an API call to ensure it uses the latest key
    // We check both GEMINI_API_KEY and API_KEY as per instructions
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || "";
    return new GoogleGenAI({ apiKey });
  }

  /**
   * Analyzes chat and streamer transcription to determine the current "Pulse" (mood/intensity)
   */
  async analyzeMood(chatMessages: string[], streamUrl: string, transcription?: string): Promise<{
    intensity: number; // 0 to 100
    mood: string;
    genre: string;
    description: string;
    game: string;
    region: string;
  }> {
    const ai = this.getAI();
    
    const parts: any[] = [
      {
        text: `
          Analyze the following live stream data and determine the musical "Pulse".
          
          Stream Context: ${streamUrl}
          
          IMPORTANT: Determine the mood and intensity based on both "Chat Messages" (Audience Reaction) AND "Streamer Transcription" (Streamer's Commentary).
          The streamer's commentary is the primary source of truth for the current action, while the chat reflects the audience's hype.
          
          Use Google Search to find the latest real-time updates, scores, or events for the stream at this URL to ensure the mood is accurate to the actual game state.
          Also determine the specific sport/game being played and the region it is being streamed from (e.g., "North America", "Europe", "Korea", "Brazil").
          
          Streamer Transcription (What the streamer is saying):
          ${transcription || "No audio transcription available yet."}
          
          Chat Messages (Audience Reaction):
          ${chatMessages.length > 0 ? chatMessages.join("\n") : "No messages yet."}
          
          Return a JSON object with:
          - intensity: (number 0-100)
          - mood: (string, e.g., "Hype", "Tense", "Victory", "Defeat", "Ambient")
          - game: (string, the sport or game being played, e.g., "Counter-Strike", "League of Legends", "Basketball")
          - region: (string, the region of the stream/tournament, e.g., "Europe", "North America")
          - genre: (string, e.g., "Cyberpunk Techno", "Epic Orchestral", "Lo-fi Chill". IMPORTANT: Base the genre on the game/sport and the region. For example, a Brazilian CS stream might have "Brazilian Phonk" or "Favela Funk", while a Korean LoL stream might have "K-EDM" or "Intense Orchestral".)
          - description: (string, a short prompt for music generation. IMPORTANT: The music MUST BE INSTRUMENTAL ONLY. NO LYRICS.)
        `
      }
    ];

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts },
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
      },
    });

    try {
      const text = response.text || "{}";
      return JSON.parse(text);
    } catch (e) {
      console.error("Failed to parse mood analysis", e);
      return { intensity: 50, mood: "Ambient", genre: "Electronic", description: "A steady electronic beat", game: "Unknown", region: "Global" };
    }
  }

  /**
   * Generates a short music clip using Lyria
   */
  async generateMusic(prompt: string, retryCount = 0): Promise<{ audioUrl: string }> {
    const ai = this.getAI();
    console.log(`Generating music (attempt ${retryCount + 1}) with prompt:`, prompt);
    
    // Use clip model for faster generation
    const modelName = "lyria-3-clip-preview"; 
    
    try {
      const response = await ai.models.generateContentStream({
        model: modelName,
        contents: `Generate a high-quality INSTRUMENTAL music track based on this mood: ${prompt}. The track should be energetic, immersive, and suitable for a gaming live stream. IMPORTANT: NO LYRICS. INSTRUMENTAL ONLY.`,
        config: {
          responseModalities: [Modality.AUDIO],
        },
      });

      let audioBase64 = "";
      let mimeType = "audio/wav";
      let finishReason = "";

      for await (const chunk of response) {
        const candidate = chunk.candidates?.[0];
        if (candidate?.finishReason) {
          finishReason = candidate.finishReason;
        }

        const parts = candidate?.content?.parts;
        if (!parts) continue;
        
        for (const part of parts) {
          if (part.inlineData?.data) {
            if (!audioBase64 && part.inlineData.mimeType) {
              mimeType = part.inlineData.mimeType;
            }
            audioBase64 += part.inlineData.data;
          }
        }
      }

      if (!audioBase64) {
        console.warn(`Music stream ended with no audio. Finish Reason: ${finishReason}. Model: ${modelName}`);
        if (retryCount < 2) {
          const nextPrompt = retryCount === 0 ? prompt : "simple energetic gaming music";
          return this.generateMusic(nextPrompt, retryCount + 1);
        }
        throw new Error(`No audio data received from ${modelName} after retries.`);
      }

      console.log(`Successfully generated audio (${audioBase64.length} bytes) using ${modelName}`);

      const binary = atob(audioBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: mimeType });
      return { audioUrl: URL.createObjectURL(blob) };

    } catch (e: any) {
      console.error(`Music generation failed on ${modelName}:`, e);
      if (retryCount < 2) {
        console.log("Retrying music generation...");
        return this.generateMusic("simple energetic gaming music", retryCount + 1);
      }
      throw e;
    }
  }

}

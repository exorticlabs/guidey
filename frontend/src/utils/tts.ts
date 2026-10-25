import { API_URL } from "./api";

export function stripTutorTags(text: string): string {
  if (!text) return "";

  // If text already has prose content outside the ```component ... ``` block,
  // do NOT duplicate it by extracting speech_sequence again.
  const textWithoutComponent = text.replace(/```component\s*\{[\s\S]*?\}\s*```/gi, "").trim();
  if (textWithoutComponent.length > 0) {
    return textWithoutComponent
      .replace(/\[BOARD_\d+\]/gi, "")
      .replace(/\[\/BOARD_\d+\]/gi, "\n\n")
      .replace(/\[SPEAK_\d+\]/gi, "")
      .replace(/\[\/SPEAK_\d+\]/gi, "\n\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  let processedText = text.replace(/```component\s*(\{[\s\S]*?\})\s*```/gi, (match, jsonStr) => {
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed.voice && parsed.voice.speech_sequence && parsed.voice.speech_sequence.length > 0) {
        return parsed.voice.speech_sequence.map((s: any) => s.text).join(" ") + "\n\n";
      } else if (parsed.speech) {
        return parsed.speech + "\n\n";
      }
    } catch(e) {}
    return "";
  });

  return processedText
    .replace(/\[BOARD_\d+\]/gi, "")
    .replace(/\[\/BOARD_\d+\]/gi, "\n\n")
    .replace(/\[SPEAK_\d+\]/gi, "")
    .replace(/\[\/SPEAK_\d+\]/gi, "\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function parseTutorResponse(rawText: string): { boardSegments: string[], speechSegments: string[] } {
  console.log("parseTutorResponse called with rawText:", rawText);
  // 1. Extract all component JSONs from ```component ... ``` blocks
  const componentRegex = /```component\s*(\{[\s\S]*?\})\s*```/gi;
  const extractedComponents: string[] = [];
  let compMatch;
  while ((compMatch = componentRegex.exec(rawText)) !== null) {
    extractedComponents.push(compMatch[1].trim());
  }

  // 2. Remove the component blocks from the text to avoid standard splitting processing them
  const cleanRawText = rawText.replace(/```component\s*\{[\s\S]*?\}\s*```/gi, "");

  const boardSegments: string[] = [];
  const speechSegments: string[] = [];
  
  // 3. Process extracted components first
  let foundStructuredTeachStep = false;
  for (const compJson of extractedComponents) {
    console.log("parseTutorResponse processing extracted component:", compJson);
    try {
      const parsed = JSON.parse(compJson);
      if (parsed.type === "OrchestratedTeachStep" || parsed.type === "TeachStep") {
        foundStructuredTeachStep = true;
        boardSegments.push(compJson);
        if (parsed.voice && parsed.voice.speech_sequence && parsed.voice.speech_sequence.length > 0) {
          const seq = parsed.voice.speech_sequence;
          for (let i = 0; i < seq.length; i++) {
            speechSegments.push(seq[i].text || "");
            if (i > 0) {
              boardSegments.push("");
            }
          }
        } else if (parsed.speech) {
          speechSegments.push(parsed.speech);
        } else {
          speechSegments.push("");
        }
      } else {
        boardSegments.push(compJson);
        speechSegments.push("");
      }
    } catch (e) {
      if (compJson.includes('TeachStep')) {
        foundStructuredTeachStep = true;
        boardSegments.push(compJson);
        speechSegments.push("");
      } else {
        boardSegments.push(compJson);
        speechSegments.push("");
      }
    }
  }

  // If structured teach step was found and populated speech, we do NOT duplicate cleanRawText
  if (foundStructuredTeachStep && speechSegments.some((s) => s.trim().length > 0)) {
    console.log("parseTutorResponse finished (structured):", { boardSegments, speechSegments });
    return { boardSegments, speechSegments };
  }

  // 4. Otherwise, parse [BOARD_n] and [SPEAK_n] tags
  const boardRegex = /\[BOARD_(\d+)\]([\s\S]*?)\[\/BOARD_\1\]/gi;
  const speakRegex = /\[SPEAK_(\d+)\]([\s\S]*?)\[\/SPEAK_\1\]/gi;
  
  const boardMap = new Map<number, string>();
  const speakMap = new Map<number, string>();
  
  let match;
  while ((match = boardRegex.exec(cleanRawText)) !== null) {
    boardMap.set(parseInt(match[1]), match[2].trim());
  }
  
  while ((match = speakRegex.exec(cleanRawText)) !== null) {
    speakMap.set(parseInt(match[1]), match[2].trim());
  }
  
  const maxIdx = Math.max(0, ...Array.from(boardMap.keys()), ...Array.from(speakMap.keys()));
  
  for (let i = 1; i <= maxIdx; i++) {
    if (boardMap.has(i) || speakMap.has(i)) {
      boardSegments.push(boardMap.get(i) || "");
      speechSegments.push(speakMap.get(i) || "");
    }
  }
  
  // 5. Fallback if no structured tags found: split using delimiters
  if (boardSegments.length === 0) {
    const rawSegments = cleanRawText.split(/([.!?。！？\n]+)/);
    const parsedSegments: string[] = [];
    
    let currentPart = "";
    for (let i = 0; i < rawSegments.length; i++) {
      const part = rawSegments[i];
      if (!part) continue;
      
      if (/^[.!?。！？\n]+$/.test(part)) {
        currentPart += part;
        const cleaned = currentPart.trim();
        if (cleaned) parsedSegments.push(cleaned);
        currentPart = "";
      } else {
        if (currentPart.trim()) parsedSegments.push(currentPart.trim());
        currentPart = part;
      }
    }
    if (currentPart.trim()) {
      parsedSegments.push(currentPart.trim());
    }
    
    const cleanSegments = parsedSegments
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith("📎") && !s.includes("Attached:") && !s.startsWith("```") && !s.startsWith("[BOARD_"));
      
    boardSegments.push(...cleanSegments);
    speechSegments.push(...cleanSegments);
  }

  console.log("parseTutorResponse finished:", { boardSegments, speechSegments });
  return { boardSegments, speechSegments };
}

export function parseStructuredResponse(data: any): { boardSegments: string[], speechSegments: string[] } {
  if (typeof data === "string") {
    return parseTutorResponse(data);
  }
  
  if (!data || typeof data !== "object") {
    return { boardSegments: [], speechSegments: [] };
  }

  const rawText = data.response || data.content || "";
  
  // If we have an OrchestratedTeachStep directly inside a component block, let's extract it
  let finalData = data;
  if (rawText.includes("```component")) {
    const compMatch = /```component\s*(\{[\s\S]*?\})\s*```/.exec(rawText);
    if (compMatch) {
      try {
        finalData = JSON.parse(compMatch[1]);
      } catch (e) {}
    }
  }

  // If this is the new OrchestratedTeachStep format
  if (finalData && finalData.type === "OrchestratedTeachStep") {
    const speechSeq = finalData.voice?.speech_sequence || [];
    const speechSegments: string[] = [];
    const boardSegments: string[] = [];
    
    if (speechSeq.length > 0) {
      // Put the whole payload in the first board segment so Whiteboard gets it
      boardSegments.push(JSON.stringify(finalData));
      speechSegments.push(speechSeq[0].text || "");
      
      for (let i = 1; i < speechSeq.length; i++) {
        boardSegments.push(""); // empty string keeps index aligned
        speechSegments.push(speechSeq[i].text || "");
      }
    } else {
      boardSegments.push(JSON.stringify(finalData));
      speechSegments.push("");
    }
    
    return { boardSegments, speechSegments };
  }
  
  // Fallback to legacy tag parsing if text contains tags
  if (rawText.includes("[BOARD_") || rawText.includes("```component")) {
    return parseTutorResponse(rawText);
  }

  // Use TTSManager to split speech text into sentence segments
  const tempManager = new TTSManager();
  const speechSegments = tempManager.splitIntoSegments(rawText);
  
  const boardSegments: string[] = speechSegments.map(() => "");

  // Prepend TeachStep so it updates visually before speech begins
  if (data.teach_step) {
    boardSegments.unshift(JSON.stringify({
      type: "TeachStep",
      ...data.teach_step
    }));
    speechSegments.unshift("");
  }

  if (boardSegments.length === 0) {
    boardSegments.push("");
    speechSegments.push("");
  }

  return { boardSegments, speechSegments };
}


export interface TTSSegment {
  index: number;
  text: string;
}

export class TTSManager {
  private audioCtx: AudioContext | null = null;
  private queue: TTSSegment[] = [];
  private isPlaying = false;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private activeSource: AudioBufferSourceNode | null = null;
  
  // Callback when a segment starts speaking (with segment index, duration in seconds, and word boundaries)
  public onSegmentStart: ((index: number, duration: number, words?: any[]) => void) | null = null;
  public onFinished: (() => void) | null = null;
  
  private currentSegmentIndex = -1;
  private nextPlayTime = 0;
  private activeSourcesCount = 0;
  private abortController: AbortController | null = null;
  private isStopped = false;

  constructor() {
    // AudioContext will be initialized on first user interaction
  }

  private initAudio() {
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === "suspended") {
      this.audioCtx.resume();
    }
  }

  /**
   * Split a block of text into sentences/phrases for speech streaming
   */
  public splitIntoSegments(text: string): string[] {
    // Split by sentence delimiters but filter out very small or empty parts
    const rawSegments = text.split(/([.!?。！？\n]+)/);
    const segments: string[] = [];
    
    let currentPart = "";
    for (let i = 0; i < rawSegments.length; i++) {
      const part = rawSegments[i];
      if (!part) continue;
      
      // If it's a delimiter, attach it to the current sentence
      if (/^[.!?。！？\n]+$/.test(part)) {
        currentPart += part;
        const cleaned = currentPart.trim();
        if (cleaned) {
          segments.push(cleaned);
        }
        currentPart = "";
      } else {
        if (currentPart.trim()) {
          segments.push(currentPart.trim());
        }
        currentPart = part;
      }
    }
    
    if (currentPart.trim()) {
      segments.push(currentPart.trim());
    }
    // Filter segments to match the chalkboard blocks in Whiteboard.tsx exactly
    return segments
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith("📎") && !s.includes("Attached:") && !s.startsWith("```") && !s.startsWith("[BOARD_"));
  }

  private isSpokenSegment(text: string): boolean {
    const clean = text.trim();
    if (!clean) return false;
    
    // Check if it looks like code syntax or code tags
    if (clean.includes("class ") || clean.includes("def ") || clean.includes("function") || clean.includes("const ") || clean.includes("import ")) {
      return false;
    }

    // Ignore LaTeX math blocks, inline math, and specific math equations/formulas
    if (clean.includes("$$") || clean.includes("\\int") || clean.includes("\\frac") || clean.includes("\\sum") || clean.includes("\\infty") || clean.includes("\\lim") || clean.includes("\\text{") || clean.includes("\\cdot") || clean.includes("\\partial") || clean.includes("\\sigma") || clean.includes("\\mu") || clean.includes("\\pi") || clean.includes("_{") || clean.includes("^{")) {
      return false;
    }
    
    // Detect ASCII art / drawings / list formatting with high symbol concentration
    const lines = clean.split("\n");
    if (lines.length > 1) {
      const layoutCharCount = (clean.match(/[|+\-=_\\\/<>┌┐└┘├┤┬┴┼─│┌┐└┘─│┼┐└┘┌┐├┤─│┬┴─│─┼─]/g) || []).length;
      if (layoutCharCount > clean.length * 0.15) {
        return false; // Skip speaking diagrams/ASCII blocks
      }
    }
    
    // Ignore lines that are purely symbol dividers or decoration
    if (/^[=\-_+*|#\s:>┌┐└┘├┤┬┴┼─│┌┐└┘─│┼┐└┘┌┐├┤─│┬┴─│─┼─]+$/.test(clean)) {
      return false;
    }
    
    return true;
  }

  private sanitizeTextForSpeech(text: string): string {
    return text
      .replace(/^#+\s*/g, "") // strip headers
      .replace(/^[-*+]\s*/g, "") // strip bullet points
      .replace(/[*_`~[\]()$]/g, "") // strip formatting symbols and dollar signs
      .replace(/[\/\\]/g, " ") // replace slashes with space
      .trim();
  }

  /**
   * Start speaking a full text by splitting it or using pre-parsed segments and scheduling playback
   */
  public async speak(text: string[] | string): Promise<void> {
    this.stop();
    this.isStopped = false;
    this.initAudio();
    this.abortController = new AbortController();

    let textSegments: string[] = [];
    if (Array.isArray(text)) {
      textSegments = text.filter((t) => t && t.trim().length > 0);
    } else if (typeof text === "string") {
      textSegments = this.splitIntoSegments(text);
    }

    if (textSegments.length === 0) {
      if (this.onFinished) this.onFinished();
      return;
    }

    this.queue = textSegments.map((t, idx) => ({ index: idx, text: t }));
    this.isPlaying = true;
    this.currentSegmentIndex = 0;
    this.activeSourcesCount = 0;
    this.nextPlayTime = this.audioCtx ? this.audioCtx.currentTime : 0;
    this.playNext();
  }

  /**
   * Play the next segment in the queue
   */
  private async playNext() {
    if (!this.isPlaying) {
      return;
    }
    if (this.currentSegmentIndex >= this.queue.length) {
      // We've scheduled everything. onFinished will be called by onended.
      if (this.activeSourcesCount === 0) {
        const now = this.audioCtx ? this.audioCtx.currentTime : 0;
        const delayMs = Math.max(0, (this.nextPlayTime - now) * 1000);
        setTimeout(() => {
          if (this.isPlaying && this.activeSourcesCount === 0 && this.currentSegmentIndex >= this.queue.length) {
            this.isPlaying = false;
            if (this.onFinished) this.onFinished();
          }
        }, delayMs);
      }
      return;
    }

    const segment = this.queue[this.currentSegmentIndex];
    // Skip audio generation/speaking for non-spoken segments (diagrams, pure code)
    if (!this.isSpokenSegment(segment.text)) {
      // Schedule UI update
      const now = this.audioCtx ? this.audioCtx.currentTime : 0;
      const startTime = this.nextPlayTime < now ? now : this.nextPlayTime;
      const delayMs = Math.max(0, (startTime - now) * 1000);
      
      setTimeout(() => {
        if (this.isPlaying && this.onSegmentStart) {
          this.onSegmentStart(segment.index);
        }
      }, delayMs);
      
      this.nextPlayTime = startTime + 0.85; // Natural 850ms writing pause
      
      this.currentSegmentIndex++;
      this.playNext();
      return;
    }

    const spokenText = this.sanitizeTextForSpeech(segment.text);
    if (!spokenText) {
      this.currentSegmentIndex++;
      this.playNext();
      return;
    }

    try {
      // Try server-side Edge-TTS / gTTS speech API with word-level timestamps
      const signal = this.abortController?.signal;
      const response = await fetch(`${API_URL}/api/tts?text=${encodeURIComponent(spokenText)}&return_words=true`, { signal });
      if (!response.ok) {
        throw new Error("TTS Server request failed");
      }
      
      let arrayBuffer: ArrayBuffer;
      let wordBoundaries: any[] = [];
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const json = await response.json();
        wordBoundaries = json.words || [];
        const binaryString = atob(json.audio_base64 || "");
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        arrayBuffer = bytes.buffer;
      } else {
        arrayBuffer = await response.arrayBuffer();
      }

      if (!this.audioCtx) throw new Error("No AudioContext");

      const audioBuffer = await this.audioCtx.decodeAudioData(arrayBuffer);
      const duration = audioBuffer.duration;
      
      if (!this.isPlaying) return; // stopped in the meantime

      const source = this.audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioCtx.destination);

      // Determine schedule time
      const now = this.audioCtx.currentTime;
      let startTime = this.nextPlayTime;
      if (startTime < now) {
        startTime = now + 0.05; // slight offset for smoothness
      }

      // Schedule UI update exactly when the audio starts playing
      const startDelayMs = Math.max(0, (startTime - now) * 1000);
      setTimeout(() => {
        if (this.isPlaying && this.onSegmentStart) {
          this.onSegmentStart(segment.index, duration, wordBoundaries);
        }
      }, startDelayMs);

      // Determine schedule time
      source.start(startTime);
      this.activeSource = source;
      this.activeSourcesCount++;
      
      source.onended = () => {
        this.activeSourcesCount--;
        if (!this.isPlaying || this.isStopped) return;
        if (this.activeSourcesCount <= 0 && this.currentSegmentIndex >= this.queue.length) {
          this.activeSourcesCount = 0;
          this.isPlaying = false;
          if (this.onFinished) this.onFinished();
        }
      };
      
      // Calculate when this finishes
      this.nextPlayTime = startTime + duration;

      // Start fetching the next segment immediately to prevent gaps
      this.currentSegmentIndex++;
      this.playNext();

    } catch (err) {
      console.warn("Fallback to client SpeechSynthesis due to error:", err);
      this.playNativeFallback(segment, spokenText);
    }
  }

  /**
   * Fallback using window.speechSynthesis
   */
  private playNativeFallback(segment: TTSSegment, spokenText: string) {
    if (!window.speechSynthesis) {
      this.currentSegmentIndex++;
      this.playNext();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(spokenText);
    
    // Choose a friendly English voice if available
    const voices = window.speechSynthesis.getVoices();
    const friendlyVoice = voices.find(v => 
      v.lang.startsWith("en") && 
      (v.name.includes("Google") || v.name.includes("Natural") || v.name.includes("Samantha"))
    );
    if (friendlyVoice) utterance.voice = friendlyVoice;

    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    this.activeSourcesCount++;
    
    utterance.onstart = () => {
      if (this.onSegmentStart) {
        const wordCount = spokenText.trim().split(/\s+/).filter(Boolean).length;
        const approxDuration = Math.max(1.5, wordCount / 2.7);
        this.onSegmentStart(segment.index, approxDuration);
      }
    };
    
    utterance.onend = () => {
      this.activeSourcesCount--;
      if (!this.isPlaying || this.isStopped) return;
      this.currentSegmentIndex++;
      if (this.currentSegmentIndex < this.queue.length) {
        this.playNext();
      } else if (this.activeSourcesCount <= 0) {
        this.activeSourcesCount = 0;
        this.isPlaying = false;
        if (this.onFinished) this.onFinished();
      }
    };

    utterance.onerror = (e) => {
      console.warn("Native TTS error", e);
      this.activeSourcesCount--;
      if (!this.isPlaying || this.isStopped) return;
      this.currentSegmentIndex++;
      if (this.currentSegmentIndex < this.queue.length) {
        this.playNext();
      } else if (this.activeSourcesCount <= 0) {
        this.activeSourcesCount = 0;
        this.isPlaying = false;
        if (this.onFinished) this.onFinished();
      }
    };
    
    this.currentUtterance = utterance;

    window.speechSynthesis.speak(utterance);
  }

  /**
   * Stop all current speech audio
   */
  public stop() {
    this.isStopped = true;
    this.isPlaying = false;
    this.queue = [];
    this.activeSourcesCount = 0;
    this.currentSegmentIndex = -1;
    this.nextPlayTime = 0;

    // 1. Abort any in-flight HTTP audio fetches
    if (this.abortController) {
      try {
        this.abortController.abort();
      } catch {}
      this.abortController = null;
    }

    // 2. Stop and clear native SpeechSynthesis
    if (typeof window !== "undefined" && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
    this.currentUtterance = null;

    // 3. Immediately close and nullify AudioContext to kill all queued/scheduled audio
    if (this.audioCtx) {
      try {
        if (this.activeSource) {
          this.activeSource.stop();
          this.activeSource.disconnect();
        }
        this.audioCtx.close().catch(() => {});
      } catch {}
      this.audioCtx = null;
      this.activeSource = null;
    }
  }
}

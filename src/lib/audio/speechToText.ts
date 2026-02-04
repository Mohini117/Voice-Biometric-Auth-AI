// Speech-to-Text Conversion using Web Speech API
// Captures speech during live recording with microphone input

declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

export interface TranscriptionResult {
  text: string;
  confidence: number;
  isFinal: boolean;
}

// Initialize Speech Recognition
function initSpeechRecognition(): any {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    throw new Error('Speech Recognition API is not supported in this browser');
  }
  return new SpeechRecognition();
}

// Start speech recognition on the microphone stream
export async function startSpeechRecognition(): Promise<TranscriptionResult> {
  return new Promise((resolve, reject) => {
    try {
      const recognition = initSpeechRecognition();
      let finalTranscript = '';
      let interimTranscript = '';
      let maxConfidence = 0;
      let hasResult = false;

      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.language = 'en-US';

      recognition.onstart = () => {
        console.log('Speech recognition started');
      };

      recognition.onresult = (event: any) => {
        interimTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          const confidence = event.results[i][0].confidence || 0;
          
          if (confidence > maxConfidence) {
            maxConfidence = confidence;
          }

          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
            hasResult = true;
            console.log('Final result:', transcript, 'Confidence:', confidence);
          } else {
            interimTranscript += transcript;
            console.log('Interim result:', transcript);
            // Save interim as backup in case we get aborted before final result
            if (transcript.trim().length > 0 && !hasResult) {
              finalTranscript = transcript + ' ';
              hasResult = true;
            }
          }
        }
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        // Don't reject on no-speech errors, just continue or stop gracefully
        if (event.error === 'no-speech' || event.error === 'network') {
          recognition.abort();
        }
      };

      recognition.onend = () => {
        const text = finalTranscript.trim().toLowerCase();
        console.log('Speech recognition ended. Transcribed text:', text, 'Confidence:', maxConfidence);
        
        // Only resolve if we actually got speech
        if (hasResult && text.length > 0) {
          resolve({
            text,
            confidence: maxConfidence,
            isFinal: true,
          });
        } else {
          resolve({
            text: '',
            confidence: 0,
            isFinal: true,
          });
        }
      };

      // Start recognition
      recognition.start();

      // Set timeout for max duration (match recording duration)
      setTimeout(() => {
        try {
          recognition.abort();
        } catch (e) {
          // Already stopped
        }
      }, 15000); // 15 seconds max

    } catch (error) {
      reject(error);
    }
  });
}

// Stop ongoing speech recognition
export function stopSpeechRecognition(recognition: any): void {
  try {
    if (recognition) {
      recognition.abort();
    }
  } catch (error) {
    console.warn('Error stopping speech recognition:', error);
  }
}

// Alternative: Process audio and extract text using pattern matching
export function extractVoicePasswordFromAudio(audioData: Float32Array, sampleRate: number = 16000): string {
  try {
    // Analyze audio frequency patterns to detect words
    // This is a simplified version - for production use cloud-based STT
    
    const fftSize = 2048;
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate });
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = fftSize;
    
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);
    
    // Extract dominant frequencies
    const dominantFrequencies = extractDominantFrequencies(dataArray, analyser.frequencyBinCount, sampleRate);
    
    console.log('Dominant frequencies detected:', dominantFrequencies);
    
    // This would require a frequency-to-phoneme mapping
    // For now, return empty as we'll use the Web Speech API
    return '';
  } catch (error) {
    console.error('Error extracting voice password:', error);
    return '';
  }
}

// Extract dominant frequencies from audio
function extractDominantFrequencies(dataArray: Uint8Array, length: number, sampleRate: number): number[] {
  const frequencies: number[] = [];
  const threshold = 150; // Frequency threshold
  
  for (let i = 0; i < length; i++) {
    if (dataArray[i] > threshold) {
      const frequency = (i * sampleRate) / (2 * length);
      frequencies.push(frequency);
    }
  }
  
  return frequencies.slice(0, 5); // Return top 5
}

// Convert Float32Array to AudioBlob
function float32ArrayToAudioBlob(float32Array: Float32Array, sampleRate: number): Blob {
  const wav = encodeWAV(float32Array, sampleRate);
  return new Blob([wav], { type: 'audio/wav' });
}

// Encode audio as WAV format
function encodeWAV(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  // WAV header
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size
  view.setUint16(20, 1, true); // AudioFormat (PCM)
  view.setUint16(22, 1, true); // NumChannels
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, sampleRate * 2, true); // ByteRate
  view.setUint16(32, 2, true); // BlockAlign
  view.setUint16(34, 16, true); // BitsPerSample
  writeString(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }

  return buffer;
}

// Normalize text for comparison (remove extra spaces, convert to lowercase)
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, ''); // Remove special characters
}

// Calculate text similarity (Levenshtein distance based)
export function calculateTextSimilarity(text1: string, text2: string): number {
  const norm1 = normalizeText(text1);
  const norm2 = normalizeText(text2);
  
  if (norm1 === norm2) return 1;
  if (!norm1 || !norm2) return 0;
  
  const maxLen = Math.max(norm1.length, norm2.length);
  const distance = levenshteinDistance(norm1, norm2);
  
  return Math.max(0, 1 - distance / maxLen);
}

// Levenshtein distance algorithm for string comparison
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

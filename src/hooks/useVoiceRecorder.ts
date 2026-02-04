import { useState, useRef, useCallback } from 'react';
import { 
  SpeakerProfile, 
  extractSpeakerProfile,
  averageSpeakerProfiles, 
  verifySpeaker,
  serializeSpeakerProfile,
  deserializeSpeakerProfile
} from '@/lib/audio/speakerRecognition';
import { startSpeechRecognition, stopSpeechRecognition } from '@/lib/audio/speechToText';

const SAMPLE_RATE = 16000;

// WAV encoder for fallback
function encodeWAV(audioData: Float32Array, sampleRate: number): Blob {
  const numChannels = 1;
  const length = audioData.length * numChannels * 2 + 36;
  const arrayBuffer = new ArrayBuffer(44 + audioData.length * numChannels * 2);
  const view = new DataView(arrayBuffer);
  
  // WAV header
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, length, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true); // 16-bit

  writeString(36, 'data');
  view.setUint32(40, audioData.length * numChannels * 2, true);

  // Audio data
  let offset = 44;
  for (let i = 0; i < audioData.length; i++) {
    const s = Math.max(-1, Math.min(1, audioData[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    offset += 2;
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

interface VoiceRecorderState {
  isRecording: boolean;
  isProcessing: boolean;
  audioLevel: number;
  error: string | null;
}

interface VerificationResult {
  match: boolean;
  confidence: number;
  message: string;
}

interface VoiceRecorderResult {
  state: VoiceRecorderState;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<{ audioData: Float32Array | null; transcript: string }>;
  extractProfile: (audioData: Float32Array) => SpeakerProfile;
  verifySpeaker: (audioData: Float32Array, enrolledProfile: SpeakerProfile, threshold?: number) => VerificationResult;
  averageProfiles: (profiles: SpeakerProfile[]) => SpeakerProfile;
}

export function useVoiceRecorder(): VoiceRecorderResult {
  const [state, setState] = useState<VoiceRecorderState>({
    isRecording: false,
    isProcessing: false,
    audioLevel: 0,
    error: null,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rawAudioDataRef = useRef<Float32Array[]>([]);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const speechRecognitionRef = useRef<any>(null);
  const recognitionPromiseRef = useRef<Promise<any> | null>(null);

  const updateAudioLevel = useCallback(() => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    const average = dataArray.reduce((acc, val) => acc + val, 0) / dataArray.length;
    const normalizedLevel = Math.min(average / 128, 1);

    setState(prev => ({ ...prev, audioLevel: normalizedLevel }));

    if (state.isRecording) {
      animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
    }
  }, [state.isRecording]);

  const startRecording = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, error: null, isRecording: true }));
      chunksRef.current = [];
      rawAudioDataRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: SAMPLE_RATE,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        }
      });

      streamRef.current = stream;

      // Set up audio context for level monitoring AND raw audio capture
      audioContextRef.current = new AudioContext({ sampleRate: SAMPLE_RATE });
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);

      // Set up ScriptProcessorNode to capture raw audio data
      const scriptProcessor = audioContextRef.current.createScriptProcessor(4096, 1, 1);
      scriptProcessorRef.current = scriptProcessor;
      
      scriptProcessor.onaudioprocess = (event: AudioProcessingEvent) => {
        const inputData = event.inputBuffer.getChannelData(0);
        // Store a copy of the audio data
        rawAudioDataRef.current.push(new Float32Array(inputData));
      };
      
      // Connect source -> analyser and source -> scriptProcessor
      source.connect(scriptProcessor);
      scriptProcessor.connect(audioContextRef.current.destination);

      // Start level monitoring
      animationFrameRef.current = requestAnimationFrame(updateAudioLevel);

      // Start speech recognition in parallel with recording
      try {
        recognitionPromiseRef.current = startSpeechRecognition();
      } catch (error) {
        console.warn('Speech recognition not available:', error);
      }

      // Set up media recorder with fallback for audio format
      const mimeTypes = [
        'audio/wav',
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4'
      ];
      
      let selectedMimeType = mimeTypes[0];
      for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType;
          break;
        }
      }

      console.log('Using MIME type:', selectedMimeType);
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: selectedMimeType
      });

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.start(100);
    } catch (error) {
      console.error('Failed to start recording:', error);
      setState(prev => ({
        ...prev,
        isRecording: false,
        error: 'Failed to access microphone. Please check permissions.'
      }));
    }
  }, [updateAudioLevel]);

  const stopRecording = useCallback(async (): Promise<{ audioData: Float32Array | null; transcript: string }> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
        setState(prev => ({ ...prev, isRecording: false }));
        resolve({ audioData: null, transcript: '' });
        return;
      }

      setState(prev => ({ ...prev, isProcessing: true }));

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      mediaRecorderRef.current.onstop = async () => {
        try {
          // Stop all tracks
          streamRef.current?.getTracks().forEach(track => track.stop());

          // Disconnect and clean up ScriptProcessorNode
          if (scriptProcessorRef.current) {
            scriptProcessorRef.current.disconnect();
            scriptProcessorRef.current = null;
          }

          // Use raw audio data captured from ScriptProcessorNode
          if (rawAudioDataRef.current.length === 0) {
            throw new Error('No audio data captured. Please try recording again.');
          }

          // Combine all audio chunks into a single Float32Array
          const totalLength = rawAudioDataRef.current.reduce((sum, chunk) => sum + chunk.length, 0);
          const audioData = new Float32Array(totalLength);
          let offset = 0;
          
          for (const chunk of rawAudioDataRef.current) {
            audioData.set(chunk, offset);
            offset += chunk.length;
          }

          console.log('Raw audio data captured:', {
            chunks: rawAudioDataRef.current.length,
            totalLength: audioData.length,
            duration: (audioData.length / SAMPLE_RATE).toFixed(2) + 's'
          });

          // Create a copy of the audio data to avoid issues with buffer references
          const audioDataCopy = audioData ? new Float32Array(audioData) : null;
          // Wait for speech recognition to complete
          let transcript = '';
          if (recognitionPromiseRef.current) {
            try {
              const result = await recognitionPromiseRef.current;
              transcript = result.text || '';
              console.log('Speech recognition result:', transcript);
            } catch (error) {
              console.warn('Speech recognition failed:', error);
            }
          }

          setState(prev => ({ ...prev, isRecording: false, isProcessing: false, audioLevel: 0 }));
          resolve({ audioData: audioDataCopy, transcript });
        } catch (error) {
          console.error('Failed to process audio:', error);
          setState(prev => ({
            ...prev,
            isRecording: false,
            isProcessing: false,
            error: error instanceof Error ? error.message : 'Failed to process audio recording. Please try again.'
          }));
          resolve({ audioData: null, transcript: '' });
        }
      };

      mediaRecorderRef.current.stop();
      
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    });

  }, []);

  // Extract speaker profile from audio
  const extractProfile = useCallback((audioData: Float32Array): SpeakerProfile => {
    return extractSpeakerProfile(audioData);
  }, []);

  // Verify speaker
  const verifySpeakerFunc = useCallback((
    audioData: Float32Array,
    enrolledProfile: SpeakerProfile,
    threshold: number = 0.75
  ): VerificationResult => {
    return verifySpeaker(audioData, enrolledProfile, threshold);
  }, []);

  // Average multiple profiles
  const averageProfiles = useCallback((profiles: SpeakerProfile[]): SpeakerProfile => {
    return averageSpeakerProfiles(profiles);
  }, []);

  return {
    state,
    startRecording,
    stopRecording,
    extractProfile,
    verifySpeaker: verifySpeakerFunc,
    averageProfiles,
  };
}

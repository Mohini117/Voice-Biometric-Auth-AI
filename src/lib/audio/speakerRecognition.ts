// Speaker Recognition System - Voice Biometric Authentication
// Users can speak anything - system identifies the speaker not the words

import { extractMFCC, cosineSimilarity } from './mfcc';

export interface SpeakerProfile {
  // Core speaker characteristics
  meanMFCC: number[];
  mfccVariance: number[];
  
  // Voice quality metrics
  energy: number;
  energyVariance: number;
  zeroCrossingRate: number;
  
  // Spectral characteristics
  spectralCentroid: number;
  spectralRolloff: number;
  
  // Temporal characteristics
  mfccDelta: number[];
  
  // Metadata
  sampleCount: number;
  totalDuration: number;
}

// Compute energy of audio signal
function computeEnergy(audioData: Float32Array): number {
  let sumSquares = 0;
  for (let i = 0; i < audioData.length; i++) {
    sumSquares += audioData[i] * audioData[i];
  }
  return Math.sqrt(sumSquares / audioData.length);
}

// Compute zero-crossing rate
function computeZeroCrossingRate(audioData: Float32Array): number {
  let crossings = 0;
  for (let i = 1; i < audioData.length; i++) {
    if ((audioData[i] >= 0 && audioData[i - 1] < 0) ||
        (audioData[i] < 0 && audioData[i - 1] >= 0)) {
      crossings++;
    }
  }
  return crossings / audioData.length;
}

// Compute spectral centroid
function computeSpectralCentroid(audioData: Float32Array): number {
  const fftSize = 512;
  if (audioData.length < fftSize) return 0;
  
  // Simple frequency-based estimation
  let totalEnergy = 0;
  let weightedSum = 0;
  
  for (let i = 0; i < audioData.length; i++) {
    const energy = audioData[i] * audioData[i];
    totalEnergy += energy;
    weightedSum += energy * (i / audioData.length);
  }
  
  return totalEnergy > 0 ? weightedSum / totalEnergy : 0;
}

// Compute spectral rolloff (frequency below which 85% of energy is concentrated)
function computeSpectralRolloff(audioData: Float32Array): number {
  const fftSize = 512;
  if (audioData.length < fftSize) return 0.85;
  
  let totalEnergy = 0;
  for (let i = 0; i < audioData.length; i++) {
    totalEnergy += audioData[i] * audioData[i];
  }
  
  let cumulativeEnergy = 0;
  const target = totalEnergy * 0.85;
  
  for (let i = 0; i < audioData.length; i++) {
    cumulativeEnergy += audioData[i] * audioData[i];
    if (cumulativeEnergy >= target) {
      return i / audioData.length;
    }
  }
  
  return 0.85;
}

// Extract speaker profile from audio
export function extractSpeakerProfile(audioData: Float32Array): SpeakerProfile {
  if (audioData.length === 0) {
    throw new Error('Audio data is empty');
  }

  // Extract MFCC features
  const mfccFrames = extractMFCC(audioData);
  
  if (mfccFrames.length === 0) {
    throw new Error('Insufficient audio length. Please record at least 3-5 seconds.');
  }

  // Compute mean MFCC
  const numCoeffs = mfccFrames[0].length;
  const meanMFCC = new Array(numCoeffs).fill(0);
  
  for (const frame of mfccFrames) {
    for (let i = 0; i < numCoeffs; i++) {
      meanMFCC[i] += frame[i];
    }
  }
  
  for (let i = 0; i < numCoeffs; i++) {
    meanMFCC[i] /= mfccFrames.length;
  }

  // Compute MFCC variance
  const mfccVariance = new Array(numCoeffs).fill(0);
  for (const frame of mfccFrames) {
    for (let i = 0; i < numCoeffs; i++) {
      const diff = frame[i] - meanMFCC[i];
      mfccVariance[i] += diff * diff;
    }
  }
  
  for (let i = 0; i < numCoeffs; i++) {
    mfccVariance[i] /= mfccFrames.length;
    mfccVariance[i] = Math.sqrt(mfccVariance[i]); // Standard deviation instead of variance
  }

  // Compute delta (rate of change) of MFCC
  const mfccDelta = new Array(numCoeffs).fill(0);
  if (mfccFrames.length >= 3) {
    for (let i = 1; i < mfccFrames.length - 1; i++) {
      for (let j = 0; j < numCoeffs; j++) {
        mfccDelta[j] += Math.abs(mfccFrames[i + 1][j] - mfccFrames[i - 1][j]) / 2;
      }
    }
    for (let i = 0; i < numCoeffs; i++) {
      mfccDelta[i] /= (mfccFrames.length - 2);
    }
  } else {
    // If few frames, use first-order differences
    for (let i = 1; i < mfccFrames.length; i++) {
      for (let j = 0; j < numCoeffs; j++) {
        mfccDelta[j] += Math.abs(mfccFrames[i][j] - mfccFrames[i - 1][j]);
      }
    }
    for (let i = 0; i < numCoeffs; i++) {
      mfccDelta[i] /= Math.max(1, mfccFrames.length - 1);
    }
  }

  // Compute voice quality metrics
  const energy = computeEnergy(audioData);
  const zcr = computeZeroCrossingRate(audioData);
  const centroid = computeSpectralCentroid(audioData);
  const rolloff = computeSpectralRolloff(audioData);

  // Compute energy variance across frames
  let energyVariance = 0;
  const frameEnergies = mfccFrames.map(frame => {
    let e = 0;
    for (const coeff of frame) {
      e += coeff * coeff;
    }
    return Math.sqrt(e);
  });
  
  const meanEnergy = frameEnergies.reduce((a, b) => a + b, 0) / frameEnergies.length;
  for (const e of frameEnergies) {
    energyVariance += (e - meanEnergy) * (e - meanEnergy);
  }
  energyVariance = Math.sqrt(energyVariance / frameEnergies.length);

  const sampleRate = 16000;
  const durationSeconds = audioData.length / sampleRate;

  return {
    meanMFCC,
    mfccVariance,
    energy,
    energyVariance,
    zeroCrossingRate: zcr,
    spectralCentroid: centroid,
    spectralRolloff: rolloff,
    mfccDelta,
    sampleCount: mfccFrames.length,
    totalDuration: durationSeconds,
  };
}

// Average multiple speaker profiles for enrollment
export function averageSpeakerProfiles(profiles: SpeakerProfile[]): SpeakerProfile {
  if (profiles.length === 0) {
    throw new Error('No profiles to average');
  }

  const numCoeffs = profiles[0].meanMFCC.length;
  
  // Validate all profiles
  for (const profile of profiles) {
    if (!profile.meanMFCC || profile.meanMFCC.length !== numCoeffs) {
      throw new Error('Inconsistent profile structure');
    }
  }

  const avgMeanMFCC = new Array(numCoeffs).fill(0);
  const avgMFCCVariance = new Array(numCoeffs).fill(0);
  const avgMFCCDelta = new Array(numCoeffs).fill(0);
  let avgEnergy = 0;
  let avgEnergyVariance = 0;
  let avgZCR = 0;
  let avgCentroid = 0;
  let avgRolloff = 0;

  for (const profile of profiles) {
    for (let i = 0; i < numCoeffs; i++) {
      avgMeanMFCC[i] += profile.meanMFCC[i];
      avgMFCCVariance[i] += profile.mfccVariance[i];
      avgMFCCDelta[i] += profile.mfccDelta[i];
    }
    avgEnergy += profile.energy;
    avgEnergyVariance += profile.energyVariance;
    avgZCR += profile.zeroCrossingRate;
    avgCentroid += profile.spectralCentroid;
    avgRolloff += profile.spectralRolloff;
  }

  const n = profiles.length;
  for (let i = 0; i < numCoeffs; i++) {
    avgMeanMFCC[i] /= n;
    avgMFCCVariance[i] /= n;
    avgMFCCDelta[i] /= n;
  }

  return {
    meanMFCC: avgMeanMFCC,
    mfccVariance: avgMFCCVariance,
    energy: avgEnergy / n,
    energyVariance: avgEnergyVariance / n,
    zeroCrossingRate: avgZCR / n,
    spectralCentroid: avgCentroid / n,
    spectralRolloff: avgRolloff / n,
    mfccDelta: avgMFCCDelta,
    sampleCount: Math.round(profiles.reduce((a, b) => a + b.sampleCount, 0) / n),
    totalDuration: profiles.reduce((a, b) => a + b.totalDuration, 0) / n,
  };
}

// Compute weighted distance between speaker profiles
function computeSpeakerDistance(test: SpeakerProfile, enrolled: SpeakerProfile): number {
  // MFCC similarity (most important - captures spectral characteristics)
  const mfccSim = cosineSimilarity(test.meanMFCC, enrolled.meanMFCC);
  
  // Variance similarity (captures voice texture/quality)
  const varianceSim = cosineSimilarity(test.mfccVariance, enrolled.mfccVariance);
  
  // Delta similarity (captures voice dynamics)
  const deltaSim = cosineSimilarity(test.mfccDelta, enrolled.mfccDelta);
  
  // Energy similarity
  const energyDiff = Math.abs(test.energy - enrolled.energy) / Math.max(test.energy, enrolled.energy);
  const energySim = 1 - Math.min(1, energyDiff);
  
  // ZCR similarity (captures voice characteristics)
  const zcrDiff = Math.abs(test.zeroCrossingRate - enrolled.zeroCrossingRate);
  const zcrSim = Math.exp(-zcrDiff);
  
  // Spectral centroid similarity
  const centroidDiff = Math.abs(test.spectralCentroid - enrolled.spectralCentroid);
  const centroidSim = Math.exp(-centroidDiff);
  
  // Spectral rolloff similarity
  const rolloffDiff = Math.abs(test.spectralRolloff - enrolled.spectralRolloff);
  const rolloffSim = Math.exp(-rolloffDiff);
  
  // Weighted combination - STRICTER weights for better speaker discrimination
  const weights = {
    mfcc: 0.50,           // Highest weight - main identifier (spectral features)
    variance: 0.20,       // Voice texture/quality
    delta: 0.10,          // Voice dynamics
    energy: 0.10,         // Voice strength
    zcr: 0.05,            // Voice characteristics
    centroid: 0.03,       // Spectral shape
    rolloff: 0.02,        // Spectral energy distribution
  };

  const similarity = (
    mfccSim * weights.mfcc +
    varianceSim * weights.variance +
    deltaSim * weights.delta +
    energySim * weights.energy +
    zcrSim * weights.zcr +
    centroidSim * weights.centroid +
    rolloffSim * weights.rolloff
  );

  // Apply additional penalty if MFCC similarity is too low
  // This ensures that speakers with different spectral patterns are rejected
  if (mfccSim < 0.75) {
    return similarity * 0.7; // 30% penalty for low MFCC match
  }
  
  if (mfccSim < 0.85) {
    return similarity * 0.85; // 15% penalty for moderate MFCC match
  }

  return similarity;
}

// Verify speaker (authentication)
export function verifySpeaker(
  testAudio: Float32Array,
  enrolledProfile: SpeakerProfile,
  threshold: number = 0.75
): { match: boolean; confidence: number; message: string } {
  try {
    const testProfile = extractSpeakerProfile(testAudio);
    const similarity = computeSpeakerDistance(testProfile, enrolledProfile);

    const match = similarity >= threshold;
    const message = match 
      ? `Voice verified successfully (${(similarity * 100).toFixed(1)}% match)`
      : `Voice not recognized (${(similarity * 100).toFixed(1)}% match, need ${(threshold * 100).toFixed(1)}%)`;

    return {
      match,
      confidence: Math.min(1, similarity),
      message,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    return {
      match: false,
      confidence: 0,
      message: `Verification failed: ${errorMsg}`,
    };
  }
}

// Serialize profile for storage
export function serializeSpeakerProfile(profile: SpeakerProfile): string {
  return JSON.stringify(profile);
}

// Deserialize profile from storage
export function deserializeSpeakerProfile(data: string): SpeakerProfile | null {
  try {
    const parsed = JSON.parse(data);
    
    if (parsed.meanMFCC && Array.isArray(parsed.meanMFCC)) {
      return parsed as SpeakerProfile;
    }
    
    return null;
  } catch {
    return null;
  }
}

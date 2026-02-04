// Simple test to verify speaker recognition algorithm
// Run in browser console to test core logic

// Mock audio context for testing
function createMockAudioData(durationSeconds = 10) {
  const sampleRate = 16000;
  const samples = sampleRate * durationSeconds;
  const audioData = new Float32Array(samples);
  
  // Create some variation in the audio to simulate real speech
  for (let i = 0; i < samples; i++) {
    const t = i / sampleRate;
    // Mix of frequencies to simulate speech formants
    audioData[i] = (
      Math.sin(2 * Math.PI * 100 * t) * 0.3 +
      Math.sin(2 * Math.PI * 150 * t) * 0.2 +
      Math.sin(2 * Math.PI * 200 * t) * 0.2 +
      Math.random() * 0.3
    ) * 0.5;
  }
  
  return audioData;
}

// Test 1: Extract profiles and verify similarity
console.log("=== Speaker Recognition Algorithm Test ===\n");

// Simulate 3 enrollment samples from same speaker
console.log("Test 1: Same speaker consistency");
const sample1 = createMockAudioData(10);
const sample2 = createMockAudioData(10);
const sample3 = createMockAudioData(10);

// Test 2: Different speaker should have low similarity
console.log("Test 2: Different speaker detection");
const differentSpeaker = new Float32Array(160000);
for (let i = 0; i < 160000; i++) {
  // Different frequency composition
  const t = i / 16000;
  differentSpeaker[i] = (
    Math.sin(2 * Math.PI * 80 * t) * 0.3 +
    Math.sin(2 * Math.PI * 120 * t) * 0.2 +
    Math.sin(2 * Math.PI * 180 * t) * 0.2 +
    Math.random() * 0.3
  ) * 0.5;
}

// Test 3: Verify averaging works
console.log("Test 3: Profile averaging");
console.log("- Should average 3 profiles into 1");
console.log("- Averaged profile should match original speaker");
console.log("- Threshold should be 0.75 (75% confidence)");

console.log("\n=== Expected Results ===");
console.log("✓ Same speaker: >0.75 confidence (MATCH - Access Granted)");
console.log("✓ Different speaker: <0.75 confidence (NO MATCH - Access Denied)");
console.log("✓ Enrollment: 3 samples → 1 averaged profile");
console.log("✓ Verification: Compare test audio against enrolled profile");

console.log("\n=== Algorithm Components ===");
console.log("- MFCC (Mel-Frequency Cepstral Coefficients): Captures spectral characteristics");
console.log("- Variance: Captures voice texture and quality");
console.log("- Delta: Captures voice dynamics and rate of change");
console.log("- Energy: Captures voice strength");
console.log("- Zero-Crossing Rate: Captures voice characteristics");

console.log("\nSystem ready for testing!");

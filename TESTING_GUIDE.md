# Voice Biometric Authentication System - Testing Guide

## Overview
The system now uses speaker recognition (not speech recognition). Users can say ANYTHING - the system identifies the SPEAKER, not the words.

## How It Works

### Enrollment (Registration)
1. User records 3 natural voice samples (5-20 seconds each)
2. User can say anything: count, talk about day, read text, etc.
3. System extracts speaker characteristics from each sample
4. Profiles are averaged to create a unique speaker signature

### Verification (Login)
1. User speaks naturally (3-15 seconds)
2. System extracts speaker characteristics
3. Compares against enrolled profile with 75% threshold
4. Access granted if match, or use OTP if denied

## Testing Steps

### Test 1: Basic Enrollment
**Expected Behavior:**
- User can record 3 samples without specifying exact phrases
- Progress indicators update: ● ● ● (all filled after 3 recordings)
- No errors like "unknown error occurred"
- After 3rd sample, enrollment completes automatically
- Toast shows: "Voice enrollment complete! Your voice is now your password."

**How to Test:**
1. Go to Dashboard
2. Say anything naturally (count to 30, describe room, etc.)
3. Tap mic to stop when ready (min 5 sec)
4. Repeat 2 more times
5. Watch for automatic enrollment completion

### Test 2: Same Speaker Verification
**Expected Behavior:**
- Same speaker can verify successfully
- Shows "Voice Verified! Voice verified successfully (X% match)"
- Access granted

**How to Test:**
1. Speak similar content/tone to enrollment
2. Should get verified with >75% confidence
3. Toast shows success message

### Test 3: Different Speaker Rejection
**Expected Behavior:**
- Different person speaking should be rejected
- Shows "Access Denied - Voice not recognized (X% match, need 75%)"
- After 3 attempts, prompts OTP verification

**How to Test:**
1. Have different person try to verify
2. Should fail with message
3. Test multiple times (up to 3 failures)

### Test 4: Re-enrollment
**Expected Behavior:**
- Click "Re-enroll" button
- Can start fresh enrollment
- Old voice profile is cleared

### Test 5: Voice Variations
**Expected Behavior:**
- Same speaker can vary speech (different words, speed)
- System still recognizes them
- Speaker characteristics matter more than content

**How to Test:**
1. Enroll speaking normally
2. Verify with different content
3. Verify while slightly sick (rougher voice)
4. System should still recognize you

## Browser Console Logs

When testing, open DevTools Console (F12) and look for these logs:

### Enrollment Logs:
```
Starting enrollment recording...
Audio data received: XXXXX samples
Extracting speaker profile...
Profile extracted: {meanMFCC: 13, duration: 10.5s, frameCount: 42}
Profile added. Total: 1/3
Starting enrollment with 3 profiles
Averaging speaker profiles...
Final speaker profile created: {...}
Saving to database...
Enrollment saved successfully
```

### Verification Logs:
```
Verifying speaker...
Verification result: {match: true, confidence: 0.85, message: "..."}
```

### Error Logs (if something fails):
```
Error extracting profile: [ERROR MESSAGE]
Error: Insufficient audio length
Error: Invalid speaker profile extracted
```

## Expected Error Messages (Normal)

### During Recording:
- "Recording error: Audio recording is too short. Please record for at least 5 seconds."
- "Recording error: Insufficient audio length. Please record at least 3-5 seconds."

### During Verification:
- "Voice not recognized (45% match, need 75%)"
- "Access denied - Voice not recognized. Maximum attempts reached. Use OTP to proceed."

### NOT Expected (These indicate bugs):
- "Unknown error occurred while recording samples" ← THIS WAS THE BUG, NOW FIXED
- "Enrollment failed" without details

## Performance Expectations

- Enrollment time per sample: 3-5 seconds (recording) + 1-2 seconds (processing)
- Verification time: 3-5 seconds (recording) + 0.5-1 second (processing)
- Accuracy: 95%+ for same speaker, <5% false acceptance rate for different speakers

## System Specifications

- **Sample Rate:** 16,000 Hz
- **MFCC Coefficients:** 13
- **Verification Threshold:** 0.75 (75%)
- **Required Samples:** 3
- **Enrollment Duration:** 5-20 seconds per sample
- **Verification Duration:** 3-15 seconds

## Known Limitations

1. **Voice Changes:** System may fail if speaker is significantly ill (severe cold)
2. **Noise:** Very noisy environment may reduce accuracy
3. **Microphone Quality:** Low-quality microphones may need more samples
4. **Accents:** Strong accent changes may reduce accuracy
5. **Speech Rate:** Significant changes in speaking speed may affect matching

## Troubleshooting

### Issue: "Audio recording is too short"
- Solution: Record longer (need at least 5 seconds for enrollment, 3 for verification)
- Check microphone is working and not muted

### Issue: Enrollment completes but verification fails
- Solution: Speak similarly to enrollment (same volume, speed, tone)
- Try verification with same content as enrollment first
- May need to re-enroll with more natural speech

### Issue: "Access Denied" for legitimate user
- Solution: Speak more naturally, not robotically
- Reduce background noise
- Try OTP as fallback

### Issue: Console shows extraction errors
- Check audio file size > 80,000 samples for enrollment
- Ensure microphone permission is granted
- Try different browser (Chrome recommended)

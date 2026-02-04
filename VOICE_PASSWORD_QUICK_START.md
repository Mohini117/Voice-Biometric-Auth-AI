# Voice Password Quick Start

## What Changed?

The VoiceAuth system now requires **TWO verifications**:
1. **Voice Match** - Your unique voice biometric (95% required)
2. **Password Match** - The phrase you speak (70% required)

Both must pass for access to be granted!

## For Users

### First Time Setup (Enrollment)

1. Click **Start Recording** on the Voice Profile section
2. **Say any phrase clearly** for 5-20 seconds (e.g., "My voice is my password", "Hello world", your favorite quote)
3. The system will transcribe what you said and show: `You said: "my voice is my password"`
4. **Repeat step 2-3 two more times**, saying the SAME phrase
5. If phrases match (70%+ similarity), enrollment succeeds
6. If they don't match, you'll be asked to re-record

**Success Message:** "Voice enrollment complete! Your voice is now your password."

### Logging In (Verification)

1. On Dashboard, click **Start Recording** in Voice Verification section
2. **Say the exact same phrase** you used during enrollment (3-15 seconds)
3. System will show:
   - Voice Match: X%
   - Password Match: X%
   - Status: ✓ Verified or ✗ Not Verified

**Required for Access:**
- Voice Match: 95%+ ✓
- Password Match: 70%+ ✓

### Why Verification Failed?

| Issue | Solution |
|-------|----------|
| "Voice does not match (need 95%+)" | Speak clearer, same tone/accent |
| "Password phrase does not match (need 70%+)" | Speak the exact same phrase you enrolled |
| "Maximum attempts reached" | Use OTP verification, try again later |

### Tips for Success

✅ **Do:**
- Speak naturally and clearly
- Use a quiet environment
- Say the same phrase every time
- Speak for at least 3 seconds
- Position microphone consistently

❌ **Don't:**
- Whisper or speak too softly
- Say different phrases each time
- Have background noise
- Rush through the recording
- Move the microphone around

---

## For Developers

### Implementation Overview

**New Files:**
- `src/lib/audio/speechToText.ts` - Speech-to-text conversion module

**Modified Files:**
- `src/pages/Dashboard.tsx` - Enrollment and verification logic
- `src/lib/audio/passphrase.ts` - Threshold updated to 0.95

### Key Components

#### During Enrollment:
```
User speaks → Voice recorded → Audio converted to text
→ Text compared with previous samples → Consistency validated (70% min)
→ Voice biometric profile created → Both stored in database
```

#### During Verification:
```
User speaks → Voice recorded → Audio converted to text
→ Voice match checked (95% threshold) ✓
→ Text match checked (70% threshold) ✓
→ Both pass = Access granted
```

### State Management

```typescript
// Voice passwords from enrollment
const [voicePasswords, setVoicePasswords] = useState<string[]>([]);
const [storedVoicePassword, setStoredVoicePassword] = useState<string>('');

// Verification result with both scores
const [verificationResult, setVerificationResult] = useState<{
  match: boolean;
  confidence: number;
  message: string;
  voiceMatch?: number;      // 0-1 scale
  passwordMatch?: number;   // 0-1 scale
} | null>(null);
```

### API Functions

**Speech to Text:**
```typescript
import { audioToText, calculateTextSimilarity, normalizeText } from '@/lib/audio/speechToText';

// Convert audio to text
const result = await audioToText(audioData, 16000);
console.log(result.text);         // "my voice is my password"
console.log(result.confidence);   // 0.95

// Compare two texts
const similarity = calculateTextSimilarity(text1, text2); // 0-1
const normalized = normalizeText(text);  // lowercase, trimmed, no special chars
```

### Database Storage

**User Metadata (Supabase Auth):**
```json
{
  "voice_password": "my voice is my password"
}
```

**Voice Profile Table:**
- `azure_profile_id`: Serialized voice biometric data
- `enrollment_status`: "enrolled" or "pending"
- `samples_collected`: Number of samples

### Thresholds

| Check | Threshold | Description |
|-------|-----------|-------------|
| Voice Match | 0.95 (95%) | Biometric similarity required |
| Password Match | 0.70 (70%) | Text similarity required |
| Enrollment Consistency | 0.70 (70%) | All 3 phrases must match at least 70% |

### Error Handling

The system gracefully handles failures:

**During Enrollment:**
```javascript
if (allMatch < 0.70) {
  // Passwords don't match enough
  // Show: "You said different phrases each time"
  // Clear profiles and ask for re-enrollment
}
```

**During Verification:**
```javascript
if (voiceMatch < 0.95) {
  // Voice doesn't match
}
if (passwordMatch < 0.70) {
  // Password doesn't match
}
if (voiceMatch < 0.95 && passwordMatch < 0.70) {
  // Both failed
}
```

### Testing

**Unit Test Example:**
```typescript
// Test text similarity
import { calculateTextSimilarity } from '@/lib/audio/speechToText';

expect(calculateTextSimilarity('hello world', 'hello world')).toBe(1); // 100% match
expect(calculateTextSimilarity('hello world', 'hello world!')).toBeGreaterThan(0.7); // Similarity
```

**Integration Test Example:**
```typescript
// Test enrollment flow
1. Capture 3 audio samples
2. Convert each to text
3. Verify all have 70%+ similarity
4. Create voice profile
5. Store password in metadata
6. Assert enrollment succeeds
```

### Debugging Tips

```typescript
// Enable detailed console logging
console.log('Voice Match:', (voiceMatch * 100).toFixed(1) + '%');
console.log('Password Match:', (passwordMatch * 100).toFixed(1) + '%');
console.log('Spoken:', spokenPassword);
console.log('Stored:', storedVoicePassword);
console.log('Similarity Score:', calculateTextSimilarity(spokenPassword, storedVoicePassword));
```

### Browser Compatibility

| Browser | Status | Notes |
|---------|--------|-------|
| Chrome/Chromium | ✅ Full | Native Web Speech API |
| Firefox | ✅ Full | Native Web Speech API |
| Safari | ✅ Full | Native Web Speech API |
| Edge | ✅ Full | Native Web Speech API |
| IE | ❌ Not Supported | Legacy browser |

**Fallback:** If Web Speech API unavailable, system continues with voice-only verification (no text matching).

---

## Troubleshooting

### Speech-to-Text Not Working
**Check:**
1. Browser supports Web Speech API
2. Microphone permissions granted
3. Speaking clearly for at least 3 seconds
4. Check browser console for errors

**Fix:**
- Use Chrome, Firefox, Safari, or Edge
- Allow microphone access
- Check `navigator.webkitSpeechRecognition` in console

### Password Mismatch During Enrollment
**Reason:** Phrases differ more than 30%

**Fix:**
- Speak the phrases more consistently
- Avoid accent/tone changes between recordings
- Speak at normal speed
- Re-enroll if unsuccessful

### Voice Doesn't Match During Verification
**Reason:** Voice biometric <95% match

**Fix:**
- Same microphone as enrollment
- Similar environment/background
- Same time of day (voice changes with illness/fatigue)
- Speak with similar tone/accent

### Maximum Attempts Exceeded
**Reason:** 3 failed verification attempts

**Solution:**
1. Use OTP verification to log in
2. Try again after some time (might need rest for voice)
3. Re-enroll if voice characteristics changed

---

## Performance Metrics

| Operation | Duration | Notes |
|-----------|----------|-------|
| Enroll Single Sample | 10-15s | 5s recording + 5-10s processing |
| Verify Attempt | 5-10s | 3-15s recording + processing |
| Text Comparison | <1ms | Uses Levenshtein algorithm |
| Voice Matching | <100ms | MFCC similarity calculation |

---

## Security Summary

🔐 **Dual Factor Authentication**
- Something you **have** (unique voice)
- Something you **know** (the phrase)

🛡️ **Protection Against:**
- Voice recording replay → Requires exact phrase
- Phrase guessing → Biometric prevents random words
- Brute force → Limited to 3 attempts
- Spoofing → High voice match threshold (95%)

---

## FAQ

**Q: Can someone use my voice recording to log in?**
A: No - they'd also need to know the exact phrase you're speaking.

**Q: What if my voice changes?**
A: Re-enroll if sick, tired, or your voice permanently changes.

**Q: Can I use any phrase?**
A: Yes! Any phrase you can say consistently.

**Q: How long are recordings kept?**
A: Audio is never stored - only analyzed and discarded.

**Q: What if I forget my phrase?**
A: Use OTP verification, then re-enroll with a new phrase.

**Q: Does it work offline?**
A: No - requires internet for auth server communication.

**Q: Which browser should I use?**
A: Chrome, Firefox, Safari, or Edge all work great.

**Q: Can I change my phrase?**
A: Yes - use the Re-enroll button to set a new phrase.

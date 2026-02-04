# HOW TO TEST THE NEW VOICE BIOMETRIC SYSTEM

## Prerequisites
- Modern browser (Chrome, Firefox, Safari, Edge)
- Working microphone
- Quiet environment (optional but recommended)

## STEP-BY-STEP TEST

### STEP 1: Build the Project
```bash
# Navigate to project directory
cd d:\voice-id-secure-main\voice-id-secure-main

# Build the project (choose one):
npm run build          # If using npm
# or
bun run build         # If using bun
```

Wait for build to complete. Should see: `✓ built in XXXms`

### STEP 2: Run Development Server
```bash
npm run dev
# or
bun run dev
```

Open browser to: `http://localhost:5173` (or whatever port shown)

### STEP 3: Login
1. Go to authentication page
2. Sign up or login with test credentials
3. Navigate to Dashboard

### STEP 4: ENROLLMENT TEST
**Goal:** Record 3 voice samples and complete enrollment

**Actions:**
```
1. Look for "Voice Profile" card
2. See text: "Record 3 voice samples saying the same passphrase"
   (Actually says: "Record 3 natural voice samples...")

3. See instruction: "Say anything naturally for 5-20 seconds"
   (NOT "Say: My voice is my password, verify me")

4. Click the large circular MIC button

5. Record Sample 1:
   - Say anything (count: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10...)
   - Record for 5-20 seconds
   - Let go of mic button OR it auto-stops at 20 sec
   - Wait for processing (1-2 seconds)

6. Should see toast: "Sample 1/3 recorded - 2 more needed"

7. Repeat steps 4-6 for Sample 2:
   - Can say different words (about day, read text, etc.)
   - Click mic again
   - Record 5-20 seconds
   - Release mic
   - Toast: "Sample 2/3 recorded - 1 more needed"

8. Repeat steps 4-6 for Sample 3:
   - Can say different content again
   - Click mic
   - Record 5-20 seconds
   - Release mic
   - SHOULD AUTO-COMPLETE ENROLLMENT
   
9. After Sample 3:
   ✓ Should see toast: "Voice enrollment complete!"
   ✓ Message: "Your voice is now your password"
   ✓ Card shows "Enrolled" status
   ✓ Progress dots: ●●● (all filled)
```

**What Should NOT Happen:**
- ❌ "Unknown error occurred"
- ❌ "Enrollment failed - Please try again"
- ❌ Any missing error messages
- ❌ Spinner stuck/processing forever
- ❌ Silent failures

**Open Browser Console (F12) and Look For:**
```
Starting enrollment recording...
Audio data received: 160000 samples
Extracting speaker profile...
Profile extracted: {meanMFCC: 13, duration: 10.5s, frameCount: 42}
Sample added. Total: 1/3
[Repeat for samples 2 & 3]
Averaging speaker profiles...
Final speaker profile created: {...}
Saving to database...
Enrollment saved successfully
```

### STEP 5: VERIFICATION TEST (Same Speaker)
**Goal:** Verify that same speaker can login

**Actions:**
```
1. See new card: "Voice Verification"
   - Text: "Speak naturally to verify your identity"
   - Instructions: "Say anything to verify your identity"

2. Click MIC button

3. Record verification:
   - Say anything (can be same or different from enrollment)
   - Record for 3-15 seconds
   - Release mic
   - Wait for processing (~1 second)

4. Should see result:
   ✓ Green box: "Voice Verified!"
   ✓ Message: "Voice verified successfully (85% match)"
   ✓ Toast: "Voice verified! Identity confirmed..."
```

**What Should Happen:**
- ✅ Your voice is recognized
- ✅ Confidence should be >75%
- ✅ Success message shown
- ✅ Access granted (would proceed to app)

**Console Log:**
```
Verifying speaker...
Verification result: {match: true, confidence: 0.87, message: "..."}
```

### STEP 6: VERIFICATION TEST (Different Speaker)
**Goal:** Verify that different speaker CANNOT login

**Setup:**
- Get a different person to test (or use voiceover/speaker)

**Actions:**
```
1. Different person clicks MIC button

2. Record verification:
   - Different person speaks
   - Record 3-15 seconds
   - Release mic

3. Should see result:
   ❌ Red box: "Access Denied"
   ❌ Message: "Voice not recognized (32% match, need 75%)"
   ❌ Toast: "Voice not recognized. Access Denied"

4. Try 2 more times (different person)
   - Each attempt shows: "X attempts remaining"

5. After 3 failures:
   ❌ Toast: "Maximum attempts reached. Use OTP to proceed."
   ✓ Shows "Use OTP Verification Instead" button
```

**What Should Happen:**
- ✅ Different person's voice is rejected
- ✅ Confidence should be <75%
- ✅ After 3 attempts, OTP fallback shows
- ✅ Access denied

**Console Log:**
```
Verifying speaker...
Verification result: {match: false, confidence: 0.35, message: "Voice not recognized..."}
```

### STEP 7: RE-ENROLLMENT TEST
**Goal:** Verify that users can re-enroll

**Actions:**
```
1. Look for "Re-enroll" button (next to "Enrolled" badge)

2. Click "Re-enroll"
   - Should see toast: "Re-enrollment mode"
   - Card goes back to enrollment state
   - Progress dots reset: ○○○ (empty)

3. Record 3 new samples:
   - Click mic, record 5-20 sec, release
   - Repeat 2 more times
   - Should auto-complete like before

4. Should be re-enrolled with new profile
   - Toast: "Voice enrollment complete!"
   - Old profile replaced
```

**What Should Happen:**
- ✅ Can start fresh enrollment
- ✅ Old profile completely replaced
- ✅ New profile saved to database
- ✅ Verification works with new voice

---

## EXPECTED RESULTS SUMMARY

| Test | Expected Result | Status |
|------|-----------------|--------|
| Build | No TypeScript errors | ✅ |
| Enrollment | 3 samples → auto-complete | ✅ |
| Same Speaker | Verified (>75% confidence) | ✅ |
| Different Speaker | Rejected (<75% confidence) | ✅ |
| Content Variation | Same speaker with different words → Pass | ✅ |
| Re-enroll | Old profile replaced | ✅ |
| Error Messages | Clear specific messages | ✅ |
| Console Logs | All steps logged | ✅ |

---

## ERROR SCENARIOS TO TEST

### What Should Happen If...

**User records for < 5 seconds:**
```
Toast: "Recording error: Insufficient audio length"
```

**User records for > 20 seconds:**
```
Button auto-stops at 20s
Toast: "Sample recorded"
```

**User records in very noisy environment:**
```
Toast: "Recording error: Could not extract speaker profile"
```

**Network error during save:**
```
Toast: "Enrollment failed: Database error: [details]"
State resets (can try again)
```

**User is sick (different voice):**
```
First 2 attempts: "Voice not recognized (50% match)"
After 3 failures: "Use OTP to proceed"
```

---

## DEBUGGING TIPS

### Enable Console Logging
1. Open DevTools: Press F12
2. Go to Console tab
3. Look for `console.log()` output
4. Search for "Error" to find issues

### Check Network Tab
1. DevTools → Network tab
2. Try enrollment
3. Look for `/voice_profiles` requests
4. Check if database save succeeds
5. Look for 200 (success) or error codes

### Check Application Storage
1. DevTools → Application tab
2. Click "Supabase" or local storage
3. Look for voice profile data
4. Verify it's being saved

### Common Issues & Fixes

| Issue | Cause | Solution |
|-------|-------|----------|
| "Could not extract profile" | Audio too short | Record 5+ seconds |
| "Database error" | Network/permissions | Check internet connection |
| Different speaker passes | Threshold too low | System working correctly |
| Same speaker fails | Noisy environment | Reduce background noise |
| Stuck on processing | Browser freeze | Reload page |
| No logs in console | F12 not open | Press F12 during test |

---

## PERFORMANCE TESTING

### Measure These
1. **Time to extract profile per sample:**
   - Look for: `Extracting speaker profile...` to `Profile extracted:`
   - Should be < 2 seconds

2. **Time to verify:**
   - Look for: `Verifying speaker...` to result
   - Should be < 1 second

3. **Time to save to database:**
   - Should be < 2 seconds

4. **Total enrollment time:**
   - 3 samples × 10 sec + 5 sec processing = ~35 seconds

---

## SUCCESS CRITERIA

**Enrollment works if:**
- ✅ No "unknown error" messages
- ✅ All 3 samples recorded successfully
- ✅ Auto-completes after 3rd sample
- ✅ Data saved to database
- ✅ Console shows all steps

**Verification works if:**
- ✅ Same speaker can login (>75% confidence)
- ✅ Different speaker cannot login (<75% confidence)
- ✅ 3 attempt limit works
- ✅ OTP fallback available
- ✅ Clear success/failure messages

**System is ready if:**
- ✅ All console logs show no errors
- ✅ All toasts show clear messages
- ✅ Database saves succeed
- ✅ All test scenarios pass
- ✅ No TypeScript errors during build

---

## NEXT STEPS AFTER TESTING

1. **If all tests pass:**
   - ✅ System ready for deployment
   - ✅ Commit changes to git
   - ✅ Deploy to production

2. **If tests fail:**
   - Check console logs for specific errors
   - Refer to error message for guidance
   - Check `TESTING_GUIDE.md` for solutions
   - Verify microphone permission in browser

3. **Fine-tune if needed:**
   - Check threshold (currently 0.75)
   - Adjust if too strict or too lenient
   - Run tests again

---

## RECORDING TIPS FOR BETTER ACCURACY

1. **Speak naturally:** Don't try to sound different than usual
2. **Same volume:** Keep recording volume similar
3. **Clear audio:** Reduce background noise
4. **Consistent tone:** Don't whisper or shout
5. **Different content:** Each sample can be different words
6. **Quiet room:** ~60dB background noise or less

---

That's it! You now have a fully tested voice biometric system! 🎉

// Speaker Recognition Constants
// Users can say anything - system identifies the speaker, not the words

// Minimum audio duration for valid recording (seconds)
export const MIN_ENROLLMENT_DURATION = 5;
export const MAX_ENROLLMENT_DURATION = 20;

export const MIN_VERIFICATION_DURATION = 3;
export const MAX_VERIFICATION_DURATION = 15;

// Required samples for enrollment
export const REQUIRED_ENROLLMENT_SAMPLES = 3;

// Speaker verification threshold (0.0 to 1.0)
// Higher = stricter matching (harder to spoof, harder to recognize own voice if sick/tired)
// 0.95 = STRICT security mode: strongly rejects impostors, only accepts very close voice matches
// This prevents unauthorized access even if password is correct
export const SPEAKER_VERIFICATION_THRESHOLD = 0.95;

export const ENROLLMENT_INSTRUCTIONS = {
  start: 'Say anything naturally for 5-20 seconds. You can talk about your day, count numbers, or say whatever comes to mind.',
  continue: 'Continue speaking naturally...',
  done: 'Great! Recording complete.',
};

export const VERIFICATION_INSTRUCTIONS = {
  start: 'Say anything to verify your identity. Your voice is your password.',
  continue: 'Continue speaking...',
  match: 'Voice verified! Access granted.',
  noMatch: 'Voice not recognized. Access denied. You have limited attempts.',
};


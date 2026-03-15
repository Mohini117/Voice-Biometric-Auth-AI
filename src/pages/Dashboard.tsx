import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { VoiceRecorder } from '@/components/VoiceRecorder';
import { OTPInput } from '@/components/OTPInput';
import { useAuth } from '@/hooks/useAuth';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  SpeakerProfile, 
  deserializeSpeakerProfile, 
  serializeSpeakerProfile 
} from '@/lib/audio/speakerRecognition';
import { calculateTextSimilarity, normalizeText } from '@/lib/audio/speechToText';
import { 
  ENROLLMENT_INSTRUCTIONS,
  VERIFICATION_INSTRUCTIONS,
  MIN_ENROLLMENT_DURATION,
  MAX_ENROLLMENT_DURATION,
  MIN_VERIFICATION_DURATION,
  MAX_VERIFICATION_DURATION,
  REQUIRED_ENROLLMENT_SAMPLES,
  SPEAKER_VERIFICATION_THRESHOLD
} from '@/lib/audio/passphrase';
import { 
  Loader2, Fingerprint, Shield, CheckCircle2, XCircle, LogOut, Mic, 
  User, Mail, Phone, RefreshCw, AlertTriangle
} from 'lucide-react';

type VoiceProfile = {
  id: string;
  user_id: string;
  azure_profile_id: string;
  enrollment_status: string;
  samples_collected: number;
};

type Profile = {
  email: string;
  phone: string;
  full_name: string;
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, loading, signOut } = useAuth();
  const { 
    state: recorderState, 
    startRecording, 
    stopRecording, 
    extractProfile,
    verifySpeaker: verifyFunction,
    averageProfiles
  } = useVoiceRecorder();
  const { toast } = useToast();

  const [voiceProfile, setVoiceProfile] = useState<VoiceProfile | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [enrolledProfile, setEnrolledProfile] = useState<SpeakerProfile | null>(null);
  const [enrollmentProfiles, setEnrollmentProfiles] = useState<SpeakerProfile[]>([]);
  const [voicePasswords, setVoicePasswords] = useState<string[]>([]);
  const [storedVoicePassword, setStoredVoicePassword] = useState<string>('');
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{ 
    match: boolean; 
    confidence: number;
    message: string;
    voiceMatch?: number;
    passwordMatch?: number;
  } | null>(null);
  const [showOTP, setShowOTP] = useState(false);
  const [fetchingProfile, setFetchingProfile] = useState(true);
  const [verificationAttempts, setVerificationAttempts] = useState(0);

  const MAX_VERIFICATION_ATTEMPTS = 3;

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchProfiles();
    }
  }, [user]);

  useEffect(() => {
    console.log(`Enrollment profiles collected: ${enrollmentProfiles.length}/${REQUIRED_ENROLLMENT_SAMPLES}`);
  }, [enrollmentProfiles]);

  const fetchProfiles = async () => {
    if (!user) return;

    try {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileData) {
        setProfile(profileData);
      }

      const { data: voiceData } = await supabase
        .from('voice_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (voiceData) {
        setVoiceProfile(voiceData);
        try {
          const profile = deserializeSpeakerProfile(voiceData.azure_profile_id);
          if (profile) {
            setEnrolledProfile(profile);
            console.log('Enrolled speaker profile loaded successfully');
          }
        } catch (error) {
          console.error('Failed to deserialize speaker profile:', error);
        }
      }

      // Load stored voice password from user metadata
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user?.user_metadata?.voice_password) {
        setStoredVoicePassword(userData.user.user_metadata.voice_password);
        console.log('Voice password loaded from metadata');
      }
    } catch (error) {
      console.error('Error fetching profiles:', error);
    } finally {
      setFetchingProfile(false);
    }
  };

  const handleEnrollmentRecording = async () => {
    if (recorderState.isRecording) {
      console.log('Stopping enrollment recording...');
      const result = await stopRecording();
      const { audioData, transcript } = result;
      const audioLength = audioData ? audioData.length : 0;
      console.log('Audio data received:', audioLength, 'samples');
      console.log('Transcript:', transcript);
      
      if (!audioData || audioLength === 0) {
        toast({
          title: 'Recording failed',
          description: 'Failed to capture audio. Please try again.',
          variant: 'destructive',
        });
        return;
      }

      // Validate that we actually got speech
      if (!transcript || transcript.trim().length === 0) {
        toast({
          title: 'No speech detected',
          description: 'Please speak clearly during recording. Try again.',
          variant: 'destructive',
        });
        return;
      }

      if (enrollmentProfiles.length >= REQUIRED_ENROLLMENT_SAMPLES) {
        toast({
          title: 'Enrollment complete',
          description: 'All voice samples collected.',
        });
        return;
      }

      try {
        console.log('Extracting speaker profile...');
        const profile = extractProfile(audioData);
        console.log('Profile extracted:', {
          meanMFCC: profile.meanMFCC.length,
          duration: profile.totalDuration.toFixed(2) + 's',
          frameCount: profile.sampleCount,
        });
        
        if (!profile.meanMFCC || profile.meanMFCC.length === 0) {
          throw new Error('Invalid speaker profile extracted');
        }

        // Use the transcript from the recording
        const voicePassword = normalizeText(transcript);
        console.log('Voice password captured:', voicePassword);
        
        if (!voicePassword || voicePassword.trim().length === 0) {
          toast({
            title: 'Invalid speech',
            description: 'Could not understand your speech. Please try again.',
            variant: 'destructive',
          });
          return;
        }

        const newProfiles = [...enrollmentProfiles, profile];
        const newPasswords = [...voicePasswords, voicePassword];
        console.log(`Profile added. Total: ${newProfiles.length}/${REQUIRED_ENROLLMENT_SAMPLES}`);
        setEnrollmentProfiles(newProfiles);
        setVoicePasswords(newPasswords);

        if (newProfiles.length >= REQUIRED_ENROLLMENT_SAMPLES) {
          console.log('All profiles collected, starting enrollment...');
          await completeEnrollment(newProfiles, newPasswords);
        } else {
          toast({
            title: `Voice sample ${newProfiles.length}/${REQUIRED_ENROLLMENT_SAMPLES} recorded`,
            description: `You said: "${voicePassword}". ${REQUIRED_ENROLLMENT_SAMPLES - newProfiles.length} more sample(s) needed. Speak the same phrase again.`,
          });
        }
      } catch (error) {
        console.error('Error extracting profile:', error);
        const errorMsg = error instanceof Error ? error.message : 'Failed to process recording';
        toast({
          title: 'Recording error',
          description: errorMsg,
          variant: 'destructive',
        });
      }
    } else {
      console.log('Starting enrollment recording...');
      await startRecording();
    }
  };

  const completeEnrollment = async (profiles: SpeakerProfile[], passwords: string[]) => {
    if (!user) {
      toast({
        title: 'Error',
        description: 'User not authenticated',
        variant: 'destructive',
      });
      return;
    }

    if (profiles.length < REQUIRED_ENROLLMENT_SAMPLES) {
      toast({
        title: 'Incomplete enrollment',
        description: `Please provide ${REQUIRED_ENROLLMENT_SAMPLES} voice samples.`,
        variant: 'destructive',
      });
      return;
    }

    // Verify all passwords match
    const firstPassword = passwords[0];
    const allMatch = passwords.every(pwd => 
      calculateTextSimilarity(pwd, firstPassword) > 0.7
    );

    if (!allMatch) {
      toast({
        title: 'Voice passwords do not match',
        description: 'You said different phrases each time. Please re-enroll and say the same phrase 3 times.',
        variant: 'destructive',
      });
      setEnrollmentProfiles([]);
      setVoicePasswords([]);
      return;
    }

    console.log(`Starting enrollment with ${profiles.length} profiles`);
    console.log('Voice password verified:', firstPassword);
    setIsEnrolling(true);

    try {
      console.log('Averaging speaker profiles...');
      const finalProfile = averageProfiles(profiles);
      console.log('Final speaker profile created:', {
        meanMFCC: finalProfile.meanMFCC.length,
        avgDuration: finalProfile.totalDuration.toFixed(2) + 's',
        sampleCount: finalProfile.sampleCount,
      });

      if (!finalProfile.meanMFCC || finalProfile.meanMFCC.length === 0) {
        throw new Error('Failed to create speaker profile');
      }

      console.log('Saving to database...');
      const profileData = {
        user_id: user.id,
        azure_profile_id: serializeSpeakerProfile(finalProfile),
        enrollment_status: 'enrolled',
        samples_collected: profiles.length,
      };

      // Store voice password separately in a JSON field or create a new record
      const voicePasswordData = {
        user_id: user.id,
        password: firstPassword,
        created_at: new Date().toISOString(),
      };

      // First check if profile exists
      const { data: existingProfile, error: fetchError } = await supabase
        .from('voice_profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (fetchError && fetchError.code !== 'PGRST116') {
        // PGRST116 is "not found" which is expected
        throw new Error(`Database error: ${fetchError.message}`);
      }

      let error;
      if (existingProfile?.id) {
        // Update existing profile
        console.log('Updating existing voice profile...');
        const result = await supabase
          .from('voice_profiles')
          .update(profileData)
          .eq('user_id', user.id);
        error = result.error;
      } else {
        // Insert new profile
        console.log('Creating new voice profile...');
        const result = await supabase
          .from('voice_profiles')
          .insert(profileData);
        error = result.error;
      }

      if (error) {
        console.error('Database error:', error);
        throw new Error(`Database error: ${error.message}`);
      }

      // Store voice password in user metadata or custom table
      await supabase.auth.updateUser({
        data: {
          voice_password: firstPassword,
        }
      });

      console.log('Enrollment saved successfully');
      setEnrolledProfile(finalProfile);
      setStoredVoicePassword(firstPassword);
      setVoiceProfile(prev => prev ? { ...prev, enrollment_status: 'enrolled', samples_collected: profiles.length } : null);
      setEnrollmentProfiles([]);
      setVoicePasswords([]);

      await supabase.from('auth_logs').insert({
        user_id: user.id,
        auth_method: 'voice_enrollment',
        success: true,
        confidence_score: 1.0,
      });

      toast({
        title: 'Voice enrollment complete!',
        description: 'Your voice is now your password. Only you can access this account.',
      });

      await fetchProfiles();
    } catch (error) {
      console.error('Enrollment error:', error);
      const errorDetails = error instanceof Error ? error.message : 'Unknown error occurred';
      toast({
        title: 'Enrollment failed',
        description: errorDetails,
        variant: 'destructive',
      });
      setEnrollmentProfiles([]);
    } finally {
      setIsEnrolling(false);
    }
  };

  const handleReEnroll = () => {
    setEnrolledProfile(null);
    setEnrollmentProfiles([]);
    setVoiceProfile(prev => prev ? { ...prev, enrollment_status: 'pending' } : null);
    setVerificationResult(null);
    setVerificationAttempts(0);
    toast({
      title: 'Re-enrollment mode',
      description: 'Record new voice samples to update your voice password.',
    });
  };

  const handleVerificationRecording = async () => {
    if (recorderState.isRecording) {
      setIsVerifying(true);
      const result = await stopRecording();
      const { audioData, transcript } = result;
      
      if (!audioData || !enrolledProfile) {
        setIsVerifying(false);
        toast({
          title: 'Error',
          description: 'Failed to capture audio or profile not found.',
          variant: 'destructive',
        });
        return;
      }

      // Validate that we got speech
      if (!transcript || transcript.trim().length === 0) {
        setIsVerifying(false);
        toast({
          title: 'No speech detected',
          description: 'Could not understand your speech. Please try again.',
          variant: 'destructive',
        });
        return;
      }

      try {
        console.log('Verifying speaker...');
        const voiceResult = verifyFunction(audioData, enrolledProfile, SPEAKER_VERIFICATION_THRESHOLD);
        console.log('Voice verification result:', voiceResult);

        // Use the transcript from live speech recognition
        const spokenPassword = normalizeText(transcript);
        console.log('Spoken password:', spokenPassword, 'Stored password:', storedVoicePassword);
        
        // Calculate text similarity
        const passwordMatch = calculateTextSimilarity(spokenPassword, storedVoicePassword);
        console.log('Password match score:', passwordMatch);

        // Voice must match AND password must match for successful verification
        const voiceMatch = voiceResult.confidence;
        const voiceVerified = voiceMatch >= 0.95;  // 95% voice similarity - STRICT to prevent imposters
        const passwordVerified = passwordMatch >= 0.70; // 70% text similarity threshold
        
        // IMPORTANT: Voice check is PRIMARY - if voice doesn't match, always deny
        // Password is secondary verification
        const overallMatch = voiceVerified && passwordVerified;

        const verificationResult = {
          match: overallMatch,
          confidence: Math.min(voiceMatch, passwordMatch),
          message: spokenPassword ? `Spoken: "${spokenPassword}"` : 'Voice verified',
          voiceMatch: voiceMatch,
          passwordMatch: passwordMatch,
        };

        setVerificationResult(verificationResult);
        setVerificationAttempts(prev => prev + 1);

        await supabase.from('auth_logs').insert({
          user_id: user?.id,
          auth_method: 'voice_verification',
          success: verificationResult.match,
          confidence_score: verificationResult.confidence,
        });

        if (verificationResult.match) {
          toast({
            title: 'Voice Verified Successfully!',
            description: `Voice match: ${(voiceMatch * 100).toFixed(1)}% | Password match: ${(passwordMatch * 100).toFixed(1)}%`,
          });
          setVerificationAttempts(0);
        } else {
          const remainingAttempts = MAX_VERIFICATION_ATTEMPTS - (verificationAttempts + 1);
          let errorMsg = `Voice: ${(voiceMatch * 100).toFixed(1)}% | Password: ${(passwordMatch * 100).toFixed(1)}%. `;
          
          if (!voiceVerified) {
            errorMsg += `Voice does not match (need 95%). This is not your voice!`;
          } else if (!passwordVerified) {
            errorMsg += `Password phrase does not match (need 70%).`;
          }
          
          if (remainingAttempts <= 0) {
            toast({
              title: 'Access Denied',
              description: errorMsg + ' Maximum attempts reached. Use OTP to proceed.',
              variant: 'destructive',
            });
            setShowOTP(true);
          } else {
            toast({
              title: 'Access Denied',
              description: `${errorMsg}(${remainingAttempts} attempt${remainingAttempts !== 1 ? 's' : ''} remaining)`,
              variant: 'destructive',
            });
          }
        }
      } catch (error) {
        console.error('Verification error:', error);
        toast({
          title: 'Verification error',
          description: error instanceof Error ? error.message : 'Unknown error',
          variant: 'destructive',
        });
      }

      setIsVerifying(false);
    } else {
      setVerificationResult(null);
      await startRecording();
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  if (loading || fetchingProfile) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="relative">
          <div className="absolute inset-0 bg-primary/30 blur-xl rounded-full" />
          <Loader2 className="w-10 h-10 animate-spin text-primary relative" />
        </div>
      </div>
    );
  }

  const isEnrolled = voiceProfile?.enrollment_status === 'enrolled' && enrolledProfile;

  // Determine verification status based on confidence percentage
  const getVerificationStatus = () => {
    if (!verificationResult) return null;
    const isVerified = verificationResult.match;
    const voiceMatch = (verificationResult.voiceMatch || 0) * 100;
    const passwordMatch = (verificationResult.passwordMatch || 0) * 100;
    
    return {
      isVerified,
      voiceMatch: voiceMatch.toFixed(1),
      passwordMatch: passwordMatch.toFixed(1),
      title: isVerified ? 'Voice Verified Successfully' : 'Access Denied',
      message: isVerified 
        ? `Your voice and password matched successfully. Access granted.`
        : `Verification failed. Check voice match (need 95%) and password phrase (need 70%).`
    };
  };

  const verificationStatus = getVerificationStatus();
  const verResultClass = verificationStatus?.isVerified 
    ? 'p-5 rounded-xl transition-all bg-primary/10 border border-primary/30 success-glow' 
    : 'p-5 rounded-xl transition-all bg-destructive/10 border border-destructive/30 error-glow';

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="fixed inset-0 cyber-grid opacity-10" />
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] bg-primary/15 rounded-full blur-[150px]" />
        <div className="absolute bottom-1/4 left-1/4 w-[400px] h-[400px] bg-secondary/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 p-4 md:p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/30 blur-lg rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                  <Fingerprint className="w-6 h-6 text-primary-foreground" />
                </div>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gradient">VoiceAuth</h1>
                <p className="text-sm text-muted-foreground">{profile?.full_name || user?.email}</p>
              </div>
            </Link>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleSignOut}
              className="hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="w-5 h-5" />
            </Button>
          </div>

          <Card className="glass-card border-border/50">
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="w-4 h-4" />
                  {profile?.full_name}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="w-4 h-4" />
                  {profile?.email}
                </div>
                {profile?.phone && profile.phone.trim() && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="w-4 h-4" />
                    {profile.phone}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card border-border/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-primary" />
                  Voice Profile
                </CardTitle>
                <div className="flex items-center gap-2">
                  {isEnrolled && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleReEnroll}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Re-enroll
                    </Button>
                  )}
                  <Badge 
                    variant={isEnrolled ? "default" : "secondary"}
                    className={isEnrolled ? "bg-gradient-to-r from-primary to-accent" : ""}
                  >
                    {isEnrolled ? "Enrolled" : "Not Enrolled"}
                  </Badge>
                </div>
              </div>
              <CardDescription>
                {isEnrolled
                  ? "Your voice is your password. Ready for authentication."
                  : `Record ${REQUIRED_ENROLLMENT_SAMPLES} natural voice samples for enrollment.`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!isEnrolled ? (
                <div className="space-y-6">
                  <div className="p-4 rounded-xl bg-primary/10 border border-primary/30">
                    <div className="flex items-start gap-3">
                      <Mic className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">How it works:</p>
                        <p className="text-sm font-semibold text-foreground mb-2">
                          Say the same phrase naturally 3 times for 5-20 seconds each.
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Your spoken phrase will be converted to text and compared with each authentication attempt. Your voice characteristics will also be recorded for voice biometric verification.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-3 mb-6">
                    {Array.from({ length: REQUIRED_ENROLLMENT_SAMPLES }).map((_, i) => (
                      <div
                        key={i}
                        className={i < enrollmentProfiles.length ? 'w-4 h-4 rounded-full bg-gradient-to-r from-primary to-accent shadow-lg relative' : 'w-4 h-4 rounded-full bg-muted relative'}
                      >
                        {i < enrollmentProfiles.length && (
                          <div className="absolute inset-0 rounded-full bg-primary animate-ping opacity-30" />
                        )}
                      </div>
                    ))}
                  </div>
                  
                  <VoiceRecorder
                    isRecording={recorderState.isRecording}
                    isProcessing={recorderState.isProcessing || isEnrolling}
                    audioLevel={recorderState.audioLevel}
                    onStart={handleEnrollmentRecording}
                    onStop={handleEnrollmentRecording}
                    minDuration={MIN_ENROLLMENT_DURATION}
                    maxDuration={MAX_ENROLLMENT_DURATION}
                  />
                </div>
              ) : (
                <div className="text-center space-y-4 py-4">
                  <div className="relative inline-block">
                    <div className="absolute inset-0 bg-primary/30 blur-xl rounded-full" />
                    <div className="relative w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center border border-primary/30">
                      <CheckCircle2 className="w-10 h-10 text-primary" />
                    </div>
                  </div>
                  <div>
                    <p className="text-foreground font-medium">Voice Enrolled</p>
                    <p className="text-sm text-muted-foreground">
                      {voiceProfile?.samples_collected} samples collected
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {isEnrolled && !showOTP && (
            <Card className="glass-card border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mic className="w-5 h-5 text-secondary" />
                  Voice Verification
                </CardTitle>
                <CardDescription>
                  Speak naturally to verify your identity with voice biometric authentication.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="p-4 rounded-xl bg-accent/10 border border-accent/30">
                  <div className="flex items-start gap-3">
                    <Mic className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Verification required:</p>
                      <p className="text-sm font-semibold text-foreground">
                        Say the same phrase you used during enrollment (3-15 seconds).
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Both your voice characteristics and the spoken phrase must match for access to be granted.
                      </p>
                    </div>
                  </div>
                </div>

                {verificationAttempts > 0 && verificationAttempts < MAX_VERIFICATION_ATTEMPTS && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="text-sm">
                      {MAX_VERIFICATION_ATTEMPTS - verificationAttempts} attempt(s) remaining
                    </span>
                  </div>
                )}

                <VoiceRecorder
                  isRecording={recorderState.isRecording}
                  isProcessing={recorderState.isProcessing || isVerifying}
                  audioLevel={recorderState.audioLevel}
                  onStart={handleVerificationRecording}
                  onStop={handleVerificationRecording}
                  minDuration={MIN_VERIFICATION_DURATION}
                  maxDuration={MAX_VERIFICATION_DURATION}
                />

                {verificationResult && (
                  <div className={verResultClass}>
                    <div className="flex items-center gap-4 mb-4">
                      {verificationStatus?.isVerified ? (
                        <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                          <CheckCircle2 className="w-6 h-6 text-primary" />
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-destructive/20 flex items-center justify-center">
                          <XCircle className="w-6 h-6 text-destructive" />
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="font-semibold text-lg">
                          {verificationStatus?.title}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {verificationStatus?.message}
                        </p>
                      </div>
                    </div>
                    <div className="border-t border-current/20 pt-4 mt-4 space-y-3">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Voice Match:</span>
                        <span className="font-semibold">{verificationStatus?.voiceMatch}%</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Password Match:</span>
                        <span className="font-semibold">{verificationStatus?.passwordMatch}%</span>
                      </div>
                      <div className="border-t border-current/20 pt-3 mt-3 space-y-2">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">Voice Threshold:</span>
                          <span className="font-semibold">95%</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">Password Threshold:</span>
                          <span className="font-semibold">70%</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center text-sm pt-2 border-t border-current/20">
                        <span className="text-muted-foreground">Overall Status:</span>
                        <span className={`font-semibold ${verificationStatus?.isVerified ? 'text-primary' : 'text-destructive'}`}>
                          {verificationStatus?.isVerified ? '✓ Verified' : '✗ Not Verified'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <Button
                  variant="outline"
                  className="w-full border-border/50 hover:bg-muted/50 hover:border-accent"
                  onClick={() => {
                    setShowOTP(true);
                    setVerificationAttempts(0);
                  }}
                >
                  Use OTP Verification Instead
                </Button>
              </CardContent>
            </Card>
          )}

          {showOTP && profile && (
            <Card className="glass-card border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-accent" />
                  OTP Verification
                </CardTitle>
                <CardDescription>
                  Verify your identity with a one-time code.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <OTPInput
                  email={profile.email}
                  phone={profile.phone}
                  onVerified={() => {
                    setShowOTP(false);
                    setVerificationAttempts(0);
                    toast({
                      title: 'Authenticated!',
                      description: 'OTP verification successful.',
                    });
                  }}
                  onBack={() => {
                    setShowOTP(false);
                    setVerificationAttempts(0);
                  }}
                />
              </CardContent>
            </Card>
          )}

          <Card className="glass-card border-border/50 bg-amber-500/5">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-foreground">Security Notice</p>
                  <p className="text-muted-foreground mt-1">
                    Your voice is your unique password. No fixed phrase needed—just speak naturally.
                    Your voice characteristics are encrypted and stored securely.
                    After 3 failed verification attempts, you will need to use OTP verification.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

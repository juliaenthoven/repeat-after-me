import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  ScrollView,
} from 'react-native';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import * as Speech from 'expo-speech';
import { Session, saveSession } from '../utils/storage';

const { width } = Dimensions.get('window');
const MAX_RECORD_SEC = 120;

type Phase = 'loading' | 'ready' | 'countdown' | 'speaking' | 'recording' | 'paused' | 'done';

interface Props {
  session: Session;
  onFinish: (session: Session) => void;
  onBack: () => void;
  onError?: (msg: string) => void;
}

export default function RecordingScreen({ session: initialSession, onFinish, onBack, onError }: Props) {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const [phase, setPhase] = useState<Phase>('loading');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [session] = useState<Session>(initialSession);
  const [recordedUris, setRecordedUris] = useState<Record<string, string>>({});

  // Progress bar
  const progressAnim = useRef(new Animated.Value(0)).current;
  const progressAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  const cameraRef = useRef<CameraView>(null);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isStoppingRef = useRef(false);
  const currentIndexRef = useRef(0);
  const translateX = useRef(new Animated.Value(0)).current;
  const recordedUrisRef = useRef<Record<string, string>>({});
  const phaseRef = useRef<Phase>('loading');

  const segments = session.segments;

  const setPhaseSync = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  useEffect(() => {
    (async () => {
      if (!cameraPermission?.granted) await requestCameraPermission();
      if (!micPermission?.granted) await requestMicPermission();
      setTimeout(() => setPhaseSync('ready'), 800);
    })();
    return () => {
      Speech.stop();
      clearTimers();
      stopProgressBar();
      try { cameraRef.current?.stopRecording(); } catch {}
    };
  }, []);

  const clearTimers = () => {
    if (maxTimerRef.current) { clearTimeout(maxTimerRef.current); maxTimerRef.current = null; }
    if (autoAdvanceTimerRef.current) { clearTimeout(autoAdvanceTimerRef.current); autoAdvanceTimerRef.current = null; }
  };

  const startProgressBar = (durationMs: number) => {
    progressAnim.setValue(0);
    progressAnimRef.current = Animated.timing(progressAnim, {
      toValue: 1,
      duration: durationMs,
      useNativeDriver: false,
    });
    progressAnimRef.current.start();
  };

  const stopProgressBar = () => {
    progressAnimRef.current?.stop();
    progressAnim.setValue(0);
  };

  const doCountdown = useCallback((onDone: () => void) => {
    setPhaseSync('countdown');
    setCountdown(3);
    let c = 3;
    Speech.speak('3', { rate: 1.2 });
    const tick = () => {
      c--;
      setCountdown(c);
      if (c > 0) {
        Speech.speak(String(c), { rate: 1.2 });
        setTimeout(tick, 1000);
      } else {
        setTimeout(onDone, 600);
      }
    };
    setTimeout(tick, 1000);
  }, []);

  const startCountdown = useCallback(() => {
    doCountdown(() => speakSegment(0));
  }, []);

  const speakSegment = useCallback((idx: number) => {
    setPhaseSync('speaking');
    currentIndexRef.current = idx;
    setCurrentIndex(idx);
    const text = segments[idx]?.text;
    if (!text) { finishSession(); return; }
    Speech.speak(text, {
      voice: session.voice,
      rate: 0.9,
      onDone: () => {
        if (phaseRef.current === 'speaking') startRecording(idx);
      },
      onError: () => {
        if (phaseRef.current === 'speaking') startRecording(idx);
      },
    });
  }, [segments, session.voice]);

  const startRecording = useCallback((idx: number) => {
    setPhaseSync('recording');
    isStoppingRef.current = false;
    currentIndexRef.current = idx;

    const estimatedMs = segments[idx]?.estimatedDurationMs ?? 3000;

    // Start camera recording
    cameraRef.current?.recordAsync({ maxDuration: MAX_RECORD_SEC, videoQuality: '1080p' }).then((result) => {
      if (result?.uri) {
        recordedUrisRef.current = { ...recordedUrisRef.current, [segments[idx].id]: result.uri };
        setRecordedUris({ ...recordedUrisRef.current });
      }
    }).catch((err: Error) => {
      if (phaseRef.current !== 'paused' && phaseRef.current !== 'done') {
        onError?.(err?.message || 'Recording failed.');
      }
    });

    // Progress bar fills over estimated speaking time
    startProgressBar(estimatedMs);

    // Auto-advance when bar completes
    autoAdvanceTimerRef.current = setTimeout(() => {
      if (phaseRef.current === 'recording') stopAndAdvance(idx);
    }, estimatedMs);

    // Hard safety cap
    maxTimerRef.current = setTimeout(() => {
      if (phaseRef.current === 'recording') stopAndAdvance(idx);
    }, MAX_RECORD_SEC * 1000);
  }, [segments]);

  const stopAndAdvance = useCallback((idx: number) => {
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;
    clearTimers();
    stopProgressBar();
    try { cameraRef.current?.stopRecording(); } catch {}
    setTimeout(() => advanceSegment(idx), 400);
  }, []);

  const advanceSegment = useCallback((idx: number) => {
    const nextIdx = idx + 1;
    Animated.timing(translateX, {
      toValue: -(nextIdx * width),
      duration: 350,
      useNativeDriver: true,
    }).start();
    if (nextIdx >= segments.length) {
      setPhaseSync('done');
      finishSession();
    } else {
      currentIndexRef.current = nextIdx;
      setCurrentIndex(nextIdx);
      setTimeout(() => speakSegment(nextIdx), 500);
    }
  }, [segments.length, translateX]);

  const handlePause = useCallback(() => {
    Speech.stop();
    clearTimers();
    stopProgressBar();
    try { cameraRef.current?.stopRecording(); } catch {}
    setPhaseSync('paused');
  }, []);

  const handleResume = useCallback(() => {
    doCountdown(() => speakSegment(currentIndexRef.current));
  }, [doCountdown, speakSegment]);

  const handleManualDone = useCallback(() => {
    if (phaseRef.current === 'recording') stopAndAdvance(currentIndexRef.current);
  }, [stopAndAdvance]);

  const handleStop = useCallback(() => {
    Speech.stop();
    clearTimers();
    stopProgressBar();
    try { cameraRef.current?.stopRecording(); } catch {}
    setTimeout(() => finishSession(), 400);
  }, []);

  const finishSession = useCallback(async () => {
    try {
      const uris = recordedUrisRef.current;
      const updated: Session = {
        ...session,
        segments: session.segments.map((seg) => ({
          ...seg,
          videoUri: uris[seg.id],
        })),
      };
      await saveSession(updated);
      setTimeout(() => onFinish(updated), 600);
    } catch (err: any) {
      onError?.(err?.message || 'Failed to save session.');
    }
  }, [session]);

  if (!cameraPermission?.granted || !micPermission?.granted) {
    return (
      <View style={styles.permContainer}>
        <Text style={styles.permText}>Camera and microphone access required.</Text>
        <TouchableOpacity style={styles.permBtn} onPress={async () => { await requestCameraPermission(); await requestMicPermission(); }}>
          <Text style={styles.permBtnText}>Grant Permissions</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onBack} style={styles.permBack}>
          <Text style={styles.permBackText}>Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const progressWidth = progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" mode="video" zoom={0.015} />
      <View style={styles.overlay} />

      {/* Top bar */}
      <View style={styles.thumbBar}>
        <TouchableOpacity onPress={onBack} style={styles.thumbBack}>
          <Text style={styles.thumbBackText}>✕</Text>
        </TouchableOpacity>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbScroll}>
          {segments.map((seg, i) => (
            <View key={seg.id} style={[
              styles.thumb,
              recordedUris[seg.id] ? styles.thumbDone : styles.thumbEmpty,
              i === currentIndex && styles.thumbActive,
            ]}>
              <Text style={styles.thumbNum}>{i + 1}</Text>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* Loading */}
      {phase === 'loading' && (
        <View style={styles.centerOverlay}>
          <View style={styles.loadingBox}>
            <Text style={styles.loadingIcon}>⏳</Text>
            <Text style={styles.loadingText}>Preparing your script...</Text>
            <Text style={styles.loadingSubtext}>{segments.length} segments</Text>
          </View>
        </View>
      )}

      {/* Ready */}
      {phase === 'ready' && (
        <View style={styles.centerOverlay}>
          <TouchableOpacity style={styles.startBtn} onPress={startCountdown} activeOpacity={0.85}>
            <Text style={styles.startBtnText}>Start</Text>
          </TouchableOpacity>
          <Text style={styles.startHint}>Tap to begin</Text>
        </View>
      )}

      {/* Countdown */}
      {phase === 'countdown' && (
        <View style={styles.centerOverlay}>
          <Text style={styles.countdownNum}>{countdown === 0 ? '▶' : countdown}</Text>
        </View>
      )}

      {/* Segment carousel */}
      {(phase === 'speaking' || phase === 'recording' || phase === 'paused') && (
        <View style={styles.segmentArea}>
          <Animated.View style={[styles.segmentCarousel, { transform: [{ translateX }], width: width * segments.length }]}>
            {segments.map((seg, i) => (
              <View key={seg.id} style={[styles.segmentSlide, { width }]}>
                <View style={[styles.segmentBox, i === currentIndex && styles.segmentBoxActive]}>
                  <Text style={styles.segmentNum}>{i + 1} / {segments.length}</Text>
                  <Text style={styles.segmentText}>{seg.text}</Text>

                  {i === currentIndex && phase === 'speaking' && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>🔊 Listen...</Text>
                    </View>
                  )}

                  {i === currentIndex && phase === 'recording' && (
                    <>
                      <View style={[styles.badge, styles.recordingBadge]}>
                        <View style={styles.recordDot} />
                        <Text style={styles.badgeText}>Recording — repeat the line</Text>
                      </View>
                      {/* Progress bar */}
                      <View style={styles.progressTrack}>
                        <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
                      </View>
                    </>
                  )}

                  {i === currentIndex && phase === 'paused' && (
                    <View style={[styles.badge, styles.pausedBadge]}>
                      <Text style={styles.badgeText}>⏸ Paused</Text>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </Animated.View>
        </View>
      )}

      {/* Done */}
      {phase === 'done' && (
        <View style={styles.centerOverlay}>
          <View style={styles.doneBox}>
            <Text style={styles.doneIcon}>✅</Text>
            <Text style={styles.doneText}>All done!</Text>
            <Text style={styles.doneSubtext}>Saving your session...</Text>
          </View>
        </View>
      )}

      {/* Bottom controls */}
      {(phase === 'speaking' || phase === 'recording' || phase === 'paused') && (
        <View style={styles.bottomControls}>
          {phase === 'paused' ? (
            <>
              <TouchableOpacity style={styles.resumeBtn} onPress={handleResume} activeOpacity={0.85}>
                <Text style={styles.resumeBtnText}>▶ Resume</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.stopBtn} onPress={handleStop}>
                <Text style={styles.stopBtnText}>■ Finish</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {phase === 'recording' && (
                <TouchableOpacity style={styles.doneSegBtn} onPress={handleManualDone}>
                  <Text style={styles.doneSegBtnText}>✓ Done</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.pauseBtn} onPress={handlePause}>
                <Text style={styles.pauseBtnText}>⏸</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.stopBtn} onPress={handleStop}>
                <Text style={styles.stopBtnText}>■ Finish</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.25)' },
  permContainer: { flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center', padding: 32 },
  permText: { color: '#fff', fontSize: 18, textAlign: 'center', marginBottom: 24 },
  permBtn: { backgroundColor: '#FF3B30', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12 },
  permBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  permBack: { marginTop: 16 },
  permBackText: { color: '#888', fontSize: 16 },

  thumbBar: { position: 'absolute', top: 60, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 10 },
  thumbBack: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  thumbBackText: { color: '#fff', fontSize: 16 },
  thumbScroll: { flex: 1 },
  thumb: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginRight: 6, borderWidth: 2 },
  thumbEmpty: { backgroundColor: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.2)' },
  thumbDone: { backgroundColor: 'rgba(255,59,48,0.6)', borderColor: '#FF3B30' },
  thumbActive: { borderColor: '#fff', borderWidth: 2 },
  thumbNum: { color: '#fff', fontSize: 13, fontWeight: '700' },

  centerOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  loadingBox: { backgroundColor: 'rgba(0,0,0,0.8)', borderRadius: 20, padding: 32, alignItems: 'center' },
  loadingIcon: { fontSize: 48, marginBottom: 16 },
  loadingText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  loadingSubtext: { color: '#888', fontSize: 14, marginTop: 6 },

  startBtn: { backgroundColor: '#FF3B30', width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center', shadowColor: '#FF3B30', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 24 },
  startBtnText: { color: '#fff', fontSize: 24, fontWeight: '800' },
  startHint: { color: 'rgba(255,255,255,0.6)', fontSize: 15, marginTop: 20 },

  countdownNum: { fontSize: 120, fontWeight: '800', color: '#fff', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 10 },

  segmentArea: { position: 'absolute', bottom: 120, left: 0, right: 0 },
  segmentCarousel: { flexDirection: 'row' },
  segmentSlide: { paddingHorizontal: 20, alignItems: 'center' },
  segmentBox: { backgroundColor: 'rgba(0,0,0,0.75)', borderRadius: 16, padding: 20, width: '100%', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  segmentBoxActive: { borderColor: 'rgba(255,59,48,0.5)' },
  segmentNum: { color: '#FF3B30', fontSize: 12, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  segmentText: { color: '#fff', fontSize: 22, fontWeight: '600', lineHeight: 32, textAlign: 'center' },

  badge: { flexDirection: 'row', alignItems: 'center', marginTop: 14, alignSelf: 'center', backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 6 },
  recordingBadge: { backgroundColor: 'rgba(255,59,48,0.25)' },
  pausedBadge: { backgroundColor: 'rgba(255,200,0,0.2)' },
  recordDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF3B30' },
  badgeText: { color: 'rgba(255,255,255,0.85)', fontSize: 13 },

  progressTrack: { marginTop: 12, height: 3, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#FF3B30', borderRadius: 2 },

  doneBox: { backgroundColor: 'rgba(0,0,0,0.8)', borderRadius: 20, padding: 40, alignItems: 'center' },
  doneIcon: { fontSize: 64, marginBottom: 16 },
  doneText: { color: '#fff', fontSize: 24, fontWeight: '800' },
  doneSubtext: { color: '#888', fontSize: 15, marginTop: 8 },

  bottomControls: { position: 'absolute', bottom: 48, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 12, paddingHorizontal: 24 },
  doneSegBtn: { flex: 1, backgroundColor: 'rgba(255,255,255,0.9)', paddingVertical: 14, borderRadius: 30, alignItems: 'center' },
  doneSegBtnText: { color: '#000', fontWeight: '700', fontSize: 16 },
  pauseBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' },
  pauseBtnText: { color: '#fff', fontSize: 18 },
  resumeBtn: { flex: 1, backgroundColor: '#FF3B30', paddingVertical: 14, borderRadius: 30, alignItems: 'center' },
  resumeBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  stopBtn: { backgroundColor: 'rgba(255,59,48,0.7)', paddingHorizontal: 20, paddingVertical: 14, borderRadius: 30, alignItems: 'center', minWidth: 90 },
  stopBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});

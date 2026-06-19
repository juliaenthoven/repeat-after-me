import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, Component, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,

  ScrollView,
  Dimensions,
  Alert,
  Modal,
  TextInput,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import * as Sharing from 'expo-sharing';
import { Session, saveSession, deleteSession } from '../utils/storage';
import * as Clipboard from 'expo-clipboard';
import { getProfile } from '../utils/profile';
import PaywallModal from '../components/PaywallModal';

const { width } = Dimensions.get('window');

class ClipErrorBoundary extends Component<{ children: React.ReactNode; transcript: string; index: number; total: number }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) {
      return (
        <View style={[styles.clipCard, { width: CARD_WIDTH, marginRight: CARD_SPACING }]}>
          <View style={[styles.clipVideo, styles.clipVideoFallback]}>
            <Text style={styles.clipVideoFallbackIcon}>🎬</Text>
            <Text style={styles.clipVideoFallbackText}>Clip unavailable</Text>
          </View>
          <View style={styles.clipInfo}>
            <Text style={styles.clipNum}>Clip {this.props.index + 1} of {this.props.total}</Text>
            <Text style={styles.clipTranscript}>{this.props.transcript}</Text>
          </View>
        </View>
      );
    }
    return this.props.children;
  }
}

function formatDuration(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const CARD_WIDTH = width * 0.5;
const CARD_SPACING = 12;

function ClipPlayer({ uri, index, total, transcript }: { uri: string; index: number; total: number; transcript: string }) {
  const videoRef = useRef(null);
  const [duration, setDuration] = useState<string | null>(null);
  const [videoHeight, setVideoHeight] = useState(CARD_WIDTH * (16 / 9)); // portrait default

  const onLoad = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      if (status.durationMillis) setDuration(formatDuration(status.durationMillis));
      if (status.naturalSize) {
        const { width: vw, height: vh } = status.naturalSize;
        if (vw && vh) setVideoHeight(CARD_WIDTH * (vh / vw));
      }
    }
  };

  return (
    <View style={[styles.clipCard, { width: CARD_WIDTH, marginRight: CARD_SPACING }]}>
      <View style={[styles.clipVideoWrapper, { height: videoHeight, backgroundColor: '#000' }]}>
        <Video
          ref={videoRef}
          source={{ uri }}
          style={{ width: CARD_WIDTH, height: videoHeight }}
          resizeMode={ResizeMode.CONTAIN}
          useNativeControls
          isLooping={false}
          onLoad={onLoad}
        />
        {duration && (
          <View style={styles.durationPill}>
            <Text style={styles.durationText}>{duration}</Text>
          </View>
        )}
      </View>
      <View style={styles.clipInfo}>
        <Text style={styles.clipNum}>Clip {index + 1} of {total}</Text>
        <Text style={styles.clipTranscript} numberOfLines={3}>{transcript}</Text>
      </View>
    </View>
  );
}

// ─── Auto-Edit Player ────────────────────────────────────────────────────────

const LEAD_TRIM_MS = 300; // skip initial silence / click at clip start

interface AutoEditSegment {
  id: string;
  videoUri: string;
  estimatedDurationMs: number;
  text: string;
}

function AutoEditPlayer({ segments }: { segments: AutoEditSegment[] }) {
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [finished, setFinished] = useState(false);
  const videoRef = useRef<any>(null);

  const seg = segments[idx];
  // How long to play this clip: estimated speech + small buffer, starting after lead trim
  const clipDurationMs = (seg?.estimatedDurationMs ?? 3000) + 500;
  const stopAtMs = LEAD_TRIM_MS + clipDurationMs;

  // When idx changes while playing, seek to trim point and resume
  useEffect(() => {
    if (!playing) return;
    const video = videoRef.current;
    if (!video) return;
    video.setPositionAsync(LEAD_TRIM_MS).then(() => video.playAsync()).catch(() => {});
  }, [idx]);

  const onPlaybackStatusUpdate = useCallback((status: any) => {
    if (!status.isLoaded || !playing) return;
    if (status.positionMillis >= stopAtMs || status.didJustFinish) {
      const next = idx + 1;
      if (next < segments.length) {
        setIdx(next);
      } else {
        setPlaying(false);
        setFinished(true);
      }
    }
  }, [idx, stopAtMs, playing, segments.length]);

  const handlePlay = async () => {
    setFinished(false);
    setIdx(0);
    setPlaying(true);
    await videoRef.current?.setPositionAsync(LEAD_TRIM_MS);
    await videoRef.current?.playAsync();
  };

  const handlePause = async () => {
    setPlaying(false);
    await videoRef.current?.pauseAsync();
  };

  const handleReplay = () => {
    setFinished(false);
    handlePlay();
  };

  const totalMs = segments.reduce((sum, s) => sum + (s.estimatedDurationMs ?? 3000) + 500, 0);
  const elapsedMs = segments.slice(0, idx).reduce((sum, s) => sum + (s.estimatedDurationMs ?? 3000) + 500, 0);
  const overallProgress = totalMs > 0 ? elapsedMs / totalMs : 0;

  if (!seg) return null;

  return (
    <View style={aeStyles.container}>
      {/* Video — key forces remount on clip change so expo-av loads the new source */}
      <View style={aeStyles.videoWrapper}>
        <Video
          key={seg.id}
          ref={videoRef}
          source={{ uri: seg.videoUri }}
          style={aeStyles.video}
          resizeMode={ResizeMode.CONTAIN}
          onPlaybackStatusUpdate={onPlaybackStatusUpdate}
          shouldPlay={false}
        />
        {/* Clip counter */}
        <View style={aeStyles.clipPill}>
          <Text style={aeStyles.clipPillText}>{idx + 1} / {segments.length}</Text>
        </View>
      </View>

      {/* Overall progress bar */}
      <View style={aeStyles.progressTrack}>
        <View style={[aeStyles.progressFill, { width: `${overallProgress * 100}%` }]} />
        {segments.map((_, i) => (
          <View
            key={i}
            style={[aeStyles.progressTick, { left: `${(segments.slice(0, i).reduce((s, sg) => s + (sg.estimatedDurationMs ?? 3000) + 500, 0) / totalMs) * 100}%` }]}
          />
        ))}
      </View>

      {/* Transcript */}
      <Text style={aeStyles.transcript} numberOfLines={2}>{seg.text}</Text>

      {/* Controls */}
      <View style={aeStyles.controls}>
        {finished ? (
          <TouchableOpacity style={aeStyles.playBtn} onPress={handleReplay} activeOpacity={0.85}>
            <Text style={aeStyles.playBtnText}>↺  Replay</Text>
          </TouchableOpacity>
        ) : playing ? (
          <TouchableOpacity style={aeStyles.playBtn} onPress={handlePause} activeOpacity={0.85}>
            <Text style={aeStyles.playBtnText}>⏸  Pause</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={aeStyles.playBtn} onPress={handlePlay} activeOpacity={0.85}>
            <Text style={aeStyles.playBtnText}>▶  Play Auto-Edit</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={aeStyles.note}>
        Silences trimmed by word-count estimate · file export coming in V2
      </Text>
    </View>
  );
}

const aeStyles = StyleSheet.create({
  container: { backgroundColor: '#111', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#2a2a2a' },
  videoWrapper: { position: 'relative', backgroundColor: '#000' },
  video: { width: '100%', height: 220, backgroundColor: '#000' },
  clipPill: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  clipPillText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  progressTrack: { height: 3, backgroundColor: '#2a2a2a', position: 'relative' },
  progressFill: { position: 'absolute', left: 0, top: 0, height: '100%', backgroundColor: '#FF3B30' },
  progressTick: { position: 'absolute', top: 0, width: 1, height: '100%', backgroundColor: '#555' },
  transcript: { color: '#888', fontSize: 13, lineHeight: 18, padding: 12, paddingBottom: 0 },
  controls: { padding: 12 },
  playBtn: { backgroundColor: '#FF3B30', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  playBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  note: { color: '#555', fontSize: 11, textAlign: 'center', paddingBottom: 12, paddingHorizontal: 12 },
});

// ─────────────────────────────────────────────────────────────────────────────

type OverlayType = 'menu' | 'rename' | 'share' | 'delete' | null;

interface Props {
  session: Session;
  onBack: () => void;
  onReRecord: (session: Session) => void;
  onDeleted: () => void;
  onError?: (msg: string) => void;
}

export default function SessionOverviewScreen({ session: initialSession, onBack, onReRecord, onDeleted, onError }: Props) {
  const [session, setSession] = useState<Session>(initialSession);
  const [scriptExpanded, setScriptExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [currentClip, setCurrentClip] = useState(0);
  const [sharing, setSharing] = useState(false);
  const [overlay, setOverlay] = useState<OverlayType>(null);
  const [renameText, setRenameText] = useState(session.title);
  const [showPaywall, setShowPaywall] = useState(false);
  const [isPro, setIsPro] = useState(false);

  useEffect(() => {
    getProfile().then((p) => setIsPro(p.plan === 'Pro'));
  }, []);

  const recordedSegments = session.segments.filter((s) => s.videoUri);

  const handleShare = async () => {
    if (!recordedSegments.length) {
      Alert.alert('No clips', 'No clips have been recorded yet.');
      return;
    }
    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      Alert.alert('Not available', 'Sharing is not available on this device.');
      return;
    }
    setSharing(true);
    try {
      for (const seg of recordedSegments) {
        if (seg.videoUri) {
          await Sharing.shareAsync(seg.videoUri, {
            mimeType: 'video/mp4',
            dialogTitle: `Clip ${recordedSegments.indexOf(seg) + 1} – ${seg.text.slice(0, 40)}`,
          });
        }
      }
    } catch (err: any) {
      onError?.(err?.message || 'Could not share clips.');
    }
    setSharing(false);
  };

  const handleRename = async () => {
    const trimmed = renameText.trim();
    if (!trimmed) return;
    const updated = { ...session, title: trimmed };
    setSession(updated);
    await saveSession(updated);
    setOverlay(null);
  };

  const handleDelete = async () => {
    await deleteSession(session.id);
    setOverlay(null);
    onDeleted();
  };

  const date = new Date(session.createdAt).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  return (
    <SafeAreaView style={styles.container}>
      {/* Nav bar */}
      <View style={styles.navBar}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Home</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle} numberOfLines={1}>{session.title}</Text>
        <TouchableOpacity style={styles.menuBtn} onPress={() => setOverlay('menu')}>
          <Text style={styles.menuBtnText}>•••</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.date}>{date}</Text>

        {/* Script accordion */}
        <TouchableOpacity style={styles.accordionHeader} onPress={() => setScriptExpanded(!scriptExpanded)} activeOpacity={0.8}>
          <Text style={styles.accordionTitle}>📄 Script</Text>
          <Text style={styles.accordionChevron}>{scriptExpanded ? '▲' : '▼'}</Text>
        </TouchableOpacity>
        {scriptExpanded && (
          <View style={styles.scriptBox}>
            <Text style={styles.scriptText}>{session.script}</Text>
            <TouchableOpacity
              style={styles.copyBtn}
              onPress={() => {
                Clipboard.setStringAsync(session.script);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              <Text style={styles.copyBtnText}>{copied ? '✓ Copied!' : '⎘  Copy to Clipboard'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Clips */}
        <Text style={styles.sectionLabel}>Recorded Clips</Text>
        {recordedSegments.length === 0 ? (
          <View style={styles.noClips}>
            <Text style={styles.noClipsText}>No clips recorded yet</Text>
            <TouchableOpacity style={styles.reRecordBtn} onPress={() => onReRecord(session)}>
              <Text style={styles.reRecordBtnText}>Start Recording</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={CARD_WIDTH + CARD_SPACING}
              snapToAlignment="start"
              decelerationRate="fast"
              contentContainerStyle={{ paddingLeft: 20, paddingRight: 20 }}
              style={styles.clipScroll}
              onScroll={(e) => setCurrentClip(Math.round(e.nativeEvent.contentOffset.x / (CARD_WIDTH + CARD_SPACING)))}
              scrollEventThrottle={16}
            >
              {recordedSegments.map((seg, i) => (
                <ClipErrorBoundary key={seg.id} index={i} total={recordedSegments.length} transcript={seg.text}>
                  <ClipPlayer uri={seg.videoUri!} index={i} total={recordedSegments.length} transcript={seg.text} />
                </ClipErrorBoundary>
              ))}
            </ScrollView>
            <View style={styles.dots}>
              {recordedSegments.map((_, i) => (
                <View key={i} style={[styles.dot, i === currentClip && styles.dotActive]} />
              ))}
            </View>
            <TouchableOpacity
              style={[styles.saveClipsBtn, sharing && styles.saveClipsBtnLoading]}
              onPress={handleShare}
              disabled={sharing}
              activeOpacity={0.85}
            >
              <Text style={styles.saveClipsBtnText}>
                {sharing ? 'Downloading...' : `↓ Download Clip${recordedSegments.length !== 1 ? 's' : ''}`}
              </Text>
            </TouchableOpacity>
          </>
        )}

        {/* Auto-Edit */}
        <Text style={styles.sectionLabel}>Auto-Edit Preview</Text>
        {recordedSegments.length === 0 ? (
          <View style={styles.autoEditBox}>
            <Text style={styles.autoEditTitle}>No clips yet</Text>
            <Text style={styles.autoEditText}>Record your clips first, then come back here to preview the auto-edit.</Text>
          </View>
        ) : !isPro ? (
          <TouchableOpacity style={styles.autoEditLocked} onPress={() => setShowPaywall(true)} activeOpacity={0.85}>
            <Text style={styles.autoEditLockedIcon}>✂️</Text>
            <Text style={styles.autoEditLockedTitle}>Auto-Edit Preview</Text>
            <Text style={styles.autoEditLockedSub}>Silences trimmed · Clips stitched together</Text>
            <View style={styles.autoEditLockedBadge}>
              <Text style={styles.autoEditLockedBadgeText}>🔒  Unlock with Pro</Text>
            </View>
          </TouchableOpacity>
        ) : (
          <AutoEditPlayer
            segments={recordedSegments.map((s) => ({
              id: s.id,
              videoUri: s.videoUri!,
              estimatedDurationMs: s.estimatedDurationMs ?? 3000,
              text: s.text,
            }))}
          />
        )}

        {/* Re-record */}
        <TouchableOpacity style={styles.reRecordFullBtn} onPress={() => onReRecord(session)} activeOpacity={0.85}>
          <Text style={styles.reRecordFullBtnText}>🔴 Re-record Session</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Paywall */}
      <PaywallModal visible={showPaywall} onClose={() => setShowPaywall(false)} />

      {/* ••• Action Menu */}
      <Modal visible={overlay === 'menu'} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={() => setOverlay(null)}>
          <View style={styles.modalBackdrop}>
            <TouchableWithoutFeedback>
              <View style={styles.menuSheet}>
                <TouchableOpacity style={styles.menuItem} onPress={() => { setRenameText(session.title); setOverlay('rename'); }}>
                  <Text style={styles.menuItemIcon}>✏️</Text>
                  <Text style={styles.menuItemText}>Rename Session</Text>
                </TouchableOpacity>
                <View style={styles.menuDivider} />
                <TouchableOpacity style={styles.menuItem} onPress={() => { setOverlay(null); if (!isPro) { setShowPaywall(true); return; } setOverlay('share'); }}>
                  <Text style={styles.menuItemIcon}>🔗</Text>
                  <Text style={styles.menuItemText}>Share Session{!isPro ? '  🔒' : ''}</Text>
                </TouchableOpacity>
                <View style={styles.menuDivider} />
                <TouchableOpacity style={styles.menuItem} onPress={() => setOverlay('delete')}>
                  <Text style={styles.menuItemIcon}>🗑️</Text>
                  <Text style={[styles.menuItemText, styles.menuItemDestructive]}>Delete Session</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Rename overlay */}
      <Modal visible={overlay === 'rename'} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <TouchableWithoutFeedback onPress={() => setOverlay(null)}>
          <View style={[styles.modalBackdrop, styles.modalBackdropCenter]}>
            <TouchableWithoutFeedback>
              <View style={[styles.dialogBox, styles.dialogBoxCentered]}>
                <Text style={styles.dialogTitle}>Rename Session</Text>
                <TextInput
                  style={styles.renameInput}
                  value={renameText}
                  onChangeText={setRenameText}
                  placeholder="Session title"
                  placeholderTextColor="#555"
                  autoFocus
                  maxLength={50}
                  selectTextOnFocus
                />
                <View style={styles.dialogBtns}>
                  <TouchableOpacity style={styles.dialogBtnSecondary} onPress={() => setOverlay(null)}>
                    <Text style={styles.dialogBtnSecondaryText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.dialogBtnPrimary} onPress={handleRename}>
                    <Text style={styles.dialogBtnPrimaryText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      {/* Share overlay */}
      <Modal visible={overlay === 'share'} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={() => setOverlay(null)}>
          <View style={styles.modalBackdrop}>
            <TouchableWithoutFeedback>
              <View style={styles.dialogBox}>
                <Text style={styles.dialogTitle}>Share Session</Text>
                <Text style={styles.underConstructionIcon}>🚧</Text>
                <Text style={styles.underConstructionText}>Under construction</Text>
                <Text style={styles.underConstructionSub}>
                  Soon you'll be able to copy a link and open your recorded clips on any device for review and editing.
                </Text>
                <TouchableOpacity style={styles.dialogBtnPrimary} onPress={() => setOverlay(null)}>
                  <Text style={styles.dialogBtnPrimaryText}>Got it</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Delete confirmation overlay */}
      <Modal visible={overlay === 'delete'} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={() => setOverlay(null)}>
          <View style={styles.modalBackdrop}>
            <TouchableWithoutFeedback>
              <View style={styles.dialogBox}>
                <Text style={styles.dialogTitle}>Delete Session</Text>
                <Text style={styles.deleteWarningText}>
                  Permanently delete these recordings from the app?
                </Text>
                <Text style={styles.deleteSubText}>This cannot be undone.</Text>
                <View style={styles.dialogBtns}>
                  <TouchableOpacity style={styles.dialogBtnSecondary} onPress={() => setOverlay(null)}>
                    <Text style={styles.dialogBtnSecondaryText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.dialogBtnPrimary, styles.dialogBtnDestructive]} onPress={handleDelete}>
                    <Text style={styles.dialogBtnPrimaryText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1e1e1e' },
  backBtn: { width: 60 },
  backText: { color: '#FF3B30', fontSize: 17 },
  navTitle: { fontSize: 17, fontWeight: '700', color: '#fff', flex: 1, textAlign: 'center' },
  menuBtn: { width: 60, alignItems: 'flex-end', paddingRight: 4 },
  menuBtnText: { color: '#fff', fontSize: 18, letterSpacing: 1 },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 60 },
  date: { color: '#666', fontSize: 13, marginBottom: 20 },
  accordionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1a1a1a', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#2a2a2a' },
  accordionTitle: { color: '#fff', fontSize: 15, fontWeight: '600' },
  accordionChevron: { color: '#888', fontSize: 14 },
  scriptBox: { backgroundColor: '#111', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#222', marginTop: 1, borderTopLeftRadius: 0, borderTopRightRadius: 0 },
  scriptText: { color: '#ccc', fontSize: 14, lineHeight: 22 },
  copyBtn: { marginTop: 12, alignSelf: 'flex-start', backgroundColor: '#2a2a2a', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  copyBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, marginTop: 28 },
  noClips: { backgroundColor: '#1a1a1a', borderRadius: 14, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: '#2a2a2a' },
  noClipsText: { color: '#555', fontSize: 16, marginBottom: 20 },
  reRecordBtn: { backgroundColor: '#FF3B30', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  reRecordBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  clipScroll: { marginHorizontal: -20 },
  clipCard: { backgroundColor: '#1a1a1a', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#2a2a2a' },
  clipVideoWrapper: { position: 'relative' },
  clipVideo: { width: '100%', backgroundColor: '#000' },
  clipVideoFallback: { alignItems: 'center', justifyContent: 'center' },
  clipVideoFallbackIcon: { fontSize: 40, marginBottom: 8 },
  clipVideoFallbackText: { color: '#555', fontSize: 14 },
  durationPill: { position: 'absolute', bottom: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.75)', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  durationText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  saveClipsBtn: { marginTop: 16, backgroundColor: '#fff', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  saveClipsBtnLoading: { opacity: 0.6 },
  saveClipsBtnText: { color: '#000', fontSize: 15, fontWeight: '700' },
  clipInfo: { padding: 16 },
  clipNum: { color: '#FF3B30', fontSize: 12, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  clipTranscript: { color: '#ccc', fontSize: 15, lineHeight: 22 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 12 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#333' },
  dotActive: { backgroundColor: '#FF3B30', width: 18 },
  autoEditBox: { backgroundColor: '#1a1a1a', borderRadius: 14, padding: 20, borderWidth: 1, borderColor: '#333', borderStyle: 'dashed' },
  autoEditTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 8 },
  autoEditText: { color: '#888', fontSize: 14, lineHeight: 20 },
  autoEditLocked: {
    backgroundColor: '#141414',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderStyle: 'dashed',
  },
  autoEditLockedIcon: { fontSize: 36, marginBottom: 12 },
  autoEditLockedTitle: { fontSize: 17, fontWeight: '700', color: '#fff', marginBottom: 4 },
  autoEditLockedSub: { fontSize: 13, color: '#555', marginBottom: 18, textAlign: 'center' },
  autoEditLockedBadge: {
    backgroundColor: '#1f1f1f',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  autoEditLockedBadgeText: { color: '#FFD60A', fontSize: 13, fontWeight: '700' },
  reRecordFullBtn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 12, borderWidth: 1, borderColor: '#FF3B30' },
  reRecordFullBtnText: { color: '#FF3B30', fontSize: 16, fontWeight: '600' },

  // Modal shared
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalBackdropCenter: { justifyContent: 'center', paddingHorizontal: 20 },

  // Action menu sheet
  menuSheet: { backgroundColor: '#1c1c1e', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 40, paddingTop: 8 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 18, gap: 14 },
  menuItemIcon: { fontSize: 20 },
  menuItemText: { fontSize: 17, color: '#fff' },
  menuItemDestructive: { color: '#FF3B30' },
  menuDivider: { height: 1, backgroundColor: '#2a2a2a', marginHorizontal: 20 },

  // Dialog boxes (rename, share, delete)
  dialogBox: { backgroundColor: '#1c1c1e', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 28, paddingBottom: 48 },
  dialogBoxCentered: { borderRadius: 20, paddingBottom: 28 },
  dialogTitle: { fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 20 },
  renameInput: { backgroundColor: '#2a2a2a', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 14, color: '#fff', fontSize: 16, marginBottom: 20, borderWidth: 1, borderColor: '#3a3a3a' },
  dialogBtns: { flexDirection: 'row', gap: 12 },
  dialogBtnSecondary: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#2a2a2a', alignItems: 'center' },
  dialogBtnSecondaryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  dialogBtnPrimary: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#FF3B30', alignItems: 'center' },
  dialogBtnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  dialogBtnDestructive: { backgroundColor: '#FF3B30' },

  // Share under construction
  underConstructionIcon: { fontSize: 48, textAlign: 'center', marginBottom: 12 },
  underConstructionText: { fontSize: 18, fontWeight: '700', color: '#fff', textAlign: 'center', marginBottom: 8 },
  underConstructionSub: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 20, marginBottom: 24 },

  // Delete warning
  deleteWarningText: { fontSize: 16, color: '#fff', marginBottom: 8, lineHeight: 24 },
  deleteSubText: { fontSize: 13, color: '#888', marginBottom: 24 },
});

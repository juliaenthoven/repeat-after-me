import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Animated,
} from 'react-native';
import * as Speech from 'expo-speech';
import * as Clipboard from 'expo-clipboard';
import { splitIntoSegments, generateTitle, estimateSegmentDurationMs, Session, Segment } from '../utils/storage';
import { getProfile } from '../utils/profile';
import PaywallModal from '../components/PaywallModal';

const VOICES_IOS = [
  { id: 'com.apple.ttsbundle.Samantha-compact', name: 'Samantha (US)' },
  { id: 'com.apple.ttsbundle.Daniel-compact', name: 'Daniel (UK)' },
  { id: 'com.apple.ttsbundle.Karen-compact', name: 'Karen (AU)' },
  { id: 'com.apple.ttsbundle.Moira-compact', name: 'Moira (IE)' },
];

const VIDEO_INPUTS = ['Back Camera', 'Front Camera'];

// ── Mock scripts returned by "LLM" ───────────────────────────────────────────

const SAMPLE_SCRIPTS = [
  `Here's the thing nobody talks about when it comes to going viral on social media.

It's not about the fancy equipment. It's not about having the perfect lighting setup. And it's definitely not about posting at some magic hour.

The secret? It's all in the hook. You have about two seconds to stop someone mid-scroll. Two seconds to make them think "wait, I need to hear this."

So before you even think about what story you're telling, ask yourself: would I stop scrolling for this?

If the answer is no — rewrite the first line. Every single time.`,

  `I used to spend three hours writing content that nobody watched. Now I spend twenty minutes and hit ten thousand views consistently.

The difference wasn't talent. It wasn't luck. It was a system.

First: write the ending before the beginning. Know exactly what your viewer will walk away thinking.

Second: cut everything that doesn't serve that ending. Ruthlessly.

Third: start in the middle of the action. Never set up context first — earn that context by making people curious.

Try this with your next video. I promise you'll never go back.`,
];

function getRandomScript() {
  return SAMPLE_SCRIPTS[Math.floor(Math.random() * SAMPLE_SCRIPTS.length)];
}

function buildScriptFromIdea(idea: string) {
  return `You've probably never thought about ${idea.toLowerCase()} quite like this before.

Most people approach it completely backwards. They focus on the output — the result they want — without ever understanding the input that actually drives it.

Here's what changed everything for me: I stopped asking "what do I want?" and started asking "what does the system want from me?"

Once I made that shift, everything clicked. The results came faster. The effort felt lighter. And suddenly, I had something worth sharing.

So if you're stuck on ${idea.toLowerCase()}, don't push harder. Step back, look at the system, and find the one lever that moves everything else.

That's where the breakthrough is.`;
}

function buildScriptFromReference(url: string) {
  return `Here's a perspective you don't see often enough.

I came across a video recently that stopped me in my tracks. Not because of the production quality — it was pretty basic, actually. But because of the idea at the center of it.

The creator made one point, and they made it clearly: the things that feel hard right now are only hard because you haven't built the habit yet.

That reframe hit different. Because we usually blame difficulty on the task itself. But what if the task is fine — and we're just early?

Think about something that feels hard in your life right now. Odds are, someone who's been doing it for six months doesn't even think twice.

You're not struggling because you're not good enough. You're struggling because you're new. And new is temporary.`;
}

// ── Script starter pills row ──────────────────────────────────────────────────

const STARTERS = [
  { key: 'idea',      label: '✨ Start with an idea', pro: true  },
  { key: 'ramble',   label: '🎙 Upload a Ramble',    pro: true  },
  { key: 'generate', label: '⚡ Generate for me',    pro: false },
  { key: 'import',   label: '🔗 Import a reference', pro: true  },
] as const;

type StarterKey = typeof STARTERS[number]['key'];

// ── Idea modal ────────────────────────────────────────────────────────────────

function IdeaModal({ visible, onClose, onScript }: { visible: boolean; onClose: () => void; onScript: (s: string) => void }) {
  const [idea, setIdea] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGenerate = () => {
    if (!idea.trim()) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onScript(buildScriptFromIdea(idea.trim()));
      setIdea('');
      onClose();
    }, 2200);
  };

  const handleClose = () => {
    if (loading) return;
    setIdea('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={handleClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Start with an idea</Text>
          <Text style={styles.sheetSub}>Describe your idea or topic and we'll write a polished social media script for you.</Text>

          <TextInput
            style={styles.sheetInput}
            placeholder="Start with an idea..."
            placeholderTextColor="#555"
            value={idea}
            onChangeText={setIdea}
            multiline
            autoFocus
            editable={!loading}
          />

          <TouchableOpacity
            style={[styles.sheetBtn, (!idea.trim() || loading) && styles.sheetBtnDisabled]}
            onPress={handleGenerate}
            disabled={!idea.trim() || loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={styles.sheetBtnText}>Writing your script...</Text>
              </View>
            ) : (
              <Text style={styles.sheetBtnText}>Generate Script</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Ramble modal ──────────────────────────────────────────────────────────────

function RambleModal({ visible, onClose, onScript }: { visible: boolean; onClose: () => void; onScript: (s: string) => void }) {
  const [loading, setLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState('');

  const handleUpload = (type: string) => {
    setLoading(true);
    setLoadingLabel(`Transcribing your ${type}...`);
    setTimeout(() => setLoadingLabel('Polishing your script...'), 1800);
    setTimeout(() => {
      setLoading(false);
      onScript(getRandomScript());
      onClose();
    }, 3500);
  };

  const handleClose = () => {
    if (loading) return;
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.modalBackdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={handleClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Upload a Ramble</Text>
          <Text style={styles.sheetSub}>
            Give us a video, audio, or voice memo where you record a rough script, story, or thoughts. Get back a polished social media script with a hook.
          </Text>

          {loading ? (
            <View style={styles.loadingCenter}>
              <ActivityIndicator color="#FF3B30" size="large" />
              <Text style={styles.loadingLabelText}>{loadingLabel}</Text>
            </View>
          ) : (
            <View style={styles.uploadOptions}>
              {[
                { icon: '🎥', label: 'Video', sub: 'MP4, MOV, or from Camera Roll' },
                { icon: '🎧', label: 'Audio', sub: 'MP3, M4A, WAV, or podcast clip' },
                { icon: '🎤', label: 'Voice Memo', sub: 'Recorded on your iPhone' },
              ].map((opt) => (
                <TouchableOpacity key={opt.label} style={styles.uploadOption} onPress={() => handleUpload(opt.label.toLowerCase())} activeOpacity={0.8}>
                  <Text style={styles.uploadIcon}>{opt.icon}</Text>
                  <View style={styles.uploadText}>
                    <Text style={styles.uploadLabel}>{opt.label}</Text>
                    <Text style={styles.uploadSub}>{opt.sub}</Text>
                  </View>
                  <Text style={styles.uploadArrow}>›</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ── Import modal ──────────────────────────────────────────────────────────────

function ImportModal({ visible, onClose, onScript }: { visible: boolean; onClose: () => void; onScript: (s: string) => void }) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState('');

  const handleImport = () => {
    if (!url.trim()) return;
    setLoading(true);
    setLoadingLabel('Transcribing video...');
    setTimeout(() => setLoadingLabel('Adapting to your voice...'), 2000);
    setTimeout(() => {
      setLoading(false);
      onScript(buildScriptFromReference(url.trim()));
      setUrl('');
      onClose();
    }, 3800);
  };

  const handlePaste = async () => {
    const text = await Clipboard.getStringAsync();
    if (text) setUrl(text);
  };

  const handleClose = () => {
    if (loading) return;
    setUrl('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={handleClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Import a reference</Text>
          <Text style={styles.sheetSub}>
            Paste a link to a video you love. We'll transcribe it and generate a script for your audience and in your voice, using that video as a model.
          </Text>

          <View style={styles.urlRow}>
            <TextInput
              style={styles.urlInput}
              placeholder="Paste a TikTok, YouTube, or Reel link..."
              placeholderTextColor="#555"
              value={url}
              onChangeText={setUrl}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              editable={!loading}
            />
            <TouchableOpacity style={styles.urlPasteBtn} onPress={handlePaste} disabled={loading}>
              <Text style={styles.urlPasteBtnText}>Paste</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.sheetBtn, (!url.trim() || loading) && styles.sheetBtnDisabled]}
            onPress={handleImport}
            disabled={!url.trim() || loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={styles.sheetBtnText}>{loadingLabel}</Text>
              </View>
            ) : (
              <Text style={styles.sheetBtnText}>Generate Script</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

interface Props {
  onBack: () => void;
  onStart: (session: Session) => void;
}

export default function NewRecordingScreen({ onBack, onStart }: Props) {
  const [script, setScript] = useState('');
  const [segmentLength, setSegmentLength] = useState(70);
  const [voice, setVoice] = useState(VOICES_IOS[0].id);
  const [videoInput, setVideoInput] = useState(VIDEO_INPUTS[0]);
  const [previewSegments, setPreviewSegments] = useState<string[]>([]);
  const [availableVoices, setAvailableVoices] = useState(VOICES_IOS);
  const [activeModal, setActiveModal] = useState<StarterKey | null>(null);
  const [generatingInstant, setGeneratingInstant] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [isPro, setIsPro] = useState(false);

  useEffect(() => {
    getProfile().then((p) => setIsPro(p.plan === 'Pro'));
  }, []);

  useEffect(() => {
    Speech.getAvailableVoicesAsync().then((voices) => {
      const ios = voices.filter((v) => v.language?.startsWith('en'));
      if (ios.length > 0) {
        const mapped = ios.slice(0, 6).map((v) => ({ id: v.identifier, name: v.name || v.identifier }));
        setAvailableVoices(mapped);
        setVoice(mapped[0].id);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (script.trim()) {
      setPreviewSegments(splitIntoSegments(script));
    } else {
      setPreviewSegments([]);
    }
  }, [script, segmentLength]);

  const handlePaste = async () => {
    const text = await Clipboard.getStringAsync();
    if (text) setScript(text);
  };

  const handleStarterPress = (key: StarterKey) => {
    const starter = STARTERS.find((s) => s.key === key);
    if (starter?.pro && !isPro) {
      setShowPaywall(true);
      return;
    }
    if (key === 'generate') {
      setGeneratingInstant(true);
      setTimeout(() => {
        setScript(getRandomScript());
        setGeneratingInstant(false);
      }, 1400);
    } else {
      setActiveModal(key);
    }
  };

  const handleGeneratedScript = (s: string) => {
    setScript(s);
    setActiveModal(null);
  };

  const handleStart = () => {
    if (!script.trim()) {
      Alert.alert('No script', 'Please add a script to continue.');
      return;
    }
    const segments = splitIntoSegments(script);
    const title = generateTitle(script);
    const session: Session = {
      id: Date.now().toString(),
      title,
      script,
      segments: segments.map((text, i) => ({
        id: `seg_${i}`,
        text,
        estimatedDurationMs: estimateSegmentDurationMs(text),
      })),
      createdAt: Date.now(),
      segmentLength,
      voice,
    };
    onStart(session);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle}>New Recording</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardDismissMode="on-drag">
        <Text style={styles.sectionLabel}>Script</Text>
        <View style={styles.scriptBox}>
          <TextInput
            style={styles.scriptInput}
            multiline
            placeholder="Paste or type your script here..."
            placeholderTextColor="#555"
            value={script}
            onChangeText={setScript}
            textAlignVertical="top"
          />
          <View style={styles.scriptBoxFooter}>
            {/* Script starter pills */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.starterScroll} contentContainerStyle={styles.starterScrollContent}>
              {STARTERS.map((s) => (
                <TouchableOpacity
                  key={s.key}
                  style={[styles.starterPill, s.key === 'generate' && generatingInstant && styles.starterPillGenerating]}
                  onPress={() => handleStarterPress(s.key)}
                  disabled={generatingInstant}
                  activeOpacity={0.75}
                >
                  {s.key === 'generate' && generatingInstant ? (
                    <View style={styles.starterPillInner}>
                      <ActivityIndicator color="#FF3B30" size="small" style={{ marginRight: 5 }} />
                      <Text style={styles.starterPillText}>Generating...</Text>
                    </View>
                  ) : (
                    <View style={styles.starterPillInner}>
                      <Text style={styles.starterPillText}>{s.label}</Text>
                      {s.pro && !isPro && <Text style={styles.lockIcon}>🔒</Text>}
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity style={styles.pasteBtn} onPress={handlePaste}>
              <Text style={styles.pasteBtnText}>Paste</Text>
            </TouchableOpacity>
          </View>
        </View>

        {previewSegments.length > 0 && (
          <View style={styles.preview}>
            <Text style={styles.previewLabel}>{previewSegments.length} segments</Text>
            {previewSegments.slice(0, 3).map((seg, i) => (
              <Text key={i} style={styles.previewSeg} numberOfLines={2}>
                {i + 1}. {seg}
              </Text>
            ))}
            {previewSegments.length > 3 && (
              <Text style={styles.previewMore}>+{previewSegments.length - 3} more segments</Text>
            )}
          </View>
        )}

        <Text style={styles.sectionLabel}>Segment Length</Text>
        <View style={styles.sliderRow}>
          <TouchableOpacity
            style={styles.sliderBtn}
            onPress={() => setSegmentLength(Math.max(20, segmentLength - 10))}
          >
            <Text style={styles.sliderBtnText}>−</Text>
          </TouchableOpacity>
          <View style={styles.sliderTrack}>
            <View style={[styles.sliderFill, { width: `${((segmentLength - 20) / 180) * 100}%` }]} />
          </View>
          <TouchableOpacity
            style={styles.sliderBtn}
            onPress={() => setSegmentLength(Math.min(200, segmentLength + 10))}
          >
            <Text style={styles.sliderBtnText}>+</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.sliderValue}>{segmentLength} characters per segment</Text>

        <Text style={styles.sectionLabel}>🔊 Voice</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll}>
          {availableVoices.map((v) => (
            <TouchableOpacity
              key={v.id}
              style={[styles.pill, voice === v.id && styles.pillActive]}
              onPress={() => {
                setVoice(v.id);
                const displayName = v.name.split('(')[0].trim();
                Speech.stop();
                Speech.speak(`Hello there! This is ${displayName}`, { voice: v.id, rate: 0.9 });
              }}
            >
              <Text style={[styles.pillText, voice === v.id && styles.pillTextActive]}>
                {v.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.sectionLabel}>Video Input</Text>
        <View style={styles.pillRow}>
          {VIDEO_INPUTS.map((inp) => (
            <TouchableOpacity
              key={inp}
              style={[styles.pill, videoInput === inp && styles.pillActive]}
              onPress={() => setVideoInput(inp)}
            >
              <Text style={[styles.pillText, videoInput === inp && styles.pillTextActive]}>
                {inp}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.startBtn, !script.trim() && styles.startBtnDisabled]}
          onPress={handleStart}
          activeOpacity={0.85}
        >
          <Text style={styles.startBtnText}>Start Recording</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Paywall */}
      <PaywallModal visible={showPaywall} onClose={() => setShowPaywall(false)} onUpgrade={() => setIsPro(true)} />

      {/* Modals */}
      <IdeaModal
        visible={activeModal === 'idea'}
        onClose={() => setActiveModal(null)}
        onScript={handleGeneratedScript}
      />
      <RambleModal
        visible={activeModal === 'ramble'}
        onClose={() => setActiveModal(null)}
        onScript={handleGeneratedScript}
      />
      <ImportModal
        visible={activeModal === 'import'}
        onClose={() => setActiveModal(null)}
        onScript={handleGeneratedScript}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e1e1e',
  },
  backBtn: { width: 60 },
  backText: { color: '#FF3B30', fontSize: 17 },
  navTitle: { fontSize: 17, fontWeight: '700', color: '#fff' },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 60 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, marginTop: 24 },

  // Script box
  scriptBox: {
    backgroundColor: '#1a1a1a',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    overflow: 'hidden',
  },
  scriptInput: {
    color: '#fff',
    fontSize: 16,
    padding: 16,
    minHeight: 140,
    lineHeight: 24,
  },
  scriptBoxFooter: {
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
    paddingVertical: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },

  // Starter pills
  starterScroll: { flex: 1 },
  starterScrollContent: { flexDirection: 'row', gap: 7, alignItems: 'center' },
  starterPill: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#252525',
    borderWidth: 1,
    borderColor: '#383838',
  },
  starterPillGenerating: {
    borderColor: '#FF3B30',
    backgroundColor: '#1f1212',
  },
  starterPillInner: { flexDirection: 'row', alignItems: 'center' },
  starterPillText: { fontSize: 12, color: '#bbb', fontWeight: '500' },
  lockIcon: { fontSize: 10, marginLeft: 4, opacity: 0.6 },

  // Paste button (in footer)
  pasteBtn: {
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    flexShrink: 0,
  },
  pasteBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  // Preview
  preview: {
    backgroundColor: '#111',
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#222',
  },
  previewLabel: { fontSize: 12, color: '#FF3B30', fontWeight: '600', marginBottom: 8 },
  previewSeg: { fontSize: 13, color: '#aaa', marginBottom: 4, lineHeight: 18 },
  previewMore: { fontSize: 12, color: '#555', marginTop: 4 },

  // Segment slider
  sliderRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sliderBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#2a2a2a', alignItems: 'center', justifyContent: 'center',
  },
  sliderBtnText: { color: '#fff', fontSize: 20, fontWeight: '300' },
  sliderTrack: { flex: 1, height: 4, backgroundColor: '#2a2a2a', borderRadius: 2, overflow: 'hidden' },
  sliderFill: { height: '100%', backgroundColor: '#FF3B30', borderRadius: 2 },
  sliderValue: { fontSize: 13, color: '#666', marginTop: 8, textAlign: 'center' },

  // Voice / input pills
  pillScroll: { marginBottom: 4 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  pill: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#333',
    marginRight: 8, marginBottom: 4,
  },
  pillActive: { backgroundColor: '#FF3B30', borderColor: '#FF3B30' },
  pillText: { fontSize: 14, color: '#888' },
  pillTextActive: { color: '#fff', fontWeight: '600' },

  // Start button
  startBtn: {
    backgroundColor: '#FF3B30', borderRadius: 14, paddingVertical: 18,
    alignItems: 'center', marginTop: 32,
    shadowColor: '#FF3B30', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 12,
  },
  startBtnDisabled: { opacity: 0.4 },
  startBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },

  // ── Modal / sheet styles ─────────────────────────────────────────────────
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#161616',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: '#2a2a2a',
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#444', alignSelf: 'center', marginBottom: 20,
  },
  sheetTitle: { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 8 },
  sheetSub: { fontSize: 14, color: '#777', lineHeight: 20, marginBottom: 20 },
  sheetInput: {
    backgroundColor: '#1f1f1f',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
    color: '#fff',
    fontSize: 15,
    padding: 14,
    minHeight: 90,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  sheetBtn: {
    backgroundColor: '#FF3B30',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  sheetBtnDisabled: { opacity: 0.4 },
  sheetBtnText: { color: '#fff', fontSize: 16, fontWeight: '700', marginLeft: 8 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  loadingCenter: { alignItems: 'center', paddingVertical: 32 },
  loadingLabelText: { color: '#aaa', fontSize: 14, marginTop: 14 },

  // Ramble upload options
  uploadOptions: { gap: 2, marginBottom: 8 },
  uploadOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f1f1f',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  uploadIcon: { fontSize: 28, marginRight: 14 },
  uploadText: { flex: 1 },
  uploadLabel: { fontSize: 15, fontWeight: '700', color: '#fff', marginBottom: 2 },
  uploadSub: { fontSize: 13, color: '#666' },
  uploadArrow: { fontSize: 22, color: '#555', marginLeft: 8 },

  // Import URL row
  urlRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  urlInput: {
    flex: 1,
    backgroundColor: '#1f1f1f',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
    color: '#fff',
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  urlPasteBtn: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  urlPasteBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
});

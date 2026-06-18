import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,

  ScrollView,
  Switch,
  Alert,
  Platform,
} from 'react-native';
import * as Speech from 'expo-speech';
import * as Clipboard from 'expo-clipboard';
import { splitIntoSegments, generateTitle, estimateSegmentDurationMs, Session, Segment } from '../utils/storage';

const VOICES_IOS = [
  { id: 'com.apple.ttsbundle.Samantha-compact', name: 'Samantha (US)' },
  { id: 'com.apple.ttsbundle.Daniel-compact', name: 'Daniel (UK)' },
  { id: 'com.apple.ttsbundle.Karen-compact', name: 'Karen (AU)' },
  { id: 'com.apple.ttsbundle.Moira-compact', name: 'Moira (IE)' },
];

const VIDEO_INPUTS = ['Back Camera', 'Front Camera'];

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
      setPreviewSegments(splitIntoSegments(script, segmentLength));
    } else {
      setPreviewSegments([]);
    }
  }, [script, segmentLength]);

  const handlePaste = async () => {
    const text = await Clipboard.getStringAsync();
    if (text) setScript(text);
  };

  const handleStart = () => {
    if (!script.trim()) {
      Alert.alert('No script', 'Please add a script to continue.');
      return;
    }
    const segments = splitIntoSegments(script, segmentLength);
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
          <TouchableOpacity style={styles.pasteBtn} onPress={handlePaste}>
            <Text style={styles.pasteBtnText}>Paste</Text>
          </TouchableOpacity>
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
  pasteBtn: {
    alignSelf: 'flex-end',
    margin: 10,
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  pasteBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
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
  sliderRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sliderBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sliderBtnText: { color: '#fff', fontSize: 20, fontWeight: '300' },
  sliderTrack: {
    flex: 1,
    height: 4,
    backgroundColor: '#2a2a2a',
    borderRadius: 2,
    overflow: 'hidden',
  },
  sliderFill: { height: '100%', backgroundColor: '#FF3B30', borderRadius: 2 },
  sliderValue: { fontSize: 13, color: '#666', marginTop: 8, textAlign: 'center' },
  pillScroll: { marginBottom: 4 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    marginRight: 8,
    marginBottom: 4,
  },
  pillActive: { backgroundColor: '#FF3B30', borderColor: '#FF3B30' },
  pillText: { fontSize: 14, color: '#888' },
  pillTextActive: { color: '#fff', fontWeight: '600' },
  startBtn: {
    backgroundColor: '#FF3B30',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 32,
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  startBtnDisabled: { opacity: 0.4 },
  startBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});

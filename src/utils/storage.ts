import AsyncStorage from '@react-native-async-storage/async-storage';

const WORDS_PER_MINUTE = 130;
const MIN_SEGMENT_MS = 2000;

export function estimateSegmentDurationMs(text: string): number {
  const words = text.trim().split(/\s+/).length;
  return Math.max(MIN_SEGMENT_MS, (words / WORDS_PER_MINUTE) * 60 * 1000 + 1000);
}

export interface Segment {
  id: string;
  text: string;
  estimatedDurationMs: number;
  videoUri?: string;
  duration?: number;
}

export interface Session {
  id: string;
  title: string;
  script: string;
  segments: Segment[];
  createdAt: number;
  segmentLength: number;
  voice: string;
}

const SESSIONS_KEY = 'ram_sessions';

export async function getSessions(): Promise<Session[]> {
  const raw = await AsyncStorage.getItem(SESSIONS_KEY);
  if (!raw) return [];
  return JSON.parse(raw);
}

export async function saveSession(session: Session): Promise<void> {
  const sessions = await getSessions();
  const idx = sessions.findIndex((s) => s.id === session.id);
  if (idx >= 0) sessions[idx] = session;
  else sessions.unshift(session);
  await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}

export async function deleteSession(id: string): Promise<void> {
  const sessions = await getSessions();
  await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions.filter((s) => s.id !== id)));
}

// Break a single string into pieces no longer than maxLen, splitting at
// the provided separator pattern. Returns the original string in an array
// if it is already short enough.
function breakAt(text: string, maxLen: number, sep: RegExp): string[] {
  if (text.length <= maxLen) return [text];
  const parts = text.split(sep).map((p) => p.trim()).filter(Boolean);
  const result: string[] = [];
  let current = '';
  for (const part of parts) {
    const candidate = current ? current + ' ' + part : part;
    if (candidate.length > maxLen && current) {
      result.push(current);
      current = part;
    } else {
      current = candidate;
    }
  }
  if (current) result.push(current);
  return result;
}

export function splitIntoSegments(script: string, segmentLength: number): string[] {
  // 1. Split into sentences.
  const sentences = (script.match(/[^.!?]+[.!?]*/g) || [script]).map((s) => s.trim()).filter(Boolean);

  // 2. For any sentence longer than segmentLength, break further at clauses
  //    (commas / semicolons / colons), then at words.
  const atoms: string[] = [];
  for (const sentence of sentences) {
    if (sentence.length <= segmentLength) {
      atoms.push(sentence);
      continue;
    }
    const clauses = breakAt(sentence, segmentLength, /[,;:]\s*/);
    for (const clause of clauses) {
      if (clause.length <= segmentLength) {
        atoms.push(clause);
      } else {
        // Last resort: split at word boundaries.
        const byWord = breakAt(clause, segmentLength, /\s+/);
        atoms.push(...byWord);
      }
    }
  }

  // 3. Greedily combine consecutive atoms into segments up to segmentLength.
  const segments: string[] = [];
  let current = '';
  for (const atom of atoms) {
    const candidate = current ? current + ' ' + atom : atom;
    if (candidate.length > segmentLength && current) {
      segments.push(current);
      current = atom;
    } else {
      current = candidate;
    }
  }
  if (current) segments.push(current);
  return segments;
}

export function generateTitle(script: string): string {
  const words = script.trim().split(/\s+/);
  let title = '';
  for (const word of words) {
    if ((title + ' ' + word).trim().length <= 30) {
      title = (title + ' ' + word).trim();
    } else break;
  }
  return title || script.slice(0, 30);
}

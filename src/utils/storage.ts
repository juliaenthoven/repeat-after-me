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


export function splitIntoSegments(script: string): string[] {
  return (script.match(/[^.!?]+[.!?]*/g) || [script])
    .map((s) => s.trim())
    .filter(Boolean);
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

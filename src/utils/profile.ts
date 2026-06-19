import AsyncStorage from '@react-native-async-storage/async-storage';

export type SocialPlatform = 'tiktok' | 'linkedin' | 'youtube' | 'facebook' | 'instagram';

export interface SocialProfile {
  platform: SocialPlatform;
  url: string;
}

export const PLATFORM_META: Record<SocialPlatform, { label: string; bg: string; textColor: string; symbol: string }> = {
  tiktok:    { label: 'TikTok',    bg: '#010101', textColor: '#fff',    symbol: 'Tt' },
  linkedin:  { label: 'LinkedIn',  bg: '#0077B5', textColor: '#fff',    symbol: 'in' },
  youtube:   { label: 'YouTube',   bg: '#FF0000', textColor: '#fff',    symbol: '▶'  },
  facebook:  { label: 'Facebook',  bg: '#1877F2', textColor: '#fff',    symbol: 'f'  },
  instagram: { label: 'Instagram', bg: '#C13584', textColor: '#fff',    symbol: '✦'  },
};

export function detectPlatform(url: string): SocialPlatform | null {
  const u = url.toLowerCase();
  if (u.includes('tiktok.com'))                          return 'tiktok';
  if (u.includes('linkedin.com'))                        return 'linkedin';
  if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube';
  if (u.includes('facebook.com') || u.includes('fb.com')) return 'facebook';
  if (u.includes('instagram.com'))                       return 'instagram';
  return null;
}

export interface UserProfile {
  firstName: string;
  lastName: string;
  email: string;
  plan: 'Free' | 'Pro';
  avatarUri?: string;
  socialProfiles?: SocialProfile[];
}

const PROFILE_KEY = 'ram_profile';

const DEFAULT_PROFILE: UserProfile = {
  firstName: 'Julia',
  lastName: 'Enthoven',
  email: 'julia@kapwing.com',
  plan: 'Free',
};

export async function getProfile(): Promise<UserProfile> {
  const raw = await AsyncStorage.getItem(PROFILE_KEY);
  if (!raw) return DEFAULT_PROFILE;
  return { ...DEFAULT_PROFILE, ...JSON.parse(raw) };
}

export async function saveProfile(profile: UserProfile): Promise<void> {
  await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export function getInitials(profile: UserProfile): string {
  return `${profile.firstName.charAt(0)}${profile.lastName.charAt(0)}`.toUpperCase();
}

import AsyncStorage from '@react-native-async-storage/async-storage';

export interface UserProfile {
  firstName: string;
  lastName: string;
  email: string;
  plan: 'Free' | 'Pro';
  avatarUri?: string;
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

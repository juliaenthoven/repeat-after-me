import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Image,
} from 'react-native';
import { useFocusEffect } from '../hooks/useFocusEffect';
import { getSessions, Session } from '../utils/storage';
import { getProfile, getInitials, UserProfile } from '../utils/profile';
import ProfileOverlay from './ProfileOverlay';

interface Props {
  onNewRecording: () => void;
  onSession: (session: Session) => void;
}

function SessionCard({ session, onPress }: { session: Session; onPress: () => void }) {
  const date = new Date(session.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const recorded = session.segments.filter((s) => s.videoUri).length;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle} numberOfLines={1}>{session.title}</Text>
        <Text style={styles.cardDate}>{date}</Text>
      </View>
      <View style={styles.cardFooter}>
        {recorded === 0 ? (
          <Text style={styles.cardNoFootage}>No footage recorded</Text>
        ) : (
          <Text style={styles.cardClips}>{recorded} clip{recorded !== 1 ? 's' : ''} recorded</Text>
        )}
        <View style={styles.cardSegmentPills}>
          {session.segments.slice(0, 5).map((seg) => (
            <View
              key={seg.id}
              style={[styles.segPill, seg.videoUri ? styles.segPillDone : styles.segPillEmpty]}
            />
          ))}
          {session.segments.length > 5 && (
            <Text style={styles.morePills}>+{session.segments.length - 5}</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

function AvatarButton({ profile, onPress }: { profile: UserProfile; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.avatarBtn}>
      {profile.avatarUri ? (
        <Image source={{ uri: profile.avatarUri }} style={styles.avatarImg} />
      ) : (
        <View style={styles.avatarInitials}>
          <Text style={styles.avatarInitialsText}>{getInitials(profile)}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function HomeScreen({ onNewRecording, onSession }: Props) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [profile, setProfile] = useState<UserProfile>({
    firstName: 'Julia',
    lastName: 'Enthoven',
    email: 'julia@kapwing.com',
    plan: 'Free',
  });
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    getProfile().then(setProfile);
  }, []);

  useFocusEffect(
    useCallback(() => {
      getSessions().then(setSessions);
    }, [])
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.logo}>🦜</Text>
          <Text style={styles.appTitle}>Repeat After Me</Text>
          <Text style={styles.subtitle}>Audio Teleprompter</Text>
        </View>
        <AvatarButton profile={profile} onPress={() => setProfileOpen(true)} />
      </View>

      <TouchableOpacity style={styles.newButton} onPress={onNewRecording} activeOpacity={0.85}>
        <Text style={styles.newButtonIcon}>+</Text>
        <Text style={styles.newButtonText}>New Recording</Text>
      </TouchableOpacity>

      {sessions.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🎬</Text>
          <Text style={styles.emptyTitle}>No recordings yet</Text>
          <Text style={styles.emptyText}>Tap "New Recording" to get started</Text>
        </View>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(s) => s.id}
          renderItem={({ item }) => (
            <SessionCard session={item} onPress={() => onSession(item)} />
          )}
          contentContainerStyle={styles.list}
        />
      )}

      <ProfileOverlay
        visible={profileOpen}
        profile={profile}
        onClose={() => setProfileOpen(false)}
        onProfileChange={setProfile}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  logo: { fontSize: 48, marginBottom: 4 },
  appTitle: { fontSize: 28, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: '#888', marginTop: 2 },
  avatarBtn: {
    marginTop: 8,
  },
  avatarInitials: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitialsText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  avatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF3B30',
    marginHorizontal: 20,
    marginVertical: 16,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 20,
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  newButtonIcon: { fontSize: 22, color: '#fff', marginRight: 10, fontWeight: '700' },
  newButtonText: { fontSize: 17, fontWeight: '700', color: '#fff' },
  list: { paddingHorizontal: 20, paddingBottom: 32 },
  card: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#fff', flex: 1, marginRight: 8 },
  cardDate: { fontSize: 13, color: '#666' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  cardNoFootage: { fontSize: 13, color: '#555' },
  cardClips: { fontSize: 13, color: '#aaa' },
  cardSegmentPills: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  segPill: { width: 20, height: 6, borderRadius: 3 },
  segPillDone: { backgroundColor: '#FF3B30' },
  segPillEmpty: { backgroundColor: '#333' },
  morePills: { fontSize: 11, color: '#666' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80 },
  emptyIcon: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 8 },
  emptyText: { fontSize: 15, color: '#666', textAlign: 'center' },
});

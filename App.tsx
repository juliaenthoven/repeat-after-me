import React, { useState, Component, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, LogBox } from 'react-native';

LogBox.ignoreLogs(['[expo-av]: Expo AV has been deprecated']);
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AuthScreen from './src/screens/AuthScreen';
import HomeScreen from './src/screens/HomeScreen';
import NewRecordingScreen from './src/screens/NewRecordingScreen';
import RecordingScreen from './src/screens/RecordingScreen';
import SessionOverviewScreen from './src/screens/SessionOverviewScreen';
import { Session } from './src/utils/storage';

const AUTH_KEY = 'ram_signed_in';

type Screen = 'home' | 'new' | 'recording' | 'overview';

// ── Error toast ──────────────────────────────────────────────────────────────

function ErrorToast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  const opacity = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.delay(3500),
      Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start(onDismiss);
  }, []);

  return (
    <Animated.View style={[toastStyles.toast, { opacity }]} pointerEvents="none">
      <Text style={toastStyles.icon}>⚠️</Text>
      <Text style={toastStyles.text} numberOfLines={3}>{message}</Text>
    </Animated.View>
  );
}

const toastStyles = StyleSheet.create({
  toast: {
    position: 'absolute',
    bottom: 60,
    left: 20,
    right: 20,
    backgroundColor: '#1c1c1e',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: 1,
    borderColor: '#FF3B30',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    zIndex: 999,
  },
  icon: { fontSize: 18 },
  text: { color: '#fff', fontSize: 14, lineHeight: 20, flex: 1 },
});

// ── Error boundary ────────────────────────────────────────────────────────────

interface BoundaryProps {
  onError: (msg: string) => void;
  children: React.ReactNode;
  resetKey: string;
}
interface BoundaryState { hasError: boolean }

class ErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { hasError: false };

  static getDerivedStateFromError(): BoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    this.props.onError(error.message || 'Something went wrong.');
  }

  componentDidUpdate(prev: BoundaryProps) {
    if (prev.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null); // null = loading
  const [screen, setScreen] = useState<Screen>('home');
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastKey, setToastKey] = useState(0);

  useEffect(() => {
    AsyncStorage.getItem(AUTH_KEY).then((val) => setSignedIn(val === 'true'));
  }, []);

  const handleSignIn = async () => {
    await AsyncStorage.setItem(AUTH_KEY, 'true');
    setSignedIn(true);
  };

  const showError = (msg: string) => {
    setToastMessage(msg);
    setToastKey((k) => k + 1);
    setScreen('home');
  };

  // Still checking AsyncStorage
  if (signedIn === null) {
    return (
      <SafeAreaProvider>
        <StatusBar style="light" />
        <View style={{ flex: 1, backgroundColor: '#0a0a0a' }} />
      </SafeAreaProvider>
    );
  }

  if (!signedIn) {
    return (
      <SafeAreaProvider>
        <StatusBar style="light" />
        <AuthScreen onSignIn={handleSignIn} />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <ErrorBoundary onError={showError} resetKey={screen}>
        {screen === 'home' && (
          <HomeScreen
            onNewRecording={() => setScreen('new')}
            onSession={(s) => {
              setActiveSession(s);
              setScreen('overview');
            }}
          />
        )}
        {screen === 'new' && (
          <NewRecordingScreen
            onBack={() => setScreen('home')}
            onStart={(session) => {
              setActiveSession(session);
              setScreen('recording');
            }}
          />
        )}
        {screen === 'recording' && activeSession && (
          <RecordingScreen
            session={activeSession}
            onFinish={(session) => {
              setActiveSession(session);
              setScreen('overview');
            }}
            onBack={() => setScreen('home')}
            onError={showError}
          />
        )}
        {screen === 'overview' && activeSession && (
          <SessionOverviewScreen
            session={activeSession}
            onBack={() => setScreen('home')}
            onReRecord={(session) => {
              setActiveSession(session);
              setScreen('recording');
            }}
            onDeleted={() => setScreen('home')}
            onError={showError}
          />
        )}
      </ErrorBoundary>

      {toastMessage && (
        <ErrorToast
          key={toastKey}
          message={toastMessage}
          onDismiss={() => setToastMessage(null)}
        />
      )}
    </SafeAreaProvider>
  );
}

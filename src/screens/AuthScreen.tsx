import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface Props {
  onSignIn: () => void;
}

type Provider = 'google' | 'apple' | 'email' | null;

export default function AuthScreen({ onSignIn }: Props) {
  const [loading, setLoading] = useState<Provider>(null);

  const handleSignIn = (provider: Provider) => {
    setLoading(provider);
    // Prototype: no real auth — proceed immediately
    setTimeout(() => {
      setLoading(null);
      onSignIn();
    }, 600);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Branding */}
      <View style={styles.brandArea}>
        <Text style={styles.logo}>🦜</Text>
        <Text style={styles.appName}>Repeat After Me</Text>
        <Text style={styles.tagline}>Your AI-powered audio teleprompter</Text>
      </View>

      {/* Auth buttons */}
      <View style={styles.authArea}>
        <Text style={styles.signInLabel}>Sign in to continue</Text>

        {/* Google */}
        <TouchableOpacity
          style={[styles.providerBtn, styles.googleBtn]}
          onPress={() => handleSignIn('google')}
          activeOpacity={0.85}
          disabled={loading !== null}
        >
          {loading === 'google' ? (
            <ActivityIndicator color="#111" size="small" />
          ) : (
            <>
              <Text style={styles.googleIcon}>G</Text>
              <Text style={styles.googleBtnText}>Sign in with Google</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Apple */}
        <TouchableOpacity
          style={[styles.providerBtn, styles.appleBtn]}
          onPress={() => handleSignIn('apple')}
          activeOpacity={0.85}
          disabled={loading !== null}
        >
          {loading === 'apple' ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Text style={styles.appleIcon}></Text>
              <Text style={styles.appleBtnText}>Sign in with Apple</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Email */}
        <TouchableOpacity
          style={[styles.providerBtn, styles.emailBtn]}
          onPress={() => handleSignIn('email')}
          activeOpacity={0.85}
          disabled={loading !== null}
        >
          {loading === 'email' ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Text style={styles.emailIcon}>✉</Text>
              <Text style={styles.emailBtnText}>Sign in with Email</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          By signing in you agree to our Terms of Service and Privacy Policy.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    justifyContent: 'space-between',
    paddingBottom: 24,
  },
  brandArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  logo: {
    fontSize: 80,
    marginBottom: 20,
  },
  appName: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  tagline: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  authArea: {
    paddingHorizontal: 24,
    gap: 12,
  },
  signInLabel: {
    color: '#888',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: 4,
  },
  providerBtn: {
    height: 54,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  // Google
  googleBtn: {
    backgroundColor: '#fff',
  },
  googleIcon: {
    fontSize: 18,
    fontWeight: '800',
    color: '#4285F4',
    width: 22,
    textAlign: 'center',
  },
  googleBtnText: {
    color: '#111',
    fontSize: 16,
    fontWeight: '600',
  },
  // Apple
  appleBtn: {
    backgroundColor: '#fff',
  },
  appleIcon: {
    fontSize: 20,
    color: '#111',
    width: 22,
    textAlign: 'center',
    lineHeight: 22,
  },
  appleBtnText: {
    color: '#111',
    fontSize: 16,
    fontWeight: '600',
  },
  // Email
  emailBtn: {
    backgroundColor: '#1e1e1e',
    borderWidth: 1,
    borderColor: '#333',
  },
  emailIcon: {
    fontSize: 16,
    color: '#fff',
    width: 22,
    textAlign: 'center',
  },
  emailBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  disclaimer: {
    color: '#444',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 8,
  },
});

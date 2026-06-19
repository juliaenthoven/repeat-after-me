import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  ScrollView,
} from 'react-native';

// Placeholder Stripe checkout URL — swap for a real Payment Link when ready
const STRIPE_URL = 'https://buy.stripe.com/repeatafterme-pro';

const PRO_FEATURES = [
  { icon: '✨', text: 'AI script generation from an idea or prompt' },
  { icon: '🎙', text: 'Upload a ramble — we transcribe & polish it' },
  { icon: '🔗', text: 'Import & adapt scripts from reference videos' },
  { icon: '✂️', text: 'Auto-Edit preview with silence trimming' },
  { icon: '↗', text: 'Save & share your recorded clips' },
];

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function PaywallModal({ visible, onClose }: Props) {
  const handleUpgrade = () => {
    Linking.openURL(STRIPE_URL).catch(() => {});
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {/* Close button */}
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>

          {/* Header */}
          <Text style={styles.badge}>⭐ PRO</Text>
          <Text style={styles.headline}>Unlock Pro</Text>
          <Text style={styles.sub}>Everything you need to create polished social media videos — once, forever.</Text>

          {/* Price */}
          <View style={styles.priceRow}>
            <Text style={styles.price}>$100</Text>
            <View style={styles.priceDetails}>
              <Text style={styles.priceLabel}>Lifetime</Text>
              <Text style={styles.priceNote}>One-time payment · No subscription</Text>
            </View>
          </View>

          {/* Feature list */}
          <View style={styles.features}>
            {PRO_FEATURES.map((f, i) => (
              <View key={i} style={styles.featureRow}>
                <Text style={styles.featureIcon}>{f.icon}</Text>
                <Text style={styles.featureText}>{f.text}</Text>
              </View>
            ))}
          </View>

          {/* CTA */}
          <TouchableOpacity style={styles.upgradeBtn} onPress={handleUpgrade} activeOpacity={0.88}>
            <Text style={styles.upgradeBtnText}>Upgrade to Pro →</Text>
          </TouchableOpacity>

          <Text style={styles.footer}>Secure checkout · Instant access</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: '#161616',
    borderRadius: 24,
    padding: 28,
    width: '100%',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 18,
    zIndex: 10,
  },
  closeBtnText: {
    color: '#666',
    fontSize: 18,
    fontWeight: '400',
  },

  badge: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFD60A',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  headline: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  sub: {
    fontSize: 14,
    color: '#777',
    lineHeight: 20,
    marginBottom: 22,
  },

  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f1f1f',
    borderRadius: 14,
    padding: 16,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: '#2e2e2e',
    gap: 14,
  },
  price: {
    fontSize: 36,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -1,
  },
  priceDetails: { flex: 1 },
  priceLabel: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 2 },
  priceNote: { fontSize: 12, color: '#666' },

  features: {
    gap: 12,
    marginBottom: 24,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  featureIcon: { fontSize: 16, marginTop: 1, width: 20, textAlign: 'center' },
  featureText: { fontSize: 14, color: '#ccc', flex: 1, lineHeight: 20 },

  upgradeBtn: {
    backgroundColor: '#FF3B30',
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
  },
  upgradeBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  footer: {
    textAlign: 'center',
    fontSize: 12,
    color: '#555',
  },
});

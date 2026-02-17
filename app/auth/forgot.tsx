import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const { isDark } = useTheme();
  const router = useRouter();

  // Web-based password reset for Expo Go (no deep linking needed)
  // Uses GitHub Pages URL: https://jaykeerthi04.github.io/password-reset-page/
  // This URL must be configured in Supabase Dashboard > Authentication > URL Configuration > Redirect URLs
  const RESET_REDIRECT_URL = process.env.EXPO_PUBLIC_SUPABASE_REDIRECT_URL || 
    'https://jaykeerthi04.github.io/password-reset-page/';

  

  const validateEmail = (value: string) => {
    const trimmed = value.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return { valid: emailRegex.test(trimmed), trimmed };
  };

  

  const sendPasswordReset = async (rawEmail: string) => {
    const { valid, trimmed } = validateEmail(rawEmail);
    if (!valid) {
      setError('Please enter a valid email');
      Alert.alert('Invalid email', 'Please enter a valid email address.');
      return;
    }

    const redirectTo = RESET_REDIRECT_URL;

    setLoading(true);
    setError('');
    setInfo('');
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(trimmed, { redirectTo });
      if (error) throw error;
      const msg = 'If this email is registered, a password reset link has been sent.';
      setInfo(msg);
      Alert.alert('Email sent', msg);
    } catch (err: any) {
      const msg = err?.message || 'Failed to send reset email';
      setError(msg);
      console.error('resetPasswordForEmail error:', err);
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.container, isDark && { backgroundColor: '#0B1220' }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={[styles.title, isDark && { color: '#F3F4F6' }]}>Forgot Password</Text>
          <Text style={[styles.subtitle, isDark && { color: '#9CA3AF' }]}>Enter your email to receive a reset link.</Text>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {info ? <Text style={styles.info}>{info}</Text> : null}

        <TextInput
          style={[styles.input, isDark && { backgroundColor: '#0F172A', borderColor: '#1F2937', color: '#F3F4F6' }]}
          placeholder="Email"
          placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          editable={!loading}
        />
        <TouchableOpacity style={[styles.buttonAlt, loading && styles.buttonDisabled]} onPress={() => sendPasswordReset(email)} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonAltText}>Send reset link</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()} style={styles.linkContainer}>
          <Text style={[styles.link, isDark && { color: '#60A5FA' }]}>Back to Sign In</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  header: { alignItems: 'center', marginBottom: 24 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#1C1C1E' },
  subtitle: { fontSize: 14, color: '#8E8E93', marginTop: 8, textAlign: 'center' },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12, padding: 16, fontSize: 16, marginBottom: 16, color: '#111827' },
  buttonDisabled: { opacity: 0.6 },
  buttonAlt: { backgroundColor: '#111827', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 10 },
  buttonAltText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  linkContainer: { alignItems: 'center', marginTop: 16 },
  link: { color: '#007AFF', fontSize: 14, fontWeight: '600' },
  error: { backgroundColor: '#FFEBEE', color: '#C62828', padding: 12, borderRadius: 8, marginBottom: 16, textAlign: 'center' },
  info: { backgroundColor: '#E8F5E9', color: '#2E7D32', padding: 12, borderRadius: 8, marginBottom: 16, textAlign: 'center' },
});

import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert } from 'react-native';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import { useRouter } from 'expo-router';

export default function ResetPassword() {
  const { isDark } = useTheme();
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [ready, setReady] = useState(false);

  const parseParams = (urlStr: string) => {
    const out: Record<string, string> = {};
    if (!urlStr) return out;
    
    // Handle both query params and hash fragments
    const [baseAndQuery, hash] = urlStr.split('#');
    const query = baseAndQuery.split('?')[1] || '';
    
    const collect = (s: string) => {
      if (!s) return;
      s.split('&').forEach((kv) => {
        if (!kv) return;
        const [k, v] = kv.split('=');
        if (k) {
          try {
            out[decodeURIComponent(k)] = decodeURIComponent(v || '');
          } catch (e) {
            // If decoding fails, use raw value
            out[k] = v || '';
          }
        }
      });
    };
    
    collect(query);
    if (hash) collect(hash);
    return out;
  };

  const handleUrl = async (url?: string | null) => {
    try {
      if (url) {
        // Check if this is a recovery/reset URL (HTTPS or custom scheme)
        const isRecoveryUrl = url.includes('type=recovery') || 
                             url.includes('/reset') || 
                             url.includes('/auth/reset') ||
                             url.includes('recovery');
        
        if (isRecoveryUrl) {
          const params = parseParams(url);
          const access_token = params['access_token'];
          const refresh_token = params['refresh_token'];
          const code = params['code'];
          const token = params['token'];
          const type = params['type'];
          
          // Try access_token and refresh_token first (most common)
          if (access_token && refresh_token) {
            const { error } = await supabase.auth.setSession({ 
              access_token, 
              refresh_token 
            });
            if (error) throw error;
            setError('');
            setReady(true);
            return true;
          }
          
          // Try code exchange (PKCE flow)
          if (code) {
            const { error } = await supabase.auth.exchangeCodeForSession(code);
            if (error) throw error;
            setError('');
            setReady(true);
            return true;
          }
          
          // Try OTP token (alternative flow)
          if (token && type === 'recovery') {
            const { error } = await supabase.auth.verifyOtp({ 
              type: 'recovery', 
              token_hash: token 
            });
            if (error) throw error;
            const { data } = await supabase.auth.getSession();
            if (!data.session) throw new Error('No session after recovery verification');
            setError('');
            setReady(true);
            return true;
          }
        }
      }
      
      // Check if we already have a valid session
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setReady(true);
        setError('');
        return true;
      }
      
      setReady(false);
      return false;
    } catch (e: any) {
      console.error('Error handling URL in reset screen:', e);
      setReady(false);
      setError(e?.message || 'Failed to process reset link');
      return false;
    }
  };

  useEffect(() => {
    let isMounted = true;

    Linking.getInitialURL().then((u) => {
      if (isMounted) handleUrl(u);
    });
    const sub = Linking.addEventListener('url', ({ url }) => {
      if (isMounted) handleUrl(url);
    });
    return () => {
      isMounted = false;
      sub.remove();
    };
  }, []);

  const handleReset = async () => {
    if (!ready) {
      setLoading(true);
      await Linking.getInitialURL().then((u) => handleUrl(u));
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setLoading(false);
        setInfo('Open the latest reset link from your email to continue.');
        return;
      }
      setLoading(false);
    }
    if (!password || !confirm) {
      const msg = 'Please fill in both fields';
      setError(msg);
      Alert.alert('Missing fields', msg);
      return;
    }
    if (password.length < 6) {
      const msg = 'Password must be at least 6 characters';
      setError(msg);
      Alert.alert('Weak password', msg);
      return;
    }
    if (password !== confirm) {
      const msg = 'Passwords do not match';
      setError(msg);
      Alert.alert('Mismatch', msg);
      return;
    }

    setLoading(true);
    setError('');
    setInfo('');

    try {
      const { data, error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setInfo('Password updated. You can now sign in with your new password.');
      setTimeout(() => router.replace('/auth/login'), 1200);
    } catch (err: any) {
      const msg = err?.message || 'Failed to update password';
      setError(msg);
      Alert.alert('Update failed', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.container, isDark && { backgroundColor: '#0B1220' }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={[styles.title, isDark && { color: '#F3F4F6' }]}>Reset Password</Text>
          <Text style={[styles.subtitle, isDark && { color: '#9CA3AF' }]}>Enter your new password below.</Text>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {info ? <Text style={styles.info}>{info}</Text> : null}
        
        {!ready && !loading && (
          <View style={styles.waitingContainer}>
            <Text style={[styles.waitingText, isDark && { color: '#9CA3AF' }]}>
              Waiting for reset link...
            </Text>
            <Text style={[styles.waitingSubtext, isDark && { color: '#6B7280' }]}>
              Please click the password reset link from your email to continue.
            </Text>
          </View>
        )}

        <TextInput
          style={[styles.input, isDark && { backgroundColor: '#0F172A', borderColor: '#1F2937', color: '#F3F4F6' }]}
          placeholder="New Password"
          placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          editable={!loading}
        />

        <TextInput
          style={[styles.input, isDark && { backgroundColor: '#0F172A', borderColor: '#1F2937', color: '#F3F4F6' }]}
          placeholder="Confirm Password"
          placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
          editable={!loading}
        />

        <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleReset} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Update Password</Text>}
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
  button: { backgroundColor: '#007AFF', borderRadius: 12, padding: 16, alignItems: 'center' },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  error: { backgroundColor: '#FFEBEE', color: '#C62828', padding: 12, borderRadius: 8, marginBottom: 16, textAlign: 'center' },
  info: { backgroundColor: '#E8F5E9', color: '#2E7D32', padding: 12, borderRadius: 8, marginBottom: 16, textAlign: 'center' },
  waitingContainer: { alignItems: 'center', marginTop: 20, marginBottom: 20 },
  waitingText: { fontSize: 16, fontWeight: '600', color: '#374151', marginBottom: 8 },
  waitingSubtext: { fontSize: 14, color: '#6B7280', textAlign: 'center', paddingHorizontal: 20 },
});

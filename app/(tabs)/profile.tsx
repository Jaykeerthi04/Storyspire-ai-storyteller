import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Switch,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { AudienceMode } from '@/types/database';
import { User, Mail, LogOut, Save, BookOpen } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

export default function Profile() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const router = useRouter();
  const { isDark } = useTheme();
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [preferredMode, setPreferredMode] = useState<AudienceMode>(
    profile?.preferred_mode || 'adult'
  );
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSave = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          preferred_mode: preferredMode,
        })
        .eq('id', user!.id);

      if (updateError) throw updateError;

      await refreshProfile();
      setSuccess('Profile updated successfully');
      setEditing(false);
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace('/auth/login');
      if (Platform.OS === 'web') {
        // Ensure web clears any cached state and reflects signed-out UI
        setTimeout(() => {
          if (typeof window !== 'undefined' && window.location) {
            window.location.reload();
          }
        }, 50);
      }
    } catch (err) {
      console.error('Error signing out:', err);
    }
  };

  const togglePreferredMode = () => {
    setPreferredMode((prev) => (prev === 'child' ? 'adult' : 'child'));
  };

  return (
    <ScrollView style={[styles.container, isDark && { backgroundColor: '#0B1220' }]}>
      <View style={[styles.header, isDark && { backgroundColor: '#0F172A', borderBottomColor: '#1F2937' }]}>
        <View style={[styles.avatarContainer, isDark && { backgroundColor: '#1E3A5F' }]}>
          <User size={48} color={isDark ? '#60A5FA' : '#007AFF'} />
        </View>
        <Text style={[styles.title, isDark && { color: '#F3F4F6' }]}>Profile</Text>
      </View>

      <View style={[styles.section, isDark && { backgroundColor: '#0F172A' }]}>
        <Text style={[styles.sectionTitle, isDark && { color: '#F3F4F6' }]}>Account Information</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {success ? <Text style={styles.success}>{success}</Text> : null}

        <View style={styles.field}>
          <View style={styles.fieldLabel}>
            <Mail size={20} color={isDark ? '#9CA3AF' : '#8E8E93'} />
            <Text style={[styles.fieldLabelText, isDark && { color: '#9CA3AF' }]}>Email</Text>
          </View>
          <Text style={[styles.fieldValue, isDark && { color: '#F3F4F6' }]}>{profile?.email}</Text>
        </View>

        <View style={styles.field}>
          <View style={styles.fieldLabel}>
            <User size={20} color={isDark ? '#9CA3AF' : '#8E8E93'} />
            <Text style={[styles.fieldLabelText, isDark && { color: '#9CA3AF' }]}>Full Name</Text>
          </View>
          {editing ? (
            <TextInput
              style={[styles.input, isDark && { backgroundColor: '#1E293B', borderColor: '#334155', color: '#F3F4F6' }]}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Enter your full name"
              placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'}
            />
          ) : (
            <Text style={[styles.fieldValue, isDark && { color: '#F3F4F6' }]}>{profile?.full_name || 'Not set'}</Text>
          )}
        </View>

        <View style={styles.field}>
          <View style={styles.fieldLabel}>
            <BookOpen size={20} color={isDark ? '#9CA3AF' : '#8E8E93'} />
            <Text style={[styles.fieldLabelText, isDark && { color: '#9CA3AF' }]}>Preferred Story Mode</Text>
          </View>
          {editing ? (
            <View style={[styles.modeSelector, isDark && { backgroundColor: '#1E293B' }]}>
              <Text style={[styles.modeText, isDark && { color: '#F3F4F6' }]}>
                {preferredMode === 'child' ? 'Child Mode' : 'Adult Mode'}
              </Text>
              <Switch
                value={preferredMode === 'adult'}
                onValueChange={togglePreferredMode}
                trackColor={{ false: '#34C759', true: isDark ? '#60A5FA' : '#007AFF' }}
                thumbColor="#fff"
              />
            </View>
          ) : (
            <View style={[styles.badge, isDark && { backgroundColor: '#1E3A5F' }]}>
              <Text style={[styles.badgeText, isDark && { color: '#60A5FA' }]}>
                {profile?.preferred_mode === 'child' ? 'Child Mode' : 'Adult Mode'}
              </Text>
            </View>
          )}
        </View>

        {editing ? (
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={() => {
                setEditing(false);
                setFullName(profile?.full_name || '');
                setPreferredMode(profile?.preferred_mode || 'adult');
                setError('');
                setSuccess('');
              }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.saveButton, loading && styles.buttonDisabled]}
              onPress={handleSave}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Save size={20} color="#fff" />
                  <Text style={styles.saveButtonText}>Save</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.button, styles.editButton]}
            onPress={() => setEditing(true)}
          >
            <Text style={styles.editButtonText}>Edit Profile</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={[styles.section, isDark && { backgroundColor: '#0F172A' }]}>
        <Text style={[styles.sectionTitle, isDark && { color: '#F3F4F6' }]}>Account Created</Text>
        <Text style={[styles.dateText, isDark && { color: '#9CA3AF' }]}>
          {profile?.created_at
            ? new Date(profile.created_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })
            : 'Unknown'}
        </Text>
      </View>

      <TouchableOpacity style={[styles.signOutButton, isDark && { backgroundColor: '#0F172A' }]} onPress={handleSignOut}>
        <LogOut size={20} color="#FF3B30" />
        <Text style={[styles.signOutButtonText, isDark && { color: '#FF6B66' }]}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    alignItems: 'center',
    paddingTop: 56,
    paddingBottom: 24,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1C1C1E',
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 16,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 16,
  },
  field: {
    marginBottom: 20,
  },
  fieldLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  fieldLabelText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8E8E93',
  },
  fieldValue: {
    fontSize: 16,
    color: '#1C1C1E',
  },
  input: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  modeSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
  },
  modeText: {
    fontSize: 16,
    color: '#1C1C1E',
  },
  badge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1976D2',
  },
  error: {
    backgroundColor: '#FFEBEE',
    color: '#C62828',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    textAlign: 'center',
  },
  success: {
    backgroundColor: '#E8F5E9',
    color: '#2E7D32',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  editButton: {
    backgroundColor: '#007AFF',
  },
  editButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#34C759',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: '#8E8E93',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  dateText: {
    fontSize: 16,
    color: '#8E8E93',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fff',
    marginTop: 16,
    marginHorizontal: 16,
    marginBottom: 32,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  signOutButtonText: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: '600',
  },
});

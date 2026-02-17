import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { TouchableOpacity } from 'react-native';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { Moon, Sun } from 'lucide-react-native';

function RootContent() {
  const { isDark } = useTheme();

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen
          name="auth/login"
          options={{
            headerShown: true,
            headerTitle: '',
            headerRight: () => (
              <ThemeHeaderToggle />
            ),
            headerStyle: { backgroundColor: isDark ? '#0B1220' : '#ffffff' },
            headerTintColor: isDark ? '#F3F4F6' : '#1C1C1E',
            headerShadowVisible: false,
          }}
        />
        <Stack.Screen
          name="auth/register"
          options={{
            headerShown: true,
            headerTitle: '',
            headerRight: () => (
              <ThemeHeaderToggle />
            ),
            headerStyle: { backgroundColor: isDark ? '#0B1220' : '#ffffff' },
            headerTintColor: isDark ? '#F3F4F6' : '#1C1C1E',
            headerShadowVisible: false,
          }}
        />
        <Stack.Screen
          name="auth/forgot"
          options={{
            headerShown: true,
            headerTitle: '',
            headerRight: () => (
              <ThemeHeaderToggle />
            ),
            headerStyle: { backgroundColor: isDark ? '#0B1220' : '#ffffff' },
            headerTintColor: isDark ? '#F3F4F6' : '#1C1C1E',
            headerShadowVisible: false,
          }}
        />
        <Stack.Screen
          name="auth/reset"
          options={{
            headerShown: true,
            headerTitle: '',
            headerRight: () => (
              <ThemeHeaderToggle />
            ),
            headerStyle: { backgroundColor: isDark ? '#0B1220' : '#ffffff' },
            headerTintColor: isDark ? '#F3F4F6' : '#1C1C1E',
            headerShadowVisible: false,
          }}
        />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="story/[id]" />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </>
  );
}

function ThemeHeaderToggle() {
  const { isDark, toggleTheme } = useTheme();
  return (
    <TouchableOpacity
      onPress={toggleTheme}
      style={{
        marginRight: 16,
        padding: 8,
        borderRadius: 8,
        backgroundColor: isDark ? '#1F2937' : '#F3F4F6',
      }}
    >
      {isDark ? <Sun size={20} color="#F59E0B" /> : <Moon size={20} color="#6B7280" />}
    </TouchableOpacity>
  );
}

export default function RootLayout() {
  useFrameworkReady();

  return (
    <ThemeProvider>
      <AuthProvider>
        <RootContent />
      </AuthProvider>
    </ThemeProvider>
  );
}


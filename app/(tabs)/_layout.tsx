import { Tabs } from 'expo-router';
import { TouchableOpacity, View } from 'react-native';
import { Home, Library, User, Moon, Sun } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

export default function TabLayout() {
  const { isDark, toggleTheme } = useTheme();

  const ThemeToggle = () => (
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

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerRight: () => <ThemeToggle />,
        headerStyle: {
          backgroundColor: isDark ? '#0B1220' : '#ffffff',
        },
        headerTintColor: isDark ? '#F3F4F6' : '#1C1C1E',
        headerShadowVisible: false,
        tabBarActiveTintColor: isDark ? '#60A5FA' : '#007AFF',
        tabBarInactiveTintColor: isDark ? '#9CA3AF' : '#8E8E93',
        tabBarStyle: {
          backgroundColor: isDark ? '#0B1220' : '#ffffff',
          borderTopWidth: 1,
          borderTopColor: isDark ? '#1F2937' : '#E5E5EA',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ size, color }) => <Home size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: 'My Library',
          tabBarIcon: ({ size, color }) => <Library size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ size, color }) => <User size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}

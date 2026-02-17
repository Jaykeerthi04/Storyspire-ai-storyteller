import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Story } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { BookOpen, Heart, Clock } from 'lucide-react-native';

export default function Library() {
  const { user } = useAuth();
  const router = useRouter();
  const { isDark } = useTheme();
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'favorites'>('all');

  useEffect(() => {
    loadStories();
  }, [filter]);

  const loadStories = async () => {
    try {
      let query = supabase
        .from('stories')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });

      if (filter === 'favorites') {
        query = query.eq('is_favorite', true);
      }

      const { data, error } = await query;

      if (error) throw error;
      setStories(data || []);
    } catch (err) {
      console.error('Error loading stories:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadStories();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const renderStory = ({ item }: { item: Story }) => (
    <TouchableOpacity
      style={[styles.storyCard, isDark && { backgroundColor: '#0F172A', shadowOpacity: 0.2 }]}
      onPress={() => router.push(`/story/${item.id}`)}
    >
      {item.image_url && (
        <Image source={{ uri: item.image_url }} style={styles.thumbnail} />
      )}
      <View style={styles.storyContent}>
        <View style={styles.storyHeader}>
          <Text style={[styles.storyTitle, isDark && { color: '#F3F4F6' }]} numberOfLines={2}>
            {item.title}
          </Text>
          {item.is_favorite && <Heart size={16} color="#FF3B30" fill="#FF3B30" />}
        </View>
        <Text style={[styles.storyExcerpt, isDark && { color: '#9CA3AF' }]} numberOfLines={2}>
          {item.content}
        </Text>
        <View style={styles.storyFooter}>
          <View style={[styles.badge, isDark && { backgroundColor: '#1E3A5F' }]}>
            <Text style={[styles.badgeText, isDark && { color: '#60A5FA' }]}>
              {item.audience_mode === 'child' ? 'Child' : 'Adult'}
            </Text>
          </View>
          <View style={styles.dateContainer}>
            <Clock size={12} color={isDark ? '#9CA3AF' : '#8E8E93'} />
            <Text style={[styles.dateText, isDark && { color: '#9CA3AF' }]}>{formatDate(item.created_at)}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={[styles.container, isDark && { backgroundColor: '#0B1220' }]}>
      <View style={[styles.header, isDark && { backgroundColor: '#0F172A', borderBottomColor: '#1F2937' }]}>
        <BookOpen size={32} color={isDark ? '#60A5FA' : '#007AFF'} />
        <Text style={[styles.title, isDark && { color: '#F3F4F6' }]}>My Library</Text>
      </View>

      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[
            styles.filterButton,
            isDark && { backgroundColor: '#0F172A', borderColor: '#1F2937' },
            filter === 'all' && (isDark ? { backgroundColor: '#1E3A5F', borderColor: '#60A5FA' } : styles.filterButtonActive),
          ]}
          onPress={() => setFilter('all')}
        >
          <Text
            style={[
              styles.filterButtonText,
              isDark && { color: '#9CA3AF' },
              filter === 'all' && (isDark ? { color: '#E5F0FF' } : styles.filterButtonTextActive),
            ]}
          >
            All Stories
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.filterButton,
            isDark && { backgroundColor: '#0F172A', borderColor: '#1F2937' },
            filter === 'favorites' && (isDark ? { backgroundColor: '#1E3A5F', borderColor: '#60A5FA' } : styles.filterButtonActive),
          ]}
          onPress={() => setFilter('favorites')}
        >
          <Text
            style={[
              styles.filterButtonText,
              isDark && { color: '#9CA3AF' },
              filter === 'favorites' && (isDark ? { color: '#E5F0FF' } : styles.filterButtonTextActive),
            ]}
          >
            Favorites
          </Text>
        </TouchableOpacity>
      </View>

      {stories.length === 0 ? (
        <View style={styles.emptyContainer}>
          <BookOpen size={64} color={isDark ? '#374151' : '#C7C7CC'} />
          <Text style={[styles.emptyTitle, isDark && { color: '#F3F4F6' }]}>No stories yet</Text>
          <Text style={[styles.emptyText, isDark && { color: '#9CA3AF' }] }>
            {filter === 'favorites'
              ? 'Mark stories as favorites to see them here'
              : 'Start creating amazing stories from the Home tab'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={stories}
          renderItem={renderStory}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1C1C1E',
  },
  filterContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  listContent: {
    padding: 16,
  },
  storyCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  thumbnail: {
    width: '100%',
    height: 150,
    resizeMode: 'cover',
  },
  storyContent: {
    padding: 16,
  },
  storyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 8,
  },
  storyTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  storyExcerpt: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 20,
    marginBottom: 12,
  },
  storyFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1976D2',
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateText: {
    fontSize: 12,
    color: '#8E8E93',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1C1C1E',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 20,
  },
});

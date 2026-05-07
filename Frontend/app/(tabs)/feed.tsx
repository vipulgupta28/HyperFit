import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { PostCard } from '@/src/components/PostCard';
import { PALETTE } from '@/src/constants/game';
import { ApiPost, api } from '@/src/services/api';
import { useUserStore } from '@/src/store/userStore';

export default function FeedScreen() {
  const user = useUserStore((s) => s.user);
  const [posts, setPosts] = useState<ApiPost[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  const loadFeed = useCallback(async (cursor?: string) => {
    const { posts: newPosts, nextCursor: next } = await api.getFeed(cursor);
    if (cursor) {
      setPosts((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        return [...prev, ...newPosts.filter((p) => !existingIds.has(p.id))];
      });
    } else {
      setPosts(newPosts);
    }
    setNextCursor(next);
  }, []);

  useEffect(() => {
    setLoading(true);
    loadFeed()
      .then(() =>
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start(),
      )
      .finally(() => setLoading(false));
  }, [loadFeed, fadeAnim]);

  useFocusEffect(
    useCallback(() => {
      loadFeed().catch(() => undefined);
    }, [loadFeed]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadFeed();
    } finally {
      setRefreshing(false);
    }
  }, [loadFeed]);

  const onEndReached = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      await loadFeed(nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, loadingMore, loadFeed]);

  const handleLike = useCallback(
    async (postId: string) => {
      if (!user) return;
      try {
        const { liked, likeCount } = await api.toggleLike(postId, user.id);
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId
              ? {
                  ...p,
                  likeCount,
                  likedBy: liked
                    ? [...p.likedBy, user.id]
                    : p.likedBy.filter((id) => id !== user.id),
                }
              : p,
          ),
        );
      } catch {
        // non-fatal
      }
    },
    [user],
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]}>
        <ActivityIndicator color={PALETTE.primary} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Feed</Text>
      </View>

      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <PostCard post={item} meUserId={user?.id} onLike={handleLike} />
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={PALETTE.primary}
            />
          }
          onEndReached={onEndReached}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator
                color={PALETTE.textDim}
                style={{ paddingVertical: 20 }}
              />
            ) : (
              <View style={{ height: 24 }} />
            )
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Text style={styles.emptyIconText}>🏃</Text>
              </View>
              <Text style={styles.emptyTitle}>No posts yet</Text>
              <Text style={styles.emptySub}>
                Complete a run and share it to see activity here.
              </Text>
            </View>
          }
          contentContainerStyle={posts.length === 0 ? styles.emptyContainer : styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: PALETTE.background },
  center: { alignItems: 'center', justifyContent: 'center' },

  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.border,
  },
  headerTitle: {
    color: PALETTE.text,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.5,
  },

  listContent: { paddingTop: 12 },
  emptyContainer: { flex: 1 },

  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingTop: 80,
    gap: 10,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: PALETTE.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyIconText: { fontSize: 30 },
  emptyTitle: {
    color: PALETTE.text,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  emptySub: {
    color: PALETTE.textDim,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});

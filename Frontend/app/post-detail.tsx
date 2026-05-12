import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { AppLoader } from '@/src/components/AppLoader';
import { Text } from '@/src/components/Text';

const { width: SCREEN_W } = Dimensions.get('window');
import MapView, { Polyline } from 'react-native-maps';

import { PALETTE } from '@/src/constants/game';
import { SOOTHING_DARK_MAP_STYLE } from '@/src/constants/mapStyle';
import { ApiComment, ApiPost, api } from '@/src/services/api';
import { useUserStore } from '@/src/store/userStore';
import { formatDistance, formatDuration, formatPace } from '@/src/utils/geo';

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function PostDetailScreen() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const router = useRouter();
  const user = useUserStore((s) => s.user);

  const [post, setPost] = useState<ApiPost | null>(null);
  const [comments, setComments] = useState<ApiComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const inputRef = useRef<TextInput>(null);

  const load = useCallback(async () => {
    if (!postId) return;
    const [{ post: p }, { comments: c }] = await Promise.all([
      api.getPost(postId),
      api.getComments(postId),
    ]);
    setPost(p);
    setComments(c);
  }, [postId]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const handleLike = async () => {
    if (!post || !user) return;
    const { liked, likeCount } = await api.toggleLike(post.id, user.id);
    setPost((p) =>
      p
        ? {
            ...p,
            likeCount,
            likedBy: liked ? [...p.likedBy, user.id] : p.likedBy.filter((id) => id !== user.id),
          }
        : p,
    );
  };

  const handleComment = async () => {
    if (!post || !user || !commentText.trim() || submitting) return;
    setSubmitting(true);
    try {
      const { comment } = await api.addComment(
        post.id,
        user.id,
        user.username,
        user.color,
        commentText.trim(),
      );
      setComments((prev) => [...prev, comment]);
      setPost((p) => (p ? { ...p, commentCount: p.commentCount + 1 } : p));
      setCommentText('');
      inputRef.current?.blur();
    } catch {
      // non-fatal
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (comment: ApiComment) => {
    if (!user || comment.userId !== user.id) return;
    try {
      await api.deleteComment(post!.id, comment.id, user.id);
      setComments((prev) => prev.filter((c) => c.id !== comment.id));
      setPost((p) => (p ? { ...p, commentCount: Math.max(0, p.commentCount - 1) } : p));
    } catch {
      // non-fatal
    }
  };

  if (loading || !post) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]}>
        {loading ? (
          <AppLoader />
        ) : (
          <>
            <Ionicons name="alert-circle-outline" size={40} color={PALETTE.textDim} />
            <Text style={styles.notFound}>Post not found</Text>
            <Pressable onPress={() => router.back()} style={styles.backBtn}>
              <Text style={styles.backBtnText}>Go Back</Text>
            </Pressable>
          </>
        )}
      </SafeAreaView>
    );
  }

  const liked = user ? post.likedBy.includes(user.id) : false;
  const modeColor = post.mode === 'run' ? PALETTE.runPrimary : PALETTE.walkPrimary;
  const pace = post.duration > 0 && post.distance > 0
    ? formatPace(post.distance, post.duration * 1000)
    : '—';

  const pathCoords = post.path.map((p) => ({ latitude: p.lat, longitude: p.lng }));
  const mapRegion = (() => {
    if (pathCoords.length === 0) return null;
    let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
    for (const c of pathCoords) {
      minLat = Math.min(minLat, c.latitude);
      maxLat = Math.max(maxLat, c.latitude);
      minLng = Math.min(minLng, c.longitude);
      maxLng = Math.max(maxLng, c.longitude);
    }
    const padLat = Math.max((maxLat - minLat) * 0.4, 0.003);
    const padLng = Math.max((maxLng - minLng) * 0.4, 0.003);
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: maxLat - minLat + padLat,
      longitudeDelta: maxLng - minLng + padLng,
    };
  })();

  const Header = (
    <View>
      {/* Back + header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backArrow} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color={PALETTE.text} />
        </Pressable>
        <View style={[styles.avatar, { backgroundColor: post.userColor }]}>
          <Text style={styles.avatarText}>{post.username.slice(0, 2).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.username}>{post.username}</Text>
          <Text style={styles.timeAgo}>{timeAgo(post.createdAt)}</Text>
        </View>
        <View style={[styles.modeBadge, { borderColor: modeColor + '50' }]}>
          <Ionicons name={post.mode === 'run' ? 'flash' : 'walk'} size={11} color={modeColor} />
          <Text style={[styles.modeBadgeText, { color: modeColor }]}>
            {post.mode === 'run' ? 'Run' : 'Walk'}
          </Text>
        </View>
      </View>

      {/* Images carousel */}
      {post.imageUris.length > 0 && (
        <View>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            bounces={false}>
            {post.imageUris.map((uri, i) => (
              <Image
                key={i}
                source={{ uri }}
                style={styles.image}
                contentFit="cover"
                transition={200}
              />
            ))}
          </ScrollView>
          {post.imageUris.length > 1 && (
            <View style={styles.imageDots}>
              {post.imageUris.map((_, i) => (
                <View key={i} style={styles.imageDot} />
              ))}
            </View>
          )}
        </View>
      )}

      {/* Description */}
      {post.description ? (
        <Text style={styles.description}>{post.description}</Text>
      ) : null}

      {/* Stats */}
      <View style={styles.statsCard}>
        <StatBox label="Distance" value={formatDistance(post.distance)} color={modeColor} />
        <View style={styles.statsDiv} />
        <StatBox label="Duration" value={formatDuration(post.duration * 1000)} color={PALETTE.text} />
        <View style={styles.statsDiv} />
        <StatBox label="Pace" value={pace} color={PALETTE.text} />
      </View>

      {/* Route map */}
      {mapRegion && pathCoords.length > 1 && (
        <View style={styles.mapCard}>
          <MapView
            style={StyleSheet.absoluteFillObject}
            initialRegion={mapRegion}
            userInterfaceStyle="dark"
            customMapStyle={Platform.OS === 'android' ? SOOTHING_DARK_MAP_STYLE : undefined}
            mapType={Platform.OS === 'ios' ? 'mutedStandard' : 'standard'}
            scrollEnabled={false}
            zoomEnabled={false}
            rotateEnabled={false}
            pitchEnabled={false}
            showsUserLocation={false}
            showsMyLocationButton={false}
            showsCompass={false}>
            <Polyline
              coordinates={pathCoords}
              strokeColor={modeColor}
              strokeWidth={4}
              lineJoin="round"
              lineCap="round"
            />
          </MapView>
        </View>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <Pressable style={styles.actionBtn} onPress={handleLike} hitSlop={8}>
          <Ionicons
            name={liked ? 'heart' : 'heart-outline'}
            size={22}
            color={liked ? '#F43F5E' : PALETTE.textDim}
          />
          {post.likeCount > 0 && (
            <Text style={[styles.actionLabel, liked && { color: '#F43F5E' }]}>
              {post.likeCount}
            </Text>
          )}
        </Pressable>
        <Pressable style={styles.actionBtn} onPress={() => inputRef.current?.focus()} hitSlop={8}>
          <Ionicons name="chatbubble-outline" size={20} color={PALETTE.textDim} />
          {post.commentCount > 0 && (
            <Text style={styles.actionLabel}>{post.commentCount}</Text>
          )}
        </Pressable>
      </View>

      {/* Comments heading */}
      <View style={styles.commentsHeader}>
        <Text style={styles.commentsTitle}>Comments</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}>
        <FlatList
          data={comments}
          keyExtractor={(c) => c.id}
          ListHeaderComponent={Header}
          renderItem={({ item }) => (
            <CommentRow
              comment={item}
              isMe={item.userId === user?.id}
              onDelete={() => handleDeleteComment(item)}
            />
          )}
          ListEmptyComponent={
            <Text style={styles.noComments}>No comments yet. Be the first!</Text>
          }
          ListFooterComponent={<View style={{ height: 20 }} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />

        {/* Comment input */}
        <View style={styles.inputBar}>
          <View style={[styles.inputAvatar, { backgroundColor: user?.color ?? PALETTE.surface }]}>
            <Text style={styles.inputAvatarText}>
              {user?.username.slice(0, 2).toUpperCase() ?? '?'}
            </Text>
          </View>
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={commentText}
            onChangeText={setCommentText}
            placeholder="Add a comment…"
            placeholderTextColor={PALETTE.textDim}
            selectionColor={PALETTE.primary}
            returnKeyType="send"
            onSubmitEditing={handleComment}
            maxLength={300}
          />
          <Pressable
            style={[styles.sendBtn, (!commentText.trim() || submitting) && styles.sendBtnDisabled]}
            onPress={handleComment}
            disabled={!commentText.trim() || submitting}
            hitSlop={8}>
            {submitting ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <Ionicons name="arrow-up" size={16} color="#000" />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function CommentRow({
  comment,
  isMe,
  onDelete,
}: {
  comment: ApiComment;
  isMe: boolean;
  onDelete: () => void;
}) {
  return (
    <View style={commentStyles.row}>
      <View style={[commentStyles.avatar, { backgroundColor: comment.userColor }]}>
        <Text style={commentStyles.avatarText}>
          {comment.username.slice(0, 2).toUpperCase()}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={commentStyles.nameRow}>
          <Text style={commentStyles.username}>{comment.username}</Text>
          <Text style={commentStyles.time}>{timeAgo(comment.createdAt)}</Text>
        </View>
        <Text style={commentStyles.text}>{comment.text}</Text>
      </View>
      {isMe && (
        <Pressable onPress={onDelete} hitSlop={10} style={commentStyles.deleteBtn}>
          <Ionicons name="trash-outline" size={14} color={PALETTE.textDim} />
        </Pressable>
      )}
    </View>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={statStyles.box}>
      <Text style={[statStyles.value, { color }]}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}

const commentStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'flex-start',
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: { color: '#000', fontWeight: '800', fontSize: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  username: { color: PALETTE.text, fontWeight: '700', fontSize: 13 },
  time: { color: PALETTE.textDim, fontSize: 11 },
  text: { color: PALETTE.textMuted, fontSize: 14, lineHeight: 19 },
  deleteBtn: { paddingTop: 2 },
});

const statStyles = StyleSheet.create({
  box: { flex: 1, alignItems: 'center', gap: 3 },
  value: { fontSize: 18, fontWeight: '700', fontVariant: ['tabular-nums'] },
  label: { color: PALETTE.textDim, fontSize: 10, fontWeight: '600', letterSpacing: 0.5 },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: PALETTE.background },
  center: { alignItems: 'center', justifyContent: 'center', gap: 12 },
  listContent: { paddingBottom: 8 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.border,
  },
  backArrow: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: PALETTE.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#000', fontWeight: '800', fontSize: 14 },
  username: { color: PALETTE.text, fontWeight: '700', fontSize: 15 },
  timeAgo: { color: PALETTE.textDim, fontSize: 11, marginTop: 2 },
  modeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  modeBadgeText: { fontSize: 11, fontWeight: '700' },

  image: {
    width: SCREEN_W,
    height: 280,
    backgroundColor: PALETTE.surface,
  },
  imageDots: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
  },
  imageDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },

  description: {
    color: PALETTE.textMuted,
    fontSize: 15,
    lineHeight: 22,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4,
  },

  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 14,
    backgroundColor: PALETTE.surfaceCard,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.border,
    paddingVertical: 16,
  },
  statsDiv: {
    width: StyleSheet.hairlineWidth,
    height: 32,
    backgroundColor: PALETTE.border,
    marginHorizontal: 4,
  },

  mapCard: {
    marginHorizontal: 16,
    marginTop: 12,
    height: 180,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: PALETTE.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.border,
  },

  actions: {
    flexDirection: 'row',
    gap: 24,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.border,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  actionLabel: {
    color: PALETTE.textDim,
    fontSize: 14,
    fontWeight: '600',
  },

  commentsHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  commentsTitle: {
    color: PALETTE.textDim,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },

  noComments: {
    color: PALETTE.textDim,
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
  },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.background,
    paddingBottom: Platform.OS === 'ios' ? 24 : 10,
  },
  inputAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  inputAvatarText: { color: '#000', fontWeight: '800', fontSize: 12 },
  input: {
    flex: 1,
    backgroundColor: PALETTE.surface,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.border,
    color: PALETTE.text,
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 9,
    maxHeight: 100,
  },
  sendBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sendBtnDisabled: {
    backgroundColor: PALETTE.surface,
  },

  notFound: { color: PALETTE.textMuted, fontSize: 16, fontWeight: '600' },
  backBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.border,
  },
  backBtnText: { color: PALETTE.text, fontWeight: '600' },
});

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PALETTE } from '../constants/game';
import { ApiPost } from '../services/api';
import { formatDistance, formatDuration, formatPace } from '../utils/geo';

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

interface PostCardProps {
  post: ApiPost;
  meUserId: string | undefined;
  onLike: (postId: string) => void;
}

export function PostCard({ post, meUserId, onLike }: PostCardProps) {
  const router = useRouter();
  const liked = meUserId ? post.likedBy.includes(meUserId) : false;
  const modeColor = post.mode === 'run' ? PALETTE.runPrimary : PALETTE.walkPrimary;
  const initials = post.username.slice(0, 2).toUpperCase();
  const pace = post.duration > 0 && post.distance > 0 ? formatPace(post.distance, post.duration * 1000) : '—';

  return (
    <Pressable
      style={styles.card}
      onPress={() => router.push({ pathname: '/post-detail', params: { postId: post.id } })}>

      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.avatar, { backgroundColor: post.userColor }]}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={styles.headerMeta}>
          <Text style={styles.username} numberOfLines={1}>{post.username}</Text>
          <View style={styles.headerSub}>
            <View style={[styles.modePill, { borderColor: modeColor + '50' }]}>
              <Ionicons name={post.mode === 'run' ? 'flash' : 'walk'} size={10} color={modeColor} />
              <Text style={[styles.modeText, { color: modeColor }]}>
                {post.mode === 'run' ? 'Run' : 'Walk'}
              </Text>
            </View>
            <Text style={styles.timeAgo}>{timeAgo(post.createdAt)}</Text>
          </View>
        </View>
      </View>

      {/* Image(s) */}
      {post.imageUris.length > 0 && (
        <View>
          <Image
            source={{ uri: post.imageUris[0] }}
            style={styles.image}
            contentFit="cover"
            transition={200}
          />
          {post.imageUris.length > 1 && (
            <View style={styles.imageCountBadge}>
              <Ionicons name="images-outline" size={12} color="#fff" />
              <Text style={styles.imageCountText}>{post.imageUris.length}</Text>
            </View>
          )}
        </View>
      )}

      {/* Description */}
      {post.description ? (
        <Text style={styles.description} numberOfLines={3}>{post.description}</Text>
      ) : null}

      {/* Stats */}
      <View style={styles.statsRow}>
        <StatCell label="DISTANCE" value={formatDistance(post.distance)} color={modeColor} />
        <View style={styles.statDiv} />
        <StatCell label="TIME" value={formatDuration(post.duration * 1000)} color={PALETTE.text} />
        <View style={styles.statDiv} />
        <StatCell label="PACE" value={pace} color={PALETTE.text} />
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <Pressable
          style={styles.actionBtn}
          onPress={(e) => { e.stopPropagation(); onLike(post.id); }}
          hitSlop={8}>
          <Ionicons
            name={liked ? 'heart' : 'heart-outline'}
            size={20}
            color={liked ? '#F43F5E' : PALETTE.textDim}
          />
          <Text style={[styles.actionCount, liked && styles.actionCountLiked]}>
            {post.likeCount > 0 ? post.likeCount : ''}
          </Text>
        </Pressable>
        <Pressable
          style={styles.actionBtn}
          onPress={() => router.push({ pathname: '/post-detail', params: { postId: post.id } })}
          hitSlop={8}>
          <Ionicons name="chatbubble-outline" size={18} color={PALETTE.textDim} />
          <Text style={styles.actionCount}>
            {post.commentCount > 0 ? post.commentCount : ''}
          </Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

function StatCell({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.statCell}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: PALETTE.surfaceCard,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.border,
    marginHorizontal: 14,
    marginBottom: 12,
    overflow: 'hidden',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    paddingBottom: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#000', fontWeight: '800', fontSize: 14, letterSpacing: 0.3 },
  headerMeta: { flex: 1 },
  username: { color: PALETTE.text, fontWeight: '700', fontSize: 15, letterSpacing: -0.2 },
  headerSub: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 },
  modePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 20,
    borderWidth: 1,
  },
  modeText: { fontSize: 10, fontWeight: '700' },
  timeAgo: { color: PALETTE.textDim, fontSize: 11 },

  // Image
  image: {
    width: '100%',
    height: 220,
    backgroundColor: PALETTE.surface,
  },
  imageCountBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  imageCountText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  // Description
  description: {
    color: PALETTE.textMuted,
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 4,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 14,
    marginTop: 12,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.border,
  },
  statCell: { flex: 1, alignItems: 'center', gap: 3 },
  statValue: { fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
  statLabel: {
    color: PALETTE.textDim,
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 1.2,
  },
  statDiv: {
    width: StyleSheet.hairlineWidth,
    height: 28,
    backgroundColor: PALETTE.border,
    marginHorizontal: 4,
  },

  // Actions
  actions: {
    flexDirection: 'row',
    gap: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.border,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionCount: {
    color: PALETTE.textDim,
    fontSize: 13,
    fontWeight: '600',
    minWidth: 16,
  },
  actionCountLiked: { color: '#F43F5E' },
});

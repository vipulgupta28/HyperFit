import { supabase } from '../db/client';
import { Comment, Post, Run, Tile, User } from './types';

// ── Row → domain mappers ───────────────────────────────────────────────────

function toUser(r: Record<string, unknown>): User {
  return {
    id: r.id as string,
    username: r.username as string,
    color: r.color as string,
    totalDistance: r.total_distance as number,
    territoryCount: r.territory_count as number,
    rank: r.rank as number,
    createdAt: new Date(r.created_at as string).getTime(),
  };
}

function fromUser(u: User): Record<string, unknown> {
  return {
    id: u.id,
    username: u.username,
    color: u.color,
    total_distance: u.totalDistance,
    territory_count: u.territoryCount,
    rank: u.rank,
    created_at: new Date(u.createdAt).toISOString(),
  };
}

function toRun(r: Record<string, unknown>): Run {
  return {
    id: r.id as string,
    userId: r.user_id as string,
    status: r.status as Run['status'],
    path: (r.path as Run['path']) ?? [],
    distance: r.distance as number,
    duration: r.duration as number,
    startedAt: new Date(r.started_at as string).getTime(),
    endedAt: r.ended_at ? new Date(r.ended_at as string).getTime() : null,
    capturedTileIds: (r.captured_tile_ids as string[]) ?? [],
    mode: r.mode as Run['mode'],
    liveTilesSnap: (r.live_tiles_snap as Run['liveTilesSnap']) ?? {},
    tileEffortPending: (r.tile_effort_pending as Run['tileEffortPending']) ?? {},
    netTerritoryDeltaAccum: (r.net_territory_delta_accum as number) ?? 0,
  };
}

function fromRun(run: Run): Record<string, unknown> {
  return {
    id: run.id,
    user_id: run.userId,
    status: run.status,
    path: run.path,
    distance: run.distance,
    duration: run.duration,
    started_at: new Date(run.startedAt).toISOString(),
    ended_at: run.endedAt ? new Date(run.endedAt).toISOString() : null,
    captured_tile_ids: run.capturedTileIds,
    mode: run.mode,
    live_tiles_snap: run.liveTilesSnap ?? null,
    tile_effort_pending: run.tileEffortPending ?? null,
    net_territory_delta_accum: run.netTerritoryDeltaAccum ?? 0,
  };
}

function toTile(r: Record<string, unknown>): Tile {
  return {
    h3Index: r.h3_index as string,
    ownerId: (r.owner_id as string | null) ?? null,
    ownerColor: (r.owner_color as string | null) ?? null,
    strength: r.strength as number,
    lastUpdated: new Date(r.last_updated as string).getTime(),
  };
}

function fromTile(tile: Tile): Record<string, unknown> {
  return {
    h3_index: tile.h3Index,
    owner_id: tile.ownerId,
    owner_color: tile.ownerColor,
    strength: tile.strength,
    last_updated: new Date(tile.lastUpdated).toISOString(),
  };
}

function toPost(r: Record<string, unknown>): Post {
  return {
    id: r.id as string,
    userId: r.user_id as string,
    username: r.username as string,
    userColor: r.user_color as string,
    runId: (r.run_id as string | null) ?? null,
    imageUris: (r.image_uris as string[]) ?? [],
    description: r.description as string,
    distance: r.distance as number,
    duration: r.duration as number,
    pace: r.pace as number,
    mode: r.mode as Post['mode'],
    path: (r.path as Post['path']) ?? [],
    likedBy: (r.liked_by as string[]) ?? [],
    commentCount: r.comment_count as number,
    createdAt: new Date(r.created_at as string).getTime(),
  };
}

function fromPost(post: Post): Record<string, unknown> {
  return {
    id: post.id,
    user_id: post.userId,
    username: post.username,
    user_color: post.userColor,
    run_id: post.runId,
    image_uris: post.imageUris,
    description: post.description,
    distance: post.distance,
    duration: post.duration,
    pace: post.pace,
    mode: post.mode,
    path: post.path,
    liked_by: post.likedBy,
    comment_count: post.commentCount,
    created_at: new Date(post.createdAt).toISOString(),
  };
}

function toComment(r: Record<string, unknown>): Comment {
  return {
    id: r.id as string,
    postId: r.post_id as string,
    userId: r.user_id as string,
    username: r.username as string,
    userColor: r.user_color as string,
    text: r.text as string,
    createdAt: new Date(r.created_at as string).getTime(),
  };
}

function fromComment(c: Comment): Record<string, unknown> {
  return {
    id: c.id,
    post_id: c.postId,
    user_id: c.userId,
    username: c.username,
    user_color: c.userColor,
    text: c.text,
    created_at: new Date(c.createdAt).toISOString(),
  };
}

// ── Store ──────────────────────────────────────────────────────────────────

class SupabaseStore {
  // ── Users ────────────────────────────────────────────────────

  async saveUser(user: User): Promise<User> {
    const { error } = await supabase
      .from('users')
      .upsert(fromUser(user), { onConflict: 'id' });
    if (error) throw new Error(`saveUser: ${error.message}`);
    return user;
  }

  async getUser(id: string): Promise<User | undefined> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();
    if (error?.code === 'PGRST116') return undefined;
    if (error) throw new Error(`getUser: ${error.message}`);
    return toUser(data as Record<string, unknown>);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .single();
    if (error?.code === 'PGRST116') return undefined;
    if (error) throw new Error(`getUserByUsername: ${error.message}`);
    return toUser(data as Record<string, unknown>);
  }

  async listUsers(): Promise<User[]> {
    const { data, error } = await supabase.from('users').select('*');
    if (error) throw new Error(`listUsers: ${error.message}`);
    return ((data as Record<string, unknown>[]) ?? []).map(toUser);
  }

  // ── Runs ─────────────────────────────────────────────────────

  async saveRun(run: Run): Promise<Run> {
    const { error } = await supabase
      .from('runs')
      .upsert(fromRun(run), { onConflict: 'id' });
    if (error) throw new Error(`saveRun: ${error.message}`);
    return run;
  }

  async getRun(id: string): Promise<Run | undefined> {
    const { data, error } = await supabase
      .from('runs')
      .select('*')
      .eq('id', id)
      .single();
    if (error?.code === 'PGRST116') return undefined;
    if (error) throw new Error(`getRun: ${error.message}`);
    return toRun(data as Record<string, unknown>);
  }

  async listRunsByUser(userId: string): Promise<Run[]> {
    const { data, error } = await supabase
      .from('runs')
      .select('*')
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .limit(50);
    if (error) throw new Error(`listRunsByUser: ${error.message}`);
    return ((data as Record<string, unknown>[]) ?? []).map(toRun);
  }

  // ── Tiles ────────────────────────────────────────────────────

  async saveTile(tile: Tile): Promise<Tile> {
    const { error } = await supabase
      .from('tiles')
      .upsert(fromTile(tile), { onConflict: 'h3_index' });
    if (error) throw new Error(`saveTile: ${error.message}`);
    return tile;
  }

  async getTile(h3Index: string): Promise<Tile | undefined> {
    const { data, error } = await supabase
      .from('tiles')
      .select('*')
      .eq('h3_index', h3Index)
      .single();
    if (error?.code === 'PGRST116') return undefined;
    if (error) throw new Error(`getTile: ${error.message}`);
    return toTile(data as Record<string, unknown>);
  }

  async getTilesByIndexes(indexes: string[]): Promise<Tile[]> {
    if (indexes.length === 0) return [];
    const { data, error } = await supabase
      .from('tiles')
      .select('*')
      .in('h3_index', indexes);
    if (error) throw new Error(`getTilesByIndexes: ${error.message}`);
    return ((data as Record<string, unknown>[]) ?? []).map(toTile);
  }

  async countTilesByOwner(userId: string): Promise<number> {
    const { count, error } = await supabase
      .from('tiles')
      .select('*', { count: 'exact', head: true })
      .eq('owner_id', userId);
    if (error) throw new Error(`countTilesByOwner: ${error.message}`);
    return count ?? 0;
  }

  async decayTiles(amount: number): Promise<Tile[]> {
    const { data, error } = await supabase.rpc('decay_tiles', { decay_amount: amount });
    if (error) throw new Error(`decayTiles: ${error.message}`);
    return ((data as Record<string, unknown>[]) ?? []).map(toTile);
  }

  async recomputeRanks(): Promise<void> {
    const { error } = await supabase.rpc('recompute_ranks');
    if (error) throw new Error(`recomputeRanks: ${error.message}`);
  }

  // ── Posts ────────────────────────────────────────────────────

  async savePost(post: Post): Promise<Post> {
    const { error } = await supabase
      .from('posts')
      .upsert(fromPost(post), { onConflict: 'id' });
    if (error) throw new Error(`savePost: ${error.message}`);
    return post;
  }

  async getPost(id: string): Promise<Post | undefined> {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .eq('id', id)
      .single();
    if (error?.code === 'PGRST116') return undefined;
    if (error) throw new Error(`getPost: ${error.message}`);
    return toPost(data as Record<string, unknown>);
  }

  async listPosts(limit: number, cursor?: string): Promise<Post[]> {
    let cursorCreatedAt: string | null = null;
    if (cursor) {
      const { data: cur } = await supabase
        .from('posts')
        .select('created_at')
        .eq('id', cursor)
        .single();
      if (cur) cursorCreatedAt = (cur as Record<string, unknown>).created_at as string;
    }

    let query = supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (cursorCreatedAt) {
      query = query.lt('created_at', cursorCreatedAt);
    }

    const { data, error } = await query;
    if (error) throw new Error(`listPosts: ${error.message}`);
    return ((data as Record<string, unknown>[]) ?? []).map(toPost);
  }

  // ── Comments ─────────────────────────────────────────────────

  async saveComment(comment: Comment): Promise<Comment> {
    const { error } = await supabase
      .from('comments')
      .upsert(fromComment(comment), { onConflict: 'id' });
    if (error) throw new Error(`saveComment: ${error.message}`);
    return comment;
  }

  async getComment(id: string): Promise<Comment | undefined> {
    const { data, error } = await supabase
      .from('comments')
      .select('*')
      .eq('id', id)
      .single();
    if (error?.code === 'PGRST116') return undefined;
    if (error) throw new Error(`getComment: ${error.message}`);
    return toComment(data as Record<string, unknown>);
  }

  async listComments(postId: string): Promise<Comment[]> {
    const { data, error } = await supabase
      .from('comments')
      .select('*')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });
    if (error) throw new Error(`listComments: ${error.message}`);
    return ((data as Record<string, unknown>[]) ?? []).map(toComment);
  }

  async deleteComment(id: string): Promise<void> {
    const { error } = await supabase.from('comments').delete().eq('id', id);
    if (error) throw new Error(`deleteComment: ${error.message}`);
  }

  async countComments(postId: string): Promise<number> {
    const { count, error } = await supabase
      .from('comments')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', postId);
    if (error) throw new Error(`countComments: ${error.message}`);
    return count ?? 0;
  }
}

export const store = new SupabaseStore();

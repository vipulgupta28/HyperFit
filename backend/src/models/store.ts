import { Comment, Post, Run, Tile, User } from './types';

/**
 * Process-local in-memory store. Designed to be swapped for MongoDB later —
 * service layers only call these methods, never touch raw maps.
 */
class MemoryStore {
  private users = new Map<string, User>();
  private runs = new Map<string, Run>();
  private tiles = new Map<string, Tile>();
  private posts = new Map<string, Post>();
  private comments = new Map<string, Comment>();

  // Users
  saveUser(user: User): User {
    this.users.set(user.id, user);
    return user;
  }
  getUser(id: string): User | undefined {
    return this.users.get(id);
  }
  listUsers(): User[] {
    return [...this.users.values()];
  }

  // Runs
  saveRun(run: Run): Run {
    this.runs.set(run.id, run);
    return run;
  }
  getRun(id: string): Run | undefined {
    return this.runs.get(id);
  }
  listRunsByUser(userId: string): Run[] {
    return [...this.runs.values()]
      .filter((r) => r.userId === userId)
      .sort((a, b) => b.startedAt - a.startedAt);
  }

  // Tiles (keyed by H3 cell index string)
  saveTile(tile: Tile): Tile {
    this.tiles.set(tile.h3Index, tile);
    return tile;
  }
  getTile(h3Index: string): Tile | undefined {
    return this.tiles.get(h3Index);
  }
  listTiles(): Tile[] {
    return [...this.tiles.values()];
  }

  // Posts
  savePost(post: Post): Post {
    this.posts.set(post.id, post);
    return post;
  }
  getPost(id: string): Post | undefined {
    return this.posts.get(id);
  }
  listPosts(): Post[] {
    return [...this.posts.values()].sort((a, b) => b.createdAt - a.createdAt);
  }

  // Comments
  saveComment(comment: Comment): Comment {
    this.comments.set(comment.id, comment);
    return comment;
  }
  getComment(id: string): Comment | undefined {
    return this.comments.get(id);
  }
  listComments(postId: string): Comment[] {
    return [...this.comments.values()]
      .filter((c) => c.postId === postId)
      .sort((a, b) => a.createdAt - b.createdAt);
  }
  deleteComment(id: string): void {
    this.comments.delete(id);
  }
}

export const store = new MemoryStore();

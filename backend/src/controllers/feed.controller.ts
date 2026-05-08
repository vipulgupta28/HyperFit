import { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

import { store } from '../models/store';
import { Comment, Post } from '../models/types';

export const getFeed = async (req: Request, res: Response): Promise<void> => {
  const limit = Math.min(Number(req.query.limit) || 20, 50);
  const cursor = req.query.cursor as string | undefined;

  const posts = await store.listPosts(limit + 1, cursor);
  const hasMore = posts.length > limit;
  const page = hasMore ? posts.slice(0, limit) : posts;
  const nextCursor = hasMore ? page[page.length - 1].id : null;

  res.json({
    posts: page.map((p) => ({ ...p, likeCount: p.likedBy.length })),
    nextCursor,
  });
};

export const getPostHandler = async (req: Request, res: Response): Promise<void> => {
  const post = await store.getPost(String(req.params.postId));
  if (!post) { res.status(404).json({ error: 'Not found' }); return; }
  res.json({ post: { ...post, likeCount: post.likedBy.length } });
};

export const createPost = async (req: Request, res: Response): Promise<void> => {
  const { userId, username, userColor, runId, imageUris, description, distance, duration, pace, mode, path } = req.body;
  if (!userId) { res.status(400).json({ error: 'userId required' }); return; }

  const post: Post = {
    id: randomUUID(),
    userId,
    username: String(username || userId),
    userColor: String(userColor || '#888'),
    runId: runId ?? null,
    imageUris: Array.isArray(imageUris) ? imageUris : [],
    description: String(description || ''),
    distance: Number(distance) || 0,
    duration: Number(duration) || 0,
    pace: Number(pace) || 0,
    mode: mode === 'walk' ? 'walk' : 'run',
    path: Array.isArray(path) ? path : [],
    likedBy: [],
    commentCount: 0,
    createdAt: Date.now(),
  };

  await store.savePost(post);
  res.status(201).json({ post: { ...post, likeCount: 0 } });
};

export const toggleLike = async (req: Request, res: Response): Promise<void> => {
  const post = await store.getPost(String(req.params.postId));
  const { userId } = req.body;
  if (!post) { res.status(404).json({ error: 'Not found' }); return; }
  if (!userId) { res.status(400).json({ error: 'userId required' }); return; }

  const idx = post.likedBy.indexOf(String(userId));
  if (idx >= 0) post.likedBy.splice(idx, 1);
  else post.likedBy.push(String(userId));
  await store.savePost(post);

  res.json({ liked: idx < 0, likeCount: post.likedBy.length });
};

export const getComments = async (req: Request, res: Response): Promise<void> => {
  const comments = await store.listComments(String(req.params.postId));
  res.json({ comments });
};

export const addComment = async (req: Request, res: Response): Promise<void> => {
  const post = await store.getPost(String(req.params.postId));
  const { userId, username, userColor, text } = req.body;
  if (!post) { res.status(404).json({ error: 'Not found' }); return; }
  if (!userId || !text?.trim()) { res.status(400).json({ error: 'userId and text required' }); return; }

  const comment: Comment = {
    id: randomUUID(),
    postId: post.id,
    userId,
    username: String(username || userId),
    userColor: String(userColor || '#888'),
    text: text.trim(),
    createdAt: Date.now(),
  };

  await store.saveComment(comment);
  post.commentCount = await store.countComments(post.id);
  await store.savePost(post);

  res.status(201).json({ comment });
};

export const deleteComment = async (req: Request, res: Response): Promise<void> => {
  const { userId } = req.body;
  const comment = await store.getComment(String(req.params.commentId));
  if (!comment) { res.status(404).json({ error: 'Not found' }); return; }
  if (comment.userId !== userId) { res.status(403).json({ error: 'Forbidden' }); return; }

  await store.deleteComment(comment.id);
  const post = await store.getPost(comment.postId);
  if (post) {
    post.commentCount = await store.countComments(post.id);
    await store.savePost(post);
  }
  res.json({ ok: true });
};

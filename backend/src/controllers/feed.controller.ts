import { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

import { store } from '../models/store';
import { Comment, Post } from '../models/types';

export const getFeed = (req: Request, res: Response): void => {
  const limit = Math.min(Number(req.query.limit) || 20, 50);
  const cursor = req.query.cursor as string | undefined;

  let posts = store.listPosts();
  if (cursor) {
    const idx = posts.findIndex((p) => p.id === cursor);
    if (idx >= 0) posts = posts.slice(idx + 1);
  }

  const page = posts.slice(0, limit);
  const nextCursor = page.length === limit ? page[page.length - 1].id : null;

  res.json({
    posts: page.map((p) => ({ ...p, likeCount: p.likedBy.length })),
    nextCursor,
  });
};

export const getPostHandler = (req: Request, res: Response): void => {
  const post = store.getPost(String(req.params.postId));
  if (!post) { res.status(404).json({ error: 'Not found' }); return; }
  res.json({ post: { ...post, likeCount: post.likedBy.length } });
};

export const createPost = (req: Request, res: Response): void => {
  const { userId, username, userColor, runId, imageUri, description, distance, duration, pace, mode, path } = req.body;
  if (!userId) { res.status(400).json({ error: 'userId required' }); return; }

  const post: Post = {
    id: randomUUID(),
    userId,
    username: String(username || userId),
    userColor: String(userColor || '#888'),
    runId: runId ?? null,
    imageUri: imageUri ?? null,
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

  store.savePost(post);
  res.status(201).json({ post: { ...post, likeCount: 0 } });
};

export const toggleLike = (req: Request, res: Response): void => {
  const post = store.getPost(String(req.params.postId));
  const { userId } = req.body;
  if (!post) { res.status(404).json({ error: 'Not found' }); return; }
  if (!userId) { res.status(400).json({ error: 'userId required' }); return; }

  const idx = post.likedBy.indexOf(String(userId));
  if (idx >= 0) post.likedBy.splice(idx, 1);
  else post.likedBy.push(String(userId));
  store.savePost(post);

  res.json({ liked: idx < 0, likeCount: post.likedBy.length });
};

export const getComments = (req: Request, res: Response): void => {
  res.json({ comments: store.listComments(String(req.params.postId)) });
};

export const addComment = (req: Request, res: Response): void => {
  const post = store.getPost(String(req.params.postId));
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

  store.saveComment(comment);
  post.commentCount = store.listComments(post.id).length;
  store.savePost(post);

  res.status(201).json({ comment });
};

export const deleteComment = (req: Request, res: Response): void => {
  const { userId } = req.body;
  const comment = store.getComment(String(req.params.commentId));
  if (!comment) { res.status(404).json({ error: 'Not found' }); return; }
  if (comment.userId !== userId) { res.status(403).json({ error: 'Forbidden' }); return; }

  store.deleteComment(comment.id);
  const post = store.getPost(comment.postId);
  if (post) {
    post.commentCount = store.listComments(post.id).length;
    store.savePost(post);
  }
  res.json({ ok: true });
};

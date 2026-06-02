import { apiRequest } from './apiClient';

export function getPosts({ categoryId, cursor, afterPostId, limit } = {}) {
  return apiRequest('/posts', {
    auth: true,
    query: { categoryId, cursor, afterPostId, limit },
  });
}
export function getBookmarkedPosts({ cursor, limit } = {}) {
  return apiRequest('/posts/bookmarks', {
    auth: true,
    query: { cursor, limit },
  });
}
export function getPost({ postId }) {
  return apiRequest('/posts/' + postId, {
    auth: true,
  });
}

export function createPost({ categoryId, workTitle, progress, content, isSpoiler, tags, mediaFiles, quotePostId }) {
  const files = Array.from(mediaFiles || []);

  if (files.length === 0) {
    return apiRequest('/posts', {
      method: 'POST',
      auth: true,
      body: {
        categoryId,
        workTitle,
        progress,
        content,
        isSpoiler,
        tags,
        quotePostId,
      },
    });
  }

  const formData = new FormData();
  formData.append('categoryId', categoryId);
  formData.append('workTitle', workTitle);
  formData.append('progress', progress);
  formData.append('content', content);
  formData.append('isSpoiler', isSpoiler ? '1' : '0');
  if (quotePostId) formData.append('quotePostId', quotePostId);

  (tags || []).forEach((tag) => formData.append('tags', tag));
  files.forEach((file) => formData.append('mediaFiles', file));

  return apiRequest('/posts', {
    method: 'POST',
    auth: true,
    body: formData,
  });
}

export function updatePost({ postId, categoryId, workTitle, progress, content, isSpoiler, tags }) {
  return apiRequest('/posts/' + postId, {
    method: 'PATCH',
    auth: true,
    body: {
      categoryId,
      workTitle,
      progress,
      content,
      isSpoiler,
      tags,
    },
  });
}

export function deletePost({ postId }) {
  return apiRequest('/posts/' + postId, {
    method: 'DELETE',
    auth: true,
  });
}
export function getPostComments({ postId, cursor, limit } = {}) {
  return apiRequest('/posts/' + postId + '/comments', {
    auth: true,
    query: { cursor, limit },
  });
}

export function createPostComment({ postId, content, isSpoiler, tags }) {
  return apiRequest('/posts/' + postId + '/comments', {
    method: 'POST',
    auth: true,
    body: { content, isSpoiler, tags },
  });
}

export function togglePostLike({ postId }) {
  return apiRequest('/posts/' + postId + '/likes', {
    method: 'POST',
    auth: true,
  });
}

export function togglePostRepost({ postId }) {
  return apiRequest('/posts/' + postId + '/reposts', {
    method: 'POST',
    auth: true,
  });
}

export function togglePostBookmark({ postId }) {
  return apiRequest('/posts/' + postId + '/bookmarks', {
    method: 'POST',
    auth: true,
  });
}

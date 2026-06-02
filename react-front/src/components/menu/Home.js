import { useEffect, useRef, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Popover,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import BookmarkBorderRoundedIcon from '@mui/icons-material/BookmarkBorderRounded';
import BookmarkRoundedIcon from '@mui/icons-material/BookmarkRounded';
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import FavoriteBorderRoundedIcon from '@mui/icons-material/FavoriteBorderRounded';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded';
import RepeatRoundedIcon from '@mui/icons-material/RepeatRounded';
import TagRoundedIcon from '@mui/icons-material/TagRounded';
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded';
import {
  getPosts,
  createPost,
  deletePost,
  updatePost,
  getPostComments,
  createPostComment,
  togglePostLike,
  togglePostRepost,
  togglePostBookmark,
} from '../../api/postApi';
import { MEDIA_ACCEPT, validateMediaFiles } from '../../utils/mediaValidation';
import MediaPreviewList from '../post/MediaPreviewList';
import PostComposerDialog from '../post/PostComposerDialog';
import { CATEGORY_ALL, CATEGORY_ALL_ID, DEFAULT_CATEGORIES } from '../../constants/categories';

const PAGE_SIZE = 20;
const NEW_POST_POLL_MS = 30000;
const SPOILER_STATUS = {
  IDLE: 'IDLE',
  ANALYZING: 'ANALYZING',
  SAFE: 'SAFE',
  SPOILER: 'SPOILER',
};

const copy = {
  category: '\uce74\ud14c\uace0\ub9ac',
  spoiler: '\uc2a4\ud3ec\uc77c\ub7ec',
  workName: '\uc791\ud488\uba85',
  progress: '\uc9c4\ub3c4',
  placeholder: '\uc9c0\uae08 \ubcf4\ub294 \uc791\ud488\uc758 \uc21c\uac04\uc744 \ub0a8\uaca8\ubcf4\uc138\uc694.',
  submit: '\uac8c\uc2dc\ud558\uae30',
  submitting: '\uac8c\uc2dc \uc911',
  fileAttach: '\ud30c\uc77c \ucca8\ubd80',
  tagButton: '\ud0dc\uadf8',
  save: '\uc800\uc7a5',
  saved: '저장됨',
  commentPlaceholder: '댓글을 입력해주세요.',
  commentSubmit: '댓글',
  commentSubmitting: '등록 중',
  commentEmpty: '아직 댓글이 없습니다.',
  aiIdle: 'AI \ubd84\uc11d',
  aiAnalyzing: '\ubd84\uc11d \uc911',
  aiSafe: '\uc548\uc804',
  aiSpoiler: '\uc2a4\ud3ec\uc77c\ub7ec \uac10\uc9c0',
  empty: '\uc544\uc9c1 \ub4f1\ub85d\ub41c \ub85c\uadf8\uac00 \uc5c6\uc2b5\ub2c8\ub2e4.',
  loadError: '\uac8c\uc2dc\uae00\uc744 \ubd88\ub7ec\uc624\uc9c0 \ubabb\ud588\uc2b5\ub2c8\ub2e4.',
  loadingMore: '\uc774\uc804 \ub85c\uadf8\ub97c \ubd88\ub7ec\uc624\ub294 \uc911...',
  endOfFeed: '\ub354 \uc774\uc0c1 \ubd88\ub7ec\uc62c \ub85c\uadf8\uac00 \uc5c6\uc2b5\ub2c8\ub2e4.',
  newPosts: (count) => `${count}\uac1c\uc758 \uc0c8\ub85c\uc6b4 \ud3ec\uc2a4\ud2b8 \ubcf4\uae30`,
  editMode: '\uc218\uc815 \uc911\uc778 \uac8c\uc2dc\uae00\uc785\ub2c8\ub2e4.',
  updateSubmit: '\uc218\uc815 \uc644\ub8cc',
  cancelEdit: '\uc218\uc815 \ucde8\uc18c',
  editPost: '\uc218\uc815\ud558\uae30',
  deletePost: '\uc0ad\uc81c\ud558\uae30',
  followUser: '\ud314\ub85c\uc6b0\ud558\uae30',
  blockUser: '\ucc28\ub2e8\ud558\uae30',
  copyUrl: 'URL \ubcf5\uc0ac',
  reportPost: '\uac8c\uc2dc\ubb3c \uc2e0\uace0\ud558\uae30',
  repostAction: '재게시',
  quoteAction: '인용하세요',
  deleteConfirm: '\uc774 \uac8c\uc2dc\uae00\uc744 \uc0ad\uc81c\ud560\uae4c\uc694?',
  copiedUrl: 'URL\uc774 \ubcf5\uc0ac\ub418\uc5c8\uc2b5\ub2c8\ub2e4.',
  nextFeature: '\uc774 \uae30\ub2a5\uc740 \ub2e4\uc74c \ub2e8\uacc4\uc5d0\uc11c API\ub97c \uc5f0\uacb0\ud558\uaca0\uc2b5\ub2c8\ub2e4.',
};

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3010';

function resolveMediaUrl(fileUrl) {
  if (!fileUrl) return '';
  return fileUrl.startsWith('http') ? fileUrl : API_BASE_URL + fileUrl;
}

function getSpoilerStatusLabel(status) {
  if (status === SPOILER_STATUS.ANALYZING) return copy.aiAnalyzing;
  if (status === SPOILER_STATUS.SAFE) return copy.aiSafe;
  if (status === SPOILER_STATUS.SPOILER) return copy.aiSpoiler;
  return copy.aiIdle;
}

function isPostVisibleByCategory(post, activeCategoryId) {
  return activeCategoryId === CATEGORY_ALL_ID || post.categoryId === activeCategoryId;
}

function mergeUniquePosts(currentPosts, incomingPosts) {
  const postMap = new Map();

  [...incomingPosts, ...currentPosts].forEach((post) => {
    postMap.set(post.postId, post);
  });

  return Array.from(postMap.values()).sort((a, b) => b.postId - a.postId);
}

function appendUniquePosts(currentPosts, incomingPosts) {
  const existingIds = new Set(currentPosts.map((post) => post.postId));
  return [...currentPosts, ...incomingPosts.filter((post) => !existingIds.has(post.postId))];
}

function formatPostUsername(username) {
  return String(username || 'user');
}

function parsePostCreatedAt(createdAt) {
  if (!createdAt) return null;

  const normalized = String(createdAt).replace(' ', 'T');
  const parsedDate = new Date(normalized);

  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function formatRelativeTime(createdAt) {
  const createdDate = parsePostCreatedAt(createdAt);
  if (!createdDate) return createdAt || '';

  const diffMs = Date.now() - createdDate.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return '1\ubd84 \ubbf8\ub9cc';
  if (diffMinutes < 60) return diffMinutes + '\ubd84 \uc804';

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return diffHours + '\uc2dc\uac04 \uc804';

  return String(createdDate.getMonth() + 1) + '/' + String(createdDate.getDate());
}

function isMyPost(post, user) {
  return Number(post?.user?.userId) === Number(user?.userId);
}

function getPostDetailPath(post) {
  return '/' + encodeURIComponent(formatPostUsername(post?.user?.username)) + '/status/' + post?.postId;
}

function QuotePostCard({ post }) {
  if (!post) return null;

  return (
    <Box className="main-quote-preview-card main-quote-preview-card--embedded">
      <Box className="main-quote-preview-card__author">
        <Avatar className="main-avatar main-avatar--quote">{post.user.nickname.charAt(0)}</Avatar>
        <Box className="main-quote-preview-card__author-text">
          <Typography className="main-quote-preview-card__name">{post.user.nickname}</Typography>
          <Typography className="main-post__meta">@{formatPostUsername(post.user.username)} · {formatRelativeTime(post.createdAt)}</Typography>
        </Box>
      </Box>
      <Stack className="main-quote-preview-card__chips" direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
        <Chip className="main-work-chip" label={post.categoryName} size="small" />
        <Chip className="main-work-chip main-work-chip--dark" label={post.workTitle} size="small" />
        <Chip className="main-work-chip" label={post.progress} size="small" />
      </Stack>
      <Typography className="main-quote-preview-card__content">{post.content}</Typography>
    </Box>
  );
}


function Home() {
  const navigate = useNavigate();
  const { avatarSrc, displayName, isDarkMode, user } = useOutletContext();
  const [activeCategoryId, setActiveCategoryId] = useState(CATEGORY_ALL_ID);
  const [content, setContent] = useState('');
  const [workTitle, setWorkTitle] = useState('');
  const [progress, setProgress] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [spoilerStatus, setSpoilerStatus] = useState(SPOILER_STATUS.IDLE);
  const [posts, setPosts] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [newPostCount, setNewPostCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [checkingNewPosts, setCheckingNewPosts] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedMediaFiles, setSelectedMediaFiles] = useState([]);
  const [commentPostId, setCommentPostId] = useState(null);
  const [commentDrafts, setCommentDrafts] = useState({});
  const [commentsByPostId, setCommentsByPostId] = useState({});
  const [commentLoadingPostId, setCommentLoadingPostId] = useState(null);
  const [commentSubmittingPostId, setCommentSubmittingPostId] = useState(null);
  const [reactionLoadingKey, setReactionLoadingKey] = useState('');
  const [editingPostId, setEditingPostId] = useState(null);
  const [postMenuAnchorEl, setPostMenuAnchorEl] = useState(null);
  const [postMenuPost, setPostMenuPost] = useState(null);
  const [repostMenuAnchorEl, setRepostMenuAnchorEl] = useState(null);
  const [repostMenuPost, setRepostMenuPost] = useState(null);
  const [quoteDialogPost, setQuoteDialogPost] = useState(null);
  const mediaInputRef = useRef(null);
  const loadMoreTargetRef = useRef(null);
  const loadMoreRef = useRef(null);

  const userCategories = Array.isArray(user?.categories) && user.categories.length > 0
    ? user.categories
    : DEFAULT_CATEGORIES;
  const feedCategoryItems = [CATEGORY_ALL, ...userCategories];
  const selectedCategoryId = activeCategoryId === CATEGORY_ALL_ID ? undefined : activeCategoryId;
  const isSubmitDisabled = !categoryId || !workTitle.trim() || !progress.trim() || !content.trim() || spoilerStatus === SPOILER_STATUS.ANALYZING || submitLoading;
  const isPostMenuOpen = Boolean(postMenuAnchorEl);
  const isPostMenuMine = isMyPost(postMenuPost, user);
  const isRepostMenuOpen = Boolean(repostMenuAnchorEl);

  useEffect(() => {
    let ignore = false;

    setLoading(true);
    setError('');
    setNewPostCount(0);
    setNextCursor(null);
    setHasMore(false);

    getPosts({ categoryId: selectedCategoryId, limit: PAGE_SIZE })
      .then((data) => {
        if (ignore) return;
        setPosts(Array.isArray(data.posts) ? data.posts : []);
        setNextCursor(data.nextCursor || null);
        setHasMore(Boolean(data.hasMore));
      })
      .catch((requestError) => {
        if (!ignore) setError(requestError.message || copy.loadError);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [selectedCategoryId]);

  const loadMorePosts = async () => {
    if (loading || loadingMore || !hasMore || !nextCursor) return;

    setLoadingMore(true);
    setError('');

    try {
      const data = await getPosts({
        categoryId: selectedCategoryId,
        cursor: nextCursor,
        limit: PAGE_SIZE,
      });

      const nextPosts = Array.isArray(data.posts) ? data.posts : [];
      setPosts((prevPosts) => appendUniquePosts(prevPosts, nextPosts));
      setNextCursor(data.nextCursor || null);
      setHasMore(Boolean(data.hasMore));
    } catch (requestError) {
      setError(requestError.message || copy.loadError);
    } finally {
      setLoadingMore(false);
    }
  };

  loadMoreRef.current = loadMorePosts;

  useEffect(() => {
    const target = loadMoreTargetRef.current;
    if (!target) return undefined;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) {
        loadMoreRef.current?.();
      }
    }, { rootMargin: '260px 0px' });

    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const firstPostId = posts[0]?.postId;
    if (!firstPostId) return undefined;

    const checkNewPosts = async () => {
      if (checkingNewPosts) return;

      setCheckingNewPosts(true);

      try {
        const data = await getPosts({
          categoryId: selectedCategoryId,
          afterPostId: firstPostId,
          limit: PAGE_SIZE,
        });
        setNewPostCount(Number(data.newCount) || 0);
      } catch (requestError) {
        // 새 글 감지는 보조 기능이므로 피드 이용을 막지 않습니다.
      } finally {
        setCheckingNewPosts(false);
      }
    };

    const timerId = window.setInterval(checkNewPosts, NEW_POST_POLL_MS);

    return () => {
      window.clearInterval(timerId);
    };
  }, [checkingNewPosts, posts, selectedCategoryId]);

  useEffect(() => {
    const handleExternalPostCreated = (event) => {
      const post = event.detail;
      if (!post || !isPostVisibleByCategory(post, activeCategoryId)) return;

      setPosts((prevPosts) => mergeUniquePosts(prevPosts, [post]));
      setNewPostCount(0);
    };

    window.addEventListener('liveLogPostCreated', handleExternalPostCreated);

    return () => {
      window.removeEventListener('liveLogPostCreated', handleExternalPostCreated);
    };
  }, [activeCategoryId]);

  const resetComposer = () => {
    setCategoryId('');
    setWorkTitle('');
    setProgress('');
    setContent('');
    setSpoilerStatus(SPOILER_STATUS.IDLE);
    setSelectedMediaFiles([]);
    setEditingPostId(null);
    if (mediaInputRef.current) mediaInputRef.current.value = '';
  };

  const handleContentChange = (event) => {
    setContent(event.target.value);
    setSpoilerStatus(SPOILER_STATUS.IDLE);
  };

  const handleOpenPostDetail = (post) => {
    navigate(getPostDetailPath(post));
  };

  const handleAnalyzeSpoiler = () => {
    if (!content.trim()) return;

    setSpoilerStatus(SPOILER_STATUS.ANALYZING);

    window.setTimeout(() => {
      const spoilerKeywords = ['\uc8fd', '\uc0ac\ub9dd', '\ubc94\uc778', '\uacb0\ub9d0', '\ubc18\uc804', '\uc2a4\ud3ec'];
      setSpoilerStatus(spoilerKeywords.some((keyword) => content.includes(keyword)) ? SPOILER_STATUS.SPOILER : SPOILER_STATUS.SAFE);
    }, 500);
  };

  const handlePostMenuOpen = (event, post) => {
    setPostMenuAnchorEl(event.currentTarget);
    setPostMenuPost(post);
  };

  const handlePostMenuClose = () => {
    setPostMenuAnchorEl(null);
    setPostMenuPost(null);
  };

  const handleStartEdit = () => {
    if (!postMenuPost) return;

    setEditingPostId(postMenuPost.postId);
    setCategoryId(postMenuPost.categoryId || '');
    setWorkTitle(postMenuPost.workTitle || '');
    setProgress(postMenuPost.progress || '');
    setContent(postMenuPost.content || '');
    setSpoilerStatus(postMenuPost.isSpoiler ? SPOILER_STATUS.SPOILER : SPOILER_STATUS.IDLE);
    setSelectedMediaFiles([]);
    if (mediaInputRef.current) mediaInputRef.current.value = '';
    handlePostMenuClose();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    resetComposer();
  };

  const handleDeletePost = async () => {
    if (!postMenuPost || !window.confirm(copy.deleteConfirm)) return;

    const targetPostId = postMenuPost.postId;
    handlePostMenuClose();
    setError('');

    try {
      await deletePost({ postId: targetPostId });
      setPosts((prevPosts) => prevPosts.filter((post) => post.postId !== targetPostId));
      if (editingPostId === targetPostId) resetComposer();
    } catch (requestError) {
      setError(requestError.message || '\uac8c\uc2dc\uae00 \uc0ad\uc81c \uc911 \uc624\ub958\uac00 \ubc1c\uc0dd\ud588\uc2b5\ub2c8\ub2e4.');
    }
  };

  const handleCopyPostUrl = async () => {
    if (!postMenuPost) return;

    const url = window.location.origin + getPostDetailPath(postMenuPost);
    handlePostMenuClose();

    try {
      await navigator.clipboard.writeText(url);
      setError(copy.copiedUrl);
    } catch (copyError) {
      setError(url);
    }
  };

  const handlePreparedMenuAction = () => {
    handlePostMenuClose();
    setError(copy.nextFeature);
  };

  const handleRepostMenuOpen = (event, post) => {
    event.stopPropagation();
    setRepostMenuAnchorEl(event.currentTarget);
    setRepostMenuPost(post);
  };

  const handleRepostMenuClose = () => {
    setRepostMenuAnchorEl(null);
    setRepostMenuPost(null);
  };

  const handleConfirmRepost = async () => {
    if (!repostMenuPost) return;

    const targetPost = repostMenuPost;
    handleRepostMenuClose();
    await handleToggleRelation(targetPost, 'repost');
  };

  const handleQuotePost = () => {
    if (!repostMenuPost) return;

    setQuoteDialogPost(repostMenuPost);
    handleRepostMenuClose();
  };

  const handleQuoteDialogClose = () => {
    setQuoteDialogPost(null);
  };

  const handleQuotePostCreated = (post) => {
    if (post && isPostVisibleByCategory(post, activeCategoryId)) {
      setPosts((prevPosts) => mergeUniquePosts(prevPosts, [post]));
    }
  };

  const updatePostById = (postId, updater) => {
    setPosts((prevPosts) => prevPosts.map((post) => (
      post.postId === postId ? updater(post) : post
    )));
  };

  const handleToggleRelation = async (post, relationType) => {
    const actionKey = relationType + '-' + post.postId;
    if (reactionLoadingKey === actionKey) return;

    const config = {
      like: {
        request: togglePostLike,
        stateKey: 'liked',
        countKey: 'likes',
      },
      repost: {
        request: togglePostRepost,
        stateKey: 'reposted',
        countKey: 'reposts',
      },
      bookmark: {
        request: togglePostBookmark,
        stateKey: 'bookmarked',
        countKey: 'bookmarks',
      },
    }[relationType];

    if (!config) return;

    setReactionLoadingKey(actionKey);
    setError('');

    try {
      const data = await config.request({ postId: post.postId });
      updatePostById(post.postId, (currentPost) => ({
        ...currentPost,
        [config.stateKey]: Boolean(data[config.stateKey]),
        counts: {
          ...currentPost.counts,
          [config.countKey]: Number(data.count) || 0,
        },
      }));
    } catch (requestError) {
      setError(requestError.message || '요청 처리 중 오류가 발생했습니다.');
    } finally {
      setReactionLoadingKey('');
    }
  };

  const handleToggleComments = async (postId) => {
    if (commentPostId === postId) {
      setCommentPostId(null);
      return;
    }

    setCommentPostId(postId);

    if (commentsByPostId[postId]) return;

    setCommentLoadingPostId(postId);
    setError('');

    try {
      const data = await getPostComments({ postId, limit: 10 });
      setCommentsByPostId((prevComments) => ({
        ...prevComments,
        [postId]: Array.isArray(data.comments) ? data.comments : [],
      }));
    } catch (requestError) {
      setError(requestError.message || '댓글을 불러오지 못했습니다.');
    } finally {
      setCommentLoadingPostId(null);
    }
  };

  const handleCommentChange = (postId, value) => {
    setCommentDrafts((prevDrafts) => ({
      ...prevDrafts,
      [postId]: value.slice(0, 4000),
    }));
  };

  const handleSubmitComment = async (post) => {
    const draft = String(commentDrafts[post.postId] || '').trim();
    if (!draft || commentSubmittingPostId === post.postId) return;

    setCommentSubmittingPostId(post.postId);
    setError('');

    try {
      const data = await createPostComment({
        postId: post.postId,
        content: draft,
        isSpoiler: false,
      });

      if (data.comment) {
        setCommentsByPostId((prevComments) => ({
          ...prevComments,
          [post.postId]: [data.comment, ...(prevComments[post.postId] || [])],
        }));
        updatePostById(post.postId, (currentPost) => ({
          ...currentPost,
          counts: {
            ...currentPost.counts,
            comments: Number(currentPost.counts.comments || 0) + 1,
          },
        }));
      }

      setCommentDrafts((prevDrafts) => ({ ...prevDrafts, [post.postId]: '' }));
    } catch (requestError) {
      setError(requestError.message || '댓글 등록 중 오류가 발생했습니다.');
    } finally {
      setCommentSubmittingPostId(null);
    }
  };


  const handleMediaButtonClick = () => {
    mediaInputRef.current?.click();
  };

  const handleMediaChange = (event) => {
    const validation = validateMediaFiles(event.target.files);

    if (validation.error) {
      setError(validation.error);
      event.target.value = '';
      return;
    }

    setSelectedMediaFiles(validation.files);
    setError('');
  };

  const handleRemoveMediaFile = (fileName) => {
    setSelectedMediaFiles((prevFiles) => prevFiles.filter((file) => file.name !== fileName));
    if (mediaInputRef.current) mediaInputRef.current.value = '';
  };

  const handleLoadNewPosts = async () => {
    const firstPostId = posts[0]?.postId;
    if (!firstPostId || newPostCount === 0) return;

    setLoading(true);
    setError('');

    try {
      const data = await getPosts({
        categoryId: selectedCategoryId,
        afterPostId: firstPostId,
        limit: PAGE_SIZE,
      });
      const freshPosts = Array.isArray(data.posts) ? data.posts : [];
      setPosts((prevPosts) => mergeUniquePosts(prevPosts, freshPosts));
      setNewPostCount(0);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (requestError) {
      setError(requestError.message || copy.loadError);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (isSubmitDisabled) return;

    setSubmitLoading(true);
    setError('');

    try {
      const payload = {
        categoryId,
        workTitle: workTitle.trim(),
        progress: progress.trim(),
        content: content.trim(),
        isSpoiler: spoilerStatus === SPOILER_STATUS.SPOILER,
      };
      const data = editingPostId
        ? await updatePost({ postId: editingPostId, ...payload })
        : await createPost({ ...payload, mediaFiles: selectedMediaFiles });

      if (data.post && isPostVisibleByCategory(data.post, activeCategoryId)) {
        setPosts((prevPosts) => mergeUniquePosts(
          editingPostId ? prevPosts.filter((post) => post.postId !== editingPostId) : prevPosts,
          [data.post]
        ));
      }

      resetComposer();
    } catch (requestError) {
      setError(requestError.message || '\uac8c\uc2dc\uae00 \ub4f1\ub85d \uc911 \uc624\ub958\uac00 \ubc1c\uc0dd\ud588\uc2b5\ub2c8\ub2e4.');
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <Box component="main" className="main-feed">
      <Box className="main-category-tabs">
        {feedCategoryItems.map((category) => (
          <Button
            className={activeCategoryId === category.categoryId ? 'main-category-tab main-category-tab--active' : 'main-category-tab'}
            key={category.categoryId}
            onClick={() => setActiveCategoryId(category.categoryId)}
          >
            {category.name}
          </Button>
        ))}
      </Box>

      <Box className="main-composer">
        <Avatar className="main-avatar main-avatar--composer" src={avatarSrc}>{displayName.charAt(0)}</Avatar>
        <Box className="main-composer__body">
          {editingPostId && (
            <Box className="main-edit-mode-row">
              <Typography>{copy.editMode}</Typography>
              <Button className="main-edit-cancel-button" onClick={handleCancelEdit} size="small">{copy.cancelEdit}</Button>
            </Box>
          )}
          <Stack className="main-composer__meta" direction="row" spacing={1.2}>
            <FormControl className="main-compact-input main-compact-input--category">
              <InputLabel id="post-category-label">{copy.category}</InputLabel>
              <Select
                label={copy.category}
                labelId="post-category-label"
                MenuProps={{
                  PaperProps: {
                    className: isDarkMode ? 'main-select-menu main-select-menu--dark' : 'main-select-menu',
                  },
                }}
                onChange={(event) => setCategoryId(event.target.value)}
                value={categoryId}
              >
                {userCategories.map((category) => (
                  <MenuItem key={category.categoryId} value={category.categoryId}>{category.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField className="main-compact-input" label={copy.workName} onChange={(event) => setWorkTitle(event.target.value)} value={workTitle} />
            <TextField className="main-compact-input main-compact-input--progress" label={copy.progress} onChange={(event) => setProgress(event.target.value)} value={progress} />
          </Stack>
          <TextField
            className="main-compose-input"
            fullWidth
            minRows={3}
            multiline
            onChange={handleContentChange}
            placeholder={copy.placeholder}
            value={content}
          />
          <Box className="main-composer__footer">
            <Stack alignItems="center" direction="row" spacing={0.5}>
              <Button className="main-tool-text-button" disabled={submitLoading || Boolean(editingPostId)} onClick={handleMediaButtonClick} startIcon={<ImageRoundedIcon />}>
                {copy.fileAttach}
              </Button>
              <input
                accept={MEDIA_ACCEPT}
                className="main-hidden-file-input"
                multiple
                onChange={handleMediaChange}
                ref={mediaInputRef}
                type="file"
              />
              <Button className="main-tool-text-button" startIcon={<TagRoundedIcon />}>
                {copy.tagButton}
              </Button>
              <Button
                className={spoilerStatus === SPOILER_STATUS.SPOILER ? 'main-ai-button main-ai-button--danger' : 'main-ai-button'}
                disabled={!content.trim() || spoilerStatus === SPOILER_STATUS.ANALYZING}
                onClick={handleAnalyzeSpoiler}
                startIcon={<AutoAwesomeRoundedIcon />}
              >
                {getSpoilerStatusLabel(spoilerStatus)}
              </Button>
            </Stack>
            <Stack alignItems="center" className="main-composer__post-actions" direction="row" spacing={1.4}>
              {spoilerStatus === SPOILER_STATUS.SPOILER && <Chip className="main-spoiler-chip" icon={<VisibilityOffRoundedIcon />} label={copy.spoiler} size="small" />}
              <Button className="main-submit-button main-submit-button--post" disabled={isSubmitDisabled} onClick={handleSubmit} size="large" variant="contained">
                {submitLoading ? copy.submitting : editingPostId ? copy.updateSubmit : copy.submit}
              </Button>
            </Stack>
          </Box>
          <MediaPreviewList files={selectedMediaFiles} onRemove={handleRemoveMediaFile} />
          {error && <Alert severity="error" className="main-form-alert">{error}</Alert>}
        </Box>
      </Box>

      {newPostCount > 0 && (
        <Box className="main-new-post-row">
          <Button className="main-new-post-button" onClick={handleLoadNewPosts} variant="contained">
            {copy.newPosts(newPostCount)}
          </Button>
        </Box>
      )}

      {loading && posts.length === 0 ? (
        <Box className="main-feed-state"><CircularProgress size={28} /></Box>
      ) : posts.length === 0 ? (
        <Box className="main-feed-state"><Typography>{copy.empty}</Typography></Box>
      ) : (
        <>
          <Stack className="main-post-list">
            {posts.map((post) => (
              <Box component="article" className="main-post main-post--clickable" key={post.postId} onClick={() => handleOpenPostDetail(post)} onKeyDown={(event) => { if (event.key === 'Enter') handleOpenPostDetail(post); }} role="button" tabIndex={0}>
                <Avatar className="main-avatar">{post.user.nickname.charAt(0)}</Avatar>
                <Box className="main-post__body">
                  <Box className="main-post__topline">
                    <Box className="main-post__author-line">
                      <Typography className="main-post__name">{post.user.nickname}</Typography>
                      <Typography className="main-post__meta">@{formatPostUsername(post.user.username)} {'\u00b7'} {formatRelativeTime(post.createdAt)}</Typography>
                    </Box>
                    <IconButton aria-label="more" className="main-icon-button main-icon-button--small" onClick={(event) => { event.stopPropagation(); handlePostMenuOpen(event, post); }}><MoreHorizRoundedIcon /></IconButton>
                  </Box>

                  <Box className="main-work-chip-row">
                    <Chip className="main-work-chip" label={post.categoryName} size="small" />
                    <Chip className="main-work-chip main-work-chip--dark" label={post.workTitle} size="small" />
                    <Chip className="main-work-chip" label={post.progress} size="small" />
                    {post.isSpoiler && <Chip className="main-spoiler-chip" icon={<VisibilityOffRoundedIcon />} label={copy.spoiler} size="small" />}
                  </Box>

                  {String(post.content || '').trim() && <Typography className={post.isSpoiler ? 'main-post__content main-post__content--spoiler' : 'main-post__content'}>{post.content}</Typography>}

                  {post.media?.length > 0 && (
                    <Box className="main-media-list" onClick={(event) => event.stopPropagation()}>
                      {post.media.map((media) => (
                        <Box className="main-media-item" key={media.mediaId}>
                          {media.mediaType === 'IMAGE' && <img alt="post media" src={resolveMediaUrl(media.fileUrl)} />}
                          {media.mediaType === 'VIDEO' && <video controls src={resolveMediaUrl(media.fileUrl)} />}
                        </Box>
                      ))}
                    </Box>
                  )}

                  {post.quotePost && <QuotePostCard post={post.quotePost} />}

                  {post.tags.length > 0 && (
                    <Stack className="main-tag-row" direction="row" spacing={0.75}>
                      {post.tags.map((tag) => <span className="main-tag" key={tag}>#{tag}</span>)}
                    </Stack>
                  )}

                  <Box className="main-post__actions">
                    <Button className="main-action-button" onClick={(event) => { event.stopPropagation(); handleToggleComments(post.postId); }} startIcon={<ChatBubbleOutlineRoundedIcon />}>{post.counts.comments}</Button>
                    <Button
                      className={post.reposted ? 'main-action-button main-action-button--active main-action-button--repost' : 'main-action-button'}
                      disabled={reactionLoadingKey === 'repost-' + post.postId}
                      onClick={(event) => handleRepostMenuOpen(event, post)}
                      startIcon={<RepeatRoundedIcon />}
                    >
                      {post.counts.reposts}
                    </Button>
                    <Button
                      className={post.liked ? 'main-action-button main-action-button--active main-action-button--like' : 'main-action-button'}
                      disabled={reactionLoadingKey === 'like-' + post.postId}
                      onClick={(event) => { event.stopPropagation(); handleToggleRelation(post, 'like'); }}
                      startIcon={post.liked ? <FavoriteRoundedIcon /> : <FavoriteBorderRoundedIcon />}
                    >
                      {post.counts.likes}
                    </Button>
                    <Button
                      className={post.bookmarked ? 'main-action-button main-action-button--active main-action-button--bookmark' : 'main-action-button'}
                      disabled={reactionLoadingKey === 'bookmark-' + post.postId}
                      onClick={(event) => { event.stopPropagation(); handleToggleRelation(post, 'bookmark'); }}
                      startIcon={post.bookmarked ? <BookmarkRoundedIcon /> : <BookmarkBorderRoundedIcon />}
                    >
                      {post.bookmarked ? copy.saved : copy.save}
                    </Button>
                  </Box>

                  {commentPostId === post.postId && (
                    <Box className="main-comment-panel" onClick={(event) => event.stopPropagation()}>
                      <Box className="main-comment-compose">
                        <Avatar className="main-avatar main-avatar--comment" src={avatarSrc}>{displayName.charAt(0)}</Avatar>
                        <TextField
                          className="main-comment-input"
                          fullWidth
                          minRows={2}
                          multiline
                          onChange={(event) => handleCommentChange(post.postId, event.target.value)}
                          placeholder={copy.commentPlaceholder}
                          value={commentDrafts[post.postId] || ''}
                        />
                        <Button
                          className="main-comment-submit"
                          disabled={!String(commentDrafts[post.postId] || '').trim() || commentSubmittingPostId === post.postId}
                          onClick={() => handleSubmitComment(post)}
                          variant="contained"
                        >
                          {commentSubmittingPostId === post.postId ? copy.commentSubmitting : copy.commentSubmit}
                        </Button>
                      </Box>

                      {commentLoadingPostId === post.postId ? (
                        <Box className="main-comment-state"><CircularProgress size={20} /></Box>
                      ) : (commentsByPostId[post.postId] || []).length > 0 ? (
                        <Stack className="main-comment-list">
                          {(commentsByPostId[post.postId] || []).map((comment) => (
                            <Box className="main-comment" key={comment.postId}>
                              <Avatar className="main-avatar main-avatar--comment">{comment.user.nickname.charAt(0)}</Avatar>
                              <Box className="main-comment__body">
                                <Box className="main-comment__meta-row">
                                  <Typography className="main-comment__name">{comment.user.nickname}</Typography>
                                  <Typography className="main-post__meta">@{formatPostUsername(comment.user.username)} {'\u00b7'} {formatRelativeTime(comment.createdAt)}</Typography>
                                </Box>
                                <Typography className="main-comment__content">{comment.content}</Typography>
                              </Box>
                            </Box>
                          ))}
                        </Stack>
                      ) : (
                        <Typography className="main-comment-empty">{copy.commentEmpty}</Typography>
                      )}
                    </Box>
                  )}
                </Box>
              </Box>
            ))}
          </Stack>

          <Popover
            anchorEl={postMenuAnchorEl}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            className={isDarkMode ? 'main-post-menu main-post-menu--dark' : 'main-post-menu'}
            onClose={handlePostMenuClose}
            open={isPostMenuOpen}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            transitionDuration={0}
          >
            <Box className="main-post-menu__content" key={postMenuPost?.postId + '-' + (isPostMenuMine ? 'mine' : 'other')}>
              {isPostMenuMine ? (
                <>
                  <Button className="main-post-menu__item" fullWidth onClick={handleStartEdit}>{copy.editPost}</Button>
                  <Button className="main-post-menu__item main-post-menu__danger" fullWidth onClick={handleDeletePost}>{copy.deletePost}</Button>
                </>
              ) : (
                <>
                  <Button className="main-post-menu__item" fullWidth onClick={handlePreparedMenuAction}>{copy.followUser}</Button>
                  <Button className="main-post-menu__item main-post-menu__danger" fullWidth onClick={handlePreparedMenuAction}>{copy.blockUser}</Button>
                </>
              )}
              <Button className="main-post-menu__item" fullWidth onClick={handleCopyPostUrl}>{copy.copyUrl}</Button>
              <Button className="main-post-menu__item main-post-menu__danger" fullWidth onClick={handlePreparedMenuAction}>{copy.reportPost}</Button>
            </Box>
          </Popover>

          <Popover
            anchorEl={repostMenuAnchorEl}
            anchorOrigin={{ horizontal: 'left', vertical: 'bottom' }}
            className={isDarkMode ? 'main-repost-menu main-repost-menu--dark' : 'main-repost-menu'}
            onClose={handleRepostMenuClose}
            open={isRepostMenuOpen}
            transformOrigin={{ horizontal: 'left', vertical: 'top' }}
            transitionDuration={0}
          >
            <Box className="main-repost-menu__content">
              <Button className="main-repost-menu__item" fullWidth onClick={handleConfirmRepost} startIcon={<RepeatRoundedIcon />}>{copy.repostAction}</Button>
              <Button className="main-repost-menu__item" fullWidth onClick={handleQuotePost} startIcon={<EditRoundedIcon />}>{copy.quoteAction}</Button>
            </Box>
          </Popover>

          <PostComposerDialog
            avatarSrc={avatarSrc}
            displayName={displayName}
            isDarkMode={isDarkMode}
            onClose={handleQuoteDialogClose}
            onPostCreated={handleQuotePostCreated}
            open={Boolean(quoteDialogPost)}
            quotePost={quoteDialogPost}
            user={user}
          />

          <Box ref={loadMoreTargetRef} className="main-scroll-sentinel" />
          {loadingMore && <Box className="main-feed-state main-feed-state--compact"><CircularProgress size={22} /><Typography>{copy.loadingMore}</Typography></Box>}
          {!hasMore && !loadingMore && posts.length > 0 && <Box className="main-feed-state main-feed-state--compact"><Typography>{copy.endOfFeed}</Typography></Box>}
        </>
      )}
    </Box>
  );
}

export default Home;


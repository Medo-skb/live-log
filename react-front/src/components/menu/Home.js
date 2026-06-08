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
import { useAppModal } from '../common/ModalProvider';
import { CATEGORY_ALL, CATEGORY_ALL_ID, DEFAULT_CATEGORIES } from '../../constants/categories';
import { getTagSearchPath, getVisibleTags } from '../../utils/tagDisplay';

const PAGE_SIZE = 20;
const NEW_POST_POLL_MS = 30000;
const copy = {
  category: '카테고리',
  spoiler: '스포일러',
  workName: '작품명',
  progress: '진도',
  placeholder: '지금 보는 작품의 순간을 남겨보세요.',
  submit: '게시하기',
  submitting: '게시 중',
  fileAttach: '파일 첨부',
  tagButton: '태그',
  save: '저장',
  saved: '저장됨',
  commentPlaceholder: '댓글을 입력해주세요.',
  commentSubmit: '댓글',
  commentSubmitting: '등록 중',
  commentEmpty: '아직 댓글이 없습니다.',
  empty: '아직 등록된 로그가 없습니다.',
  loadError: '게시글을 불러오지 못했습니다.',
  loadingMore: '이전 로그를 불러오는 중...',
  endOfFeed: '더 이상 불러올 로그가 없습니다.',
  newPosts: (count) => `${count}개의 새로운 포스트 보기`,
  editMode: '수정 중인 게시글입니다.',
  updateSubmit: '수정 완료',
  cancelEdit: '수정 취소',
  editPost: '수정하기',
  deletePost: '삭제하기',
  followUser: '팔로우하기',
  blockUser: '차단하기',
  copyUrl: 'URL 복사',
  reportPost: '게시물 신고하기',
  repostAction: '재게시',
  quoteAction: '인용하세요',
  deleteConfirmTitle: '게시물을 삭제할까요?',
  deleteConfirmBody: '이 동작은 취소할 수 없으며 내 프로필, 나를 팔로우하는 계정의 타임라인, 그리고 검색 결과에서 삭제됩니다.',
  deleteConfirmButton: '삭제하기',
  cancel: '취소',
  copiedUrlTitle: 'URL이 복사되었습니다.',
  copiedUrlBody: '게시물 링크를 클립보드에 저장했습니다.',
  copyFailedTitle: 'URL을 복사하지 못했습니다.',
  copyFailedBody: '아래 링크를 직접 복사해주세요.',
  nextFeatureTitle: '준비 중인 기능입니다.',
  nextFeature: '이 기능은 다음 단계에서 API를 연결하겠습니다.',
};
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3010';

function resolveMediaUrl(fileUrl) {
  if (!fileUrl) return '';
  return fileUrl.startsWith('http') ? fileUrl : API_BASE_URL + fileUrl;
}

function parseManualTags(value) {
  return [...new Set(String(value || '')
    .split(/[\s,]+/)
    .map((tag) => tag.replace(/^#/, '').trim())
    .filter(Boolean))]
    .slice(0, 5);
}

function isPostVisibleByCategory(post, activeCategoryId) {
  return activeCategoryId === CATEGORY_ALL_ID || post.categoryId === activeCategoryId;
}

function getTimelineKey(post) {
  if (!post) return '';

  if (post.repostedBy?.userId) {
    return 'repost-' + post.repostedBy.userId + '-' + post.postId;
  }

  return 'post-' + post.postId;
}

function getMissingTimelinePosts(currentPosts, incomingPosts) {
  const existingKeys = new Set(currentPosts.map(getTimelineKey));
  return incomingPosts.filter((post) => !existingKeys.has(getTimelineKey(post)));
}

function parseTimelineCreatedAt(post) {
  const value = post?.timelineAt || post?.createdAt;
  const parsedDate = new Date(String(value || '').replace(' ', 'T'));
  return Number.isNaN(parsedDate.getTime()) ? 0 : parsedDate.getTime();
}

function sortTimelinePosts(posts) {
  return [...posts].sort((a, b) => {
    const timeDiff = parseTimelineCreatedAt(b) - parseTimelineCreatedAt(a);
    if (timeDiff !== 0) return timeDiff;
    return Number(b.postId || 0) - Number(a.postId || 0);
  });
}

function mergeUniquePosts(currentPosts, incomingPosts) {
  const postMap = new Map();

  [...incomingPosts, ...currentPosts].forEach((post) => {
    postMap.set(getTimelineKey(post), post);
  });

  return sortTimelinePosts(Array.from(postMap.values()));
}

function appendUniquePosts(currentPosts, incomingPosts) {
  const existingIds = new Set(currentPosts.map(getTimelineKey));
  return [...currentPosts, ...incomingPosts.filter((post) => !existingIds.has(getTimelineKey(post)))];
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

  if (diffMinutes < 1) return '1분 미만';
  if (diffMinutes < 60) return diffMinutes + '분 전';

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return diffHours + '시간 전';

  return String(createdDate.getMonth() + 1) + '/' + String(createdDate.getDate());
}

function isMyPost(post, user) {
  return Number(post?.user?.userId) === Number(user?.userId);
}

function isMyRepost(post, user) {
  return Number(post?.repostedBy?.userId) === Number(user?.userId);
}

function getRepostLabel(post, user) {
  if (!post?.repostedBy) return '';
  if (isMyRepost(post, user)) return '리포스트했습니다.';
  return (post.repostedBy.nickname || post.repostedBy.username || '사용자') + ' 님이 리포스트했습니다.';
}

function getPostDetailPath(post) {
  return '/' + encodeURIComponent(formatPostUsername(post?.user?.username)) + '/status/' + post?.postId;
}

function getPostPhotoPath(post, photoIndex) {
  return getPostDetailPath(post) + '/photo/' + photoIndex;
}

function QuotePostCard({ post }) {
  if (!post) return null;

  return (
    <Box className="main-quote-preview-card main-quote-preview-card--embedded">
      <Box className="main-quote-preview-card__author">
        <Avatar className="main-avatar main-avatar--quote" src={resolveMediaUrl(post.user.profileImageUrl || post.user.profileImage)}>{post.user.nickname.charAt(0)}</Avatar>
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
      {post.media?.length > 0 && (
        <Box className="main-quote-preview-card__media">
          {post.media.map((media) => (
            media.mediaType === 'VIDEO'
              ? <video controls key={media.mediaId} src={resolveMediaUrl(media.fileUrl)} />
              : <img alt="quoted post media" key={media.mediaId} src={resolveMediaUrl(media.fileUrl)} />
          ))}
        </Box>
      )}
    </Box>
  );
}


function Home() {
  const navigate = useNavigate();
  const appModal = useAppModal();
  const { avatarSrc, displayName, isDarkMode, user } = useOutletContext();
  const [activeCategoryId, setActiveCategoryId] = useState(CATEGORY_ALL_ID);
  const [content, setContent] = useState('');
  const [tagInputOpen, setTagInputOpen] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [workTitle, setWorkTitle] = useState('');
  const [progress, setProgress] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [posts, setPosts] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [newPostCount, setNewPostCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
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
  const [revealedSpoilerPosts, setRevealedSpoilerPosts] = useState({});
  const mediaInputRef = useRef(null);
  const loadMoreTargetRef = useRef(null);
  const loadMoreRef = useRef(null);
  const postsRef = useRef([]);
  const selectedCategoryIdRef = useRef(undefined);
  const checkingNewPostsRef = useRef(false);

  const userCategories = Array.isArray(user?.categories) && user.categories.length > 0
    ? user.categories
    : DEFAULT_CATEGORIES;
  const feedCategoryItems = [CATEGORY_ALL, ...userCategories];
  const selectedCategoryId = activeCategoryId === CATEGORY_ALL_ID ? undefined : activeCategoryId;
  const isSubmitDisabled = !categoryId || !workTitle.trim() || !progress.trim() || !content.trim() || submitLoading;
  const isPostMenuOpen = Boolean(postMenuAnchorEl);
  const isPostMenuMine = isMyPost(postMenuPost, user);
  const isRepostMenuOpen = Boolean(repostMenuAnchorEl);
  const handleRevealSpoiler = (event, postId) => {
    event.stopPropagation();
    setRevealedSpoilerPosts((prev) => ({ ...prev, [postId]: true }));
  };

  useEffect(() => {
    postsRef.current = posts;
  }, [posts]);

  useEffect(() => {
    selectedCategoryIdRef.current = selectedCategoryId;
  }, [selectedCategoryId]);

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
    const checkNewPosts = async () => {
      const currentPosts = postsRef.current;
      if (currentPosts.length === 0 || checkingNewPostsRef.current) return;

      checkingNewPostsRef.current = true;

      try {
        const data = await getPosts({
          categoryId: selectedCategoryIdRef.current,
          limit: PAGE_SIZE,
        });
        const latestPosts = Array.isArray(data.posts) ? data.posts : [];
        setNewPostCount(getMissingTimelinePosts(currentPosts, latestPosts).length);
      } catch (requestError) {
        // 새 포스트 확인 중 오류가 발생해도 무시합니다.
      } finally {
        checkingNewPostsRef.current = false;
      }
    };

    const timerId = window.setInterval(checkNewPosts, NEW_POST_POLL_MS);

    return () => {
      window.clearInterval(timerId);
    };
  }, []);

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
    setTagInput('');
    setTagInputOpen(false);
    setSelectedMediaFiles([]);
    setEditingPostId(null);
    if (mediaInputRef.current) mediaInputRef.current.value = '';
  };

  const handleContentChange = (event) => {
    setContent(event.target.value);
  };

  const handleOpenProfile = (event, postUser) => {
    event.stopPropagation();
    if (postUser?.username) navigate('/' + encodeURIComponent(postUser.username));
  };

  const handleOpenPostDetail = (post) => {
    navigate(getPostDetailPath(post));
  };

  const handleOpenPostPhoto = (event, post, photoIndex) => {
    event.stopPropagation();
    navigate(getPostPhotoPath(post, photoIndex));
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
    setTagInput((postMenuPost.tags || []).map((tag) => '#' + tag).join(' '));
    setTagInputOpen(Boolean((postMenuPost.tags || []).length));
    setSelectedMediaFiles([]);
    if (mediaInputRef.current) mediaInputRef.current.value = '';
    handlePostMenuClose();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    resetComposer();
  };

  const handleDeletePost = async () => {
    if (!postMenuPost) return;

    const confirmed = await appModal.showConfirm({
      title: copy.deleteConfirmTitle,
      message: copy.deleteConfirmBody,
      confirmText: copy.deleteConfirmButton,
      cancelText: copy.cancel,
      variant: 'danger',
    });

    if (!confirmed) return;

    const targetPostId = postMenuPost.postId;
    handlePostMenuClose();
    setError('');

    try {
      await deletePost({ postId: targetPostId });
      setPosts((prevPosts) => prevPosts.filter((post) => post.postId !== targetPostId));
      if (editingPostId === targetPostId) resetComposer();
    } catch (requestError) {
      setError(requestError.message || '게시글 삭제 중 오류가 발생했습니다.');
    }
  };

  const handleCopyPostUrl = async () => {
    if (!postMenuPost) return;

    const url = window.location.origin + getPostDetailPath(postMenuPost);
    handlePostMenuClose();

    try {
      await navigator.clipboard.writeText(url);
      await appModal.showAlert({
        title: copy.copiedUrlTitle,
        message: copy.copiedUrlBody,
      });
    } catch (copyError) {
      await appModal.showAlert({
        title: copy.copyFailedTitle,
        message: copy.copyFailedBody + '\n' + url,
      });
    }
  };

  const handlePreparedMenuAction = () => {
    handlePostMenuClose();
    appModal.showAlert({
      title: copy.nextFeatureTitle,
      message: copy.nextFeature,
    });
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
      const nextCount = Number(data.count) || 0;
      updatePostById(post.postId, (currentPost) => ({
        ...currentPost,
        [config.stateKey]: Boolean(data[config.stateKey]),
        counts: {
          ...currentPost.counts,
          [config.countKey]: nextCount,
        },
      }));

      if (relationType === 'repost') {
        if (data.reposted) {
          const repostEvent = {
            ...post,
            reposted: true,
            repostedBy: user,
            timelineId: 'repost-local-' + Date.now() + '-' + post.postId,
            timelineAt: new Date().toISOString(),
            counts: {
              ...post.counts,
              reposts: nextCount,
            },
          };
          setPosts((prevPosts) => mergeUniquePosts(prevPosts, [repostEvent]));
        } else {
          setPosts((prevPosts) => prevPosts.filter((currentPost) => !(
            currentPost.postId === post.postId
            && currentPost.repostedBy
            && Number(currentPost.repostedBy.userId) === Number(user?.userId)
          )));
        }
      }
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
    const currentPosts = postsRef.current;
    if (!currentPosts.length || newPostCount === 0) return;

    const maxId = Math.max(...currentPosts.map(p => Number(p.postId) || 0));

    setLoading(true);
    setError('');

    try {
      const data = await getPosts({
        categoryId: selectedCategoryIdRef.current,
        afterPostId: maxId,
        limit: PAGE_SIZE,
      });
      const freshPosts = Array.isArray(data.posts) ? data.posts : [];
      if (freshPosts.length > 0) {
        setPosts((prevPosts) => mergeUniquePosts(prevPosts, freshPosts));
      }
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
        tags: parseManualTags(tagInput),
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
      setError(requestError.message || '게시글 등록 중 오류가 발생했습니다.');
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
              <Button className="main-tool-text-button" onClick={() => setTagInputOpen((prev) => !prev)} startIcon={<TagRoundedIcon />}>
                {copy.tagButton}
              </Button>
            </Stack>
            <Stack alignItems="center" className="main-composer__post-actions" direction="row" spacing={1.4}>
              <Button className="main-submit-button main-submit-button--post" disabled={isSubmitDisabled} onClick={handleSubmit} size="large" variant="contained">
                {submitLoading ? copy.submitting : editingPostId ? copy.updateSubmit : copy.submit}
              </Button>
            </Stack>          </Box>
          {tagInputOpen && (
            <TextField
              className="main-tag-input"
              fullWidth
              onChange={(event) => setTagInput(event.target.value)}
              placeholder="태그를 직접 입력하세요. 예: #결말 #엔딩게임"
              value={tagInput}
            />
          )}
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
            {posts.map((post) => {
              const spoilerHidden = Boolean(post.isSpoiler && !isMyPost(post, user) && !revealedSpoilerPosts[post.postId]);

              return (
              <Box component="article" className="main-post main-post--clickable" key={getTimelineKey(post)} onClick={() => handleOpenPostDetail(post)} onKeyDown={(event) => { if (event.key === 'Enter') handleOpenPostDetail(post); }} role="button" tabIndex={0}>
                <Avatar className="main-avatar main-post__profile-link" onClick={(event) => handleOpenProfile(event, post.user)} src={resolveMediaUrl(post.user.profileImageUrl || post.user.profileImage)}>{post.user.nickname.charAt(0)}</Avatar>
                <Box className={spoilerHidden ? 'main-post__body main-post__body--spoiler-hidden' : 'main-post__body'}>
                  {post.repostedBy && <Typography className="main-repost-label"><RepeatRoundedIcon /> {getRepostLabel(post, user)}</Typography>}
                  <Box className="main-post__topline">
                    <Box className="main-post__author-line">
                      <Typography className="main-post__name main-post__profile-link" onClick={(event) => handleOpenProfile(event, post.user)}>{post.user.nickname}</Typography>
                      <Typography className="main-post__meta">@{formatPostUsername(post.user.username)} · {formatRelativeTime(post.createdAt)}</Typography>
                    </Box>
                    <IconButton aria-label="more" className="main-icon-button main-icon-button--small" onClick={(event) => { event.stopPropagation(); handlePostMenuOpen(event, post); }}><MoreHorizRoundedIcon /></IconButton>
                  </Box>

                  {spoilerHidden && (
                    <Box className="main-spoiler-gate" onClick={(event) => event.stopPropagation()}>
                      <Typography className="main-spoiler-gate__title">스포일러가 포함된 글입니다.</Typography>
                      <Typography className="main-spoiler-gate__message">태그, 이미지, 인용글에 스포일러가 포함될 수 있습니다.</Typography>
                      <Button className="main-spoiler-gate__button" onClick={(event) => handleRevealSpoiler(event, post.postId)}>게시글 보기</Button>
                    </Box>
                  )}

                  <Box className="main-work-chip-row">
                    <Chip className="main-work-chip" label={post.categoryName} size="small" />
                    <Chip className="main-work-chip main-work-chip--dark" label={post.workTitle} size="small" />
                    <Chip className="main-work-chip" label={post.progress} size="small" />
                    {post.isSpoiler && <Chip className="main-spoiler-chip" icon={<VisibilityOffRoundedIcon />} label={copy.spoiler} size="small" />}
                  </Box>

                  {String(post.content || '').trim() && <Typography className={post.isSpoiler ? 'main-post__content main-post__content--spoiler' : 'main-post__content'}>{post.content}</Typography>}

                  {post.media?.length > 0 && (
                    <Box className="main-media-list" onClick={(event) => event.stopPropagation()}>
                      {post.media.map((media) => {
                        const photoIndex = post.media.filter((item) => item.mediaType === 'IMAGE').findIndex((item) => item.mediaId === media.mediaId) + 1;

                        return (
                          <Box className="main-media-item" key={media.mediaId}>
                            {media.mediaType === 'IMAGE' && <img alt="post media" className="main-media-clickable" onClick={(event) => handleOpenPostPhoto(event, post, photoIndex)} src={resolveMediaUrl(media.fileUrl)} />}
                            {media.mediaType === 'VIDEO' && <video controls src={resolveMediaUrl(media.fileUrl)} />}
                          </Box>
                        );
                      })}
                    </Box>
                  )}

                  {post.quotePost && <QuotePostCard post={post.quotePost} />}

                  {getVisibleTags(post).length > 0 && (
                    <Stack className="main-tag-row" direction="row" spacing={0.75}>
                      {getVisibleTags(post).map((tag) => <button className="main-tag main-tag--button" key={tag} onClick={(event) => { event.stopPropagation(); navigate(getTagSearchPath(tag)); }} type="button">#{tag}</button>)}
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
                                  <Typography className="main-post__meta">@{formatPostUsername(comment.user.username)} · {formatRelativeTime(comment.createdAt)}</Typography>
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
              );
            })}
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
                  <Button className="main-post-menu__item" fullWidth onClick={handleCopyPostUrl}>{copy.copyUrl}</Button>
                  <Button className="main-post-menu__item main-post-menu__danger" fullWidth onClick={handleDeletePost}>{copy.deletePost}</Button>
                </>
              ) : (
                <>
                  <Button className="main-post-menu__item" fullWidth onClick={handlePreparedMenuAction}>{copy.followUser}</Button>
                  <Button className="main-post-menu__item" fullWidth onClick={handleCopyPostUrl}>{copy.copyUrl}</Button>
                  <Button className="main-post-menu__item main-post-menu__danger" fullWidth onClick={handlePreparedMenuAction}>{copy.blockUser}</Button>
                </>
              )}
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

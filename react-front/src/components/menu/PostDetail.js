import { useEffect, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Popover,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import BookmarkBorderRoundedIcon from '@mui/icons-material/BookmarkBorderRounded';
import BookmarkRoundedIcon from '@mui/icons-material/BookmarkRounded';
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import FavoriteBorderRoundedIcon from '@mui/icons-material/FavoriteBorderRounded';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import RepeatRoundedIcon from '@mui/icons-material/RepeatRounded';
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded';
import {
  getPost,
  getPostComments,
  createPostComment,
  togglePostLike,
  togglePostRepost,
  togglePostBookmark,
} from '../../api/postApi';
import PostComposerDialog from '../post/PostComposerDialog';

const COMMENT_LIMIT = 20;
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3010';

function resolveMediaUrl(fileUrl) {
  if (!fileUrl) return '';
  return fileUrl.startsWith('http') ? fileUrl : API_BASE_URL + fileUrl;
}

function parsePostCreatedAt(createdAt) {
  if (!createdAt) return null;

  const parsedDate = new Date(String(createdAt).replace(' ', 'T'));
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function formatRelativeTime(createdAt) {
  const createdDate = parsePostCreatedAt(createdAt);
  if (!createdDate) return createdAt || '';

  const diffMinutes = Math.floor((Date.now() - createdDate.getTime()) / 60000);
  if (diffMinutes < 1) return '1분 미만';
  if (diffMinutes < 60) return diffMinutes + '분 전';

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return diffHours + '시간 전';

  return String(createdDate.getMonth() + 1) + '/' + String(createdDate.getDate());
}

function formatAbsoluteTime(createdAt) {
  const createdDate = parsePostCreatedAt(createdAt);
  if (!createdDate) return createdAt || '';

  const year = createdDate.getFullYear();
  const month = createdDate.getMonth() + 1;
  const day = createdDate.getDate();
  const hour = String(createdDate.getHours()).padStart(2, '0');
  const minute = String(createdDate.getMinutes()).padStart(2, '0');

  return `${year}년 ${month}월 ${day}일 ${hour}:${minute}`;
}

function formatUsername(username) {
  return String(username || 'user');
}

function QuotePostCard({ post }) {
  if (!post) return null;

  return (
    <Box className="main-quote-preview-card main-quote-preview-card--embedded">
      <Box className="main-quote-preview-card__author">
        <Avatar className="main-avatar main-avatar--quote">{post.user.nickname.charAt(0)}</Avatar>
        <Box className="main-quote-preview-card__author-text">
          <Typography className="main-quote-preview-card__name">{post.user.nickname}</Typography>
          <Typography className="main-post__meta">@{formatUsername(post.user.username)} · {formatRelativeTime(post.createdAt)}</Typography>
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


function PostDetail() {
  const { postId } = useParams();
  const navigate = useNavigate();
  const { avatarSrc, displayName, isDarkMode, user } = useOutletContext();
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [commentDraft, setCommentDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [commentLoading, setCommentLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [reactionLoadingKey, setReactionLoadingKey] = useState('');
  const [repostMenuAnchorEl, setRepostMenuAnchorEl] = useState(null);
  const [quoteDialogOpen, setQuoteDialogOpen] = useState(false);
  const [error, setError] = useState('');

  const isRepostMenuOpen = Boolean(repostMenuAnchorEl);

  useEffect(() => {
    let ignore = false;

    setLoading(true);
    setError('');

    Promise.all([
      getPost({ postId }),
      getPostComments({ postId, limit: COMMENT_LIMIT }),
    ])
      .then(([postData, commentData]) => {
        if (ignore) return;
        setPost(postData.post || null);
        setComments(Array.isArray(commentData.comments) ? commentData.comments : []);
        setNextCursor(commentData.nextCursor || null);
        setHasMore(Boolean(commentData.hasMore));
      })
      .catch((requestError) => {
        if (!ignore) setError(requestError.message || '게시글을 불러오지 못했습니다.');
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [postId]);

  const handleRepostMenuOpen = (event) => {
    setRepostMenuAnchorEl(event.currentTarget);
  };

  const handleRepostMenuClose = () => {
    setRepostMenuAnchorEl(null);
  };

  const handleConfirmRepost = async () => {
    handleRepostMenuClose();
    await handleToggleRelation('repost');
  };

  const handleQuotePost = () => {
    setQuoteDialogOpen(true);
    handleRepostMenuClose();
  };

  const handleQuoteDialogClose = () => {
    setQuoteDialogOpen(false);
  };

  const handleQuotePostCreated = (createdPost) => {
    if (createdPost) {
      window.dispatchEvent(new CustomEvent('liveLogPostCreated', { detail: createdPost }));
    }
  };

  const handleToggleRelation = async (relationType) => {
    if (!post) return;

    const actionKey = relationType + '-' + post.postId;
    if (reactionLoadingKey === actionKey) return;

    const config = {
      like: { request: togglePostLike, stateKey: 'liked', countKey: 'likes' },
      repost: { request: togglePostRepost, stateKey: 'reposted', countKey: 'reposts' },
      bookmark: { request: togglePostBookmark, stateKey: 'bookmarked', countKey: 'bookmarks' },
    }[relationType];

    if (!config) return;

    setReactionLoadingKey(actionKey);
    setError('');

    try {
      const data = await config.request({ postId: post.postId });
      setPost((prevPost) => ({
        ...prevPost,
        [config.stateKey]: Boolean(data[config.stateKey]),
        counts: {
          ...prevPost.counts,
          [config.countKey]: Number(data.count) || 0,
        },
      }));
    } catch (requestError) {
      setError(requestError.message || '요청 처리 중 오류가 발생했습니다.');
    } finally {
      setReactionLoadingKey('');
    }
  };

  const handleSubmitComment = async () => {
    const content = commentDraft.trim();
    if (!post || !content || submitLoading) return;

    setSubmitLoading(true);
    setError('');

    try {
      const data = await createPostComment({ postId: post.postId, content, isSpoiler: false });

      if (data.comment) {
        setComments((prevComments) => [data.comment, ...prevComments]);
        setPost((prevPost) => ({
          ...prevPost,
          counts: {
            ...prevPost.counts,
            comments: Number(prevPost.counts.comments || 0) + 1,
          },
        }));
      }

      setCommentDraft('');
    } catch (requestError) {
      setError(requestError.message || '댓글 등록 중 오류가 발생했습니다.');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleLoadMoreComments = async () => {
    if (!nextCursor || commentLoading) return;

    setCommentLoading(true);
    setError('');

    try {
      const data = await getPostComments({ postId, cursor: nextCursor, limit: COMMENT_LIMIT });
      const nextComments = Array.isArray(data.comments) ? data.comments : [];
      const existingIds = new Set(comments.map((comment) => comment.postId));

      setComments((prevComments) => [...prevComments, ...nextComments.filter((comment) => !existingIds.has(comment.postId))]);
      setNextCursor(data.nextCursor || null);
      setHasMore(Boolean(data.hasMore));
    } catch (requestError) {
      setError(requestError.message || '댓글을 더 불러오지 못했습니다.');
    } finally {
      setCommentLoading(false);
    }
  };

  return (
    <Box component="main" className="main-feed post-detail-page">
      <Box className="post-detail-header">
        <IconButton className="main-icon-button" onClick={() => navigate(-1)} aria-label="뒤로가기">
          <ArrowBackRoundedIcon />
        </IconButton>
        <Typography className="post-detail-header__title">게시물</Typography>
      </Box>

      {error && <Alert className="main-form-alert" severity="error">{error}</Alert>}

      {loading ? (
        <Box className="main-feed-state"><CircularProgress size={28} /></Box>
      ) : !post ? (
        <Box className="main-feed-state"><Typography>게시글을 찾을 수 없습니다.</Typography></Box>
      ) : (
        <>
          <Box className="post-detail-card">
            <Box className="post-detail-author-row">
              <Avatar className="main-avatar">{post.user.nickname.charAt(0)}</Avatar>
              <Box>
                <Typography className="post-detail-author__name">{post.user.nickname}</Typography>
                <Typography className="main-post__meta">@{formatUsername(post.user.username)}</Typography>
              </Box>
            </Box>

            <Stack className="main-work-chip-row" direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
              <Chip className="main-work-chip" label={post.categoryName} size="small" />
              <Chip className="main-work-chip main-work-chip--dark" label={post.workTitle} size="small" />
              <Chip className="main-work-chip" label={post.progress} size="small" />
              {post.isSpoiler && <Chip className="main-spoiler-chip" icon={<VisibilityOffRoundedIcon />} label="스포일러" size="small" />}
            </Stack>

            {String(post.content || '').trim() && <Typography className={post.isSpoiler ? 'post-detail-content post-detail-content--spoiler' : 'post-detail-content'}>{post.content}</Typography>}

            {post.media?.length > 0 && (
              <Box className="main-media-list">
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

            <Typography className="post-detail-time">{formatAbsoluteTime(post.createdAt)}</Typography>

            <Box className="post-detail-stats">
              <Typography><strong>{post.counts.comments}</strong> 댓글</Typography>
              <Typography><strong>{post.counts.reposts}</strong> 리포스트</Typography>
              <Typography><strong>{post.counts.likes}</strong> 좋아요</Typography>
              <Typography><strong>{post.counts.bookmarks}</strong> 북마크</Typography>
            </Box>

            <Box className="post-detail-actions">
              <Button className="main-action-button" startIcon={<ChatBubbleOutlineRoundedIcon />}>{post.counts.comments}</Button>
              <Button
                className={post.reposted ? 'main-action-button main-action-button--active main-action-button--repost' : 'main-action-button'}
                disabled={reactionLoadingKey === 'repost-' + post.postId}
                onClick={handleRepostMenuOpen}
                startIcon={<RepeatRoundedIcon />}
              >
                {post.counts.reposts}
              </Button>
              <Button
                className={post.liked ? 'main-action-button main-action-button--active main-action-button--like' : 'main-action-button'}
                disabled={reactionLoadingKey === 'like-' + post.postId}
                onClick={() => handleToggleRelation('like')}
                startIcon={post.liked ? <FavoriteRoundedIcon /> : <FavoriteBorderRoundedIcon />}
              >
                {post.counts.likes}
              </Button>
              <Button
                className={post.bookmarked ? 'main-action-button main-action-button--active main-action-button--bookmark' : 'main-action-button'}
                disabled={reactionLoadingKey === 'bookmark-' + post.postId}
                onClick={() => handleToggleRelation('bookmark')}
                startIcon={post.bookmarked ? <BookmarkRoundedIcon /> : <BookmarkBorderRoundedIcon />}
              >
                {post.bookmarked ? '저장됨' : '저장'}
              </Button>
            </Box>
          </Box>

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
              <Button className="main-repost-menu__item" fullWidth onClick={handleConfirmRepost} startIcon={<RepeatRoundedIcon />}>재게시</Button>
              <Button className="main-repost-menu__item" fullWidth onClick={handleQuotePost} startIcon={<EditRoundedIcon />}>인용하세요</Button>
            </Box>
          </Popover>

          <PostComposerDialog
            avatarSrc={avatarSrc}
            displayName={displayName}
            isDarkMode={isDarkMode}
            onClose={handleQuoteDialogClose}
            onPostCreated={handleQuotePostCreated}
            open={quoteDialogOpen}
            quotePost={post}
            user={user}
          />

          <Box className="post-detail-reply-box">
            <Avatar className="main-avatar" src={avatarSrc}>{displayName.charAt(0)}</Avatar>
            <TextField
              className="post-detail-reply-input"
              fullWidth
              minRows={2}
              multiline
              onChange={(event) => setCommentDraft(event.target.value.slice(0, 4000))}
              placeholder="댓글 게시하기"
              value={commentDraft}
            />
            <Button
              className="main-comment-submit"
              disabled={!commentDraft.trim() || submitLoading}
              onClick={handleSubmitComment}
              variant="contained"
            >
              {submitLoading ? '등록 중' : '댓글'}
            </Button>
          </Box>

          <Stack className="post-detail-comment-list">
            {comments.map((comment) => (
              <Box className="post-detail-comment" key={comment.postId}>
                <Avatar className="main-avatar main-avatar--comment">{comment.user.nickname.charAt(0)}</Avatar>
                <Box className="post-detail-comment__body">
                  <Box className="main-comment__meta-row">
                    <Typography className="main-comment__name">{comment.user.nickname}</Typography>
                    <Typography className="main-post__meta">@{formatUsername(comment.user.username)} · {formatRelativeTime(comment.createdAt)}</Typography>
                  </Box>
                  <Typography className="main-comment__content">{comment.content}</Typography>
                </Box>
              </Box>
            ))}
          </Stack>

          {comments.length === 0 && <Box className="main-feed-state main-feed-state--compact"><Typography>아직 댓글이 없습니다.</Typography></Box>}

          {hasMore && (
            <Box className="post-detail-more-row">
              <Button className="main-menu-screen__button" disabled={commentLoading} onClick={handleLoadMoreComments} variant="contained">
                {commentLoading ? '불러오는 중' : '댓글 더 보기'}
              </Button>
            </Box>
          )}
        </>
      )}
    </Box>
  );
}

export default PostDetail;
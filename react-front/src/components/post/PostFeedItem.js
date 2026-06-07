import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, Box, Button, Chip, CircularProgress, IconButton, Popover, Stack, TextField, Typography } from '@mui/material';
import BookmarkBorderRoundedIcon from '@mui/icons-material/BookmarkBorderRounded';
import BookmarkRoundedIcon from '@mui/icons-material/BookmarkRounded';
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import FavoriteBorderRoundedIcon from '@mui/icons-material/FavoriteBorderRounded';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded';
import RepeatRoundedIcon from '@mui/icons-material/RepeatRounded';
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded';
import {
  createPostComment,
  deletePost,
  getPostComments,
  reportPost,
  togglePostBookmark,
  togglePostLike,
  togglePostRepost,
} from '../../api/postApi';
import PostComposerDialog from './PostComposerDialog';
import { useAppModal } from '../common/ModalProvider';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3010';
const META_SEPARATOR = '·';

const copy = {
  spoiler: '스포일러',
  save: '저장',
  saved: '저장됨',
  editPost: '수정하기',
  deletePost: '삭제하기',
  followUser: '팔로우하기',
  blockUser: '차단하기',
  copyUrl: 'URL 복사',
  reportPost: '게시물 신고하기',
  reportConfirmTitle: '게시물을 신고할까요?',
  reportConfirmBody: '신고된 게시글은 관리자 검토 후 조치됩니다.',
  reportSuccessTitle: '신고가 접수되었습니다.',
  reportSuccessBody: '빠른 시일 내에 처리하겠습니다.',
  repostAction: '재게시',
  repostCancelAction: '재게시 취소',
  quoteAction: '인용하기',
  deleteConfirmTitle: '게시물을 삭제할까요?',
  deleteConfirmBody: '이 동작은 취소할 수 없으며 내 프로필과 타임라인에서 삭제됩니다.',
  cancel: '취소',
  copiedUrlTitle: 'URL이 복사되었습니다.',
  copiedUrlBody: '게시물 링크를 클립보드에 저장했습니다.',
  copyFailedTitle: 'URL을 복사하지 못했습니다.',
  copyFailedBody: '아래 링크를 직접 복사해주세요.',
  nextFeatureTitle: '준비 중인 기능입니다.',
  nextFeature: '이 기능은 다음 단계에서 업데이트될 예정입니다.',
  deleteError: '게시글 삭제 중 오류가 발생했습니다.',
  commentPlaceholder: '댓글을 입력하세요.',
  commentSubmit: '댓글',
  commentSubmitting: '등록 중',
  commentEmpty: '아직 댓글이 없습니다.',
  repostedByMe: '리포스트했습니다.',
  repostedByUser: '님이 리포스트했습니다.',
};

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

function formatUsername(username) {
  return String(username || 'user');
}

function getInitial(nickname, username) {
  return String(nickname || username || 'L').charAt(0).toUpperCase();
}

function getPostDetailPath(post) {
  return '/' + encodeURIComponent(formatUsername(post?.user?.username)) + '/status/' + post?.postId;
}

function getPostPhotoPath(post, photoIndex) {
  return getPostDetailPath(post) + '/photo/' + photoIndex;
}

function isMyPost(post, viewer) {
  if (!post || !viewer) return false;
  return String(post.user?.username || '') === String(viewer.username || '') || String(post.user?.userId || '') === String(viewer.userId || '');
}

function isMyRepost(post, viewer) {
  if (!post?.repostedBy || !viewer) return false;
  return String(post.repostedBy.userId || '') === String(viewer.userId || '') || String(post.repostedBy.username || '') === String(viewer.username || '');
}

function getRepostLabel(post, viewer) {
  if (!post?.repostedBy) return '';
  if (isMyRepost(post, viewer)) return copy.repostedByMe;
  return (post.repostedBy.nickname || post.repostedBy.username || '사용자') + ' ' + copy.repostedByUser;
}

function PostMeta({ username, createdAt }) {
  return <Typography className="main-post__meta">@{formatUsername(username)} {META_SEPARATOR} {formatRelativeTime(createdAt)}</Typography>;
}

function QuotePostCard({ onOpen, post }) {
  if (!post) return null;
  const user = post.user || {};

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpen?.(event);
    }
  };

  return (
    <Box
      className="main-quote-preview-card main-quote-preview-card--embedded main-quote-preview-card--clickable"
      onClick={onOpen}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
    >
      <Box className="main-quote-preview-card__author">
        <Avatar className="main-avatar main-avatar--quote" src={resolveMediaUrl(user.profileImageUrl || user.profileImage)}>{getInitial(user.nickname, user.username)}</Avatar>
        <Box className="main-quote-preview-card__author-text">
          <Typography className="main-quote-preview-card__name">{user.nickname || user.username}</Typography>
          <PostMeta username={user.username} createdAt={post.createdAt} />
        </Box>
      </Box>
      <Stack className="main-quote-preview-card__chips" direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
        {post.categoryName && <Chip className="main-work-chip" label={post.categoryName} size="small" />}
        {post.workTitle && <Chip className="main-work-chip main-work-chip--dark" label={post.workTitle} size="small" />}
        {post.progress && <Chip className="main-work-chip" label={post.progress} size="small" />}
      </Stack>
      {String(post.content || '').trim() && <Typography className="main-quote-preview-card__content">{post.content}</Typography>}
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


function normalizeTagValue(tag) {
  return String(tag || '').replace(/^#/, '').trim().toLowerCase();
}

function getVisibleTags(post) {
  const content = String(post?.content || '').toLowerCase();
  const seen = new Set();

  return (post?.tags || []).filter((tag) => {
    const normalizedTag = normalizeTagValue(tag);
    if (!normalizedTag || seen.has(normalizedTag)) return false;
    seen.add(normalizedTag);
    return !content.includes('#' + normalizedTag);
  });
}
function PostFeedItem({ isDarkMode = false, onDeleted, onOpen, post, showActions = true, showMenu = true, viewer }) {
  const navigate = useNavigate();
  const appModal = useAppModal();
  const [displayPost, setDisplayPost] = useState(post);
  const [menuAnchorEl, setMenuAnchorEl] = useState(null);
  const [repostMenuAnchorEl, setRepostMenuAnchorEl] = useState(null);
  const [quoteDialogOpen, setQuoteDialogOpen] = useState(false);
  const [commentOpen, setCommentOpen] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [commentDraft, setCommentDraft] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [reactionLoadingKey, setReactionLoadingKey] = useState('');
  const replyInputRef = useRef(null);

  useEffect(() => {
    setDisplayPost(post);
  }, [post]);

  const user = displayPost?.user || {};
  const mine = isMyPost(displayPost, viewer);
  const menuOpen = Boolean(menuAnchorEl);
  const repostMenuOpen = Boolean(repostMenuAnchorEl);
  const repostLabel = getRepostLabel(displayPost, viewer);
  const visibleTags = getVisibleTags(displayPost);

  const stopActionClick = (event) => event.stopPropagation();
  const handleOpen = () => onOpen?.(displayPost);

  const handleOpenPostPhoto = (event, photoIndex) => {
    event.stopPropagation();
    navigate(getPostPhotoPath(displayPost, photoIndex));
  };

  const handleOpenQuotePost = (event) => {
    event.stopPropagation();
    if (!displayPost.quotePost?.postId) return;
    navigate(getPostDetailPath(displayPost.quotePost));
  };

  const handleMenuOpen = (event) => {
    event.stopPropagation();
    setMenuAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => setMenuAnchorEl(null);

  const handleRepostMenuOpen = (event) => {
    event.stopPropagation();
    setRepostMenuAnchorEl(event.currentTarget);
  };

  const handleRepostMenuClose = () => setRepostMenuAnchorEl(null);

  const handlePreparedMenuAction = () => {
    handleMenuClose();
    appModal.showAlert({ title: copy.nextFeatureTitle, message: copy.nextFeature });
  };

  const handleReportPost = async () => {
    handleMenuClose();
    const confirmed = await appModal.showConfirm({
      title: copy.reportConfirmTitle,
      message: copy.reportConfirmBody,
      confirmText: copy.reportPost,
      cancelText: copy.cancel,
      variant: 'danger',
    });

    if (!confirmed) return;

    try {
      await reportPost({ postId: displayPost.postId, reason: '부적절한 내용' });
      await appModal.showAlert({ title: copy.reportSuccessTitle, message: copy.reportSuccessBody });
    } catch (requestError) {
      await appModal.showAlert({ title: copy.nextFeatureTitle, message: requestError.message || copy.nextFeature });
    }
  };

  const handleCopyPostUrl = async () => {
    const url = window.location.origin + getPostDetailPath(displayPost);
    handleMenuClose();
    try {
      await navigator.clipboard.writeText(url);
      await appModal.showAlert({ title: copy.copiedUrlTitle, message: copy.copiedUrlBody });
    } catch (copyError) {
      await appModal.showAlert({ title: copy.copyFailedTitle, message: copy.copyFailedBody + '\n' + url });
    }
  };

  const handleDeletePost = async () => {
    const confirmed = await appModal.showConfirm({
      title: copy.deleteConfirmTitle,
      message: copy.deleteConfirmBody,
      confirmText: copy.deletePost,
      cancelText: copy.cancel,
      variant: 'danger',
    });
    if (!confirmed) return;
    handleMenuClose();
    try {
      await deletePost({ postId: displayPost.postId });
      onDeleted?.(displayPost.postId);
    } catch (requestError) {
      await appModal.showAlert({ title: copy.nextFeatureTitle, message: requestError.message || copy.deleteError });
    }
  };

  const updateRelation = async (relationType) => {
    const actionKey = relationType + '-' + displayPost.postId;
    if (reactionLoadingKey === actionKey) return;

    const config = {
      like: { request: togglePostLike, stateKey: 'liked', countKey: 'likes' },
      repost: { request: togglePostRepost, stateKey: 'reposted', countKey: 'reposts' },
      bookmark: { request: togglePostBookmark, stateKey: 'bookmarked', countKey: 'bookmarks' },
    }[relationType];

    if (!config) return;
    setReactionLoadingKey(actionKey);

    try {
      const data = await config.request({ postId: displayPost.postId });
      const nextCount = Number(data.count) || 0;
      setDisplayPost((prevPost) => ({
        ...prevPost,
        [config.stateKey]: Boolean(data[config.stateKey]),
        counts: { ...prevPost.counts, [config.countKey]: nextCount },
      }));

      if (relationType === 'repost' && data.reposted) {
        window.dispatchEvent(new CustomEvent('liveLogPostCreated', {
          detail: {
            ...displayPost,
            reposted: true,
            repostedBy: viewer,
            timelineId: 'repost-local-' + Date.now() + '-' + displayPost.postId,
            timelineAt: new Date().toISOString(),
            counts: { ...displayPost.counts, reposts: nextCount },
          },
        }));
      }
    } catch (requestError) {
      await appModal.showAlert({ title: copy.nextFeatureTitle, message: requestError.message || copy.nextFeature });
    } finally {
      setReactionLoadingKey('');
    }
  };

  const handleConfirmRepost = async () => {
    handleRepostMenuClose();
    await updateRelation('repost');
  };

  const handleQuotePost = () => {
    handleRepostMenuClose();
    setQuoteDialogOpen(true);
  };

  const handleQuotePostCreated = (createdPost) => {
    if (createdPost) window.dispatchEvent(new CustomEvent('liveLogPostCreated', { detail: createdPost }));
  };

  const handleToggleComments = async () => {
    setCommentOpen((prevOpen) => !prevOpen);
    window.setTimeout(() => replyInputRef.current?.focus(), 0);
    if (commentsLoaded || commentLoading) return;

    setCommentLoading(true);
    try {
      const data = await getPostComments({ postId: displayPost.postId, limit: 10 });
      setComments(Array.isArray(data.comments) ? data.comments : []);
      setCommentsLoaded(true);
    } catch (requestError) {
      await appModal.showAlert({ title: copy.nextFeatureTitle, message: requestError.message || copy.nextFeature });
    } finally {
      setCommentLoading(false);
    }
  };

  const handleSubmitComment = async () => {
    const content = commentDraft.trim();
    if (!content || commentSubmitting) return;

    setCommentSubmitting(true);
    try {
      const data = await createPostComment({ postId: displayPost.postId, content, isSpoiler: false });
      if (data.comment) setComments((prevComments) => [data.comment, ...prevComments]);
      setDisplayPost((prevPost) => ({
        ...prevPost,
        counts: { ...prevPost.counts, comments: Number(prevPost.counts?.comments || 0) + 1 },
      }));
      setCommentDraft('');
      setCommentOpen(true);
      setCommentsLoaded(true);
    } catch (requestError) {
      await appModal.showAlert({ title: copy.nextFeatureTitle, message: requestError.message || copy.nextFeature });
    } finally {
      setCommentSubmitting(false);
    }
  };

  return (
    <Box component="article" className="main-post main-post--clickable" onClick={handleOpen} onKeyDown={(event) => { if (event.key === 'Enter') handleOpen(); }} role="button" tabIndex={0}>
      <Avatar className="main-avatar" src={resolveMediaUrl(user.profileImageUrl || user.profileImage)}>{getInitial(user.nickname, user.username)}</Avatar>
      <Box className="main-post__body">
        {repostLabel && <Typography className="main-repost-label"><RepeatRoundedIcon /> {repostLabel}</Typography>}
        <Box className="main-post__topline">
          <Box className="main-post__author-line">
            <Typography className="main-post__name">{user.nickname || user.username}</Typography>
            <PostMeta username={user.username} createdAt={displayPost.createdAt} />
          </Box>
          {showMenu && <IconButton aria-label="more" className="main-icon-button main-icon-button--small" onClick={handleMenuOpen}><MoreHorizRoundedIcon /></IconButton>}
        </Box>

        <Box className="main-work-chip-row">
          {displayPost.categoryName && <Chip className="main-work-chip" label={displayPost.categoryName} size="small" />}
          {displayPost.workTitle && <Chip className="main-work-chip main-work-chip--dark" label={displayPost.workTitle} size="small" />}
          {displayPost.progress && <Chip className="main-work-chip" label={displayPost.progress} size="small" />}
          {displayPost.isSpoiler && <Chip className="main-spoiler-chip" icon={<VisibilityOffRoundedIcon />} label={copy.spoiler} size="small" />}
        </Box>

        {String(displayPost.content || '').trim() && <Typography className={displayPost.isSpoiler ? 'main-post__content main-post__content--spoiler' : 'main-post__content'}>{displayPost.content}</Typography>}

        {displayPost.media?.length > 0 && (
          <Box className="main-media-list" onClick={stopActionClick}>
            {displayPost.media.map((media) => {
              const photoIndex = displayPost.media.filter((item) => item.mediaType === 'IMAGE').findIndex((item) => item.mediaId === media.mediaId) + 1;
              return (
                <Box className="main-media-item" key={media.mediaId}>
                  {media.mediaType === 'IMAGE' && <button className="main-media-open-button" onClick={(event) => handleOpenPostPhoto(event, photoIndex)} type="button"><img alt="첨부 이미지" src={resolveMediaUrl(media.fileUrl)} /></button>}
                  {media.mediaType === 'VIDEO' && <video controls src={resolveMediaUrl(media.fileUrl)} />}
                </Box>
              );
            })}
          </Box>
        )}

        {displayPost.quotePost && <QuotePostCard onOpen={handleOpenQuotePost} post={displayPost.quotePost} />}

        {visibleTags.length > 0 && (
          <Stack className="main-tag-row" direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
            {visibleTags.map((tag) => (
              <button
                className="main-tag main-tag--button"
                key={tag}
                onClick={(event) => {
                  event.stopPropagation();
                  navigate('/explore?q=' + encodeURIComponent('#' + tag));
                }}
                type="button"
              >
                #{tag}
              </button>
            ))}
          </Stack>
        )}

        {showActions && (
          <Box className="main-post__actions" onClick={stopActionClick}>
            <Button className="main-action-button" onClick={handleToggleComments} startIcon={<ChatBubbleOutlineRoundedIcon />}>{displayPost.counts?.comments || 0}</Button>
            <Button className={displayPost.reposted ? 'main-action-button main-action-button--active main-action-button--repost' : 'main-action-button'} disabled={reactionLoadingKey === 'repost-' + displayPost.postId} onClick={handleRepostMenuOpen} startIcon={<RepeatRoundedIcon />}>{displayPost.counts?.reposts || 0}</Button>
            <Button className={displayPost.liked ? 'main-action-button main-action-button--active main-action-button--like' : 'main-action-button'} disabled={reactionLoadingKey === 'like-' + displayPost.postId} onClick={() => updateRelation('like')} startIcon={displayPost.liked ? <FavoriteRoundedIcon /> : <FavoriteBorderRoundedIcon />}>{displayPost.counts?.likes || 0}</Button>
            <Button className={displayPost.bookmarked ? 'main-action-button main-action-button--active main-action-button--bookmark' : 'main-action-button'} disabled={reactionLoadingKey === 'bookmark-' + displayPost.postId} onClick={() => updateRelation('bookmark')} startIcon={displayPost.bookmarked ? <BookmarkRoundedIcon /> : <BookmarkBorderRoundedIcon />}>{displayPost.bookmarked ? copy.saved : copy.save}</Button>
          </Box>
        )}

        {commentOpen && (
          <Box className="main-comment-panel" onClick={stopActionClick}>
            <Box className="main-comment-compose">
              <Avatar className="main-avatar main-avatar--comment">{getInitial(viewer?.nickname, viewer?.username)}</Avatar>
              <TextField className="main-comment-input" fullWidth inputRef={replyInputRef} minRows={2} multiline onChange={(event) => setCommentDraft(event.target.value.slice(0, 4000))} placeholder={copy.commentPlaceholder} value={commentDraft} />
              <Button className="main-comment-submit" disabled={!commentDraft.trim() || commentSubmitting} onClick={handleSubmitComment} variant="contained">{commentSubmitting ? copy.commentSubmitting : copy.commentSubmit}</Button>
            </Box>
            {commentLoading ? (
              <Box className="main-comment-state"><CircularProgress size={20} /></Box>
            ) : comments.length > 0 ? (
              <Stack className="main-comment-list">
                {comments.map((comment) => (
                  <Box className="main-comment" key={comment.postId}>
                    <Avatar className="main-avatar main-avatar--comment">{getInitial(comment.user?.nickname, comment.user?.username)}</Avatar>
                    <Box className="main-comment__body">
                      <Box className="main-comment__meta-row">
                        <Typography className="main-comment__name">{comment.user?.nickname || comment.user?.username}</Typography>
                        <PostMeta username={comment.user?.username} createdAt={comment.createdAt} />
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

      {showMenu && (
        <Popover anchorEl={menuAnchorEl} anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }} className={isDarkMode ? 'main-post-menu main-post-menu--dark' : 'main-post-menu'} onClose={handleMenuClose} open={menuOpen} transformOrigin={{ horizontal: 'right', vertical: 'top' }} transitionDuration={0}>
          <Box className="main-post-menu__content" key={displayPost?.postId + '-' + (mine ? 'mine' : 'other')} onClick={stopActionClick}>
            {mine ? (
              <>
                <Button className="main-post-menu__item" fullWidth onClick={handlePreparedMenuAction}>{copy.editPost}</Button>
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
            <Button className="main-post-menu__item main-post-menu__danger" fullWidth onClick={handleReportPost}>{copy.reportPost}</Button>
          </Box>
        </Popover>
      )}

      <Popover anchorEl={repostMenuAnchorEl} anchorOrigin={{ horizontal: 'left', vertical: 'bottom' }} className={isDarkMode ? 'main-repost-menu main-repost-menu--dark' : 'main-repost-menu'} onClose={handleRepostMenuClose} open={repostMenuOpen} transformOrigin={{ horizontal: 'left', vertical: 'top' }} transitionDuration={0}>
        <Box className="main-repost-menu__content" onClick={stopActionClick}>
          <Button className="main-repost-menu__item" fullWidth onClick={handleConfirmRepost} startIcon={<RepeatRoundedIcon />}>{displayPost.reposted ? copy.repostCancelAction : copy.repostAction}</Button>
          <Button className="main-repost-menu__item" fullWidth onClick={handleQuotePost} startIcon={<EditRoundedIcon />}>{copy.quoteAction}</Button>
        </Box>
      </Popover>

      <PostComposerDialog avatarSrc={viewer?.avatarSrc} displayName={viewer?.nickname || viewer?.username || ''} isDarkMode={isDarkMode} onClose={() => setQuoteDialogOpen(false)} onPostCreated={handleQuotePostCreated} open={quoteDialogOpen} quotePost={displayPost} user={viewer} />
    </Box>
  );
}

export default PostFeedItem;

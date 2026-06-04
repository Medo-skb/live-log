import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, Box, Button, Chip, IconButton, Popover, Stack, Typography } from '@mui/material';
import BookmarkBorderRoundedIcon from '@mui/icons-material/BookmarkBorderRounded';
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import FavoriteBorderRoundedIcon from '@mui/icons-material/FavoriteBorderRounded';
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded';
import RepeatRoundedIcon from '@mui/icons-material/RepeatRounded';
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded';
import { deletePost } from '../../api/postApi';
import { useAppModal } from '../common/ModalProvider';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3010';
const META_SEPARATOR = String.fromCharCode(183);

const copy = {
  spoiler: '스포일러',
  save: '저장',
  editPost: '수정하기',
  deletePost: '삭제하기',
  followUser: '팔로우하기',
  blockUser: '차단하기',
  copyUrl: 'URL 복사',
  reportPost: '게시물 신고하기',
  deleteConfirmTitle: '게시물을 삭제할까요?',
  deleteConfirmBody: '이 동작은 취소할 수 없으며 내 프로필, 나를 팔로우하는 계정의 타임라인, 그리고 검색 결과에서 삭제됩니다.',
  copiedUrlTitle: 'URL이 복사되었습니다.',
  copiedUrlBody: '게시물 링크를 클립보드에 저장했습니다.',
  copyFailedTitle: 'URL을 복사하지 못했습니다.',
  copyFailedBody: '아래 링크를 직접 복사해주세요.',
  nextFeatureTitle: '준비 중인 기능입니다.',
  nextFeature: '이 기능은 다음 단계에서 API를 연결하겠습니다.',
  deleteError: '게시글 삭제 중 오류가 발생했습니다.',
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
  return '/' + encodeURIComponent(String(post?.user?.username || 'user')) + '/status/' + post?.postId;
}

function getPostPhotoPath(post, photoIndex) {
  return getPostDetailPath(post) + '/photo/' + photoIndex;
}

function isMyPost(post, viewer) {
  if (!post || !viewer) return false;
  return String(post.user?.username || '') === String(viewer.username || '') || String(post.user?.userId || '') === String(viewer.userId || '');
}

function PostMeta({ username, createdAt }) {
  return (
    <Typography className="main-post__meta">
      @{formatUsername(username)} {META_SEPARATOR} {formatRelativeTime(createdAt)}
    </Typography>
  );
}

function QuotePostCard({ post }) {
  if (!post) return null;

  const user = post.user || {};

  return (
    <Box className="main-quote-preview-card main-quote-preview-card--embedded">
      <Box className="main-quote-preview-card__author">
        <Avatar className="main-avatar main-avatar--quote">{getInitial(user.nickname, user.username)}</Avatar>
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
    </Box>
  );
}

function PostFeedItem({ isDarkMode = false, onDeleted, onOpen, post, showActions = true, showMenu = true, viewer }) {
  const navigate = useNavigate();
  const appModal = useAppModal();
  const [menuAnchorEl, setMenuAnchorEl] = useState(null);
  const user = post?.user || {};
  const menuOpen = Boolean(menuAnchorEl);
  const mine = isMyPost(post, viewer);

  const handleOpen = () => {
    onOpen?.(post);
  };

  const handleOpenPostPhoto = (event, photoIndex) => {
    event.stopPropagation();
    navigate(getPostPhotoPath(post, photoIndex));
  };

  const stopActionClick = (event) => {
    event.stopPropagation();
  };

  const handleMenuOpen = (event) => {
    event.stopPropagation();
    setMenuAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
  };

  const handlePreparedMenuAction = () => {
    handleMenuClose();
    appModal.showAlert({
      title: copy.nextFeatureTitle,
      message: copy.nextFeature,
    });
  };

  const handleCopyPostUrl = async () => {
    const url = window.location.origin + getPostDetailPath(post);
    handleMenuClose();

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

  const handleDeletePost = async () => {
    const confirmed = await appModal.showConfirm({
      title: copy.deleteConfirmTitle,
      message: copy.deleteConfirmBody,
      confirmText: copy.deletePost,
      cancelText: '취소',
      variant: 'danger',
    });

    if (!confirmed) return;

    handleMenuClose();

    try {
      await deletePost({ postId: post.postId });
      onDeleted?.(post.postId);
    } catch (requestError) {
      await appModal.showAlert({
        title: copy.nextFeatureTitle,
        message: requestError.message || copy.deleteError,
      });
    }
  };

  return (
    <Box
      component="article"
      className="main-post main-post--clickable"
      onClick={handleOpen}
      onKeyDown={(event) => { if (event.key === 'Enter') handleOpen(); }}
      role="button"
      tabIndex={0}
    >
      <Avatar className="main-avatar">{getInitial(user.nickname, user.username)}</Avatar>

      <Box className="main-post__body">
        <Box className="main-post__topline">
          <Box className="main-post__author-line">
            <Typography className="main-post__name">{user.nickname || user.username}</Typography>
            <PostMeta username={user.username} createdAt={post.createdAt} />
          </Box>
          {showMenu && (
            <IconButton aria-label="more" className="main-icon-button main-icon-button--small" onClick={handleMenuOpen}>
              <MoreHorizRoundedIcon />
            </IconButton>
          )}
        </Box>

        <Box className="main-work-chip-row">
          {post.categoryName && <Chip className="main-work-chip" label={post.categoryName} size="small" />}
          {post.workTitle && <Chip className="main-work-chip main-work-chip--dark" label={post.workTitle} size="small" />}
          {post.progress && <Chip className="main-work-chip" label={post.progress} size="small" />}
          {post.isSpoiler && <Chip className="main-spoiler-chip" icon={<VisibilityOffRoundedIcon />} label={copy.spoiler} size="small" />}
        </Box>

        {String(post.content || '').trim() && (
          <Typography className={post.isSpoiler ? 'main-post__content main-post__content--spoiler' : 'main-post__content'}>
            {post.content}
          </Typography>
        )}

        {post.media?.length > 0 && (
          <Box className="main-media-list" onClick={stopActionClick}>
            {post.media.map((media) => {
              const photoIndex = post.media.filter((item) => item.mediaType === 'IMAGE').findIndex((item) => item.mediaId === media.mediaId) + 1;

              return (
                <Box className="main-media-item" key={media.mediaId}>
                  {media.mediaType === 'IMAGE' && (
                    <button className="main-media-open-button" onClick={(event) => handleOpenPostPhoto(event, photoIndex)} type="button">
                      <img alt="첨부 이미지" src={resolveMediaUrl(media.fileUrl)} />
                    </button>
                  )}
                  {media.mediaType === 'VIDEO' && <video controls src={resolveMediaUrl(media.fileUrl)} />}
                </Box>
              );
            })}
          </Box>
        )}
        {post.quotePost && <QuotePostCard post={post.quotePost} />}

        {post.tags?.length > 0 && (
          <Stack className="main-tag-row" direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
            {post.tags.map((tag) => <span className="main-tag" key={tag}>#{tag}</span>)}
          </Stack>
        )}

        {showActions && (
          <Box className="main-post__actions" onClick={stopActionClick}>
            <Button className="main-action-button" startIcon={<ChatBubbleOutlineRoundedIcon />}>{post.counts?.comments || 0}</Button>
            <Button className={post.reposted ? 'main-action-button main-action-button--active main-action-button--repost' : 'main-action-button'} startIcon={<RepeatRoundedIcon />}>{post.counts?.reposts || 0}</Button>
            <Button className={post.liked ? 'main-action-button main-action-button--active main-action-button--like' : 'main-action-button'} startIcon={<FavoriteBorderRoundedIcon />}>{post.counts?.likes || 0}</Button>
            <Button className={post.bookmarked ? 'main-action-button main-action-button--active main-action-button--bookmark' : 'main-action-button'} startIcon={<BookmarkBorderRoundedIcon />}>{copy.save}</Button>
          </Box>
        )}
      </Box>

      {showMenu && (
        <Popover
          anchorEl={menuAnchorEl}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          className={isDarkMode ? 'main-post-menu main-post-menu--dark' : 'main-post-menu'}
          onClose={handleMenuClose}
          open={menuOpen}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          transitionDuration={0}
        >
          <Box className="main-post-menu__content" key={post?.postId + '-' + (mine ? 'mine' : 'other')} onClick={stopActionClick}>
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
            <Button className="main-post-menu__item main-post-menu__danger" fullWidth onClick={handlePreparedMenuAction}>{copy.reportPost}</Button>
          </Box>
        </Popover>
      )}
    </Box>
  );
}

export default PostFeedItem;

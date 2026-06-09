import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import {
  Avatar,
  Box,
  Button,
  CircularProgress,
  IconButton,
  Popover,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import BookmarkBorderRoundedIcon from '@mui/icons-material/BookmarkBorderRounded';
import BookmarkRoundedIcon from '@mui/icons-material/BookmarkRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import FavoriteBorderRoundedIcon from '@mui/icons-material/FavoriteBorderRounded';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded';
import NavigateBeforeRoundedIcon from '@mui/icons-material/NavigateBeforeRounded';
import NavigateNextRoundedIcon from '@mui/icons-material/NavigateNextRounded';
import RepeatRoundedIcon from '@mui/icons-material/RepeatRounded';
import {
  createPostComment,
  deletePost,
  getPost,
  togglePostBookmark,
  togglePostLike,
  togglePostRepost,
} from '../../api/postApi';
import PostComposerDialog from '../post/PostComposerDialog';
import { useAppModal } from '../common/ModalProvider';
import { getTagSearchPath, getVisibleTags } from '../../utils/tagDisplay';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3010';
const META_SEPARATOR = String.fromCharCode(183);

const copy = {
  editPost: '수정하기',
  deletePost: '삭제하기',
  followUser: '팔로우하기',
  blockUser: '차단하기',
  copyUrl: 'URL 복사',
  reportPost: '게시물 신고하기',
  copiedUrlTitle: 'URL을 복사했습니다.',
  copiedUrlBody: '게시물 링크를 클립보드에 저장했습니다.',
  copyFailedTitle: 'URL을 복사하지 못했습니다.',
  copyFailedBody: '아래 링크를 직접 복사해주세요.',
  deleteConfirmTitle: '게시물을 삭제할까요?',
  deleteConfirmBody: '이 동작은 취소할 수 없으며 프로필, 타임라인, 검색 결과에서 숨김 처리됩니다.',
  cancel: '취소',
  nextFeatureTitle: '준비 중인 기능입니다.',
  nextFeature: '이 기능은 다음 단계에서 API를 연결하겠습니다.',
  requestError: '요청 처리 중 오류가 발생했습니다.',
  loadError: '사진을 불러오지 못했습니다.',
  notFound: '사진을 찾을 수 없습니다.',
  postNotFound: '게시물을 찾을 수 없습니다.',
  back: '뒤로가기',
  imageAlt: '게시물 첨부 사진',
  prevPhoto: '이전 사진',
  nextPhoto: '다음 사진',
  bookmark: '북마크',
  likes: '좋아요',
  commentPlaceholder: '댓글 게시하기',
  commentSubmit: '답글',
  commentSubmitting: '등록 중',
  repostAction: '리포스트',
  repostCancelAction: '리포스트 취소',
  quoteAction: '인용하기',
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

function formatAbsoluteTime(createdAt) {
  const createdDate = parsePostCreatedAt(createdAt);
  if (!createdDate) return createdAt || '';

  const year = createdDate.getFullYear();
  const month = createdDate.getMonth() + 1;
  const day = createdDate.getDate();
  const hour = String(createdDate.getHours()).padStart(2, '0');
  const minute = String(createdDate.getMinutes()).padStart(2, '0');

  return year + '년 ' + month + '월 ' + day + '일 ' + hour + ':' + minute;
}

function formatUsername(username) {
  return String(username || 'user');
}

function getPostDetailPath(post) {
  return '/' + encodeURIComponent(String(post?.user?.username || 'user')) + '/status/' + post?.postId;
}

function getPhotoPath(post, photoIndex) {
  return getPostDetailPath(post) + '/photo/' + photoIndex;
}

function getInitial(post) {
  return String(post?.user?.nickname || post?.user?.username || 'L').charAt(0).toUpperCase();
}

function isMyPost(post, viewer) {
  if (!post || !viewer) return false;
  return String(post.user?.username || '') === String(viewer.username || '') || String(post.user?.userId || '') === String(viewer.userId || '');
}

function PhotoViewer() {
  const { postId, photoIndex } = useParams();
  const navigate = useNavigate();
  const appModal = useAppModal();
  const outletContext = useOutletContext() || {};
  const { isDarkMode, user } = outletContext;
  const replyInputRef = useRef(null);
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [menuAnchorEl, setMenuAnchorEl] = useState(null);
  const [repostMenuAnchorEl, setRepostMenuAnchorEl] = useState(null);
  const [quoteDialogOpen, setQuoteDialogOpen] = useState(false);
  const [reactionLoadingKey, setReactionLoadingKey] = useState('');
  const [commentDraft, setCommentDraft] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [spoilerRevealed, setSpoilerRevealed] = useState(false);

  const menuOpen = Boolean(menuAnchorEl);
  const repostMenuOpen = Boolean(repostMenuAnchorEl);
  const mine = isMyPost(post, user);
  const spoilerHidden = Boolean(post?.isSpoiler && !mine && !spoilerRevealed);

  useEffect(() => {
    let ignore = false;

    setLoading(true);
    setError('');

    getPost({ postId })
      .then((data) => {
        if (ignore) return;
        setPost(data.post || null);
      })
      .catch((requestError) => {
        if (!ignore) setError(requestError.message || '사진을 불러오지 못했습니다.');
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [postId]);

  const imageMedia = useMemo(() => (post?.media || []).filter((media) => media.mediaType === 'IMAGE'), [post]);
  const currentIndex = Math.max(1, Math.min(Number(photoIndex) || 1, imageMedia.length || 1));
  const currentMedia = imageMedia[currentIndex - 1] || null;
  const canGoPrev = currentIndex > 1;
  const canGoNext = currentIndex < imageMedia.length;

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    if (post) {
      navigate(getPostDetailPath(post), { replace: true });
      return;
    }

    navigate('/home', { replace: true });
  };

  const handleMovePhoto = (nextIndex) => {
    if (!post || nextIndex < 1 || nextIndex > imageMedia.length) return;
    navigate(getPhotoPath(post, nextIndex), { replace: true });
  };

  const handleMenuOpen = (event) => {
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
    if (!post) return;

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
    if (!post) return;

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
      await deletePost({ postId: post.postId });
      navigate('/home', { replace: true });
    } catch (requestError) {
      await appModal.showAlert({
        title: copy.nextFeatureTitle,
        message: requestError.message || copy.requestError,
      });
    }
  };

  const handleFocusReply = () => {
    replyInputRef.current?.focus();
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
      setError(requestError.message || copy.requestError);
    } finally {
      setReactionLoadingKey('');
    }
  };


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
    handleRepostMenuClose();
    setQuoteDialogOpen(true);
  };

  const handleQuoteDialogClose = () => {
    setQuoteDialogOpen(false);
  };

  const handleQuotePostCreated = (createdPost) => {
    if (createdPost) {
      window.dispatchEvent(new CustomEvent('liveLogPostCreated', { detail: createdPost }));
    }
  };

  const handleSubmitComment = async () => {
    const content = commentDraft.trim();
    if (!post || !content || commentSubmitting) return;

    setCommentSubmitting(true);
    setError('');

    try {
      await createPostComment({ postId: post.postId, content, isSpoiler: false });
      setPost((prevPost) => ({
        ...prevPost,
        counts: {
          ...prevPost.counts,
          comments: Number(prevPost.counts?.comments || 0) + 1,
        },
      }));
      setCommentDraft('');
    } catch (requestError) {
      setError(requestError.message || copy.requestError);
    } finally {
      setCommentSubmitting(false);
    }
  };

  const commentButton = (
    <Button className="photo-viewer__floating-action" onClick={handleFocusReply} startIcon={<ChatBubbleOutlineRoundedIcon />}>{post?.counts?.comments || 0}</Button>
  );
  const repostButton = (
    <Button className={post?.reposted ? 'photo-viewer__floating-action photo-viewer__floating-action--repost' : 'photo-viewer__floating-action'} disabled={reactionLoadingKey === 'repost-' + post?.postId} onClick={handleRepostMenuOpen} startIcon={<RepeatRoundedIcon />}>{post?.counts?.reposts || 0}</Button>
  );
  const likeButton = (
    <Button className={post?.liked ? 'photo-viewer__floating-action photo-viewer__floating-action--like' : 'photo-viewer__floating-action'} disabled={reactionLoadingKey === 'like-' + post?.postId} onClick={() => handleToggleRelation('like')} startIcon={post?.liked ? <FavoriteRoundedIcon /> : <FavoriteBorderRoundedIcon />}>{post?.counts?.likes || 0}</Button>
  );
  const bookmarkButton = (
    <Button aria-label="북마크" className={post?.bookmarked ? 'photo-viewer__floating-action photo-viewer__floating-action--bookmark photo-viewer__floating-action--icon' : 'photo-viewer__floating-action photo-viewer__floating-action--icon'} disabled={reactionLoadingKey === 'bookmark-' + post?.postId} onClick={() => handleToggleRelation('bookmark')} startIcon={post?.bookmarked ? <BookmarkRoundedIcon /> : <BookmarkBorderRoundedIcon />} />
  );

  return (
    <Box className="photo-viewer" component="main">
      <Box className={spoilerHidden ? 'photo-viewer__stage photo-viewer__stage--spoiler-hidden' : 'photo-viewer__stage'}>
        <Button className="photo-viewer__back-control" onClick={handleBack} startIcon={<ArrowBackRoundedIcon />}>
          뒤로가기
        </Button>

        {loading ? (
          <Box className="photo-viewer__state"><CircularProgress size={30} /></Box>
        ) : error || !post || !currentMedia ? (
          <Box className="photo-viewer__state">
            <Typography>{error || '사진을 찾을 수 없습니다.'}</Typography>
            <Button className="photo-viewer__back-button" onClick={handleBack}>뒤로가기</Button>
          </Box>
        ) : (
          <>
            {spoilerHidden && (
              <Box className="main-spoiler-gate photo-viewer__spoiler-gate">
                <Typography className="main-spoiler-gate__title">스포일러가 포함된 사진입니다.</Typography>
                <Typography className="main-spoiler-gate__message">이미지와 게시글 내용에 스포일러가 포함될 수 있습니다.</Typography>
                <Button className="main-spoiler-gate__button" onClick={() => setSpoilerRevealed(true)}>사진 보기</Button>
              </Box>
            )}
            {canGoPrev && (
              <IconButton className="photo-viewer__nav photo-viewer__nav--prev" onClick={() => handleMovePhoto(currentIndex - 1)} aria-label="이전 사진">
                <NavigateBeforeRoundedIcon />
              </IconButton>
            )}
            <img className="photo-viewer__image" alt="게시물 첨부 사진" src={resolveMediaUrl(currentMedia.fileUrl)} />
            {canGoNext && (
              <IconButton className="photo-viewer__nav photo-viewer__nav--next" onClick={() => handleMovePhoto(currentIndex + 1)} aria-label="다음 사진">
                <NavigateNextRoundedIcon />
              </IconButton>
            )}
            <Box className="photo-viewer__floating-actions">
              {commentButton}
              {repostButton}
              {likeButton}
              {bookmarkButton}
            </Box>
          </>
        )}
      </Box>

      <Box className="photo-viewer__panel">
        {loading ? (
          <Box className="photo-viewer__panel-state"><CircularProgress size={24} /></Box>
        ) : post ? (
          <>
            <Box className="photo-viewer__author">
              <Avatar className="main-avatar">{getInitial(post)}</Avatar>
              <Box className="photo-viewer__author-text">
                <Typography className="photo-viewer__name">{post.user.nickname}</Typography>
                <Typography className="photo-viewer__username">@{formatUsername(post.user.username)}</Typography>
              </Box>
              <IconButton className="main-icon-button main-icon-button--small photo-viewer__more-button" onClick={handleMenuOpen} aria-label="more">
                <MoreHorizRoundedIcon />
              </IconButton>
            </Box>

            {spoilerHidden ? (
              <Box className="main-spoiler-gate">
                <Typography className="main-spoiler-gate__title">스포일러가 포함된 글입니다.</Typography>
                <Typography className="main-spoiler-gate__message">태그와 본문에 스포일러가 포함될 수 있습니다.</Typography>
                <Button className="main-spoiler-gate__button" onClick={() => setSpoilerRevealed(true)}>게시글 보기</Button>
              </Box>
            ) : String(post.content || '').trim() && <Typography className="photo-viewer__content">{post.content}</Typography>}

            {getVisibleTags(post).length > 0 && (
              <Stack className="photo-viewer__tags" direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                {getVisibleTags(post).map((tag) => <button className="main-tag main-tag--button" key={tag} onClick={() => navigate(getTagSearchPath(tag))} type="button">#{tag}</button>)}
              </Stack>
            )}

            <Typography className="photo-viewer__time">{formatAbsoluteTime(post.createdAt)} {META_SEPARATOR} {post.counts?.likes || 0} 좋아요</Typography>

            <Box className="photo-viewer__panel-actions">
              <Button className="main-action-button" onClick={handleFocusReply} startIcon={<ChatBubbleOutlineRoundedIcon />}>{post.counts?.comments || 0}</Button>
              <Button className={post.reposted ? 'main-action-button main-action-button--active main-action-button--repost' : 'main-action-button'} disabled={reactionLoadingKey === 'repost-' + post.postId} onClick={handleRepostMenuOpen} startIcon={<RepeatRoundedIcon />}>{post.counts?.reposts || 0}</Button>
              <Button className={post.liked ? 'main-action-button main-action-button--active main-action-button--like' : 'main-action-button'} disabled={reactionLoadingKey === 'like-' + post.postId} onClick={() => handleToggleRelation('like')} startIcon={post.liked ? <FavoriteRoundedIcon /> : <FavoriteBorderRoundedIcon />}>{post.counts?.likes || 0}</Button>
              <Button aria-label="북마크" className={post.bookmarked ? 'main-action-button main-action-button--active main-action-button--bookmark photo-viewer__panel-bookmark' : 'main-action-button photo-viewer__panel-bookmark'} disabled={reactionLoadingKey === 'bookmark-' + post.postId} onClick={() => handleToggleRelation('bookmark')} startIcon={post.bookmarked ? <BookmarkRoundedIcon /> : <BookmarkBorderRoundedIcon />} />
            </Box>

            <Box className="photo-viewer__reply">
              <Avatar className="main-avatar main-avatar--comment">{getInitial(post)}</Avatar>
              <TextField className="photo-viewer__reply-input" fullWidth inputRef={replyInputRef} onChange={(event) => setCommentDraft(event.target.value.slice(0, 2000))} placeholder={copy.commentPlaceholder} size="small" value={commentDraft} />
              <Button className="main-comment-submit" disabled={!commentDraft.trim() || commentSubmitting} onClick={handleSubmitComment} variant="contained">{commentSubmitting ? copy.commentSubmitting : copy.commentSubmit}</Button>
            </Box>

            <Popover
              anchorEl={menuAnchorEl}
              anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
              className={isDarkMode ? 'main-post-menu main-post-menu--dark photo-viewer-post-menu' : 'main-post-menu photo-viewer-post-menu'}
              onClose={handleMenuClose}
              open={menuOpen}
              transformOrigin={{ horizontal: 'right', vertical: 'top' }}
              transitionDuration={0}
            >
              <Box className="main-post-menu__content" key={post.postId + '-' + (mine ? 'mine' : 'other')}>
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

            <Popover
              anchorEl={repostMenuAnchorEl}
              anchorOrigin={{ horizontal: 'left', vertical: 'bottom' }}
              className={isDarkMode ? 'main-repost-menu main-repost-menu--dark photo-viewer-repost-menu' : 'main-repost-menu photo-viewer-repost-menu'}
              onClose={handleRepostMenuClose}
              open={repostMenuOpen}
              transformOrigin={{ horizontal: 'left', vertical: 'top' }}
              transitionDuration={0}
            >
              <Box className="main-repost-menu__content">
                <Button className="main-repost-menu__item" fullWidth onClick={handleConfirmRepost}>
                  <RepeatRoundedIcon className="main-repost-menu__item-icon" />
                  <span className="main-repost-menu__item-label">{post.reposted ? copy.repostCancelAction : copy.repostAction}</span>
                </Button>
                <Button className="main-repost-menu__item" fullWidth onClick={handleQuotePost}>
                  <EditRoundedIcon className="main-repost-menu__item-icon" />
                  <span className="main-repost-menu__item-label">{copy.quoteAction}</span>
                </Button>
              </Box>
            </Popover>

            <PostComposerDialog
              avatarSrc={outletContext.avatarSrc}
              displayName={outletContext.displayName || post.user.nickname}
              isDarkMode={isDarkMode}
              onClose={handleQuoteDialogClose}
              onPostCreated={handleQuotePostCreated}
              open={quoteDialogOpen}
              quotePost={post}
              user={user}
            />
          </>
        ) : (
          <Box className="photo-viewer__panel-state"><Typography>게시물을 찾을 수 없습니다.</Typography></Box>
        )}
      </Box>
    </Box>
  );
}

export default PhotoViewer;

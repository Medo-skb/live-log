import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import BookmarkRoundedIcon from '@mui/icons-material/BookmarkRounded';
import { getBookmarkedPosts } from '../../api/postApi';

const PAGE_SIZE = 20;

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

function getPostDetailPath(post) {
  return '/' + encodeURIComponent(String(post?.user?.username || 'user')) + '/status/' + post?.postId;
}

function Bookmark() {
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let ignore = false;

    setLoading(true);
    setError('');

    getBookmarkedPosts({ limit: PAGE_SIZE })
      .then((data) => {
        if (ignore) return;
        setPosts(Array.isArray(data.posts) ? data.posts : []);
        setNextCursor(data.nextCursor || null);
        setHasMore(Boolean(data.hasMore));
      })
      .catch((requestError) => {
        if (!ignore) setError(requestError.message || '북마크 목록을 불러오지 못했습니다.');
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, []);

  const handleOpenPostDetail = (post) => {
    navigate(getPostDetailPath(post));
  };

  const handleLoadMore = async () => {
    if (!nextCursor || loadingMore) return;

    setLoadingMore(true);
    setError('');

    try {
      const data = await getBookmarkedPosts({ cursor: nextCursor, limit: PAGE_SIZE });
      const nextPosts = Array.isArray(data.posts) ? data.posts : [];
      const existingIds = new Set(posts.map((post) => post.postId));

      setPosts((prevPosts) => [...prevPosts, ...nextPosts.filter((post) => !existingIds.has(post.postId))]);
      setNextCursor(data.nextCursor || null);
      setHasMore(Boolean(data.hasMore));
    } catch (requestError) {
      setError(requestError.message || '북마크 목록을 더 불러오지 못했습니다.');
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <Box className="main-menu-screen main-bookmark-screen">
      <Box className="main-menu-screen__inner">
        <Stack spacing={1.5}>
          <Typography className="main-menu-screen__title">북마크</Typography>
          <Typography className="main-menu-screen__description">저장한 중계글을 모아보는 화면입니다.</Typography>
        </Stack>

        {error && <Alert className="main-form-alert" severity="error">{error}</Alert>}

        {loading ? (
          <Box className="main-feed-state"><CircularProgress size={28} /></Box>
        ) : posts.length === 0 ? (
          <Box className="main-feed-state"><Typography>아직 저장한 게시글이 없습니다.</Typography></Box>
        ) : (
          <Stack className="main-bookmark-list">
            {posts.map((post) => (
              <Box
                className="main-bookmark-card main-post--clickable"
                key={post.postId}
                onClick={() => handleOpenPostDetail(post)}
                onKeyDown={(event) => { if (event.key === 'Enter') handleOpenPostDetail(post); }}
                role="button"
                tabIndex={0}
              >
                <Box className="main-bookmark-card__topline">
                  <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                    <Chip className="main-work-chip" label={post.categoryName} size="small" />
                    <Chip className="main-work-chip main-work-chip--dark" label={post.workTitle} size="small" />
                    <Chip className="main-work-chip" label={post.progress} size="small" />
                  </Stack>
                  <BookmarkRoundedIcon className="main-bookmark-card__icon" />
                </Box>
                <Typography className="main-bookmark-card__author">{post.user.nickname} @{post.user.username} · {formatRelativeTime(post.createdAt)}</Typography>
                <Typography className="main-bookmark-card__content">{post.content}</Typography>
              </Box>
            ))}

            {hasMore && (
              <Button className="main-menu-screen__button" disabled={loadingMore} onClick={handleLoadMore} variant="contained">
                {loadingMore ? '불러오는 중' : '더 보기'}
              </Button>
            )}
          </Stack>
        )}
      </Box>
    </Box>
  );
}

export default Bookmark;
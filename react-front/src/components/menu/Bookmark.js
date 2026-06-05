import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import PostFeedItem from '../post/PostFeedItem';
import { getBookmarkedPosts } from '../../api/postApi';

const PAGE_SIZE = 10;

function getPostDetailPath(post) {
  return '/' + encodeURIComponent(String(post?.user?.username || 'user')) + '/status/' + post?.postId;
}

function getTimelineKey(post) {
  return post?.timelineId || 'post-' + post?.postId;
}

function Bookmark() {
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(1);
  const [pageCursors, setPageCursors] = useState([null]);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadPage = async (nextPage, cursor) => {
    setLoading(true);
    setError('');

    try {
      const data = await getBookmarkedPosts({ cursor, limit: PAGE_SIZE });
      setPosts(Array.isArray(data.posts) ? data.posts : []);
      setNextCursor(data.nextCursor || null);
      setHasMore(Boolean(data.hasMore));
      setPage(nextPage);
    } catch (requestError) {
      setError(requestError.message || '북마크 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

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
        setPage(1);
        setPageCursors([null]);
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

  const handlePrevPage = () => {
    if (page <= 1 || loading) return;
    loadPage(page - 1, pageCursors[page - 2] || null);
  };

  const handleNextPage = () => {
    if (!hasMore || !nextCursor || loading) return;

    setPageCursors((prevCursors) => {
      const nextCursors = [...prevCursors];
      nextCursors[page] = nextCursor;
      return nextCursors;
    });
    loadPage(page + 1, nextCursor);
  };

  return (
    <Box component="main" className="main-feed main-bookmark-screen">
      <Box className="bookmark-header">
        <Typography className="bookmark-header__title">북마크</Typography>
        <Typography className="bookmark-header__description">저장한 중계글을 모아보는 화면입니다.</Typography>
      </Box>

      {error && <Alert className="main-form-alert" severity="error">{error}</Alert>}

      {loading ? (
        <Box className="main-feed-state"><CircularProgress size={28} /></Box>
      ) : posts.length === 0 ? (
        <Box className="main-feed-state"><Typography>아직 저장한 게시글이 없습니다.</Typography></Box>
      ) : (
        <>
          <Stack className="main-post-list">
            {posts.map((post) => (
              <PostFeedItem key={getTimelineKey(post)} post={post} onOpen={handleOpenPostDetail} showActions={false} showMenu={false} />
            ))}
          </Stack>
          <Box className="bookmark-pagination">
            <Button className="bookmark-page-button" disabled={page <= 1 || loading} onClick={handlePrevPage}>이전</Button>
            <Typography className="bookmark-page-label">{page}페이지</Typography>
            <Button className="bookmark-page-button" disabled={!hasMore || loading} onClick={handleNextPage}>다음</Button>
          </Box>
        </>
      )}
    </Box>
  );
}

export default Bookmark;

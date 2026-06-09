import { useEffect, useState } from 'react';
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Avatar,
  Box,
  Button,
  CircularProgress,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import { getPosts } from '../../api/postApi';
import { getSearchSuggestions } from '../../api/searchApi';
import PostFeedItem from '../post/PostFeedItem';

const PAGE_SIZE = 20;
const SUGGESTION_DELAY = 220;

function getPostDetailPath(post) {
  return '/' + encodeURIComponent(String(post?.user?.username || 'user')) + '/status/' + post?.postId;
}

function getTimelineKey(post) {
  return post?.timelineId || 'post-' + post?.postId;
}

function getInitial(user) {
  return String(user?.nickname || user?.username || 'L').charAt(0).toUpperCase();
}

function Explore() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isDarkMode, user } = useOutletContext();
  const [keyword, setKeyword] = useState(searchParams.get('q') || '');
  const [searchedKeyword, setSearchedKeyword] = useState('');
  const [posts, setPosts] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [suggestions, setSuggestions] = useState({ terms: [], users: [], tags: [] });
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [error, setError] = useState('');

  const requestSearch = async (search, options = {}) => {
    const normalizedSearch = String(search || '').trim();
    if (!normalizedSearch) return;

    setLoading(true);
    setError('');
    setPosts([]);
    setNextCursor(null);
    setHasMore(false);
    setSearchedKeyword(normalizedSearch);
    setSuggestionsOpen(false);
    setKeyword(normalizedSearch);

    if (!options.skipUrlUpdate) {
      setSearchParams({ q: normalizedSearch });
    }

    try {
      const data = await getPosts({ search: normalizedSearch, limit: PAGE_SIZE });
      setPosts(Array.isArray(data.posts) ? data.posts : []);
      setNextCursor(data.nextCursor || null);
      setHasMore(Boolean(data.hasMore));
    } catch (requestError) {
      setError(requestError.message || '검색 결과를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const queryKeyword = searchParams.get('q') || '';
    if (!queryKeyword.trim()) return;
    if (queryKeyword === searchedKeyword) return;
    requestSearch(queryKeyword, { skipUrlUpdate: true });
  // searchedKeyword를 의존성에 추가하면 같은 검색어로 URL이 반복 갱신될 수 있습니다.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    const search = keyword.trim();

    if (!search) {
      setSuggestions({ terms: [], users: [], tags: [] });
      setSuggestionsOpen(false);
      return undefined;
    }

    let ignore = false;
    const timer = setTimeout(() => {
      setSuggestionsLoading(true);
      getSearchSuggestions({ keyword: search })
        .then((data) => {
          if (ignore) return;
          setSuggestions(data.suggestions || { terms: [], users: [], tags: [] });
          setSuggestionsOpen(true);
        })
        .catch(() => {
          if (!ignore) setSuggestions({ terms: [], users: [], tags: [] });
        })
        .finally(() => {
          if (!ignore) setSuggestionsLoading(false);
        });
    }, SUGGESTION_DELAY);

    return () => {
      ignore = true;
      clearTimeout(timer);
    };
  }, [keyword]);

  const handleSearch = async (event) => {
    event?.preventDefault();
    const search = keyword.trim();
    if (!search || loading) return;
    await requestSearch(search);
  };

  const handleSelectSearch = (value) => {
    requestSearch(value);
  };

  const handleOpenUser = (targetUser) => {
    setSuggestionsOpen(false);
    navigate('/' + encodeURIComponent(targetUser.username));
  };

  const handleLoadMore = async () => {
    if (!searchedKeyword || !nextCursor || loadingMore) return;

    setLoadingMore(true);
    setError('');

    try {
      const data = await getPosts({ search: searchedKeyword, cursor: nextCursor, limit: PAGE_SIZE });
      const nextPosts = Array.isArray(data.posts) ? data.posts : [];
      const existingIds = new Set(posts.map(getTimelineKey));

      setPosts((prevPosts) => [...prevPosts, ...nextPosts.filter((post) => !existingIds.has(getTimelineKey(post)))]);
      setNextCursor(data.nextCursor || null);
      setHasMore(Boolean(data.hasMore));
    } catch (requestError) {
      setError(requestError.message || '검색 결과를 더 불러오지 못했습니다.');
    } finally {
      setLoadingMore(false);
    }
  };

  const handleOpenPost = (post) => {
    navigate(getPostDetailPath(post));
  };

  const handleDeletedPost = (postId) => {
    setPosts((prevPosts) => prevPosts.filter((post) => post.postId !== postId));
  };

  const isTagMode = keyword.trim().startsWith('#');
  const hasSuggestions = suggestions.terms.length > 0 || suggestions.users.length > 0 || suggestions.tags.length > 0;

  return (
    <Box component="main" className="main-feed explore-page">
      <Box className="explore-header">
        <Typography className="explore-header__title">탐색하기</Typography>
        <Box className="explore-search-wrap">
          <Box className="explore-search-form" component="form" onSubmit={handleSearch}>
            <TextField
              className="main-search explore-search-input"
              fullWidth
              onChange={(event) => setKeyword(event.target.value)}
              onFocus={() => { if (keyword.trim()) setSuggestionsOpen(true); }}
              placeholder="작품, 태그, 사용자, 게시글 검색"
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRoundedIcon /></InputAdornment> } }}
              value={keyword}
            />
            <Button className="explore-search-button" disabled={!keyword.trim() || loading} type="submit" variant="contained">검색</Button>
          </Box>

          {suggestionsOpen && keyword.trim() && (hasSuggestions || suggestionsLoading) && (
            <Box className="explore-suggest-panel">
              {suggestionsLoading && <Box className="explore-suggest-state"><CircularProgress size={20} /></Box>}

              {!suggestionsLoading && isTagMode && suggestions.tags.map((item) => (
                <Button className="explore-suggest-row" key={item.value} onMouseDown={(event) => event.preventDefault()} onClick={() => handleSelectSearch(item.value)}>
                  <SearchRoundedIcon className="explore-suggest-row__icon" />
                  <Box className="explore-suggest-row__text">
                    <Typography className="explore-suggest-row__label">{item.label}</Typography>
                    <Typography className="explore-suggest-row__meta">태그</Typography>
                  </Box>
                </Button>
              ))}

              {!suggestionsLoading && !isTagMode && suggestions.terms.map((item) => (
                <Button className="explore-suggest-row" key={item.type + item.value} onMouseDown={(event) => event.preventDefault()} onClick={() => handleSelectSearch(item.value)}>
                  <SearchRoundedIcon className="explore-suggest-row__icon" />
                  <Typography className="explore-suggest-row__label">{item.label}</Typography>
                </Button>
              ))}

              {!suggestionsLoading && !isTagMode && suggestions.users.length > 0 && (
                <Box className="explore-suggest-section-title">사용자</Box>
              )}

              {!suggestionsLoading && !isTagMode && suggestions.users.map((targetUser) => (
                <Button className="explore-suggest-user" key={targetUser.userId} onMouseDown={(event) => event.preventDefault()} onClick={() => handleOpenUser(targetUser)}>
                  <Avatar className="main-avatar explore-suggest-user__avatar">{getInitial(targetUser)}</Avatar>
                  <Box className="explore-suggest-user__text">
                    <Typography className="explore-suggest-user__name">{targetUser.nickname}</Typography>
                    <Typography className="explore-suggest-user__username">@{targetUser.username}</Typography>
                  </Box>
                </Button>
              ))}
            </Box>
          )}
        </Box>
      </Box>

      {error && <Alert className="main-form-alert" severity="error">{error}</Alert>}

      {loading ? (
        <Box className="main-feed-state"><CircularProgress size={28} /></Box>
      ) : !searchedKeyword ? (
        <Box className="main-feed-state"><Typography>작품명, 태그, 사용자 아이디로 검색해보세요.</Typography></Box>
      ) : posts.length === 0 ? (
        <Box className="main-feed-state"><Typography>검색 결과가 없습니다.</Typography></Box>
      ) : (
        <>
          <Box className="explore-result-line">
            <Typography>검색어: <strong>{searchedKeyword}</strong></Typography>
          </Box>
          <Stack className="main-post-list">
            {posts.map((post) => <PostFeedItem key={getTimelineKey(post)} isDarkMode={isDarkMode} onDeleted={handleDeletedPost} post={post} onOpen={handleOpenPost} viewer={user} />)}

            {hasMore && (
              <Box className="post-detail-more-row">
                <Button className="main-menu-screen__button" disabled={loadingMore} onClick={handleLoadMore} variant="contained">
                  {loadingMore ? '불러오는 중' : '더 보기'}
                </Button>
              </Box>
            )}
          </Stack>
        </>
      )}
    </Box>
  );
}

export default Explore;

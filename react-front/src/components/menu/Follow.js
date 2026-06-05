import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import PersonAddAltRoundedIcon from '@mui/icons-material/PersonAddAltRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import { getRecommendedUsers, searchUsers, toggleUserFollow } from '../../api/userApi';

const copy = {
  title: '팔로우하기',
  description: '관심사와 활동을 기준으로 팔로우할 사용자를 추천합니다.',
  searchPlaceholder: '닉네임 또는 아이디 검색',
  loadError: '추천 사용자를 불러오지 못했습니다.',
  searchError: '사용자 검색 중 오류가 발생했습니다.',
  emptyRecommend: '추천할 사용자가 없습니다.',
  emptySearch: '검색 결과가 없습니다.',
  follow: '팔로우',
  following: '팔로잉',
  posts: '게시글',
  followers: '팔로워',
  mutualCategories: '공통 관심사',
};

function getInitial(user) {
  return String(user?.nickname || user?.username || 'L').charAt(0).toUpperCase();
}

function Follow() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(true);
  const [followLoadingId, setFollowLoadingId] = useState(null);
  const [error, setError] = useState('');

  const trimmedKeyword = keyword.trim();
  const isSearching = trimmedKeyword.length > 0;

  useEffect(() => {
    let ignore = false;
    const timer = setTimeout(() => {
      setLoading(true);
      setError('');

      const request = isSearching
        ? searchUsers({ keyword: trimmedKeyword, limit: 20 })
        : getRecommendedUsers({ limit: 12 });

      request
        .then((data) => {
          if (ignore) return;
          setUsers(Array.isArray(data.users) ? data.users : []);
        })
        .catch((requestError) => {
          if (!ignore) setError(requestError.message || (isSearching ? copy.searchError : copy.loadError));
        })
        .finally(() => {
          if (!ignore) setLoading(false);
        });
    }, isSearching ? 250 : 0);

    return () => {
      ignore = true;
      clearTimeout(timer);
    };
  }, [isSearching, trimmedKeyword]);

  const handleOpenProfile = (user) => {
    navigate('/' + encodeURIComponent(user.username));
  };

  const handleFollow = async (event, user) => {
    event.stopPropagation();
    if (followLoadingId) return;

    setFollowLoadingId(user.userId);
    setError('');

    try {
      const data = await toggleUserFollow({ username: user.username });

      if (!isSearching && data.following) {
        setUsers((prevUsers) => prevUsers.filter((item) => item.userId !== user.userId));
        return;
      }

      setUsers((prevUsers) => prevUsers.map((item) => (
        item.userId === user.userId ? { ...item, followedByMe: Boolean(data.following) } : item
      )));
    } catch (requestError) {
      setError(requestError.message || '팔로우 처리 중 오류가 발생했습니다.');
    } finally {
      setFollowLoadingId(null);
    }
  };

  return (
    <Box component="main" className="main-feed follow-page">
      <Box className="menu-page-header">
        <Typography className="menu-page-header__title">{copy.title}</Typography>
        <Typography className="menu-page-header__description">{copy.description}</Typography>
      </Box>

      <Box className="follow-search-box">
        <TextField
          className="follow-search-input"
          fullWidth
          onChange={(event) => setKeyword(event.target.value)}
          placeholder={copy.searchPlaceholder}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRoundedIcon />
                </InputAdornment>
              ),
            },
            htmlInput: {
              maxLength: 50,
            },
          }}
          value={keyword}
        />
      </Box>

      {error && <Alert className="main-form-alert" severity="error">{error}</Alert>}

      {loading ? (
        <Box className="main-feed-state"><CircularProgress size={28} /></Box>
      ) : users.length === 0 ? (
        <Box className="main-feed-state">
          <Typography>{isSearching ? copy.emptySearch : copy.emptyRecommend}</Typography>
        </Box>
      ) : (
        <Stack className="recommend-user-list">
          {users.map((user) => (
            <Box
              className="recommend-user-card main-post--clickable"
              key={user.userId}
              onClick={() => handleOpenProfile(user)}
              onKeyDown={(event) => { if (event.key === 'Enter') handleOpenProfile(user); }}
              role="button"
              tabIndex={0}
            >
              <Avatar className="main-avatar recommend-user-card__avatar">{getInitial(user)}</Avatar>
              <Box className="recommend-user-card__body">
                <Typography className="recommend-user-card__name">{user.nickname}</Typography>
                <Typography className="recommend-user-card__username">@{user.username}</Typography>
                <Stack className="recommend-user-card__meta" direction="row" spacing={1.2} useFlexGap flexWrap="wrap">
                  <span>{copy.mutualCategories} {user.counts?.mutualCategories || 0}</span>
                  <span>{copy.followers} {user.counts?.followers || 0}</span>
                  <span>{copy.posts} {user.counts?.posts || 0}</span>
                </Stack>
              </Box>
              <Button
                className="recommend-user-card__button"
                disabled={followLoadingId === user.userId}
                onClick={(event) => handleFollow(event, user)}
                startIcon={<PersonAddAltRoundedIcon />}
                variant="contained"
              >
                {user.followedByMe ? copy.following : copy.follow}
              </Button>
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  );
}

export default Follow;

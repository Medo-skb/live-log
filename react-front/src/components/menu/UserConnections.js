import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Avatar,
  Box,
  Button,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import { getUserConnections, toggleUserFollow } from '../../api/userApi';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3010';

const copy = {
  followers: '팔로워',
  following: '팔로잉',
  follow: '팔로우',
  unfollow: '팔로잉 해제',
  emptyFollowers: '아직 팔로워가 없습니다.',
  emptyFollowing: '아직 팔로잉한 사용자가 없습니다.',
  loadError: '사용자 목록을 불러오지 못했습니다.',
};

function resolveMediaUrl(fileUrl) {
  if (!fileUrl) return '';
  return String(fileUrl).startsWith('http') ? fileUrl : API_BASE_URL + fileUrl;
}

function getInitial(user) {
  return String(user?.nickname || user?.username || 'L').charAt(0).toUpperCase();
}

function UserConnections() {
  const { username } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const isFollowers = location.pathname.endsWith('/followers');
  const title = isFollowers ? copy.followers : copy.following;
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [followLoadingUser, setFollowLoadingUser] = useState('');
  const [hoveredUser, setHoveredUser] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let ignore = false;

    setLoading(true);
    setError('');
    setUsers([]);

    getUserConnections({ username, type: isFollowers ? 'followers' : 'following' })
      .then((data) => {
        if (ignore) return;
        setUsers(Array.isArray(data.users) ? data.users : []);
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
  }, [isFollowers, username]);

  const handleOpenProfile = (targetUser) => {
    navigate('/' + encodeURIComponent(targetUser.username));
  };

  const handleToggleFollow = async (event, targetUser) => {
    event.stopPropagation();
    if (followLoadingUser) return;

    setFollowLoadingUser(targetUser.username);
    try {
      const data = await toggleUserFollow({ username: targetUser.username });
      if (!data.following && !isFollowers) {
        setUsers((prevUsers) => prevUsers.filter((item) => item.username !== targetUser.username));
        return;
      }
      setUsers((prevUsers) => prevUsers.map((item) => (
        item.username === targetUser.username ? { ...item, followedByMe: Boolean(data.following) } : item
      )));
    } catch (requestError) {
      setError(requestError.message || '팔로우 처리 중 오류가 발생했습니다.');
    } finally {
      setFollowLoadingUser('');
    }
  };

  return (
    <Box component="main" className="main-feed connection-page">
      <Box className="connection-header">
        <Button className="main-icon-button" onClick={() => navigate(-1)}><ArrowBackRoundedIcon /></Button>
        <Box>
          <Typography className="connection-header__title">{title}</Typography>
          <Typography className="connection-header__meta">@{username}</Typography>
        </Box>
      </Box>

      {error && <Alert className="main-form-alert" severity="error">{error}</Alert>}

      {loading ? (
        <Box className="main-feed-state"><CircularProgress size={28} /></Box>
      ) : users.length === 0 ? (
        <Box className="main-feed-state"><Typography>{isFollowers ? copy.emptyFollowers : copy.emptyFollowing}</Typography></Box>
      ) : (
        <Stack className="connection-list">
          {users.map((targetUser) => {
            const followed = Boolean(targetUser.followedByMe);
            const hoveringFollowed = followed && hoveredUser === targetUser.username;

            return (
              <Box
                className="connection-card main-post--clickable"
                key={targetUser.userId}
                onClick={() => handleOpenProfile(targetUser)}
                onKeyDown={(event) => { if (event.key === 'Enter') handleOpenProfile(targetUser); }}
                role="button"
                tabIndex={0}
              >
                <Avatar className="main-avatar" src={resolveMediaUrl(targetUser.profileImageUrl)}>{getInitial(targetUser)}</Avatar>
                <Box className="connection-card__body">
                  <Typography className="connection-card__name">{targetUser.nickname}</Typography>
                  <Typography className="connection-card__username">@{targetUser.username}</Typography>
                </Box>
                <Button
                  className={followed ? 'connection-follow-button connection-follow-button--following' : 'connection-follow-button'}
                  disabled={followLoadingUser === targetUser.username}
                  onClick={(event) => handleToggleFollow(event, targetUser)}
                  onMouseEnter={() => setHoveredUser(targetUser.username)}
                  onMouseLeave={() => setHoveredUser('')}
                  variant={followed ? 'outlined' : 'contained'}
                >
                  {hoveringFollowed ? copy.unfollow : followed ? copy.following : copy.follow}
                </Button>
              </Box>
            );
          })}
        </Stack>
      )}
    </Box>
  );
}

export default UserConnections;
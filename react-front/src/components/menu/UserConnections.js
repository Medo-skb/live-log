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
import { getUserConnections } from '../../api/userApi';

const copy = {
  followers: '팔로워',
  following: '팔로잉',
  emptyFollowers: '아직 팔로워가 없습니다.',
  emptyFollowing: '아직 팔로잉한 사용자가 없습니다.',
  loadError: '사용자 목록을 불러오지 못했습니다.',
};

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
          {users.map((targetUser) => (
            <Box
              className="connection-card main-post--clickable"
              key={targetUser.userId}
              onClick={() => handleOpenProfile(targetUser)}
              onKeyDown={(event) => { if (event.key === 'Enter') handleOpenProfile(targetUser); }}
              role="button"
              tabIndex={0}
            >
              <Avatar className="main-avatar">{getInitial(targetUser)}</Avatar>
              <Box className="connection-card__body">
                <Typography className="connection-card__name">{targetUser.nickname}</Typography>
                <Typography className="connection-card__username">@{targetUser.username}</Typography>
              </Box>
              {targetUser.followedByMe && <Typography className="connection-card__badge">{copy.following}</Typography>}
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  );
}

export default UserConnections;

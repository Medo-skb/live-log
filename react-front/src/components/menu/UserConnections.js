import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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

function getInitial(user) {
  return String(user?.nickname || user?.username || 'L').charAt(0).toUpperCase();
}

function UserConnections() {
  const { username, listType } = useParams();
  const navigate = useNavigate();
  const isFollowers = listType === 'followers';
  const title = isFollowers ? '팔로워' : '팔로잉';
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
        if (!ignore) setError(requestError.message || '사용자 목록을 불러오지 못했습니다.');
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [isFollowers, username]);

  const handleOpenProfile = (user) => {
    navigate('/' + encodeURIComponent(user.username));
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
        <Box className="main-feed-state"><Typography>{isFollowers ? '아직 팔로워가 없습니다.' : '아직 팔로잉한 사용자가 없습니다.'}</Typography></Box>
      ) : (
        <Stack className="connection-list">
          {users.map((user) => (
            <Box
              className="connection-card main-post--clickable"
              key={user.userId}
              onClick={() => handleOpenProfile(user)}
              onKeyDown={(event) => { if (event.key === 'Enter') handleOpenProfile(user); }}
              role="button"
              tabIndex={0}
            >
              <Avatar className="main-avatar">{getInitial(user)}</Avatar>
              <Box className="connection-card__body">
                <Typography className="connection-card__name">{user.nickname}</Typography>
                <Typography className="connection-card__username">@{user.username}</Typography>
              </Box>
              {user.followedByMe && <Typography className="connection-card__badge">팔로잉</Typography>}
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  );
}

export default UserConnections;

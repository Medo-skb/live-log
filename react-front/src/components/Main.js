import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Avatar,
  Badge,
  Box,
  Button,
  Divider,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import BookmarkBorderRoundedIcon from '@mui/icons-material/BookmarkBorderRounded';
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded';
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded';
import NotificationsNoneRoundedIcon from '@mui/icons-material/NotificationsNoneRounded';
import PersonAddAltRoundedIcon from '@mui/icons-material/PersonAddAltRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import WhatshotRoundedIcon from '@mui/icons-material/WhatshotRounded';
import { getTrendingTags } from '../api/searchApi';
import { getRecommendedUsers, getUserProfile } from '../api/userApi';
import PostComposerDialog from './post/PostComposerDialog';
import { getUnreadNoticeCount } from '../api/noticeApi';
import { getUnreadDmCount } from '../api/dmApi';
import { getAuthUser, updateAuthUser } from '../utils/authStorage';
import { connectSocket, disconnectSocket } from '../socket/socketClient';
import '../css/main.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3010';

function resolveMediaUrl(fileUrl) {
  if (!fileUrl) return '';
  return String(fileUrl).startsWith('http') ? fileUrl : API_BASE_URL + fileUrl;
}
const THEME_MODE_KEY = 'liveLogThemeMode';

const copy = {
  home: '홈',
  explore: '탐색하기',
  alerts: '알림',
  follow: '팔로우하기',
  chat: '채팅',
  bookmark: '북마크',
  profile: '프로필',
  admin: '관리자',
  post: '게시하기',
  settings: '설정',
  darkMode: '다크 모드',
  lightMode: '라이트 모드',
  accountLogout: '계정 로그아웃',
  searchPlaceholder: '작품, 태그, 사용자 검색',
  trendKeywords: '인기 키워드',
  mention: '언급',
  times: '회',
  recommendedFollowers: '추천 팔로워',
  noTrendTags: '아직 언급된 태그가 없습니다.',
  noRecommendedUsers: '추천할 사용자가 없습니다.',
};

const navItems = [
  { label: copy.home, path: '/home', icon: <HomeRoundedIcon /> },
  { label: copy.explore, path: '/explore', icon: <SearchRoundedIcon /> },
  { label: copy.alerts, path: '/alerts', icon: <NotificationsNoneRoundedIcon />, badgeKey: 'alerts' },
  { label: copy.follow, path: '/follow', icon: <PersonAddAltRoundedIcon /> },
  { label: copy.chat, path: '/chat', icon: <ChatBubbleOutlineRoundedIcon />, badgeKey: 'chat' },
  { label: copy.bookmark, path: '/bookmark', icon: <BookmarkBorderRoundedIcon /> },
  { label: copy.profile, path: '__PROFILE_PATH__', icon: <PersonRoundedIcon /> },
];


function getStoredThemeMode() {
  return localStorage.getItem(THEME_MODE_KEY) === 'dark' ? 'dark' : 'light';
}

function getStoredUser() {
  return getAuthUser();
}

function hasSelectedCategories(user) {
  return Array.isArray(user?.categories) && user.categories.length > 0;
}

function isActivePath(currentPath, itemPath) {
  if (itemPath === '/home') {
    return currentPath === '/home';
  }

  return currentPath === itemPath || currentPath.startsWith(itemPath + '/');
}

function Main() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(() => getStoredUser());
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [themeMode, setThemeMode] = useState(() => getStoredThemeMode());
  const [postDialogOpen, setPostDialogOpen] = useState(false);
  const [unreadNoticeCount, setUnreadNoticeCount] = useState(0);
  const [unreadDmCount, setUnreadDmCount] = useState(0);
  const [trendTags, setTrendTags] = useState([]);
  const [recommendedUsers, setRecommendedUsers] = useState([]);
  const [asideSearchKeyword, setAsideSearchKeyword] = useState('');

  const displayName = user?.nickname || user?.username || '사용자';
  const accountId = user?.username || 'guest';
  const avatarSrc = resolveMediaUrl(user?.profileImageUrl || user?.profileImage || user?.picture || '');
  const isDarkMode = themeMode === 'dark';
  const isChatPage = location.pathname.startsWith('/chat');
  const profilePath = '/' + accountId;
  const adminNavItems = user?.role === 'ADMIN' ? [{ label: copy.admin, path: '/admin', icon: <SettingsRoundedIcon /> }] : [];
  const resolvedNavItems = [...navItems, ...adminNavItems].map((item) => (item.path === '__PROFILE_PATH__' ? { ...item, path: profilePath } : item));

  useEffect(() => {
    if (String(user?.role || '').toUpperCase() === 'ADMIN') {
      navigate('/admin', { replace: true });
      return;
    }

    if (!hasSelectedCategories(user) && location.pathname !== '/onboarding') {
      navigate('/onboarding', { replace: true });
    }
  }, [location.pathname, navigate, user]);


  useEffect(() => {
    if (!user?.username) return undefined;

    let ignore = false;

    getUserProfile({ username: user.username })
      .then((data) => {
        const profile = data.profile;
        if (ignore || !profile) return;

        setUser((prevUser) => {
          if (!prevUser || String(prevUser.username) !== String(profile.username)) return prevUser;

          const nextUser = {
            ...prevUser,
            nickname: profile.nickname || prevUser.nickname,
            role: profile.role || prevUser.role,
            profileImage: profile.profileImageUrl || prevUser.profileImage,
            profileImageUrl: profile.profileImageUrl || prevUser.profileImageUrl,
            bannerImage: profile.bannerImageUrl || prevUser.bannerImage,
            bannerImageUrl: profile.bannerImageUrl || prevUser.bannerImageUrl,
            categories: Array.isArray(prevUser.categories) ? prevUser.categories : [],
          };
          updateAuthUser(nextUser);
          return nextUser;
        });
      })
      .catch(() => {});

    return () => {
      ignore = true;
    };
  }, [user?.username]);


  useEffect(() => {
    let ignore = false;

    getTrendingTags()
      .then((data) => {
        if (!ignore) setTrendTags(Array.isArray(data.tags) ? data.tags : []);
      })
      .catch(() => {
        if (!ignore) setTrendTags([]);
      });

    getRecommendedUsers({ limit: 3 })
      .then((data) => {
        if (!ignore) setRecommendedUsers(Array.isArray(data.users) ? data.users : []);
      })
      .catch(() => {
        if (!ignore) setRecommendedUsers([]);
      });

    return () => {
      ignore = true;
    };
  }, [location.pathname]);
  useEffect(() => {
    let ignore = false;

    getUnreadNoticeCount()
      .then((data) => {
        if (!ignore) setUnreadNoticeCount(Number(data.unreadCount) || 0);
      })
      .catch(() => {
        if (!ignore) setUnreadNoticeCount(0);
      });

    getUnreadDmCount()
      .then((data) => {
        if (!ignore) setUnreadDmCount(Number(data.unreadCount) || 0);
      })
      .catch(() => {
        if (!ignore) setUnreadDmCount(0);
      });

    return () => {
      ignore = true;
    };
  }, [location.pathname]);

  useEffect(() => {
    const socket = connectSocket();
    if (!socket) return undefined;

    const handleNoticeCreated = (payload) => {
      const nextUnreadCount = Number(payload?.unreadCount);
      setUnreadNoticeCount((prevCount) => (
        Number.isFinite(nextUnreadCount) ? nextUnreadCount : prevCount + 1
      ));
      window.dispatchEvent(new CustomEvent('liveLogNoticeCreated', { detail: payload }));
    };

    const handleDmCreated = (payload) => {
      const nextUnreadCount = Number(payload?.unreadCount);
      setUnreadDmCount((prevCount) => (
        Number.isFinite(nextUnreadCount) ? nextUnreadCount : prevCount + 1
      ));
    };

    const handleDmUnreadCount = (payload) => {
      const nextUnreadCount = Number(payload?.unreadCount);
      if (Number.isFinite(nextUnreadCount)) setUnreadDmCount(nextUnreadCount);
    };

    socket.on('notice:new', handleNoticeCreated);
    socket.on('dm:new', handleDmCreated);
    socket.on('dm:unread-count', handleDmUnreadCount);

    return () => {
      socket.off('notice:new', handleNoticeCreated);
      socket.off('dm:new', handleDmCreated);
      socket.off('dm:unread-count', handleDmUnreadCount);
    };
  }, []);

  useEffect(() => {
    const handleUnreadChanged = (event) => {
      const nextUnreadCount = Number(event.detail?.unreadCount);
      if (Number.isFinite(nextUnreadCount)) {
        setUnreadNoticeCount(nextUnreadCount);
      }
    };

    const handleDmUnreadChanged = (event) => {
      const nextUnreadCount = Number(event.detail?.unreadCount);
      if (Number.isFinite(nextUnreadCount)) {
        setUnreadDmCount(nextUnreadCount);
      }
    };

    window.addEventListener('liveLogNoticeUnreadChanged', handleUnreadChanged);
    window.addEventListener('liveLogDmUnreadChanged', handleDmUnreadChanged);

    return () => {
      window.removeEventListener('liveLogNoticeUnreadChanged', handleUnreadChanged);
      window.removeEventListener('liveLogDmUnreadChanged', handleDmUnreadChanged);
    };
  }, []);

  const handleThemeToggle = () => {
    setThemeMode((prev) => {
      const nextMode = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem(THEME_MODE_KEY, nextMode);

      return nextMode;
    });
  };

  const handlePostCreated = (post) => {
    window.dispatchEvent(new CustomEvent('liveLogPostCreated', { detail: post }));
  };

  const handleLogout = () => {
    disconnectSocket();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };
  const handleAsideSearch = (event) => {
    event?.preventDefault();
    const search = asideSearchKeyword.trim();
    if (!search) return;
    navigate('/explore?q=' + encodeURIComponent(search));
  };

  return (
    <Box className={(isDarkMode ? 'main-shell main-shell--dark' : 'main-shell') + (isChatPage ? ' main-shell--chat' : '')}>
      <Box component="aside" className="main-sidebar">
        <Box className="main-brand">
          <Box className="main-brand__mark">L</Box>
          <Typography className="main-brand__name">Live-Log</Typography>
        </Box>

        <Stack component="nav" className="main-nav" spacing={0.25}>
          {resolvedNavItems.map((item) => {
            const active = isActivePath(location.pathname, item.path);

            return (
              <Button
                className={active ? 'main-nav__item main-nav__item--active' : 'main-nav__item'}
                key={item.path}
                onClick={() => navigate(item.path)}
                startIcon={
                  (item.badgeKey === 'alerts' && unreadNoticeCount > 0) ? (
                    <Badge badgeContent={unreadNoticeCount} color="primary">
                      {item.icon}
                    </Badge>
                  ) : (item.badgeKey === 'chat' && unreadDmCount > 0) ? (
                    <Badge badgeContent={unreadDmCount} color="primary">
                      {item.icon}
                    </Badge>
                  ) : item.icon
                }
              >
                <span>{item.label}</span>
              </Button>
            );
          })}
        </Stack>

        <Button className="main-write-button" fullWidth onClick={() => setPostDialogOpen(true)} startIcon={<AddRoundedIcon />} variant="contained">
          {copy.post}
        </Button>

        <Box className="main-account-wrap">
          {profileMenuOpen && (
            <Box className="main-account-menu">
              <Button className="main-account-menu__item" fullWidth onClick={() => { setProfileMenuOpen(false); navigate('/settings'); }} startIcon={<SettingsRoundedIcon />}>
                {copy.settings}
              </Button>
              <Button
                className="main-account-menu__item"
                fullWidth
                onClick={handleThemeToggle}
                startIcon={isDarkMode ? <LightModeRoundedIcon /> : <DarkModeRoundedIcon />}
              >
                {isDarkMode ? copy.lightMode : copy.darkMode}
              </Button>
              <Button className="main-account-menu__item" fullWidth onClick={handleLogout} startIcon={<LogoutRoundedIcon />}>
                @{accountId} {copy.accountLogout}
              </Button>
              <Box className="main-account-menu__arrow" />
            </Box>
          )}

          <Button className="main-account-button" fullWidth onClick={() => setProfileMenuOpen((prev) => !prev)}>
            <Avatar className="main-avatar main-avatar--account" src={avatarSrc}>{displayName.charAt(0)}</Avatar>
            <Box className="main-account-button__text">
              <Typography className="main-account-button__name">{displayName}</Typography>
              <Typography className="main-account-button__meta">@{accountId}</Typography>
            </Box>
            <MoreHorizRoundedIcon className="main-account-button__more" />
          </Button>
        </Box>
      </Box>

      <Outlet context={{ accountId, avatarSrc, displayName, isDarkMode, setThemeMode, setUser, themeMode, user }} />

      <PostComposerDialog
        avatarSrc={avatarSrc}
        displayName={displayName}
        isDarkMode={isDarkMode}
        onClose={() => setPostDialogOpen(false)}
        onPostCreated={handlePostCreated}
        open={postDialogOpen}
        user={user}
      />

      <Box component="aside" className="main-aside">
        <Box component="form" onSubmit={handleAsideSearch}>
          <TextField
            className="main-search"
            fullWidth
            onChange={(event) => setAsideSearchKeyword(event.target.value)}
            placeholder={copy.searchPlaceholder}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRoundedIcon /></InputAdornment> } }}
            value={asideSearchKeyword}
          />
        </Box>

        <Box className="main-side-panel">
          <Box className="main-side-panel__title-row">
            <Typography className="main-side-panel__title">{copy.trendKeywords}</Typography>
            <WhatshotRoundedIcon className="main-side-panel__icon" />
          </Box>
          {trendTags.length === 0 ? (
            <Typography className="main-side-panel__empty">{copy.noTrendTags}</Typography>
          ) : (
            <Stack divider={<Divider />}>
              {trendTags.map((item, index) => (
                <Button className="main-trend-item main-trend-item--button" fullWidth key={item.tag} onClick={() => navigate('/explore?q=' + encodeURIComponent('#' + item.tag))}>
                  <Typography className="main-trend-item__rank">{index + 1}</Typography>
                  <Box>
                    <Typography className="main-trend-item__keyword">#{item.tag}</Typography>
                    <Typography className="main-trend-item__count">{copy.mention} {Number(item.count || 0).toLocaleString()}{copy.times}</Typography>
                  </Box>
                </Button>
              ))}
            </Stack>
          )}
        </Box>

        <Box className="main-side-panel">
          <Box className="main-side-panel__title-row">
            <Typography className="main-side-panel__title">{copy.recommendedFollowers}</Typography>
          </Box>
          {recommendedUsers.length === 0 ? (
            <Typography className="main-side-panel__empty">{copy.noRecommendedUsers}</Typography>
          ) : (
            <Stack divider={<Divider />}>
              {recommendedUsers.map((targetUser) => (
                <Button className="main-recommend-user" fullWidth key={targetUser.userId} onClick={() => navigate('/' + encodeURIComponent(targetUser.username))}>
                  <Avatar className="main-avatar main-recommend-user__avatar" src={resolveMediaUrl(targetUser.profileImageUrl)}>{String(targetUser.nickname || targetUser.username || 'L').charAt(0).toUpperCase()}</Avatar>
                  <Box className="main-recommend-user__text">
                    <Typography className="main-recommend-user__name">{targetUser.nickname || targetUser.username}</Typography>
                    <Typography className="main-recommend-user__username">@{targetUser.username}</Typography>
                  </Box>
                </Button>
              ))}
            </Stack>
          )}
        </Box>
      </Box>
    </Box>
  );
}

export default Main;


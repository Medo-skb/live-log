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
import PostComposerDialog from './post/PostComposerDialog';
import '../css/main.css';

const THEME_MODE_KEY = 'liveLogThemeMode';

const copy = {
  home: "홈",
  explore: "탐색하기",
  alerts: "알림",
  follow: "팔로우하기",
  chat: "채팅",
  bookmark: "북마크",
  profile: "프로필",
  post: "게시하기",
  settings: "설정",
  darkMode: "다크모드",
  lightMode: "라이트모드",
  accountLogout: "계정에서 로그아웃",
  searchPlaceholder: "작품, 태그, 사용자를 검색",
  trendKeywords: "트렌드 키워드",
  mention: "언급",
  times: "회",
  todayCheck: "오늘의 체크",
  check1: "이메일 인증 완료 계정만 메인 진입",
  check2: "작성 API 연결 전 프론트 화면 검증",
};

const navItems = [
  { label: copy.home, path: '/home', icon: <HomeRoundedIcon /> },
  { label: copy.explore, path: '/explore', icon: <SearchRoundedIcon /> },
  { label: copy.alerts, path: '/alerts', icon: <NotificationsNoneRoundedIcon />, badge: 2 },
  { label: copy.follow, path: '/follow', icon: <PersonAddAltRoundedIcon /> },
  { label: copy.chat, path: '/chat', icon: <ChatBubbleOutlineRoundedIcon /> },
  { label: copy.bookmark, path: '/bookmark', icon: <BookmarkBorderRoundedIcon /> },
  { label: copy.profile, path: '__PROFILE_PATH__', icon: <PersonRoundedIcon /> },
];

const trendItems = [
  { keyword: "프리렌", count: '1,248' },
  { keyword: "스포일러방지", count: '932' },
  { keyword: "주술회전", count: '781' },
  { keyword: "새벽감상", count: '420' },
];

function getStoredThemeMode() {
  return localStorage.getItem(THEME_MODE_KEY) === 'dark' ? 'dark' : 'light';
}

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null');
  } catch (error) {
    return null;
  }
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

  const displayName = user?.nickname || user?.username || "게스트";
  const accountId = user?.username || 'guest';
  const avatarSrc = user?.profileImage || user?.picture || '';
  const isDarkMode = themeMode === 'dark';
  const profilePath = '/' + accountId;
  const resolvedNavItems = navItems.map((item) => (item.path === '__PROFILE_PATH__' ? { ...item, path: profilePath } : item));

  useEffect(() => {
    if (!hasSelectedCategories(user) && location.pathname !== '/onboarding') {
      navigate('/onboarding', { replace: true });
    }
  }, [location.pathname, navigate, user]);

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
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  return (
    <Box className={isDarkMode ? 'main-shell main-shell--dark' : 'main-shell'}>
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
                  item.badge ? (
                    <Badge badgeContent={item.badge} color="primary">
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
              <Button className="main-account-menu__item" fullWidth startIcon={<SettingsRoundedIcon />}>
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

      <Outlet context={{ accountId, avatarSrc, displayName, isDarkMode, setUser, user }} />

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
        <TextField
          className="main-search"
          fullWidth
          placeholder={copy.searchPlaceholder}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRoundedIcon /></InputAdornment> } }}
        />

        <Box className="main-side-panel">
          <Box className="main-side-panel__title-row">
            <Typography className="main-side-panel__title">{copy.trendKeywords}</Typography>
            <WhatshotRoundedIcon className="main-side-panel__icon" />
          </Box>
          <Stack divider={<Divider />}>
            {trendItems.map((item, index) => (
              <Box className="main-trend-item" key={item.keyword}>
                <Typography className="main-trend-item__rank">{index + 1}</Typography>
                <Box>
                  <Typography className="main-trend-item__keyword">#{item.keyword}</Typography>
                  <Typography className="main-trend-item__count">{copy.mention} {item.count}{copy.times}</Typography>
                </Box>
              </Box>
            ))}
          </Stack>
        </Box>

        <Box className="main-side-panel main-side-panel--notice">
          <Typography className="main-side-panel__title">{copy.todayCheck}</Typography>
          <Stack spacing={1.2}>
            <Box className="main-check-row"><Badge color="primary" variant="dot" /><Typography>{copy.check1}</Typography></Box>
            <Box className="main-check-row"><Badge color="secondary" variant="dot" /><Typography>{copy.check2}</Typography></Box>
          </Stack>
        </Box>
      </Box>
    </Box>
  );
}

export default Main;


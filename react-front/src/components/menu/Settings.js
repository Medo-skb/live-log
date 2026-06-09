import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  FormControlLabel,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import BlockRoundedIcon from '@mui/icons-material/BlockRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded';
import { getCategories, getMyCategories, updateMyCategories } from '../../api/categoryApi';
import { getBlockedUsers, getMySettings, unblockUser, updateMySettings } from '../../api/userApi';
import { DEFAULT_CATEGORIES } from '../../constants/categories';
import { updateAuthUser } from '../../utils/authStorage';
import { useAppModal } from '../common/ModalProvider';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3010';
const THEME_MODE_KEY = 'liveLogThemeMode';

const copy = {
  title: '설정',
  description: '콘텐츠 표시 방식과 차단한 사용자를 관리합니다.',
  contentTitle: '화면 및 콘텐츠',
  categoryTitle: '관심 카테고리',
  categoryDescription: '선택한 카테고리는 홈 상단 탭과 피드 필터에 사용됩니다.',
  categoryHelper: '1개 이상, 최대 5개까지 선택할 수 있습니다.',
  saveCategories: '카테고리 저장',
  saving: '저장 중',
  spoilerTitle: '스포일러 필터',
  spoilerDescription: 'AI가 스포일러로 판단한 게시글을 가려서 표시합니다.',
  darkModeTitle: '다크 모드',
  darkModeDescription: '로그인 이후 화면에 다크 테마를 적용합니다.',
  privacyTitle: '차단 및 개인정보',
  blockTitle: '차단한 사용자',
  blockDescription: '차단한 사용자는 내 피드, 검색, DM 대상에서 제외됩니다.',
  noBlockedUsers: '차단한 사용자가 없습니다.',
  unblock: '차단 해제',
  unblockConfirmTitle: '차단을 해제할까요?',
  unblockConfirmBody: '차단을 해제하면 해당 사용자의 게시글과 메시지가 다시 보일 수 있습니다.',
  unblockDoneTitle: '차단을 해제했습니다.',
  categoryRequired: '관심 카테고리를 1개 이상 선택해주세요.',
  categoryMax: '관심 카테고리는 최대 5개까지 선택할 수 있습니다.',
  categorySavedTitle: '카테고리를 저장했습니다.',
  settingSavedTitle: '설정을 저장했습니다.',
  loadError: '설정을 불러오지 못했습니다.',
};

function resolveMediaUrl(fileUrl) {
  if (!fileUrl) return '';
  return String(fileUrl).startsWith('http') ? fileUrl : API_BASE_URL + fileUrl;
}

function getInitial(user) {
  return String(user?.nickname || user?.username || 'L').charAt(0).toUpperCase();
}

function Settings() {
  const appModal = useAppModal();
  const { setThemeMode, setUser, themeMode, user } = useOutletContext();
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [selectedIds, setSelectedIds] = useState(() => (user?.categories || []).map((category) => category.categoryId));
  const [spoilerFilter, setSpoilerFilter] = useState(user?.spoilerFilter === 0 ? 0 : 1);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categorySaving, setCategorySaving] = useState(false);
  const [settingSaving, setSettingSaving] = useState(false);
  const [error, setError] = useState('');

  const isDarkMode = themeMode === 'dark';
  const selectedCountLabel = useMemo(() => selectedIds.length + ' / 5', [selectedIds.length]);

  useEffect(() => {
    let ignore = false;

    setLoading(true);
    setError('');

    Promise.all([
      getCategories().catch(() => ({ categories: DEFAULT_CATEGORIES })),
      getMyCategories(),
      getMySettings(),
      getBlockedUsers(),
    ])
      .then(([categoryData, myCategoryData, settingData, blockData]) => {
        if (ignore) return;

        const nextCategories = Array.isArray(categoryData.categories) && categoryData.categories.length > 0
          ? categoryData.categories
          : DEFAULT_CATEGORIES;
        const nextMyCategories = Array.isArray(myCategoryData.categories) ? myCategoryData.categories : [];
        const nextSpoilerFilter = settingData.settings?.spoilerFilter === 0 ? 0 : 1;

        setCategories(nextCategories);
        setSelectedIds(nextMyCategories.map((category) => category.categoryId));
        setSpoilerFilter(nextSpoilerFilter);
        setBlockedUsers(Array.isArray(blockData.users) ? blockData.users : []);

        setUser?.((prevUser) => {
          if (!prevUser) return prevUser;
          const nextUser = {
            ...prevUser,
            categories: nextMyCategories,
            spoilerFilter: nextSpoilerFilter,
          };
          updateAuthUser(nextUser);
          return nextUser;
        });
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
  }, [setUser]);

  const handleToggleCategory = (categoryId) => {
    setSelectedIds((prev) => {
      if (prev.includes(categoryId)) {
        return prev.filter((id) => id !== categoryId);
      }

      if (prev.length >= 5) {
        appModal.showAlert({ title: copy.categoryMax, message: copy.categoryHelper });
        return prev;
      }

      return [...prev, categoryId];
    });
  };

  const handleSaveCategories = async () => {
    if (selectedIds.length === 0) {
      await appModal.showAlert({ title: copy.categoryRequired, message: copy.categoryHelper });
      return;
    }

    setCategorySaving(true);
    try {
      const data = await updateMyCategories({ categoryIds: selectedIds });
      const nextCategories = Array.isArray(data.categories) ? data.categories : [];
      setSelectedIds(nextCategories.map((category) => category.categoryId));
      setUser?.((prevUser) => {
        const nextUser = { ...(prevUser || user || {}), categories: nextCategories };
        updateAuthUser(nextUser);
        return nextUser;
      });
      await appModal.showAlert({ title: copy.categorySavedTitle, message: data.message || '' });
    } catch (requestError) {
      await appModal.showAlert({ title: '저장 실패', message: requestError.message || '카테고리를 저장하지 못했습니다.' });
    } finally {
      setCategorySaving(false);
    }
  };

  const handleSpoilerToggle = async (event) => {
    const nextSpoilerFilter = event.target.checked ? 1 : 0;
    const prevSpoilerFilter = spoilerFilter;
    setSpoilerFilter(nextSpoilerFilter);
    setSettingSaving(true);

    try {
      const data = await updateMySettings({ spoilerFilter: nextSpoilerFilter });
      const savedSpoilerFilter = data.settings?.spoilerFilter === 0 ? 0 : 1;
      setSpoilerFilter(savedSpoilerFilter);
      setUser?.((prevUser) => {
        const nextUser = { ...(prevUser || user || {}), spoilerFilter: savedSpoilerFilter };
        updateAuthUser(nextUser);
        return nextUser;
      });
    } catch (requestError) {
      setSpoilerFilter(prevSpoilerFilter);
      await appModal.showAlert({ title: '저장 실패', message: requestError.message || '스포일러 설정을 저장하지 못했습니다.' });
    } finally {
      setSettingSaving(false);
    }
  };

  const handleThemeToggle = (event) => {
    const nextMode = event.target.checked ? 'dark' : 'light';
    localStorage.setItem(THEME_MODE_KEY, nextMode);
    setThemeMode?.(nextMode);
  };

  const handleUnblock = async (targetUser) => {
    const confirmed = await appModal.showConfirm({
      title: copy.unblockConfirmTitle,
      message: copy.unblockConfirmBody,
      confirmText: copy.unblock,
      cancelText: '취소',
    });

    if (!confirmed) return;

    try {
      await unblockUser({ username: targetUser.username });
      setBlockedUsers((prevUsers) => prevUsers.filter((item) => item.username !== targetUser.username));
      await appModal.showAlert({ title: copy.unblockDoneTitle, message: '@' + targetUser.username + ' 사용자의 차단을 해제했습니다.' });
    } catch (requestError) {
      await appModal.showAlert({ title: '차단 해제 실패', message: requestError.message || '차단을 해제하지 못했습니다.' });
    }
  };

  return (
    <Box component="main" className="main-feed settings-page">
      <Box className="menu-page-header settings-page__header">
        <Typography className="menu-page-header__title" component="h1">{copy.title}</Typography>
        <Typography className="menu-page-header__description">{copy.description}</Typography>
      </Box>

      {loading ? (
        <Box className="settings-page__loading"><CircularProgress size={28} /></Box>
      ) : (
        <Stack className="settings-page__content" spacing={2.2}>
          {error && <Alert severity="error">{error}</Alert>}

          <Box className="settings-card">
            <Box className="settings-card__heading">
              <Box className="settings-card__icon"><VisibilityOffRoundedIcon /></Box>
              <Box>
                <Typography className="settings-card__title">{copy.contentTitle}</Typography>
                <Typography className="settings-card__description">{copy.description}</Typography>
              </Box>
            </Box>

            <Box className="settings-row">
              <Box>
                <Typography className="settings-row__title">{copy.spoilerTitle}</Typography>
                <Typography className="settings-row__description">{copy.spoilerDescription}</Typography>
              </Box>
              <FormControlLabel
                className="settings-switch"
                control={<Switch checked={spoilerFilter === 1} disabled={settingSaving} onChange={handleSpoilerToggle} />}
                label={spoilerFilter === 1 ? '켜짐' : '꺼짐'}
              />
            </Box>

            <Divider className="settings-divider" />

            <Box className="settings-row">
              <Box>
                <Typography className="settings-row__title">{copy.darkModeTitle}</Typography>
                <Typography className="settings-row__description">{copy.darkModeDescription}</Typography>
              </Box>
              <FormControlLabel
                className="settings-switch"
                control={<Switch checked={isDarkMode} onChange={handleThemeToggle} />}
                label={isDarkMode ? '켜짐' : '꺼짐'}
              />
            </Box>
          </Box>

          <Box className="settings-card">
            <Box className="settings-card__heading">
              <Box className="settings-card__icon"><DarkModeRoundedIcon /></Box>
              <Box>
                <Typography className="settings-card__title">{copy.categoryTitle}</Typography>
                <Typography className="settings-card__description">{copy.categoryDescription}</Typography>
              </Box>
            </Box>

            <Typography className="settings-card__helper">{copy.categoryHelper}</Typography>
            <Box className="settings-category-grid">
              {categories.map((category) => {
                const selected = selectedIds.includes(category.categoryId);
                return (
                  <Button
                    className={selected ? 'main-category-choice main-category-choice--selected' : 'main-category-choice'}
                    key={category.categoryId}
                    onClick={() => handleToggleCategory(category.categoryId)}
                  >
                    <span>{category.name}</span>
                    {selected && <CheckCircleRoundedIcon />}
                  </Button>
                );
              })}
            </Box>

            <Box className="settings-card__actions">
              <Chip className="main-onboarding__count" label={selectedCountLabel} />
              <Button className="settings-primary-button" disabled={categorySaving || selectedIds.length === 0} onClick={handleSaveCategories} variant="contained">
                {categorySaving ? copy.saving : copy.saveCategories}
              </Button>
            </Box>
          </Box>

          <Box className="settings-card">
            <Box className="settings-card__heading">
              <Box className="settings-card__icon"><ShieldOutlinedIcon /></Box>
              <Box>
                <Typography className="settings-card__title">{copy.privacyTitle}</Typography>
                <Typography className="settings-card__description">{copy.blockDescription}</Typography>
              </Box>
            </Box>

            <Box className="settings-block-list">
              {blockedUsers.length === 0 ? (
                <Box className="settings-empty-state">
                  <BlockRoundedIcon />
                  <Typography>{copy.noBlockedUsers}</Typography>
                </Box>
              ) : blockedUsers.map((targetUser) => (
                <Box className="settings-block-user" key={targetUser.userId}>
                  <Avatar className="main-avatar" src={resolveMediaUrl(targetUser.profileImageUrl)}>{getInitial(targetUser)}</Avatar>
                  <Box className="settings-block-user__body">
                    <Typography className="settings-block-user__name">{targetUser.nickname || targetUser.username}</Typography>
                    <Typography className="settings-block-user__meta">@{targetUser.username}</Typography>
                  </Box>
                  <Button className="settings-secondary-button" onClick={() => handleUnblock(targetUser)}>{copy.unblock}</Button>
                </Box>
              ))}
            </Box>
          </Box>
        </Stack>
      )}
    </Box>
  );
}

export default Settings;
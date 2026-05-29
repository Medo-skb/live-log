import { useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import { getCategories, updateMyCategories } from '../../api/categoryApi';
import { DEFAULT_CATEGORIES } from '../../constants/categories';
import { updateAuthUser } from '../../utils/authStorage';

const copy = {
  title: "관심 카테고리를 선택해주세요",
  description: "선택한 카테고리는 메인 피드 상단 탭과 초기 피드 필터로 사용됩니다.",
  helper: "1개 이상, 최대 5개까지 선택할 수 있습니다.",
  submit: "선택 완료",
  submitting: "저장 중...",
  required: "관심 카테고리를 1개 이상 선택해주세요.",
  failed: "카테고리 저장에 실패했습니다.",
};

function Onboarding() {
  const navigate = useNavigate();
  const { setUser, user } = useOutletContext();
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [selectedIds, setSelectedIds] = useState(() => (user?.categories || []).map((category) => category.categoryId));
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getCategories()
      .then((data) => {
        if (Array.isArray(data.categories) && data.categories.length > 0) {
          setCategories(data.categories);
        }
      })
      .catch(() => {
        setCategories(DEFAULT_CATEGORIES);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const handleToggle = (categoryId) => {
    setError('');
    setSelectedIds((prev) => {
      if (prev.includes(categoryId)) {
        return prev.filter((id) => id !== categoryId);
      }

      if (prev.length >= 5) {
        return prev;
      }

      return [...prev, categoryId];
    });
  };

  const handleSubmit = () => {
    if (selectedIds.length === 0) {
      setError(copy.required);
      return;
    }

    setSubmitting(true);
    setError('');

    updateMyCategories({ categoryIds: selectedIds })
      .then((data) => {
        const nextUser = {
          ...(user || {}),
          categories: data.categories || [],
        };

        updateAuthUser(nextUser);
        setUser(nextUser);
        navigate('/main', { replace: true });
      })
      .catch((err) => {
        setError(err.message || copy.failed);
      })
      .finally(() => {
        setSubmitting(false);
      });
  };

  return (
    <Box component="main" className="main-feed main-onboarding">
      <Box className="main-onboarding__inner">
        <Stack spacing={2.4}>
          <Box>
            <Typography component="h1" className="main-onboarding__title">{copy.title}</Typography>
            <Typography className="main-onboarding__description">{copy.description}</Typography>
          </Box>

          <Typography className="main-onboarding__helper">{copy.helper}</Typography>
          {error && <Alert severity="warning">{error}</Alert>}

          {loading ? (
            <Box className="main-onboarding__loading"><CircularProgress size={28} /></Box>
          ) : (
            <Box className="main-onboarding__grid">
              {categories.map((category) => {
                const selected = selectedIds.includes(category.categoryId);

                return (
                  <Button
                    className={selected ? 'main-category-choice main-category-choice--selected' : 'main-category-choice'}
                    key={category.categoryId}
                    onClick={() => handleToggle(category.categoryId)}
                  >
                    <span>{category.name}</span>
                    {selected && <CheckCircleRoundedIcon />}
                  </Button>
                );
              })}
            </Box>
          )}

          <Stack alignItems="center" direction="row" justifyContent="space-between" spacing={2}>
            <Chip className="main-onboarding__count" label={selectedIds.length + ' / 5'} />
            <Button
              className="main-onboarding__submit"
              disabled={submitting || selectedIds.length === 0}
              onClick={handleSubmit}
              variant="contained"
            >
              {submitting ? copy.submitting : copy.submit}
            </Button>
          </Stack>
        </Stack>
      </Box>
    </Box>
  );
}

export default Onboarding;

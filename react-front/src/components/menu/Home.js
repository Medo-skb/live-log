import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Avatar,
  Box,
  Button,
  Chip,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import BookmarkBorderRoundedIcon from '@mui/icons-material/BookmarkBorderRounded';
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import FavoriteBorderRoundedIcon from '@mui/icons-material/FavoriteBorderRounded';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded';
import RepeatRoundedIcon from '@mui/icons-material/RepeatRounded';
import TagRoundedIcon from '@mui/icons-material/TagRounded';
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded';
import { CATEGORY_ALL, CATEGORY_ALL_ID, DEFAULT_CATEGORIES } from '../../constants/categories';

const SPOILER_STATUS = {
  IDLE: 'IDLE',
  ANALYZING: 'ANALYZING',
  SAFE: 'SAFE',
  SPOILER: 'SPOILER',
};

const copy = {
  category: "카테고리",
  spoiler: "스포일러",
  workName: "작품명",
  progress: "진도",
  placeholder: "지금 보는 작품의 순간을 남겨보세요.",
  submit: "게시",
  save: "저장",
  aiIdle: "AI 분석",
  aiAnalyzing: "분석 중",
  aiSafe: "안전",
  aiSpoiler: "스포일러 감지",
  devAlert: "프론트 화면 확인용입니다. 다음 단계에서 POSTS 작성 API와 AI 스포일러 분석 API를 연결하면 실제 등록됩니다.",
};

const mockPosts = [
  {
    postId: 1,
    categoryId: 1,
    categoryName: "애니메이션",
    user: { nickname: "하루로그", tag: '1842', username: 'harulog' },
    workTitle: "장송의 프리렌",
    progress: "12화",
    content: "잔잔한데 장면마다 여운이 길게 남는다. 오늘 본 회차는 대사보다 침묵이 더 크게 느껴졌다.",
    isSpoiler: false,
    tags: ["감상", "판타지", "힐링"],
    createdAt: "12분 전",
    counts: { comments: 8, reposts: 3, likes: 42 },
  },
  {
    postId: 2,
    categoryId: 2,
    categoryName: "소설",
    user: { nickname: "삼줄마커", tag: '0301', username: 'marker' },
    workTitle: "문의 아이들",
    progress: "2권 4장",
    content: "스포일러가 될 수 있는 장면이라 접어둠. 감정선이 크게 꿂이는 구간이었다.",
    isSpoiler: true,
    tags: ["스포주의", "소설", "기록"],
    createdAt: "34분 전",
    counts: { comments: 2, reposts: 1, likes: 19 },
  },
  {
    postId: 3,
    categoryId: 8,
    categoryName: "게임",
    user: { nickname: "콘트롤러", tag: '7772', username: 'controller' },
    workTitle: "새벽의 보스러시",
    progress: "챕터 6",
    content: "같은 패턴인데 두 번째 페이즈부터 전혀 다른 게임처럼 바뀌다.",
    isSpoiler: false,
    tags: ["게임", "보스전"],
    createdAt: "1시간 전",
    counts: { comments: 5, reposts: 7, likes: 64 },
  },
];

function getSpoilerStatusLabel(status) {
  if (status === SPOILER_STATUS.ANALYZING) return copy.aiAnalyzing;
  if (status === SPOILER_STATUS.SAFE) return copy.aiSafe;
  if (status === SPOILER_STATUS.SPOILER) return copy.aiSpoiler;
  return copy.aiIdle;
}

function Home() {
  const { avatarSrc, displayName, user } = useOutletContext();
  const [activeCategoryId, setActiveCategoryId] = useState(CATEGORY_ALL_ID);
  const [content, setContent] = useState('');
  const [workTitle, setWorkTitle] = useState('');
  const [progress, setProgress] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [spoilerStatus, setSpoilerStatus] = useState(SPOILER_STATUS.IDLE);

  const userCategories = Array.isArray(user?.categories) && user.categories.length > 0
    ? user.categories
    : DEFAULT_CATEGORIES;
  const feedCategoryItems = [CATEGORY_ALL, ...userCategories];
  const filteredPosts = activeCategoryId === CATEGORY_ALL_ID
    ? mockPosts
    : mockPosts.filter((post) => post.categoryId === activeCategoryId);
  const isSubmitDisabled = !categoryId || !workTitle.trim() || !progress.trim() || !content.trim() || spoilerStatus === SPOILER_STATUS.ANALYZING;

  const handleContentChange = (event) => {
    setContent(event.target.value);
    setSpoilerStatus(SPOILER_STATUS.IDLE);
  };

  const handleAnalyzeSpoiler = () => {
    if (!content.trim()) return;

    setSpoilerStatus(SPOILER_STATUS.ANALYZING);

    window.setTimeout(() => {
      const spoilerPattern = new RegExp("죽|사망|범인|결말|반전|스포", 'i');
      setSpoilerStatus(spoilerPattern.test(content) ? SPOILER_STATUS.SPOILER : SPOILER_STATUS.SAFE);
    }, 500);
  };

  const handleSubmit = () => {
    alert(copy.devAlert);
  };

  return (
    <Box component="main" className="main-feed">
      <Box className="main-category-tabs">
        {feedCategoryItems.map((category) => (
          <Button
            className={activeCategoryId === category.categoryId ? 'main-category-tab main-category-tab--active' : 'main-category-tab'}
            key={category.categoryId}
            onClick={() => setActiveCategoryId(category.categoryId)}
          >
            {category.name}
          </Button>
        ))}
      </Box>

      <Box className="main-composer">
        <Avatar className="main-avatar main-avatar--composer" src={avatarSrc}>{displayName.charAt(0)}</Avatar>
        <Box className="main-composer__body">
          <Stack className="main-composer__meta" direction="row" spacing={1.2}>
            <FormControl className="main-compact-input main-compact-input--category">
              <InputLabel id="post-category-label">{copy.category}</InputLabel>
              <Select
                label={copy.category}
                labelId="post-category-label"
                onChange={(event) => setCategoryId(event.target.value)}
                value={categoryId}
              >
                {userCategories.map((category) => (
                  <MenuItem key={category.categoryId} value={category.categoryId}>{category.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField className="main-compact-input" label={copy.workName} onChange={(event) => setWorkTitle(event.target.value)} value={workTitle} />
            <TextField className="main-compact-input main-compact-input--progress" label={copy.progress} onChange={(event) => setProgress(event.target.value)} value={progress} />
          </Stack>
          <TextField
            className="main-compose-input"
            fullWidth
            minRows={3}
            multiline
            onChange={handleContentChange}
            placeholder={copy.placeholder}
            value={content}
          />
          <Box className="main-composer__footer">
            <Stack alignItems="center" direction="row" spacing={0.5}>
              <IconButton aria-label="image" className="main-tool-button"><ImageRoundedIcon /></IconButton>
              <IconButton aria-label="tag" className="main-tool-button"><TagRoundedIcon /></IconButton>
              <Button
                className={spoilerStatus === SPOILER_STATUS.SPOILER ? 'main-ai-button main-ai-button--danger' : 'main-ai-button'}
                disabled={!content.trim() || spoilerStatus === SPOILER_STATUS.ANALYZING}
                onClick={handleAnalyzeSpoiler}
                startIcon={<AutoAwesomeRoundedIcon />}
              >
                {getSpoilerStatusLabel(spoilerStatus)}
              </Button>
            </Stack>
            <Stack alignItems="center" direction="row" spacing={1.4}>
              {spoilerStatus === SPOILER_STATUS.SPOILER && <Chip className="main-spoiler-chip" icon={<VisibilityOffRoundedIcon />} label={copy.spoiler} size="small" />}
              <Button className="main-submit-button" disabled={isSubmitDisabled} onClick={handleSubmit} variant="contained">{copy.submit}</Button>
            </Stack>
          </Box>
        </Box>
      </Box>

      <Stack className="main-post-list">
        {filteredPosts.map((post) => (
          <Box component="article" className="main-post" key={post.postId}>
            <Avatar className="main-avatar">{post.user.nickname.charAt(0)}</Avatar>
            <Box className="main-post__body">
              <Box className="main-post__topline">
                <Box className="main-post__author-line">
                  <Typography className="main-post__name">{post.user.nickname}</Typography>
                  <Typography className="main-post__meta">@{post.user.username}#{post.user.tag} ? {post.createdAt}</Typography>
                </Box>
                <IconButton aria-label="more" className="main-icon-button main-icon-button--small"><MoreHorizRoundedIcon /></IconButton>
              </Box>

              <Box className="main-work-chip-row">
                <Chip className="main-work-chip" label={post.categoryName} size="small" />
                <Chip className="main-work-chip main-work-chip--dark" label={post.workTitle} size="small" />
                <Chip className="main-work-chip" label={post.progress} size="small" />
                {post.isSpoiler && <Chip className="main-spoiler-chip" icon={<VisibilityOffRoundedIcon />} label={copy.spoiler} size="small" />}
              </Box>

              <Typography className={post.isSpoiler ? 'main-post__content main-post__content--spoiler' : 'main-post__content'}>{post.content}</Typography>

              <Stack className="main-tag-row" direction="row" spacing={0.75}>
                {post.tags.map((tag) => <span className="main-tag" key={tag}>#{tag}</span>)}
              </Stack>

              <Box className="main-post__actions">
                <Button className="main-action-button" startIcon={<ChatBubbleOutlineRoundedIcon />}>{post.counts.comments}</Button>
                <Button className="main-action-button" startIcon={<RepeatRoundedIcon />}>{post.counts.reposts}</Button>
                <Button className="main-action-button" startIcon={<FavoriteBorderRoundedIcon />}>{post.counts.likes}</Button>
                <Button className="main-action-button" startIcon={<BookmarkBorderRoundedIcon />}>{copy.save}</Button>
              </Box>
            </Box>
          </Box>
        ))}
      </Stack>
    </Box>
  );
}

export default Home;

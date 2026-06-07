import { useMemo, useRef, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import TagRoundedIcon from '@mui/icons-material/TagRounded';
import { createPost } from '../../api/postApi';
import { MEDIA_ACCEPT, validateMediaFiles } from '../../utils/mediaValidation';
import MediaPreviewList from './MediaPreviewList';
import { DEFAULT_CATEGORIES } from '../../constants/categories';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3010';

function resolveMediaUrl(fileUrl) {
  if (!fileUrl) return '';
  return fileUrl.startsWith('http') ? fileUrl : API_BASE_URL + fileUrl;
}

const copy = {
  title: '로그 작성',
  quoteTitle: '인용하기',
  category: '카테고리',
  workName: '작품명',
  progress: '진도',
  placeholder: '지금 보는 작품의 순간을 남겨보세요.',
  quotePlaceholder: '내용 추가하기',
  submit: '게시하기',
  submitting: '게시 중',
  fileAttach: '파일 첨부',
  tagButton: '태그',
};

function parsePostCreatedAt(createdAt) {
  if (!createdAt) return null;

  const parsedDate = new Date(String(createdAt).replace(' ', 'T'));
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function formatRelativeTime(createdAt) {
  const createdDate = parsePostCreatedAt(createdAt);
  if (!createdDate) return createdAt || '';

  const diffMinutes = Math.floor((Date.now() - createdDate.getTime()) / 60000);
  if (diffMinutes < 1) return '1분 미만';
  if (diffMinutes < 60) return diffMinutes + '분 전';

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return diffHours + '시간 전';

  return String(createdDate.getMonth() + 1) + '/' + String(createdDate.getDate());
}

function formatUsername(username) {
  return String(username || 'user');
}

function QuotePreviewCard({ post }) {
  if (!post) return null;

  return (
    <Box className="main-quote-preview-card">
      <Box className="main-quote-preview-card__author">
        <Avatar className="main-avatar main-avatar--quote" src={resolveMediaUrl(post.user.profileImageUrl || post.user.profileImage)}>{post.user.nickname.charAt(0)}</Avatar>
        <Box className="main-quote-preview-card__author-text">
          <Typography className="main-quote-preview-card__name">{post.user.nickname}</Typography>
          <Typography className="main-post__meta">@{formatUsername(post.user.username)} · {formatRelativeTime(post.createdAt)}</Typography>
        </Box>
      </Box>
      <Stack className="main-quote-preview-card__chips" direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
        <Chip className="main-work-chip" label={post.categoryName} size="small" />
        <Chip className="main-work-chip main-work-chip--dark" label={post.workTitle} size="small" />
        <Chip className="main-work-chip" label={post.progress} size="small" />
      </Stack>
      <Typography className="main-quote-preview-card__content">{post.content}</Typography>
      {post.media?.length > 0 && (
        <Box className="main-quote-preview-card__media">
          {post.media.map((media) => (
            media.mediaType === 'VIDEO'
              ? <video controls key={media.mediaId} src={resolveMediaUrl(media.fileUrl)} />
              : <img alt="quoted post media" key={media.mediaId} src={resolveMediaUrl(media.fileUrl)} />
          ))}
        </Box>
      )}
    </Box>
  );
}

function PostComposerDialog({ avatarSrc, displayName, isDarkMode, onClose, onPostCreated, open, quotePost, user }) {
  const userCategories = useMemo(() => (
    Array.isArray(user?.categories) && user.categories.length > 0
      ? user.categories
      : DEFAULT_CATEGORIES
  ), [user]);
  const [categoryId, setCategoryId] = useState('');
  const [workTitle, setWorkTitle] = useState('');
  const [progress, setProgress] = useState('');
  const [content, setContent] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedMediaFiles, setSelectedMediaFiles] = useState([]);
  const isQuoteMode = Boolean(quotePost);
  const mediaInputRef = useRef(null);

  const isSubmitDisabled = (isQuoteMode
    ? !content.trim() && selectedMediaFiles.length === 0
    : !categoryId || !workTitle.trim() || !progress.trim())
    || submitLoading;

  const resetForm = () => {
    setCategoryId('');
    setWorkTitle('');
    setProgress('');
    setContent('');
    setError('');
    setSelectedMediaFiles([]);
    if (mediaInputRef.current) mediaInputRef.current.value = '';
  };

  const handleClose = () => {
    if (submitLoading) return;
    onClose();
  };

  const handleContentChange = (event) => {
    setContent(event.target.value);
  };

  const handleMediaButtonClick = () => {
    mediaInputRef.current?.click();
  };

  const handleMediaChange = (event) => {
    const validation = validateMediaFiles(event.target.files);

    if (validation.error) {
      setError(validation.error);
      event.target.value = '';
      return;
    }

    setSelectedMediaFiles(validation.files);
    setError('');
  };

  const handleRemoveMediaFile = (fileName) => {
    setSelectedMediaFiles((prevFiles) => prevFiles.filter((file) => file.name !== fileName));
    if (mediaInputRef.current) mediaInputRef.current.value = '';
  };

  const handleSubmit = async () => {
    if (isSubmitDisabled) return;

    setSubmitLoading(true);
    setError('');

    try {
      const data = await createPost({
        categoryId: isQuoteMode ? quotePost.categoryId : categoryId,
        workTitle: isQuoteMode ? quotePost.workTitle : workTitle.trim(),
        progress: isQuoteMode ? quotePost.progress : progress.trim(),
        content: content.trim(),
        mediaFiles: selectedMediaFiles,
        quotePostId: quotePost?.postId,
      });

      if (data.post) onPostCreated?.(data.post);
      resetForm();
      onClose();
    } catch (requestError) {
      setError(requestError.message || '게시글 등록 중 오류가 발생했습니다.');
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <Dialog
      className={isDarkMode ? 'main-post-dialog main-post-dialog--dark' : 'main-post-dialog'}
      fullWidth
      maxWidth="sm"
      onClose={handleClose}
      open={open}
    >
      <DialogTitle className="main-post-dialog__title-row">
        <Typography component="span" className="main-post-dialog__title">{isQuoteMode ? copy.quoteTitle : copy.title}</Typography>
        <IconButton aria-label="close" className="main-post-dialog__close" disabled={submitLoading} onClick={handleClose}>
          <CloseRoundedIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent className="main-post-dialog__content">
        <Box className="main-composer main-composer--dialog">
          <Avatar className="main-avatar main-avatar--composer" src={avatarSrc}>{displayName.charAt(0)}</Avatar>
          <Box className="main-composer__body">
            {!isQuoteMode && (
              <Stack className="main-composer__meta" direction="row" spacing={1.2}>
                <FormControl className="main-compact-input main-compact-input--category">
                  <InputLabel id="dialog-post-category-label">{copy.category}</InputLabel>
                  <Select
                    label={copy.category}
                    labelId="dialog-post-category-label"
                    MenuProps={{
                      PaperProps: {
                        className: isDarkMode ? 'main-select-menu main-select-menu--dark' : 'main-select-menu',
                      },
                    }}
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
            )}
            <TextField
              className="main-compose-input"
              fullWidth
              minRows={4}
              multiline
              onChange={handleContentChange}
              placeholder={isQuoteMode ? copy.quotePlaceholder : copy.placeholder}
              value={content}
            />
            {isQuoteMode && <QuotePreviewCard post={quotePost} />}
            <Box className="main-composer__footer">
              <Stack alignItems="center" direction="row" spacing={0.5}>
                <Button className="main-tool-text-button" disabled={submitLoading} onClick={handleMediaButtonClick} startIcon={<ImageRoundedIcon />}>
                  {copy.fileAttach}
                </Button>
                <input
                  accept={MEDIA_ACCEPT}
                  className="main-hidden-file-input"
                  multiple
                  onChange={handleMediaChange}
                  ref={mediaInputRef}
                  type="file"
                />
                <Button className="main-tool-text-button" startIcon={<TagRoundedIcon />}>
                  {copy.tagButton}
                </Button>
              </Stack>
              <Stack alignItems="center" className="main-composer__post-actions" direction="row" spacing={1.4}>
                <Button className="main-submit-button main-submit-button--post" disabled={isSubmitDisabled} onClick={handleSubmit} size="large" variant="contained">
                  {submitLoading ? copy.submitting : copy.submit}
                </Button>
              </Stack>
            </Box>
          <MediaPreviewList files={selectedMediaFiles} onRemove={handleRemoveMediaFile} />
          {error && <Alert severity="error" className="main-form-alert">{error}</Alert>}
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
}

export default PostComposerDialog;

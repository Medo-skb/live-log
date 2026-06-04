import { useEffect, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import {
  Alert,
  Avatar,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import PostFeedItem from '../post/PostFeedItem';
import { getLikedPosts, getPosts } from '../../api/postApi';
import { getUserProfile, toggleUserFollow, updateUserProfile } from '../../api/userApi';

const PAGE_SIZE = 20;
const NICKNAME_MIN = 2;
const NICKNAME_MAX = 20;

function getPostDetailPath(post) {
  return '/' + encodeURIComponent(String(post?.user?.username || 'user')) + '/status/' + post?.postId;
}

function getInitial(profile) {
  return String(profile?.nickname || profile?.username || 'L').charAt(0).toUpperCase();
}

function validateNickname(value) {
  const nickname = String(value || '').trim();
  if (!nickname) return '닉네임을 입력해주세요.';
  if (nickname.length < NICKNAME_MIN || nickname.length > NICKNAME_MAX) return '닉네임은 2~20자로 입력해주세요.';
  return '';
}

function Profile() {
  const { username } = useParams();
  const navigate = useNavigate();
  const { isDarkMode, user } = useOutletContext();
  const [profile, setProfile] = useState(null);
  const [activeTab, setActiveTab] = useState('posts');
  const [posts, setPosts] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editNickname, setEditNickname] = useState('');
  const [editError, setEditError] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let ignore = false;

    setLoading(true);
    setError('');
    setProfile(null);
    setPosts([]);
    setNextCursor(null);
    setHasMore(false);

    const postRequest = activeTab === 'likes'
      ? getLikedPosts({ username, limit: PAGE_SIZE })
      : getPosts({ username, limit: PAGE_SIZE });

    Promise.all([
      getUserProfile({ username }),
      postRequest,
    ])
      .then(([profileData, postData]) => {
        if (ignore) return;
        setProfile(profileData.profile || null);
        setPosts(Array.isArray(postData.posts) ? postData.posts : []);
        setNextCursor(postData.nextCursor || null);
        setHasMore(Boolean(postData.hasMore));
      })
      .catch((requestError) => {
        if (!ignore) setError(requestError.message || '프로필을 불러오지 못했습니다.');
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [activeTab, username]);

  const handleFollowToggle = async () => {
    if (!profile || profile.isMe || followLoading) return;

    setFollowLoading(true);
    setError('');

    try {
      const data = await toggleUserFollow({ username: profile.username });
      setProfile(data.profile || profile);
    } catch (requestError) {
      setError(requestError.message || '팔로우 처리 중 오류가 발생했습니다.');
    } finally {
      setFollowLoading(false);
    }
  };

  const handleLoadMore = async () => {
    if (!nextCursor || loadingMore) return;

    setLoadingMore(true);
    setError('');

    try {
      const data = activeTab === 'likes'
        ? await getLikedPosts({ username, cursor: nextCursor, limit: PAGE_SIZE })
        : await getPosts({ username, cursor: nextCursor, limit: PAGE_SIZE });
      const nextPosts = Array.isArray(data.posts) ? data.posts : [];
      const existingIds = new Set(posts.map((post) => post.postId));

      setPosts((prevPosts) => [...prevPosts, ...nextPosts.filter((post) => !existingIds.has(post.postId))]);
      setNextCursor(data.nextCursor || null);
      setHasMore(Boolean(data.hasMore));
    } catch (requestError) {
      setError(requestError.message || '게시글을 더 불러오지 못했습니다.');
    } finally {
      setLoadingMore(false);
    }
  };

  const handleOpenPost = (post) => {
    navigate(getPostDetailPath(post));
  };

  const handleDeletedPost = (postId) => {
    setPosts((prevPosts) => prevPosts.filter((post) => post.postId !== postId));
    setProfile((prevProfile) => {
      if (!prevProfile || activeTab !== 'posts') return prevProfile;
      return {
        ...prevProfile,
        counts: {
          ...prevProfile.counts,
          posts: Math.max(0, Number(prevProfile.counts.posts || 0) - 1),
        },
      };
    });
  };

  const handleTabChange = (nextTab) => {
    if (nextTab === activeTab) return;
    setActiveTab(nextTab);
  };

  const handleOpenConnections = (type) => {
    navigate('/' + encodeURIComponent(username) + '/' + type);
  };

  const handleOpenEdit = () => {
    if (!profile) return;
    setEditNickname(profile.nickname || '');
    setEditError('');
    setEditOpen(true);
  };

  const handleCloseEdit = () => {
    if (editLoading) return;
    setEditOpen(false);
    setEditError('');
  };

  const handleSubmitEdit = async () => {
    const nextError = validateNickname(editNickname);
    if (nextError) {
      setEditError(nextError);
      return;
    }

    setEditLoading(true);
    setEditError('');
    setError('');

    try {
      const data = await updateUserProfile({ username: profile.username, nickname: editNickname.trim() });
      setProfile(data.profile || profile);
      setEditOpen(false);
    } catch (requestError) {
      setEditError(requestError.message || '프로필을 수정하지 못했습니다.');
    } finally {
      setEditLoading(false);
    }
  };

  return (
    <Box component="main" className="main-feed profile-page">
      <Box className="profile-header-sticky">
        <Box className="profile-header-sticky__text">
          <Typography className="profile-header-sticky__title">{profile?.nickname || '프로필'}</Typography>
          {profile && <Typography className="profile-header-sticky__meta">{profile.counts.posts} 게시글</Typography>}
        </Box>
      </Box>

      {error && <Alert className="main-form-alert" severity="error">{error}</Alert>}

      {loading ? (
        <Box className="main-feed-state"><CircularProgress size={28} /></Box>
      ) : !profile ? (
        <Box className="main-feed-state"><Typography>프로필을 찾을 수 없습니다.</Typography></Box>
      ) : (
        <>
          <Box className="profile-hero">
            <Box className="profile-hero__banner" />
            <Box className="profile-hero__body">
              <Avatar className="profile-hero__avatar">{getInitial(profile)}</Avatar>
              <Box className="profile-hero__actions">
                {profile.isMe ? (
                  <Button className="profile-outline-button" onClick={handleOpenEdit}>프로필 수정</Button>
                ) : (
                  <Button
                    className={profile.followedByMe ? 'profile-outline-button' : 'profile-follow-button'}
                    disabled={followLoading}
                    onClick={handleFollowToggle}
                    variant={profile.followedByMe ? 'outlined' : 'contained'}
                  >
                    {profile.followedByMe ? '팔로잉' : '팔로우'}
                  </Button>
                )}
              </Box>

              <Typography className="profile-hero__name">{profile.nickname}</Typography>
              <Typography className="profile-hero__username">@{profile.username}</Typography>
              <Box className="profile-hero__joined"><CalendarMonthRoundedIcon /> <span>{profile.createdAt} 가입</span></Box>

              <Stack className="profile-hero__stats" direction="row" spacing={2.2}>
                <Button className="profile-stat-button" onClick={() => handleOpenConnections('following')}><strong>{profile.counts.following}</strong> 팔로잉</Button>
                <Button className="profile-stat-button" onClick={() => handleOpenConnections('followers')}><strong>{profile.counts.followers}</strong> 팔로워</Button>
              </Stack>
            </Box>
          </Box>

          <Box className="profile-tab-row">
            <Button className={activeTab === 'posts' ? 'profile-tab profile-tab--active' : 'profile-tab'} onClick={() => handleTabChange('posts')}>게시글</Button>
            <Button className={activeTab === 'likes' ? 'profile-tab profile-tab--active' : 'profile-tab'} onClick={() => handleTabChange('likes')}>좋아요</Button>
          </Box>

          {posts.length === 0 ? (
            <Box className="main-feed-state"><Typography>{activeTab === 'likes' ? '아직 좋아요한 게시글이 없습니다.' : '아직 작성한 게시글이 없습니다.'}</Typography></Box>
          ) : (
            <Stack className="profile-post-list">
              {posts.map((post) => (
                <PostFeedItem key={post.postId} isDarkMode={isDarkMode} onDeleted={handleDeletedPost} post={post} onOpen={handleOpenPost} viewer={user} />
              ))}

              {hasMore && (
                <Box className="post-detail-more-row">
                  <Button className="main-menu-screen__button" disabled={loadingMore} onClick={handleLoadMore} variant="contained">
                    {loadingMore ? '불러오는 중' : '더 보기'}
                  </Button>
                </Box>
              )}
            </Stack>
          )}

          <Dialog className="profile-edit-dialog" fullWidth maxWidth="xs" onClose={handleCloseEdit} open={editOpen}>
            <DialogTitle className="profile-edit-dialog__title">프로필 수정</DialogTitle>
            <DialogContent className="profile-edit-dialog__content">
              {editError && <Alert severity="error">{editError}</Alert>}
              <TextField
                autoFocus
                className="profile-edit-input"
                fullWidth
                helperText={editError ? '' : '서비스에서 표시될 이름입니다. 2~20자로 입력해주세요.'}
                label="닉네임"
                onChange={(event) => {
                  const value = event.target.value.slice(0, NICKNAME_MAX);
                  setEditNickname(value);
                  if (editError) setEditError(validateNickname(value));
                }}
                value={editNickname}
              />
            </DialogContent>
            <DialogActions className="profile-edit-dialog__actions">
              <Button className="profile-edit-cancel" disabled={editLoading} onClick={handleCloseEdit}>취소</Button>
              <Button className="profile-edit-save" disabled={editLoading} onClick={handleSubmitEdit} variant="contained">
                {editLoading ? '저장 중' : '저장'}
              </Button>
            </DialogActions>
          </Dialog>
        </>
      )}
    </Box>
  );
}

export default Profile;

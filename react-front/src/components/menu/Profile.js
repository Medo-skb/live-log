import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import {
  Alert,
  Avatar,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import MailOutlineRoundedIcon from '@mui/icons-material/MailOutlineRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import PhotoCameraRoundedIcon from '@mui/icons-material/PhotoCameraRounded';
import PostFeedItem from '../post/PostFeedItem';
import { getLikedPosts, getPosts } from '../../api/postApi';
import { getUserProfile, toggleUserFollow, updateUserProfile } from '../../api/userApi';
import { updateAuthUser } from '../../utils/authStorage';

const PAGE_SIZE = 20;
const NICKNAME_MIN = 2;
const NICKNAME_MAX = 20;
const BIO_MAX = 500;
const IMAGE_LIMIT = 5 * 1024 * 1024;
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3010';

function resolveMediaUrl(fileUrl) {
  if (!fileUrl) return '';
  return String(fileUrl).startsWith('http') ? fileUrl : API_BASE_URL + fileUrl;
}

function getPostDetailPath(post) {
  return '/' + encodeURIComponent(String(post?.user?.username || 'user')) + '/status/' + post?.postId;
}

function getTimelineKey(post) {
  return post?.timelineId || 'post-' + post?.postId;
}

function getInitial(profile) {
  return String(profile?.nickname || profile?.username || 'L').charAt(0).toUpperCase();
}

function validateNickname(value) {
  const nickname = String(value || '').trim();
  if (!nickname) return '닉네임을 입력해주세요.';
  if (nickname.length < NICKNAME_MIN || nickname.length > NICKNAME_MAX) return '닉네임은 2~20자 사이여야 합니다.';
  return '';
}

function validateImage(file) {
  if (!file) return '';
  if (!String(file.type || '').startsWith('image/')) return '이미지 파일만 업로드할 수 있습니다.';
  if (file.size > IMAGE_LIMIT) return '이미지 파일은 5MB 이하만 가능합니다.';
  return '';
}

function Profile() {
  const { username } = useParams();
  const navigate = useNavigate();
  const { isDarkMode, setUser, user } = useOutletContext();
  const [profile, setProfile] = useState(null);
  const [activeTab, setActiveTab] = useState('posts');
  const [posts, setPosts] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [followHover, setFollowHover] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editNickname, setEditNickname] = useState('');
  const [editBio, setEditBio] = useState('');
  const [profileImageFile, setProfileImageFile] = useState(null);
  const [bannerImageFile, setBannerImageFile] = useState(null);
  const [profilePreviewUrl, setProfilePreviewUrl] = useState('');
  const [bannerPreviewUrl, setBannerPreviewUrl] = useState('');
  const [editError, setEditError] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [error, setError] = useState('');

  const profileImageUrl = useMemo(() => resolveMediaUrl(profile?.profileImageUrl), [profile?.profileImageUrl]);
  const bannerImageUrl = useMemo(() => resolveMediaUrl(profile?.bannerImageUrl), [profile?.bannerImageUrl]);
  const profilePreview = profilePreviewUrl || profileImageUrl;
  const bannerPreview = bannerPreviewUrl || bannerImageUrl;

  useEffect(() => () => {
    if (profilePreviewUrl) URL.revokeObjectURL(profilePreviewUrl);
    if (bannerPreviewUrl) URL.revokeObjectURL(bannerPreviewUrl);
  }, [bannerPreviewUrl, profilePreviewUrl]);

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
        if (!ignore) setError(requestError.message || '프로필 정보를 불러오지 못했습니다.');
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
      const existingIds = new Set(posts.map(getTimelineKey));

      setPosts((prevPosts) => [...prevPosts, ...nextPosts.filter((post) => !existingIds.has(getTimelineKey(post)))]);
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

  const handleOpenDirectMessage = () => {
    if (!profile?.username || profile.isMe) return;
    navigate('/chat?to=' + encodeURIComponent(profile.username));
  };

  const handleOpenConnections = (type) => {
    navigate('/' + encodeURIComponent(username) + '/' + type);
  };

  const resetPreview = () => {
    if (profilePreviewUrl) URL.revokeObjectURL(profilePreviewUrl);
    if (bannerPreviewUrl) URL.revokeObjectURL(bannerPreviewUrl);
    setProfilePreviewUrl('');
    setBannerPreviewUrl('');
    setProfileImageFile(null);
    setBannerImageFile(null);
  };

  const handleOpenEdit = () => {
    if (!profile) return;
    resetPreview();
    setEditNickname(profile.nickname || '');
    setEditBio(profile.bio || '');
    setEditError('');
    setEditOpen(true);
  };

  const handleCloseEdit = () => {
    if (editLoading) return;
    resetPreview();
    setEditOpen(false);
    setEditError('');
  };

  const handleImageChange = (event, type) => {
    const file = event.target.files?.[0] || null;
    event.target.value = '';
    const imageError = validateImage(file);
    if (imageError) {
      setEditError(imageError);
      return;
    }

    setEditError('');

    if (type === 'profile') {
      if (profilePreviewUrl) URL.revokeObjectURL(profilePreviewUrl);
      setProfileImageFile(file);
      setProfilePreviewUrl(file ? URL.createObjectURL(file) : '');
      return;
    }

    if (bannerPreviewUrl) URL.revokeObjectURL(bannerPreviewUrl);
    setBannerImageFile(file);
    setBannerPreviewUrl(file ? URL.createObjectURL(file) : '');
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
      const data = await updateUserProfile({
        username: profile.username,
        nickname: editNickname.trim(),
        bio: editBio.trim(),
        profileImage: profileImageFile,
        bannerImage: bannerImageFile,
      });
      const nextProfile = data.profile || profile;
      setProfile(nextProfile);
      setUser?.((prevUser) => {
        if (!prevUser || String(prevUser.username) !== String(nextProfile.username)) return prevUser;
        const nextUser = {
          ...prevUser,
          nickname: nextProfile.nickname,
          profileImage: nextProfile.profileImageUrl,
          profileImageUrl: nextProfile.profileImageUrl,
          bannerImage: nextProfile.bannerImageUrl,
          bannerImageUrl: nextProfile.bannerImageUrl,
        };
        updateAuthUser(nextUser);
        return nextUser;
      });
      resetPreview();
      setEditOpen(false);
    } catch (requestError) {
      setEditError(requestError.message || '프로필 수정 중 오류가 발생했습니다.');
    } finally {
      setEditLoading(false);
    }
  };

  return (
    <Box component="main" className="main-feed profile-page">
      <Box className="profile-header-sticky">
        <Box className="profile-header-sticky__text">
          <Typography className="profile-header-sticky__title">{profile?.nickname || '사용자'}</Typography>
          {profile && <Typography className="profile-header-sticky__meta">{profile.counts.posts} 게시물</Typography>}
        </Box>
      </Box>

      {error && <Alert className="main-form-alert" severity="error">{error}</Alert>}

      {loading ? (
        <Box className="main-feed-state"><CircularProgress size={28} /></Box>
      ) : !profile ? (
        <Box className="main-feed-state"><Typography>사용자를 찾을 수 없습니다.</Typography></Box>
      ) : (
        <>
          <Box className="profile-hero">
            <Box className={bannerImageUrl ? 'profile-hero__banner profile-hero__banner--image' : 'profile-hero__banner'} style={bannerImageUrl ? { backgroundImage: 'url(' + bannerImageUrl + ')' } : undefined} />
            <Box className="profile-hero__body">
              <Avatar className="profile-hero__avatar" src={profileImageUrl}>{getInitial(profile)}</Avatar>
              <Box className="profile-hero__actions">
                {profile.isMe ? (
                  <Button className="profile-outline-button" onClick={handleOpenEdit}>프로필 수정</Button>                ) : (
                  <>
                    <IconButton className="profile-message-button" onClick={handleOpenDirectMessage} aria-label="쪽지 보내기">
                      <MailOutlineRoundedIcon />
                    </IconButton>
                    <Button
                      className={profile.followedByMe ? 'profile-outline-button profile-outline-button--following' : 'profile-follow-button'}
                      disabled={followLoading}
                      onClick={handleFollowToggle}
                      onMouseEnter={() => setFollowHover(true)}
                      onMouseLeave={() => setFollowHover(false)}
                      variant={profile.followedByMe ? 'outlined' : 'contained'}
                    >
                      {profile.followedByMe ? (followHover ? '팔로잉 해제' : '팔로잉') : '팔로우'}
                    </Button>
                  </>
                )}
              </Box>

              <Typography className="profile-hero__name">{profile.nickname}</Typography>
              <Typography className="profile-hero__username">@{profile.username}</Typography>
              {profile.bio && <Typography className="profile-hero__bio">{profile.bio}</Typography>}
              <Box className="profile-hero__joined"><CalendarMonthRoundedIcon /> <span>{profile.createdAt} 가입</span></Box>

              <Stack className="profile-hero__stats" direction="row" spacing={2.2}>
                <Button className="profile-stat-button" onClick={() => handleOpenConnections('following')}><strong>{profile.counts.following}</strong> 팔로잉</Button>
                <Button className="profile-stat-button" onClick={() => handleOpenConnections('followers')}><strong>{profile.counts.followers}</strong> 팔로워</Button>
              </Stack>
            </Box>
          </Box>

          <Box className="profile-tab-row">
            <Button className={activeTab === 'posts' ? 'profile-tab profile-tab--active' : 'profile-tab'} onClick={() => handleTabChange('posts')}>게시물</Button>
            <Button className={activeTab === 'likes' ? 'profile-tab profile-tab--active' : 'profile-tab'} onClick={() => handleTabChange('likes')}>좋아요</Button>
          </Box>

          {posts.length === 0 ? (
            <Box className="main-feed-state"><Typography>{activeTab === 'likes' ? '좋아요한 게시글이 없습니다.' : '작성한 게시글이 없습니다.'}</Typography></Box>
          ) : (
            <Stack className="profile-post-list">
              {posts.map((post) => (
                <PostFeedItem key={getTimelineKey(post)} isDarkMode={isDarkMode} onDeleted={handleDeletedPost} post={post} onOpen={handleOpenPost} viewer={user} />
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

          <Dialog className={isDarkMode ? 'profile-edit-dialog profile-edit-dialog--dark' : 'profile-edit-dialog'} fullWidth maxWidth="sm" onClose={handleCloseEdit} open={editOpen}>
            <Box className="profile-edit-dialog__header">
              <IconButton className="profile-edit-dialog__close" disabled={editLoading} onClick={handleCloseEdit}><CloseRoundedIcon /></IconButton>
              <Typography className="profile-edit-dialog__title">프로필 수정</Typography>
              <Button className="profile-edit-save" disabled={editLoading} onClick={handleSubmitEdit} variant="contained">
                {editLoading ? '저장 중' : '저장'}
              </Button>
            </Box>
            <DialogContent className="profile-edit-dialog__content">
              {editError && <Alert severity="error">{editError}</Alert>}

              <Box className="profile-edit-media">
                <Box className={bannerPreview ? 'profile-edit-media__banner profile-edit-media__banner--image' : 'profile-edit-media__banner'} style={bannerPreview ? { backgroundImage: 'url(' + bannerPreview + ')' } : undefined}>
                  <IconButton className="profile-edit-media__button" component="label">
                    <PhotoCameraRoundedIcon />
                    <input accept="image/*" hidden onChange={(event) => handleImageChange(event, 'banner')} type="file" />
                  </IconButton>
                </Box>
                <Box className="profile-edit-media__avatar-wrap">
                  <Avatar className="profile-edit-media__avatar" src={profilePreview}>{getInitial(profile)}</Avatar>
                  <IconButton className="profile-edit-media__avatar-button" component="label">
                    <PhotoCameraRoundedIcon />
                    <input accept="image/*" hidden onChange={(event) => handleImageChange(event, 'profile')} type="file" />
                  </IconButton>
                </Box>
              </Box>

              <TextField
                autoFocus
                className="profile-edit-input"
                fullWidth
                helperText="공개될 이름을 입력하세요. 2~20자 이내."
                label="닉네임"
                onChange={(event) => {
                  const value = event.target.value.slice(0, NICKNAME_MAX);
                  setEditNickname(value);
                  if (editError) setEditError(validateNickname(value));
                }}
                value={editNickname}
              />
              <TextField
                className="profile-edit-input"
                fullWidth
                helperText={editBio.length + '/' + BIO_MAX}
                label="자기소개"
                maxRows={5}
                minRows={3}
                multiline
                onChange={(event) => setEditBio(event.target.value.slice(0, BIO_MAX))}
                value={editBio}
              />
            </DialogContent>
          </Dialog>
        </>
      )}
    </Box>
  );
}

export default Profile;

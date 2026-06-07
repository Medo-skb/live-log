import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Avatar, Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import PersonAddAltRoundedIcon from '@mui/icons-material/PersonAddAltRounded';
import RepeatRoundedIcon from '@mui/icons-material/RepeatRounded';
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import NotificationsNoneRoundedIcon from '@mui/icons-material/NotificationsNoneRounded';
import FormatQuoteRoundedIcon from '@mui/icons-material/FormatQuoteRounded';
import { getNotices, markAllNoticesRead, markNoticeRead } from '../../api/noticeApi';

const PAGE_SIZE = 20;

const copy = {
  title: '알림',
  markAllRead: '모두 읽음',
  loadError: '알림을 불러오지 못했습니다.',
  empty: '알림이 없습니다.',
  loadMore: '더 보기',
  loadingMore: '불러오는 중',
  unread: '안 읽음',
  read: '읽음',
};

function getInitial(notice) {
  return String(notice?.sender?.nickname || notice?.sender?.username || 'L').charAt(0).toUpperCase();
}

function parseNoticeCreatedAt(createdAt) {
  if (!createdAt) return null;
  const parsedDate = new Date(String(createdAt).replace(' ', 'T'));
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function formatRelativeTime(createdAt) {
  const createdDate = parseNoticeCreatedAt(createdAt);
  if (!createdDate) return createdAt || '';
  const diffMinutes = Math.floor((Date.now() - createdDate.getTime()) / 60000);
  if (diffMinutes < 1) return '1분 미만';
  if (diffMinutes < 60) return diffMinutes + '분 전';
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return diffHours + '시간 전';
  return String(createdDate.getMonth() + 1) + '/' + String(createdDate.getDate());
}

function getNoticeMessage(notice) {
  const senderName = notice.sender?.nickname || notice.sender?.username || '알 수 없음';
  if (notice.type === 'FOLLOW') return senderName + '님이 나를 팔로우합니다.';
  if (notice.type === 'LIKE') return senderName + '님이 내 게시글을 좋아합니다.';
  if (notice.type === 'REPOST') return senderName + '님이 내 게시글을 리포스트했습니다.';
  if (notice.type === 'COMMENT') return senderName + '님이 내 게시글에 댓글을 남겼습니다.';
  if (notice.type === 'QUOTE') return senderName + '님이 내 게시글을 인용했습니다.';
  return senderName + '님에게 새 알림이 있습니다.';
}

function getNoticeIcon(type) {
  if (type === 'FOLLOW') return <PersonAddAltRoundedIcon />;
  if (type === 'LIKE') return <FavoriteRoundedIcon />;
  if (type === 'REPOST') return <RepeatRoundedIcon />;
  if (type === 'COMMENT') return <ChatBubbleOutlineRoundedIcon />;
  if (type === 'QUOTE') return <FormatQuoteRoundedIcon />;
  return <NotificationsNoneRoundedIcon />;
}

function mergeNoticeList(currentNotices, incomingNotices) {
  const noticeMap = new Map();
  [...currentNotices, ...incomingNotices].forEach((notice) => {
    if (notice?.noticeId) noticeMap.set(notice.noticeId, notice);
  });

  return Array.from(noticeMap.values()).sort((a, b) => Number(b.noticeId) - Number(a.noticeId));
}

function Alerts() {
  const navigate = useNavigate();
  const [notices, setNotices] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let ignore = false;

    setLoading(true);
    setError('');

    getNotices({ limit: PAGE_SIZE })
      .then((data) => {
        if (ignore) return;
        setNotices(Array.isArray(data.notices) ? data.notices : []);
        setUnreadCount(Number(data.unreadCount) || 0);
        setNextCursor(data.nextCursor || null);
        setHasMore(Boolean(data.hasMore));
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
  }, []);

  useEffect(() => {
    const handleRealtimeNotice = (event) => {
      const payload = event.detail || {};
      const notice = payload.notice;
      if (!notice?.noticeId) return;

      setNotices((prevNotices) => mergeNoticeList([notice], prevNotices));

      const nextUnreadCount = Number(payload.unreadCount);
      setUnreadCount((prevCount) => (
        Number.isFinite(nextUnreadCount) ? nextUnreadCount : prevCount + 1
      ));
    };

    window.addEventListener('liveLogNoticeCreated', handleRealtimeNotice);

    return () => {
      window.removeEventListener('liveLogNoticeCreated', handleRealtimeNotice);
    };
  }, []);

  const handleOpenNotice = async (notice) => {
    if (!notice.isRead) {
      setNotices((prevNotices) => prevNotices.map((item) => (
        item.noticeId === notice.noticeId ? { ...item, isRead: true } : item
      )));
      setUnreadCount((prevCount) => {
        const nextCount = Math.max(0, prevCount - 1);
        window.dispatchEvent(new CustomEvent('liveLogNoticeUnreadChanged', { detail: { unreadCount: nextCount } }));
        return nextCount;
      });
      markNoticeRead({ noticeId: notice.noticeId }).catch(() => {});
    }

    if (notice.targetType === 'POST' && notice.targetId) {
      const targetUsername = notice.targetPost?.username || notice.sender?.username;
      if (targetUsername) navigate('/' + encodeURIComponent(targetUsername) + '/status/' + notice.targetId);
      return;
    }

    if (notice.targetType === 'USER' && notice.sender?.username) {
      navigate('/' + encodeURIComponent(notice.sender.username));
    }
  };

  const handleMarkAllRead = async () => {
    if (unreadCount === 0) return;
    setNotices((prevNotices) => prevNotices.map((notice) => ({ ...notice, isRead: true })));
    setUnreadCount(0);
    window.dispatchEvent(new CustomEvent('liveLogNoticeUnreadChanged', { detail: { unreadCount: 0 } }));
    try {
      await markAllNoticesRead();
    } catch (requestError) {
      setError(requestError.message || '모두 읽음 처리 중 오류가 발생했습니다.');
    }
  };

  const handleLoadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setError('');
    try {
      const data = await getNotices({ cursor: nextCursor, limit: PAGE_SIZE });
      const nextNotices = Array.isArray(data.notices) ? data.notices : [];
      setNotices((prevNotices) => mergeNoticeList(prevNotices, nextNotices));
      setUnreadCount(Number(data.unreadCount) || 0);
      setNextCursor(data.nextCursor || null);
      setHasMore(Boolean(data.hasMore));
    } catch (requestError) {
      setError(requestError.message || copy.loadError);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <Box component="main" className="main-feed alerts-page">
      <Box className="menu-page-header menu-page-header--row">
        <Box>
          <Typography className="menu-page-header__title">{copy.title}</Typography>
          <Typography className="menu-page-header__description">{copy.unread} {unreadCount}</Typography>
        </Box>
        <Button className="main-menu-screen__button" disabled={unreadCount === 0} onClick={handleMarkAllRead} variant="contained">
          {copy.markAllRead}
        </Button>
      </Box>

      {error && <Alert className="main-form-alert" severity="error">{error}</Alert>}

      {loading ? (
        <Box className="main-feed-state"><CircularProgress size={28} /></Box>
      ) : notices.length === 0 ? (
        <Box className="main-feed-state"><Typography>{copy.empty}</Typography></Box>
      ) : (
        <Stack className="notice-list">
          {notices.map((notice) => (
            <Box
              className={notice.isRead ? 'notice-card main-post--clickable' : 'notice-card notice-card--unread main-post--clickable'}
              key={notice.noticeId}
              onClick={() => handleOpenNotice(notice)}
              onKeyDown={(event) => { if (event.key === 'Enter') handleOpenNotice(notice); }}
              role="button"
              tabIndex={0}
            >
              <Box className="notice-card__icon">{getNoticeIcon(notice.type)}</Box>
              <Avatar className="main-avatar notice-card__avatar">{getInitial(notice)}</Avatar>
              <Box className="notice-card__body">
                <Typography className="notice-card__message">{getNoticeMessage(notice)}</Typography>
                <Typography className="notice-card__meta">{formatRelativeTime(notice.createdAt)} · {notice.isRead ? copy.read : copy.unread}</Typography>
              </Box>
            </Box>
          ))}
        </Stack>
      )}

      {hasMore && (
        <Box className="post-detail-more-row">
          <Button className="main-menu-screen__button" disabled={loadingMore} onClick={handleLoadMore} variant="contained">
            {loadingMore ? copy.loadingMore : copy.loadMore}
          </Button>
        </Box>
      )}
    </Box>
  );
}

export default Alerts;

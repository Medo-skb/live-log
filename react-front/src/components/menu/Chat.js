import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Avatar,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  Divider,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';
import MailOutlineRoundedIcon from '@mui/icons-material/MailOutlineRounded';
import NotificationsNoneRoundedIcon from '@mui/icons-material/NotificationsNoneRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import { deleteDmMessage, getDmConversations, getDmMessages, markDmConversationRead, sendDmMessage } from '../../api/dmApi';
import { getRecommendedUsers, searchUsers } from '../../api/userApi';
import { connectSocket } from '../../socket/socketClient';
import { useAppModal } from '../common/ModalProvider';

const PAGE_SIZE = 30;
const MAX_MESSAGE_LENGTH = 2000;
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3010';

const copy = {
  title: '채팅',
  filterAll: '전체',
  filterUnread: '읽지 않음',
  messageRequests: '쪽지 보관함',
  requestEmptyTitle: '쪽지 요청이 없습니다',
  requestEmptyBody: '팔로우 관계가 아닌 사용자에게 받은 쪽지가 여기에 표시됩니다.',
  searchPlaceholder: '검색',
  newMessageTitle: '새 채팅',
  newChatPlaceholder: '이름이나 사용자 아이디로 검색하기',
  recommendedUsers: '추천 사용자',
  searchResults: '검색 결과',
  recommendedEmpty: '추천할 사용자가 없습니다.',
  emptyInboxTitle: '빈 보관함',
  emptyInboxBody: '메시지 보내기',
  emptyPanelTitle: '대화 시작하기',
  emptyPanelBody: '기존 대화에서 선택하거나 새로운 대화를 만드세요.',
  newChat: '새 채팅',
  messagePlaceholder: '새 메시지를 입력하세요.',
  send: '전송',
  loadMore: '이전 메시지 보기',
  searchEmpty: '검색 결과가 없습니다.',
  loadError: '대화 목록을 불러오지 못했습니다.',
  messageLoadError: '메시지를 불러오지 못했습니다.',
  sendError: '메시지 전송 중 오류가 발생했습니다.',
  deleteMessage: '메시지 삭제',
  blockUser: '사용자 차단',
  deleteConfirmTitle: '메시지를 삭제할까요?',
  deleteConfirmBody: '삭제한 메시지는 대화에서 사라집니다.',
  blockConfirmTitle: '사용자를 차단할까요?',
  blockConfirmBody: '차단하면 서로 메시지를 보낼 수 없습니다.',
  deleteButton: '삭제',
  blockButton: '차단',
  cancel: '취소',
};

function resolveMediaUrl(fileUrl) {
  if (!fileUrl) return '';
  return String(fileUrl).startsWith('http') ? fileUrl : API_BASE_URL + fileUrl;
}

function getInitial(user) {
  return String(user?.nickname || user?.username || 'L').charAt(0).toUpperCase();
}

function getConversationKey(user) {
  return String(user?.userId || user?.username || '');
}

function formatMessageTime(value) {
  if (!value) return '';
  const date = new Date(String(value).replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return value;

  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');

  return month + '/' + day + ' ' + hour + ':' + minute;
}

function mergeMessages(currentMessages, incomingMessages) {
  const map = new Map();
  [...currentMessages, ...incomingMessages].forEach((message) => {
    map.set(message.messageId, message);
  });

  return Array.from(map.values()).sort((a, b) => Number(a.messageId) - Number(b.messageId));
}

function upsertConversation(conversations, conversationUser, message, viewerId, selectedKey) {
  if (!conversationUser?.userId || !message?.messageId) return conversations;

  const key = getConversationKey(conversationUser);
  const existing = conversations.find((conversation) => getConversationKey(conversation.user) === key);
  const shouldIncrement = key !== selectedKey && Number(message.receiverId) === Number(viewerId);
  const nextConversation = {
    user: conversationUser,
    lastMessage: message,
    unreadCount: shouldIncrement ? (existing?.unreadCount || 0) + 1 : (existing?.unreadCount || 0),
  };

  return [nextConversation, ...conversations.filter((conversation) => getConversationKey(conversation.user) !== key)];
}

function getTotalUnread(conversations) {
  return conversations.reduce((sum, conversation) => sum + Number(conversation.unreadCount || 0), 0);
}

function Chat() {
  const appModal = useAppModal();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isDarkMode, user } = useOutletContext();
  const [conversations, setConversations] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [conversationFilter, setConversationFilter] = useState('all');
  const [requestsOpen, setRequestsOpen] = useState(false);
  const [filterAnchorEl, setFilterAnchorEl] = useState(null);
  const [newChatKeyword, setNewChatKeyword] = useState('');
  const [newChatResults, setNewChatResults] = useState([]);
  const [recommendedUsers, setRecommendedUsers] = useState([]);
  const [loadingNewChatUsers, setLoadingNewChatUsers] = useState(false);
  const [error, setError] = useState('');
  const messageEndRef = useRef(null);

  const selectedKey = useMemo(() => getConversationKey(selectedUser), [selectedUser]);
  const selectedUsername = selectedUser?.username || '';
  const directChatUsername = searchParams.get('to') || '';
  const filteredConversations = conversations.filter((conversation) => {
    if (requestsOpen && !conversation.isRequest) return false;
    if (!requestsOpen && conversation.isRequest) return false;
    if (conversationFilter === 'unread') return Number(conversation.unreadCount || 0) > 0;
    return true;
  });
  const activeConversationList = searchKeyword.trim()
    ? requestsOpen
      ? filteredConversations.filter((conversation) => {
        const keyword = searchKeyword.trim().toLowerCase();
        return String(conversation.user?.nickname || '').toLowerCase().includes(keyword)
          || String(conversation.user?.username || '').toLowerCase().includes(keyword);
      })
      : searchResults.filter((resultUser) => String(resultUser.role || 'USER').toUpperCase() !== 'ADMIN').map((resultUser) => ({ user: resultUser, lastMessage: null, unreadCount: 0 }))
    : filteredConversations;
  const normalizedNewChatKeyword = newChatKeyword.trim();
  const newChatUsers = (normalizedNewChatKeyword ? newChatResults : recommendedUsers)
    .filter((targetUser) => String(targetUser.role || 'USER').toUpperCase() !== 'ADMIN');
  const conversationFilterLabel = conversationFilter === 'unread' ? copy.filterUnread : copy.filterAll;
  const conversationTitle = requestsOpen ? copy.messageRequests : copy.title;
  const emptyConversationTitle = requestsOpen ? copy.requestEmptyTitle : copy.emptyInboxTitle;
  const emptyConversationBody = requestsOpen ? copy.requestEmptyBody : copy.emptyInboxBody;

  const syncUnreadCount = (nextConversations) => {
    window.dispatchEvent(new CustomEvent('liveLogDmUnreadChanged', {
      detail: { unreadCount: getTotalUnread(nextConversations) },
    }));
  };

  useEffect(() => {
    let ignore = false;

    setLoadingConversations(true);
    setError('');

    getDmConversations()
      .then((data) => {
        if (ignore) return;
        const nextConversations = Array.isArray(data.conversations) ? data.conversations : [];
        setConversations(nextConversations);
        syncUnreadCount(nextConversations);
      })
      .catch((requestError) => {
        if (!ignore) setError(requestError.message || copy.loadError);
      })
      .finally(() => {
        if (!ignore) setLoadingConversations(false);
      });

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedUsername) {
      setMessages([]);
      return undefined;
    }

    let ignore = false;

    setLoadingMessages(true);
    setError('');

    getDmMessages({ username: selectedUsername, limit: PAGE_SIZE })
      .then((data) => {
        if (ignore) return;
        setMessages(Array.isArray(data.messages) ? data.messages : []);
        setNextCursor(data.nextCursor || null);
        setHasMore(Boolean(data.hasMore));
        setConversations((prevConversations) => {
          const nextConversations = prevConversations.map((conversation) => (
            getConversationKey(conversation.user) === selectedKey
              ? { ...conversation, unreadCount: 0 }
              : conversation
          ));
          syncUnreadCount(nextConversations);
          return nextConversations;
        });
        markDmConversationRead({ username: selectedUsername })
          .then((readData) => {
            window.dispatchEvent(new CustomEvent('liveLogDmUnreadChanged', { detail: { unreadCount: Number(readData.unreadCount) || 0 } }));
          })
          .catch(() => {});
      })
      .catch((requestError) => {
        if (!ignore) setError(requestError.message || copy.messageLoadError);
      })
      .finally(() => {
        if (!ignore) setLoadingMessages(false);
      });

    return () => {
      ignore = true;
    };
  }, [selectedKey, selectedUsername]);

  useEffect(() => {
    const keyword = searchKeyword.trim();
    let ignore = false;

    if (!keyword) {
      setSearchResults([]);
      setSearchLoading(false);
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setSearchLoading(true);
      searchUsers({ keyword, limit: 8 })
        .then((data) => {
          if (!ignore) setSearchResults(Array.isArray(data.users) ? data.users : []);
        })
        .catch(() => {
          if (!ignore) setSearchResults([]);
        })
        .finally(() => {
          if (!ignore) setSearchLoading(false);
        });
    }, 250);

    return () => {
      ignore = true;
      window.clearTimeout(timer);
    };
  }, [searchKeyword]);

  useEffect(() => {
    const username = directChatUsername.trim();
    if (!username || selectedUsername === username) return undefined;

    const existingConversation = conversations.find((conversation) => conversation.user?.username === username);
    if (existingConversation) {
      setSelectedUser(existingConversation.user);
      setSearchParams({}, { replace: true });
      return undefined;
    }

    let ignore = false;
    searchUsers({ keyword: username, limit: 5 })
      .then((data) => {
        if (ignore) return;
        const users = Array.isArray(data.users) ? data.users : [];
        const targetUser = users.find((item) => item.username === username) || users[0];
        if (targetUser && String(targetUser.role || 'USER').toUpperCase() !== 'ADMIN') {
          setSelectedUser(targetUser);
        }
        setSearchParams({}, { replace: true });
      })
      .catch(() => {
        if (!ignore) setSearchParams({}, { replace: true });
      });

    return () => {
      ignore = true;
    };
  }, [conversations, directChatUsername, selectedUsername, setSearchParams]);
  useEffect(() => {
    if (!newChatOpen) return undefined;

    let ignore = false;
    setLoadingNewChatUsers(true);

    getRecommendedUsers({ limit: 12 })
      .then((data) => {
        if (!ignore) setRecommendedUsers(Array.isArray(data.users) ? data.users : []);
      })
      .catch(() => {
        if (!ignore) setRecommendedUsers([]);
      })
      .finally(() => {
        if (!ignore) setLoadingNewChatUsers(false);
      });

    return () => {
      ignore = true;
    };
  }, [newChatOpen]);

  useEffect(() => {
    const username = directChatUsername.trim();
    if (!username || selectedUsername === username) return undefined;

    const existingConversation = conversations.find((conversation) => conversation.user?.username === username);
    if (existingConversation) {
      setSelectedUser(existingConversation.user);
      setSearchParams({}, { replace: true });
      return undefined;
    }

    let ignore = false;
    searchUsers({ keyword: username, limit: 5 })
      .then((data) => {
        if (ignore) return;
        const users = Array.isArray(data.users) ? data.users : [];
        const targetUser = users.find((item) => item.username === username) || users[0];
        if (targetUser && String(targetUser.role || 'USER').toUpperCase() !== 'ADMIN') {
          setSelectedUser(targetUser);
        }
        setSearchParams({}, { replace: true });
      })
      .catch(() => {
        if (!ignore) setSearchParams({}, { replace: true });
      });

    return () => {
      ignore = true;
    };
  }, [conversations, directChatUsername, selectedUsername, setSearchParams]);
  useEffect(() => {
    if (!newChatOpen) return undefined;

    const keyword = newChatKeyword.trim();
    let ignore = false;

    if (!keyword) {
      setNewChatResults([]);
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setLoadingNewChatUsers(true);
      searchUsers({ keyword, limit: 12 })
        .then((data) => {
          if (!ignore) setNewChatResults(Array.isArray(data.users) ? data.users : []);
        })
        .catch(() => {
          if (!ignore) setNewChatResults([]);
        })
        .finally(() => {
          if (!ignore) setLoadingNewChatUsers(false);
        });
    }, 250);

    return () => {
      ignore = true;
      window.clearTimeout(timer);
    };
  }, [newChatKeyword, newChatOpen]);

  useEffect(() => {
    const socket = connectSocket();
    if (!socket) return undefined;

    const handleNewMessage = (payload) => {
      const message = payload?.message;
      const conversationUser = payload?.conversationUser;
      if (!message?.messageId || !conversationUser) return;

      const incomingKey = getConversationKey(conversationUser);
      const isOpenConversation = incomingKey === selectedKey;

      if (isOpenConversation) {
        setMessages((prevMessages) => mergeMessages(prevMessages, [message]));
        markDmConversationRead({ username: conversationUser.username }).catch(() => {});
      }

      setConversations((prevConversations) => {
        const nextConversations = upsertConversation(prevConversations, conversationUser, message, user?.userId, selectedKey);
        const normalizedConversations = isOpenConversation
          ? nextConversations.map((conversation) => (
            getConversationKey(conversation.user) === selectedKey ? { ...conversation, unreadCount: 0 } : conversation
          ))
          : nextConversations;
        syncUnreadCount(normalizedConversations);
        return normalizedConversations;
      });
    };

    const handleMessageDelete = (payload) => {
      const messageId = Number(payload?.messageId);
      if (!messageId) return;
      setMessages((prevMessages) => prevMessages.filter((message) => Number(message.messageId) !== messageId));
    };

    const handleConversationRead = (payload) => {
      const readerId = Number(payload?.readerId);
      if (!readerId) return;
      setMessages((prevMessages) => prevMessages.map((message) => (
        Number(message.receiverId) === readerId ? { ...message, isRead: true } : message
      )));
    };

    const handleBlocked = () => {
      setConversations((prevConversations) => prevConversations.filter((conversation) => getConversationKey(conversation.user) !== selectedKey));
      setSelectedUser(null);
      setMessages([]);
    };

    socket.on('dm:new', handleNewMessage);
    socket.on('dm:delete', handleMessageDelete);
    socket.on('dm:read', handleConversationRead);
    socket.on('dm:block', handleBlocked);

    return () => {
      socket.off('dm:new', handleNewMessage);
      socket.off('dm:delete', handleMessageDelete);
      socket.off('dm:read', handleConversationRead);
      socket.off('dm:block', handleBlocked);
    };
  }, [selectedKey, user?.userId]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, selectedKey]);

  const handleSelectUser = (nextUser) => {
    setSelectedUser(nextUser);
    setSearchKeyword('');
    setSearchResults([]);
  };

  const handleSelectConversationFilter = (nextFilter) => {
    setConversationFilter(nextFilter);
    setFilterAnchorEl(null);
  };

  const handleOpenRequests = () => {
    setRequestsOpen((current) => !current);
    setSelectedUser(null);
    setFilterAnchorEl(null);
  };

  const handleOpenNewChat = () => {
    setNewChatKeyword('');
    setNewChatResults([]);
    setNewChatOpen(true);
  };

  const handleCloseNewChat = () => {
    setNewChatOpen(false);
    setNewChatKeyword('');
    setNewChatResults([]);
  };

  const handleStartNewChat = (nextUser) => {
    handleSelectUser(nextUser);
    handleCloseNewChat();
  };

  const handleLoadMore = async () => {
    if (!selectedUsername || !nextCursor || loadingMessages) return;

    setLoadingMessages(true);
    setError('');

    try {
      const data = await getDmMessages({ username: selectedUsername, cursor: nextCursor, limit: PAGE_SIZE });
      const olderMessages = Array.isArray(data.messages) ? data.messages : [];
      setMessages((prevMessages) => mergeMessages(olderMessages, prevMessages));
      setNextCursor(data.nextCursor || null);
      setHasMore(Boolean(data.hasMore));
    } catch (requestError) {
      setError(requestError.message || copy.messageLoadError);
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleSendMessage = async () => {
    const content = draft.trim();
    if (!selectedUsername || !content || sending) return;

    setSending(true);
    setError('');

    try {
      const data = await sendDmMessage({ username: selectedUsername, content });
      if (data.message) {
        setMessages((prevMessages) => mergeMessages(prevMessages, [data.message]));
        setConversations((prevConversations) => upsertConversation(prevConversations, selectedUser, data.message, user?.userId, selectedKey));
      }
      setDraft('');
    } catch (requestError) {
      setError(requestError.message || copy.sendError);
    } finally {
      setSending(false);
    }
  };

  const handleDeleteMessage = async (message) => {
    const confirmed = await appModal.showConfirm({
      title: copy.deleteConfirmTitle,
      message: copy.deleteConfirmBody,
      confirmText: copy.deleteButton,
      cancelText: copy.cancel,
      variant: 'danger',
    });

    if (!confirmed) return;

    try {
      await deleteDmMessage({ messageId: message.messageId });
      setMessages((prevMessages) => prevMessages.filter((item) => item.messageId !== message.messageId));
    } catch (requestError) {
      setError(requestError.message || copy.sendError);
    }
  };

  const handleDraftKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <Box component="main" className="main-feed dm-page">
      <Box className="dm-layout">
        <Box className="dm-list-panel">
          <Box className="dm-header">
            <Typography className="dm-header__title">{conversationTitle}</Typography>
            <Button className="dm-filter-button" endIcon={<ExpandMoreRoundedIcon />} onClick={(event) => setFilterAnchorEl(event.currentTarget)}>{conversationFilterLabel}</Button>
            <Tooltip title="알림"><IconButton className="dm-header-icon" onClick={() => navigate('/alerts')}><NotificationsNoneRoundedIcon /></IconButton></Tooltip>
            <Tooltip title={copy.messageRequests}><IconButton className={requestsOpen ? 'dm-header-icon dm-header-icon--active' : 'dm-header-icon'} onClick={handleOpenRequests}><MailOutlineRoundedIcon /></IconButton></Tooltip>
            <Tooltip title={copy.newChat}><IconButton className="dm-header-icon" onClick={handleOpenNewChat}><ChatBubbleOutlineRoundedIcon /></IconButton></Tooltip>
          </Box>

          <Menu anchorEl={filterAnchorEl} onClose={() => setFilterAnchorEl(null)} open={Boolean(filterAnchorEl)}>
            <MenuItem selected={conversationFilter === 'all'} onClick={() => handleSelectConversationFilter('all')}>{copy.filterAll}</MenuItem>
            <MenuItem selected={conversationFilter === 'unread'} onClick={() => handleSelectConversationFilter('unread')}>{copy.filterUnread}</MenuItem>
          </Menu>

          <Box className="dm-search-box">
            <TextField
              className="dm-search-input"
              fullWidth
              onChange={(event) => setSearchKeyword(event.target.value)}
              placeholder={copy.searchPlaceholder}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchRoundedIcon />
                    </InputAdornment>
                  ),
                },
                htmlInput: { maxLength: 50 },
              }}
              value={searchKeyword}
            />
          </Box>

          {loadingConversations ? (
            <Box className="dm-state"><CircularProgress size={26} /></Box>
          ) : searchLoading ? (
            <Box className="dm-state"><CircularProgress size={24} /></Box>
          ) : activeConversationList.length === 0 ? (
            <Box className="dm-inbox-empty">
              <InboxOutlinedIcon />
              <Typography className="dm-inbox-empty__title">{searchKeyword.trim() ? copy.searchEmpty : emptyConversationTitle}</Typography>
              <Typography className="dm-inbox-empty__body">{searchKeyword.trim() ? copy.searchEmpty : emptyConversationBody}</Typography>
            </Box>
          ) : (
            <Stack className="dm-conversation-list" divider={<Divider />}>
              {activeConversationList.map((conversation) => {
                const conversationUser = conversation.user;
                const active = getConversationKey(conversationUser) === selectedKey;
                return (
                  <Button
                    className={active ? 'dm-conversation dm-conversation--active' : 'dm-conversation'}
                    key={getConversationKey(conversationUser)}
                    onClick={() => handleSelectUser(conversationUser)}
                  >
                    <Avatar className="main-avatar dm-conversation__avatar" src={resolveMediaUrl(conversationUser.profileImageUrl || conversationUser.profileImage)}>{getInitial(conversationUser)}</Avatar>
                    <Box className="dm-conversation__body">
                      <Typography className="dm-conversation__name">{conversationUser.nickname}</Typography>
                      <Typography className="dm-conversation__message">
                        {conversation.lastMessage?.content || '@' + conversationUser.username}
                      </Typography>
                    </Box>
                    {conversation.unreadCount > 0 && <Box className="dm-conversation__badge">{conversation.unreadCount}</Box>}
                  </Button>
                );
              })}
            </Stack>
          )}
        </Box>

        <Box className="dm-message-panel">
          {selectedUser ? (
            <>
              <Box className="dm-message-header">
                <Avatar className="main-avatar dm-message-header__avatar" src={resolveMediaUrl(selectedUser.profileImageUrl || selectedUser.profileImage)}>{getInitial(selectedUser)}</Avatar>
                <Box className="dm-message-header__text">
                  <Typography className="dm-message-header__name">{selectedUser.nickname}</Typography>
                  <Typography className="dm-message-header__username">@{selectedUser.username}</Typography>
                </Box>
              </Box>

              {error && <Alert className="main-form-alert" severity="error">{error}</Alert>}

              <Box className="dm-message-list">
                {hasMore && (
                  <Box className="dm-load-more-row">
                    <Button className="dm-load-more-button" disabled={loadingMessages} onClick={handleLoadMore}>{copy.loadMore}</Button>
                  </Box>
                )}

                {loadingMessages && messages.length === 0 ? (
                  <Box className="dm-state"><CircularProgress size={26} /></Box>
                ) : messages.length === 0 ? null : messages.map((message) => {
                  const mine = Number(message.senderId) === Number(user?.userId);
                  return (
                    <Box className={mine ? 'dm-message-row dm-message-row--mine' : 'dm-message-row'} key={message.messageId}>
                      <Box className="dm-message-bubble">
                        <Typography className="dm-message-bubble__content">{message.content}</Typography>
                        <Box className="dm-message-bubble__footer">
                          <Typography className="dm-message-bubble__time">{formatMessageTime(message.createdAt)}{mine && message.isRead ? ' · 읽음' : ''}</Typography>
                          {mine && (
                            <Tooltip title={copy.deleteMessage}>
                              <IconButton className="dm-message-delete" onClick={() => handleDeleteMessage(message)}><DeleteOutlineRoundedIcon /></IconButton>
                            </Tooltip>
                          )}
                        </Box>
                      </Box>
                    </Box>
                  );
                })}
                <div ref={messageEndRef} />
              </Box>

              <Box className="dm-compose">
                <TextField
                  className="dm-compose-input"
                  fullWidth
                  maxRows={4}
                  multiline
                  onChange={(event) => setDraft(event.target.value.slice(0, MAX_MESSAGE_LENGTH))}
                  onKeyDown={handleDraftKeyDown}
                  placeholder={copy.messagePlaceholder}
                  value={draft}
                />
                <Button
                  className="dm-send-button"
                  disabled={!draft.trim() || sending}
                  onClick={handleSendMessage}
                  startIcon={<SendRoundedIcon />}
                  variant="contained"
                >
                  {copy.send}
                </Button>
              </Box>
            </>
          ) : (
            <Box className="dm-center-empty dm-center-empty--standalone">
              <Box className="dm-center-empty__icon"><ChatBubbleOutlineRoundedIcon /></Box>
              <Typography className="dm-center-empty__title">{copy.emptyPanelTitle}</Typography>
              <Typography className="dm-center-empty__body">{copy.emptyPanelBody}</Typography>
              <Button className="dm-center-empty__button" onClick={handleOpenNewChat} variant="contained">{copy.newChat}</Button>
            </Box>
          )}
        </Box>
      </Box>

      <Dialog
        className={isDarkMode ? 'dm-new-chat-dialog dm-new-chat-dialog--dark' : 'dm-new-chat-dialog'}
        fullWidth
        maxWidth="xs"
        onClose={handleCloseNewChat}
        open={newChatOpen}
      >
        <Box className="dm-new-chat-header">
          <Typography className="dm-new-chat-title">{copy.newMessageTitle}</Typography>
          <IconButton className="dm-new-chat-close" onClick={handleCloseNewChat}>
            <CloseRoundedIcon />
          </IconButton>
        </Box>

        <DialogContent className="dm-new-chat-content">
          <TextField
            autoFocus
            className="dm-new-chat-search"
            fullWidth
            onChange={(event) => setNewChatKeyword(event.target.value)}
            placeholder={copy.newChatPlaceholder}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRoundedIcon />
                  </InputAdornment>
                ),
              },
              htmlInput: { maxLength: 50 },
            }}
            value={newChatKeyword}
          />

          <Box className="dm-new-chat-section-head">
            <Typography>{normalizedNewChatKeyword ? copy.searchResults : copy.recommendedUsers}</Typography>
          </Box>

          {loadingNewChatUsers ? (
            <Box className="dm-new-chat-state"><CircularProgress size={24} /></Box>
          ) : newChatUsers.length === 0 ? (
            <Box className="dm-new-chat-state">
              <Typography>{normalizedNewChatKeyword ? copy.searchEmpty : copy.recommendedEmpty}</Typography>
            </Box>
          ) : (
            <Stack className="dm-new-chat-list">
              {newChatUsers.map((targetUser) => (
                <Button
                  className="dm-new-chat-user"
                  key={getConversationKey(targetUser)}
                  onClick={() => handleStartNewChat(targetUser)}
                >
                  <Avatar className="main-avatar dm-new-chat-user__avatar" src={resolveMediaUrl(targetUser.profileImageUrl || targetUser.profileImage)}>{getInitial(targetUser)}</Avatar>
                  <Box className="dm-new-chat-user__body">
                    <Box className="dm-new-chat-user__name-row">
                      <Typography className="dm-new-chat-user__name">{targetUser.nickname}</Typography>
                      {targetUser.followedByMe && <Typography className="dm-new-chat-user__chip">팔로잉</Typography>}
                    </Box>
                    <Typography className="dm-new-chat-user__username">@{targetUser.username}</Typography>
                  </Box>
                </Button>
              ))}
            </Stack>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}

export default Chat;

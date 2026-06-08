import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Box, Button, Chip, CircularProgress, Stack, Typography } from '@mui/material';
import AdminPanelSettingsRoundedIcon from '@mui/icons-material/AdminPanelSettingsRounded';
import ReportProblemRoundedIcon from '@mui/icons-material/ReportProblemRounded';
import { getReports, updateReport } from '../../api/adminApi';
import { useAppModal } from '../common/ModalProvider';
import { getAuthUser } from '../../utils/authStorage';

const PAGE_SIZE = 20;

function getPostDetailPath(report) {
  const username = report?.post?.user?.username || 'user';
  return '/' + encodeURIComponent(username) + '/status/' + report?.post?.postId;
}

function getStatusLabel(status) {
  if (status === 'APPROVED') return '조치 완료';
  if (status === 'REJECTED') return '신고 반려';
  return '대기 중';
}

function Admin() {
  const navigate = useNavigate();
  const appModal = useAppModal();
  const user = getAuthUser();
  const [reports, setReports] = useState([]);
  const [status, setStatus] = useState('PENDING');
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [processingId, setProcessingId] = useState('');
  const [error, setError] = useState('');

  const loadReports = async ({ cursor, append = false } = {}) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError('');

    try {
      const data = await getReports({ cursor, limit: PAGE_SIZE, status });
      const nextReports = Array.isArray(data.reports) ? data.reports : [];
      setReports((prevReports) => (append ? [...prevReports, ...nextReports] : nextReports));
      setNextCursor(data.nextCursor || null);
      setHasMore(Boolean(data.hasMore));
    } catch (requestError) {
      setError(requestError.message || '신고 목록을 불러오지 못했습니다.');
    } finally {
      if (append) setLoadingMore(false);
      else setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  // status 변경 시 신고 목록을 다시 불러옵니다.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const handleProcessReport = async (report, hidePost) => {
    const confirmed = await appModal.showConfirm({
      title: hidePost ? '게시글 숨김 처리' : '신고 처리 확인',
      message: hidePost ? '게시글을 숨기면 다른 사용자가 볼 수 없게 됩니다. 계속하시겠습니까?' : '해당 신고를 처리 완료 상태로 변경하시겠습니까?',
      confirmText: hidePost ? '숨기기' : '확인',
      cancelText: '취소',
      variant: hidePost ? 'danger' : 'primary',
    });

    if (!confirmed) return;

    setProcessingId(report.reportId);
    setError('');

    try {
      await updateReport({ reportId: report.reportId, status: hidePost ? 'APPROVED' : 'REJECTED', hidePost });
      setReports((prevReports) => prevReports.filter((item) => item.reportId !== report.reportId));
      await appModal.showAlert({ title: '처리 완료', message: '신고 처리가 완료되었습니다.' });
    } catch (requestError) {
      setError(requestError.message || '신고 처리 중 오류가 발생했습니다.');
    } finally {
      setProcessingId('');
    }
  };

  if (String(user?.role || '').toUpperCase() !== 'ADMIN') {
    return (
      <Box component="main" className="admin-page admin-page--standalone">
        <Box className="main-feed-state"><Typography>관리자 권한이 없습니다.</Typography></Box>
      </Box>
    );
  }

  return (
    <Box component="main" className="admin-page admin-page--standalone">
      <Box className="menu-page-header menu-page-header--row">
        <Box>
          <Typography className="menu-page-header__title"><AdminPanelSettingsRoundedIcon /> 관리자</Typography>
          <Typography className="menu-page-header__description">신고된 게시글을 관리하고 조치를 취할 수 있습니다.</Typography>
        </Box>
      </Box>

      <Stack className="admin-filter-row" direction="row" spacing={1}>
        <Button className={status === 'PENDING' ? 'admin-filter-button admin-filter-button--active' : 'admin-filter-button'} onClick={() => setStatus('PENDING')}>대기 중</Button>
        <Button className={status === 'APPROVED' ? 'admin-filter-button admin-filter-button--active' : 'admin-filter-button'} onClick={() => setStatus('APPROVED')}>조치 완료</Button>
        <Button className={status === 'REJECTED' ? 'admin-filter-button admin-filter-button--active' : 'admin-filter-button'} onClick={() => setStatus('REJECTED')}>신고 반려</Button>
      </Stack>

      {error && <Alert className="main-form-alert" severity="error">{error}</Alert>}

      {loading ? (
        <Box className="main-feed-state"><CircularProgress size={28} /></Box>
      ) : reports.length === 0 ? (
        <Box className="main-feed-state"><Typography>신고 내역이 없습니다.</Typography></Box>
      ) : (
        <Stack className="admin-report-list">
          {reports.map((report) => (
            <Box className="admin-report-card" key={report.reportId}>
              <Box className="admin-report-card__head">
                <Box className="admin-report-card__title-row">
                  <ReportProblemRoundedIcon />
                  <Typography className="admin-report-card__title">신고 #{report.reportId}</Typography>
                  <Chip className={report.status !== 'PENDING' ? 'admin-status-chip admin-status-chip--done' : 'admin-status-chip'} label={getStatusLabel(report.status)} size="small" />
                </Box>
                <Typography className="admin-report-card__date">{report.createdAt}</Typography>
              </Box>

              <Box className="admin-report-card__meta">
                <Typography>신고자: <strong>{report.reporter.nickname}</strong> @{report.reporter.username}</Typography>
                <Typography>피신고자: <strong>{report.post.user.nickname}</strong> @{report.post.user.username}</Typography>
              </Box>

              <Box className="admin-report-card__reason">
                <Typography className="admin-report-card__label">신고 사유</Typography>
                <Typography>{report.reason}</Typography>
              </Box>

              <Box className="admin-report-card__post" onClick={() => navigate(getPostDetailPath(report))} role="button" tabIndex={0}>
                <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                  <Chip className="main-work-chip" label={report.post.categoryName} size="small" />
                  <Chip className="main-work-chip main-work-chip--dark" label={report.post.workTitle} size="small" />
                  <Chip className="main-work-chip" label={report.post.progress} size="small" />
                  {report.post.isDeleted && <Chip color="error" label="삭제됨" size="small" />}
                </Stack>
                <Typography className="admin-report-card__content">{report.post.content}</Typography>
              </Box>

              {report.status === 'PENDING' && (
                <Stack className="admin-report-card__actions" direction="row" spacing={1}>
                  <Button className="profile-outline-button" disabled={processingId === report.reportId} onClick={() => handleProcessReport(report, false)}>신고 반려</Button>
                  <Button className="admin-danger-button" disabled={processingId === report.reportId || report.post.isDeleted} onClick={() => handleProcessReport(report, true)}>게시글 숨김</Button>
                </Stack>
              )}
            </Box>
          ))}

          {hasMore && (
            <Box className="post-detail-more-row">
              <Button className="main-menu-screen__button" disabled={loadingMore} onClick={() => loadReports({ cursor: nextCursor, append: true })} variant="contained">
                {loadingMore ? '불러오는 중' : '더 보기'}
              </Button>
            </Box>
          )}
        </Stack>
      )}
    </Box>
  );
}

export default Admin;

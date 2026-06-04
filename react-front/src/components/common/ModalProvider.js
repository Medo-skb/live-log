import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Box, Button, Dialog, Typography } from '@mui/material';
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined';

const ModalContext = createContext(null);
const THEME_MODE_KEY = 'liveLogThemeMode';

const DEFAULT_ALERT = {
  type: 'alert',
  title: '알림',
  message: '',
  confirmText: '확인',
  cancelText: '취소',
  variant: 'default',
};

function isStoredDarkMode() {
  return typeof window !== 'undefined' && window.localStorage.getItem(THEME_MODE_KEY) === 'dark';
}

function getDialogClassName(variant) {
  const classNames = ['app-modal'];

  if (variant === 'danger') classNames.push('app-modal--danger');
  if (isStoredDarkMode()) classNames.push('app-modal--dark');

  return classNames.join(' ');
}

export function ModalProvider({ children }) {
  const resolverRef = useRef(null);
  const [dialog, setDialog] = useState(null);

  const closeDialog = useCallback((result) => {
    if (resolverRef.current) {
      resolverRef.current(result);
      resolverRef.current = null;
    }
    setDialog(null);
  }, []);

  const openDialog = useCallback((options) => new Promise((resolve) => {
    resolverRef.current = resolve;
    setDialog({ ...DEFAULT_ALERT, ...options });
  }), []);

  const modalApi = useMemo(() => ({
    showAlert: (options) => openDialog({ ...options, type: 'alert' }),
    showConfirm: (options) => openDialog({ ...options, type: 'confirm' }),
  }), [openDialog]);

  const isConfirm = dialog?.type === 'confirm';

  return (
    <ModalContext.Provider value={modalApi}>
      {children}
      <Dialog
        className={getDialogClassName(dialog?.variant)}
        fullWidth
        maxWidth="xs"
        onClose={() => closeDialog(false)}
        open={Boolean(dialog)}
      >
        {dialog && (
          <>
            <Box className="app-modal__body">
              <Box className="app-modal__icon" aria-hidden="true">
                <ReportProblemOutlinedIcon />
              </Box>
              <Typography className="app-modal__title" component="h2">
                {dialog.title}
              </Typography>
              {dialog.message && (
                <Typography className="app-modal__message">
                  {dialog.message}
                </Typography>
              )}
            </Box>
            <Box className={isConfirm ? 'app-modal__actions' : 'app-modal__actions app-modal__actions--single'}>
              {isConfirm && (
                <Button className="app-modal__button app-modal__button--cancel" onClick={() => closeDialog(false)}>
                  {dialog.cancelText}
                </Button>
              )}
              <Button className="app-modal__button app-modal__button--confirm" onClick={() => closeDialog(true)}>
                {dialog.confirmText}
              </Button>
            </Box>
          </>
        )}
      </Dialog>
    </ModalContext.Provider>
  );
}

export function useAppModal() {
  const modal = useContext(ModalContext);

  if (!modal) {
    throw new Error('useAppModal must be used inside ModalProvider.');
  }

  return modal;
}

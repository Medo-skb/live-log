import { createTheme } from '@mui/material/styles';

export const liveLogTokens = {
  bg: '#f4f7f5',
  surface: '#ffffff',
  surfaceSoft: '#edf3ee',
  ink: '#15201c',
  muted: '#65716c',
  line: '#dbe4df',
  primary: '#1f6f5b',
  primaryDark: '#164c41',
  accent: '#ff6b4a',
  lime: '#b8e15d',
  warning: '#8d5a00',
  warningBg: '#fff1ca',
  radius: 8,
  shadow: '0 18px 55px rgba(21, 32, 28, 0.1)',
};

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: liveLogTokens.primary,
      dark: liveLogTokens.primaryDark,
      contrastText: '#ffffff',
    },
    secondary: {
      main: liveLogTokens.accent,
      contrastText: '#ffffff',
    },
    background: {
      default: liveLogTokens.bg,
      paper: liveLogTokens.surface,
    },
    text: {
      primary: liveLogTokens.ink,
      secondary: liveLogTokens.muted,
    },
    divider: liveLogTokens.line,
    warning: {
      main: liveLogTokens.warning,
      light: liveLogTokens.warningBg,
    },
  },
  typography: {
    fontFamily: 'Pretendard, "Noto Sans KR", "Segoe UI", Arial, sans-serif',
    allVariants: {
      letterSpacing: 0,
    },
    h1: {
      fontWeight: 900,
      lineHeight: 1.08,
    },
    h2: {
      fontWeight: 900,
    },
    h3: {
      fontWeight: 900,
    },
    button: {
      fontWeight: 800,
      textTransform: 'none',
    },
  },
  shape: {
    borderRadius: liveLogTokens.radius,
  },
  shadows: [
    'none',
    '0 1px 0 rgba(21, 32, 28, 0.03)',
    liveLogTokens.shadow,
    '0 8px 24px rgba(21, 32, 28, 0.08)',
    '0 10px 30px rgba(21, 32, 28, 0.1)',
    '0 12px 36px rgba(21, 32, 28, 0.12)',
    '0 14px 42px rgba(21, 32, 28, 0.14)',
    '0 16px 48px rgba(21, 32, 28, 0.16)',
    '0 18px 55px rgba(21, 32, 28, 0.18)',
    '0 20px 60px rgba(21, 32, 28, 0.2)',
    '0 22px 66px rgba(21, 32, 28, 0.22)',
    '0 24px 72px rgba(21, 32, 28, 0.24)',
    '0 26px 78px rgba(21, 32, 28, 0.26)',
    '0 28px 84px rgba(21, 32, 28, 0.28)',
    '0 30px 90px rgba(21, 32, 28, 0.3)',
    '0 32px 96px rgba(21, 32, 28, 0.32)',
    '0 34px 102px rgba(21, 32, 28, 0.34)',
    '0 36px 108px rgba(21, 32, 28, 0.36)',
    '0 38px 114px rgba(21, 32, 28, 0.38)',
    '0 40px 120px rgba(21, 32, 28, 0.4)',
    '0 42px 126px rgba(21, 32, 28, 0.42)',
    '0 44px 132px rgba(21, 32, 28, 0.44)',
    '0 46px 138px rgba(21, 32, 28, 0.46)',
    '0 48px 144px rgba(21, 32, 28, 0.48)',
    '0 50px 150px rgba(21, 32, 28, 0.5)',
  ],
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        '*': {
          boxSizing: 'border-box',
        },
        body: {
          margin: 0,
          backgroundColor: liveLogTokens.bg,
          color: liveLogTokens.ink,
          fontFamily: 'Pretendard, "Noto Sans KR", "Segoe UI", Arial, sans-serif',
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          minHeight: 42,
          borderRadius: liveLogTokens.radius,
          fontWeight: 800,
          boxShadow: 'none',
        },
      },
      defaultProps: {
        disableElevation: true,
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          border: `1px solid ${liveLogTokens.line}`,
          borderRadius: liveLogTokens.radius,
          boxShadow: '0 1px 0 rgba(21, 32, 28, 0.03)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: 'outlined',
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: liveLogTokens.radius,
          backgroundColor: '#fafcfb',
        },
        notchedOutline: {
          borderColor: liveLogTokens.line,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          backgroundColor: liveLogTokens.surfaceSoft,
          color: liveLogTokens.primaryDark,
          fontWeight: 800,
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderColor: liveLogTokens.line,
          backgroundColor: liveLogTokens.surface,
        },
      },
    },
  },
});

export default theme;

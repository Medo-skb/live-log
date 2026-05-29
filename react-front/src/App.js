import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Box, CssBaseline } from '@mui/material';
import Login from './components/user/Login';
import Join from './components/user/Join';
import EmailVerify from './components/user/EmailVerify';
import Main from './components/Main';
import Home from './components/menu/Home';
import Explore from './components/menu/Explore';
import Alerts from './components/menu/Alerts';
import Follow from './components/menu/Follow';
import Chat from './components/menu/Chat';
import Bookmark from './components/menu/Bookmark';
import Profile from './components/menu/Profile';
import Onboarding from './components/menu/Onboarding';
import ProtectedRoute from './components/common/ProtectedRoute';
import './css/layout.css';

function App() {
  return (
    <Box className="app-layout">
      <CssBaseline />
      <Box component="main" className="app-main app-main--auth">
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/join" element={<Join />} />
          <Route path="/verify-email" element={<EmailVerify />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/main" element={<Main />}>
              <Route index element={<Home />} />
              <Route path="onboarding" element={<Onboarding />} />
              <Route path="explore" element={<Explore />} />
              <Route path="alerts" element={<Alerts />} />
              <Route path="follow" element={<Follow />} />
              <Route path="chat" element={<Chat />} />
              <Route path="bookmark" element={<Bookmark />} />
              <Route path="profile" element={<Profile />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Box>
    </Box>
  );
}

export default App;
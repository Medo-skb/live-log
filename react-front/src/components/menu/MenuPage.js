import { Box, Button, Stack, Typography } from '@mui/material';

function MenuPage({ actionText, description, title }) {
  return (
    <Box component="main" className="main-feed main-menu-screen">
      <Box className="main-menu-screen__inner">
        <Stack spacing={2.5}>
          <Typography component="h1" className="main-menu-screen__title">{title}</Typography>
          <Typography className="main-menu-screen__description">{description}</Typography>
          {actionText && <Button className="main-menu-screen__button" variant="contained">{actionText}</Button>}
        </Stack>
      </Box>
    </Box>
  );
}

export default MenuPage;

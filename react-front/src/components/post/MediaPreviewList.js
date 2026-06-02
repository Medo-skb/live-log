import { useEffect, useMemo } from 'react';
import { Box, Chip, IconButton, Typography } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import MovieRoundedIcon from '@mui/icons-material/MovieRounded';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import { getMediaFileLabel, getMediaKind } from '../../utils/mediaValidation';

function getKindIcon(kind) {
  if (kind === 'image') return <ImageRoundedIcon />;
  if (kind === 'video') return <MovieRoundedIcon />;
  return <ImageRoundedIcon />;
}

function MediaPreviewList({ files, onRemove }) {
  const previews = useMemo(() => Array.from(files || []).map((file) => ({
    file,
    kind: getMediaKind(file),
    label: getMediaFileLabel(file),
    url: URL.createObjectURL(file),
  })), [files]);

  useEffect(() => () => {
    previews.forEach((preview) => URL.revokeObjectURL(preview.url));
  }, [previews]);

  if (previews.length === 0) return null;

  return (
    <Box className="main-media-preview-list">
      {previews.map((preview) => (
        <Box className="main-media-preview" key={preview.file.name + preview.file.lastModified}>
          <Box className="main-media-preview__viewer">
            {preview.kind === 'image' && <img alt={preview.file.name} src={preview.url} />}
            {preview.kind === 'video' && <video controls src={preview.url} />}
          </Box>
          <Box className="main-media-preview__meta">
            <Chip className="main-media-preview__kind" icon={getKindIcon(preview.kind)} label={preview.kind || 'file'} size="small" />
            <Typography className="main-media-preview__name">{preview.label}</Typography>
            <IconButton aria-label="remove file" className="main-media-preview__remove" onClick={() => onRemove(preview.file.name)} size="small">
              <CloseRoundedIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>
      ))}
    </Box>
  );
}

export default MediaPreviewList;

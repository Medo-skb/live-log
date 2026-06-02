export const MEDIA_ACCEPT = 'image/*,video/*';

export const MEDIA_RULES = {
  image: { maxSize: 10 * 1024 * 1024, label: '사진' },
  video: { maxSize: 30 * 1024 * 1024, label: '동영상' },
};

export function getMediaKind(file) {
  if (!file?.type) return '';
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  return '';
}

export function formatFileSize(bytes) {
  const size = Number(bytes);

  if (!Number.isFinite(size) || size <= 0) return '0 KB';
  if (size < 1024 * 1024) return Math.ceil(size / 1024) + ' KB';

  return (size / 1024 / 1024).toFixed(1) + ' MB';
}

export function getMediaFileLabel(file) {
  return formatFileSize(file.size) + ' - ' + file.name;
}

export function validateMediaFiles(files) {
  const selectedFiles = Array.from(files || []);

  for (const file of selectedFiles) {
    const mediaKind = getMediaKind(file);
    const rule = MEDIA_RULES[mediaKind];

    if (!rule) {
      return {
        files: [],
        error: '사진, 동영상 파일만 업로드할 수 있습니다. 선택한 파일: ' + file.name,
      };
    }

    if (file.size > rule.maxSize) {
      return {
        files: [],
        error: rule.label + ' 파일은 ' + formatFileSize(rule.maxSize) + '까지 업로드할 수 있습니다. 선택한 파일: ' + file.name + ' (' + formatFileSize(file.size) + ')',
      };
    }
  }

  return { files: selectedFiles, error: '' };
}

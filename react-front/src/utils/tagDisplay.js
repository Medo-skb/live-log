export function normalizeTagValue(tag) {
  return String(tag || '').replace(/^#/, '').trim().toLowerCase();
}

export function getVisibleTags(post) {
  const content = String(post?.content || '').toLowerCase();
  const seen = new Set();

  return (post?.tags || []).filter((tag) => {
    const normalizedTag = normalizeTagValue(tag);
    if (!normalizedTag || seen.has(normalizedTag)) return false;
    seen.add(normalizedTag);
    return !content.includes('#' + normalizedTag);
  });
}

export function getTagSearchPath(tag) {
  const normalizedTag = String(tag || '').replace(/^#/, '').trim();
  return '/explore?q=' + encodeURIComponent('#' + normalizedTag);
}

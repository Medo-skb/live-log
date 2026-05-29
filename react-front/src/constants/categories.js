export const CATEGORY_ALL_ID = 'ALL';

export const CATEGORY_ALL = {
  categoryId: CATEGORY_ALL_ID,
  name: "전체",
};

export const DEFAULT_CATEGORIES = [
  { categoryId: 1, name: "애니메이션" },
  { categoryId: 2, name: "소설" },
  { categoryId: 3, name: "영화" },
  { categoryId: 4, name: "드라마" },
  { categoryId: 5, name: "음악" },
];

export const FEED_CATEGORY_ITEMS = [CATEGORY_ALL, ...DEFAULT_CATEGORIES];

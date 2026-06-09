const { GoogleGenAI } = require('@google/genai');

const DEFAULT_PROVIDER = 'mock';
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash-lite';
const MAX_TAG_COUNT = 3;
const MAX_TAG_LENGTH = 100;
const SPOILER_KEYWORDS = ['죽', '사망', '범인', '결말', '반전', '스포', '배신', '흑막', '정체', '최종화'];

function getProvider() {
  return String(process.env.AI_PROVIDER || DEFAULT_PROVIDER).trim().toLowerCase();
}

function normalizeBoolean(value) {
  return value === true || value === 1 || value === '1' || String(value).toLowerCase() === 'true';
}

function clampConfidence(value) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return 0;
  return Math.min(1, Math.max(0, Number(numberValue.toFixed(4))));
}

function normalizeTag(tag) {
  return String(tag || '')
    .replace(/^#/, '')
    .trim()
    .replace(/[\s,]+/g, '_')
    .slice(0, MAX_TAG_LENGTH);
}

function normalizeTags(tags) {
  const seen = new Set();
  const normalized = [];

  (Array.isArray(tags) ? tags : []).forEach((tag) => {
    const cleanTag = normalizeTag(tag);
    const key = cleanTag.toLowerCase();
    if (!cleanTag || seen.has(key)) return;
    seen.add(key);
    normalized.push(cleanTag);
  });

  return normalized.slice(0, MAX_TAG_COUNT);
}

function extractJson(text) {
  const value = String(text || '').trim();
  if (!value) return null;

  try {
    return JSON.parse(value);
  } catch (error) {
    const match = value.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch (nestedError) {
      return null;
    }
  }
}

function getResponseText(response) {
  if (!response) return '';
  if (typeof response.text === 'string') return response.text;
  if (typeof response.text === 'function') return response.text();

  return response.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || '')
    .join('') || '';
}

function buildPrompt({ categoryName, workTitle, progress, content }) {
  return [
    'Live-Log SNS 게시글을 분석하세요.',
    '목표는 스포일러 여부 판단과 검색용 추천 태그 생성입니다.',
    '스포일러는 결말, 사망, 범인, 반전, 정체, 핵심 전개, 이후 전개를 직접적으로 드러내는 내용입니다.',
    '단순 감상, 분위기, 재미 여부, 작품명, 현재 진도만으로는 스포일러로 판단하지 마세요.',
    '반드시 JSON만 응답하세요.',
    '형식: {"isSpoiler": boolean, "confidence": number, "tags": ["태그1", "태그2", "태그3"], "reason": "짧은 한국어 판단 근거"}',
    '',
    '카테고리: ' + (categoryName || ''),
    '작품명: ' + (workTitle || ''),
    '진도: ' + (progress || ''),
    '본문: ' + (content || ''),
  ].join('\n');
}

function mockAnalyzePost({ categoryName, workTitle, content }) {
  const source = String(content || '');
  const isSpoiler = SPOILER_KEYWORDS.some((keyword) => source.includes(keyword));
  const hashTags = (source.match(/#[\p{L}\p{N}_-]+/gu) || []).map((tag) => tag.replace(/^#/, ''));
  const tags = normalizeTags([
    ...hashTags,
    workTitle,
    categoryName,
    isSpoiler ? '스포일러' : '감상',
  ]);

  return {
    provider: 'mock',
    model: 'keyword-fallback',
    isSpoiler,
    confidence: isSpoiler ? 0.7 : 0.35,
    tags,
    reason: isSpoiler ? '스포일러 가능성이 높은 키워드가 포함되어 있습니다.' : '핵심 전개를 직접적으로 드러내는 표현이 적습니다.',
    rawResponse: '',
  };
}

async function analyzeWithGemini(input) {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;

  if (!apiKey) return mockAnalyzePost(input);

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model,
    contents: buildPrompt(input),
    config: {
      temperature: 0.1,
      responseMimeType: 'application/json',
    },
  });

  const rawText = getResponseText(response);
  const parsed = extractJson(rawText);
  if (!parsed) throw new Error('Gemini returned non-JSON response');

  return {
    provider: 'gemini',
    model,
    isSpoiler: normalizeBoolean(parsed.isSpoiler),
    confidence: clampConfidence(parsed.confidence),
    tags: normalizeTags(parsed.tags),
    reason: String(parsed.reason || '').slice(0, 300),
    rawResponse: rawText.slice(0, 1000),
  };
}

async function analyzePostContent(input) {
  const provider = getProvider();

  try {
    if (provider === 'gemini') return await analyzeWithGemini(input);
    return mockAnalyzePost(input);
  } catch (error) {
    console.error('AI analysis fallback', error.message);
    const fallback = mockAnalyzePost(input);
    return {
      ...fallback,
      provider: provider + ':fallback',
      reason: fallback.reason + ' AI 호출 실패로 fallback 분석을 사용했습니다.',
    };
  }
}

module.exports = {
  analyzePostContent,
  normalizeTags,
};

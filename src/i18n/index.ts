// ========================================
// i18n 語言管理器
// 支援 en / zh / ja 三語
// ========================================

import { en } from "./en.ts";
import { zh } from "./zh.ts";
import { ja } from "./ja.ts";

/** 支援的語系 */
export type Locale = "en" | "zh" | "ja";

/** 翻譯字典的型別 — key 為 dot-notation 字串 */
export type TranslationDict = Record<string, string>;

/** 所有語系的翻譯資料 */
const translations: Record<Locale, TranslationDict> = { en, zh, ja };

/** 目前使用的語系（預設英文） */
let currentLocale: Locale = "en";

/**
 * 設定目前語系
 * @param locale - 語系代碼
 */
export function setLocale(locale: Locale): void {
  if (!(locale in translations)) {
    throw new Error(`Unsupported locale: ${locale}. Use: en, zh, ja`);
  }
  currentLocale = locale;
}

/**
 * 取得目前語系
 */
export function getLocale(): Locale {
  return currentLocale;
}

/**
 * 取得指定語系的完整翻譯字典
 * @param locale - 語系代碼（預設使用目前語系）
 */
export function getTranslation(locale?: Locale): TranslationDict {
  return translations[locale ?? currentLocale];
}

/**
 * 翻譯函數 — 以 dot notation key 取得翻譯文字
 * 找不到 key 時 fallback 到英文，再找不到就回傳 key 本身
 *
 * @param key - 翻譯鍵，例如 'crystal_ball.title'
 * @param locale - 可選的語系覆寫
 * @returns 翻譯後的文字
 */
export function t(key: string, locale?: Locale): string {
  const lang = locale ?? currentLocale;
  const dict = translations[lang];
  if (dict[key] !== undefined) return dict[key];

  // Fallback to English
  if (lang !== "en" && translations.en[key] !== undefined) {
    return translations.en[key];
  }

  // Key not found anywhere — return the key itself
  return key;
}

/**
 * 取得指標的本地化顯示名稱
 * @param metricId - 內部指標 ID（如 'mrr', 'churn'）
 * @param fallbackName - API 回傳的顯示名稱（fallback）
 * @param locale - 可選的語系覆寫
 */
export function tMetric(metricId: string, fallbackName: string, locale?: Locale): string {
  const key = `metric.${metricId}`;
  const translated = t(key, locale);
  // 如果 t() 回傳的是 key 本身，表示沒有對應翻譯，用 fallback
  return translated === key ? fallbackName : translated;
}

/**
 * 取得趨勢方向的本地化文字
 */
export function tTrend(trend: string, locale?: Locale): string {
  return t(`trend.${trend}`, locale);
}

/**
 * 取得趨勢方向的本地化文字（帶圖示版本）
 */
export function tTrendIcon(trend: string, locale?: Locale): string {
  return t(`trend.${trend}_icon`, locale);
}

/**
 * 取得 Quick Ratio 等級的本地化文字
 */
export function tQRGrade(grade: string, locale?: Locale): string {
  return t(`qr.grade.${grade}`, locale);
}

/**
 * 取得 Quick Ratio 等級的本地化文字（帶圖示版本）
 */
export function tQRGradeIcon(grade: string, locale?: Locale): string {
  return t(`qr.grade.${grade}_icon`, locale);
}

/**
 * PMF grade 內部值到 key 的對照
 */
const PMF_GRADE_KEY: Record<string, string> = {
  "Strong PMF": "strong",
  "Approaching PMF": "approaching",
  "Pre-PMF": "pre",
  "No PMF Signal": "no_signal",
};

/**
 * 取得 PMF 等級的本地化文字
 */
export function tPMFGrade(grade: string, locale?: Locale): string {
  const key = PMF_GRADE_KEY[grade] ?? grade;
  return t(`pmf.grade.${key}`, locale);
}

/**
 * 取得 PMF 等級的本地化文字（帶圖示版本）
 */
export function tPMFGradeIcon(grade: string, locale?: Locale): string {
  const key = PMF_GRADE_KEY[grade] ?? grade;
  return t(`pmf.grade.${key}_icon`, locale);
}

/**
 * 驗證所有語系的 key 數量是否一致
 * 用於開發/測試環境
 * @returns 驗證結果
 */
export function validateTranslations(): {
  valid: boolean;
  counts: Record<Locale, number>;
  missingKeys: Record<Locale, string[]>;
} {
  const enKeys = new Set(Object.keys(en));
  const counts: Record<Locale, number> = {
    en: Object.keys(en).length,
    zh: Object.keys(zh).length,
    ja: Object.keys(ja).length,
  };

  const missingKeys: Record<Locale, string[]> = {
    en: [],
    zh: [],
    ja: [],
  };

  // Check zh and ja have all en keys
  for (const key of enKeys) {
    if (zh[key] === undefined) missingKeys.zh.push(key);
    if (ja[key] === undefined) missingKeys.ja.push(key);
  }

  // Check en has all zh/ja keys (extra keys in non-default locales)
  for (const key of Object.keys(zh)) {
    if (!enKeys.has(key)) missingKeys.en.push(key);
  }
  for (const key of Object.keys(ja)) {
    if (!enKeys.has(key)) missingKeys.en.push(key);
  }

  const valid =
    missingKeys.en.length === 0 &&
    missingKeys.zh.length === 0 &&
    missingKeys.ja.length === 0;

  return { valid, counts, missingKeys };
}

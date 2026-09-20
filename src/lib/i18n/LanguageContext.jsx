import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { translations, languageNames } from "./translations";

const LanguageContext = createContext();

const STORAGE_KEY = "app_language";

function detectInitialLanguage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && translations[saved]) return saved;
  } catch (e) {}
  return "ar";
}

function applyDocumentAttrs(lang) {
  const meta = languageNames[lang] || languageNames.ar;
  if (typeof document !== "undefined") {
    document.documentElement.lang = lang;
    document.documentElement.dir = meta.dir;
  }
}

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(detectInitialLanguage);

  useEffect(() => {
    applyDocumentAttrs(language);
    try { localStorage.setItem(STORAGE_KEY, language); } catch (e) {}
  }, [language]);

  const setLanguage = useCallback((lang) => {
    if (translations[lang]) setLanguageState(lang);
  }, []);

  const t = useCallback(
    (key, fallback) => {
      const dict = translations[language] || translations.ar;
      return dict[key] ?? fallback ?? translations.ar[key] ?? key;
    },
    [language]
  );

  const value = { language, setLanguage, t, dir: languageNames[language]?.dir || "rtl" };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    // Fallback for components rendered outside provider
    return { language: "ar", setLanguage: () => {}, t: (k, f) => f || k, dir: "rtl" };
  }
  return ctx;
}
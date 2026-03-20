import { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ja from '../i18n/ja';
import en from '../i18n/en';

const translations = { ja, en };

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState('ja');

  useEffect(() => {
    AsyncStorage.getItem('lang').then((saved) => {
      if (saved === 'ja' || saved === 'en') setLang(saved);
    });
  }, []);

  const toggleLanguage = async () => {
    const next = lang === 'ja' ? 'en' : 'ja';
    setLang(next);
    await AsyncStorage.setItem('lang', next);
  };

  return (
    <LanguageContext.Provider value={{ lang, toggleLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const { lang, toggleLanguage } = useContext(LanguageContext);
  const t = (key, params) => {
    let str = translations[lang]?.[key] ?? translations['ja'][key] ?? key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        str = str.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
      });
    }
    return str;
  };
  return { lang, toggleLanguage, t };
}

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import en from './locales/en.json';
import ru from './locales/ru.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import it from './locales/it.json';

// Detect the user's language
const locales = Localization.getLocales();
const languageCode = locales && locales.length > 0 ? locales[0].languageCode : 'en';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      ru: { translation: ru },
      es: { translation: es },
      fr: { translation: fr },
      it: { translation: it },
    },
    lng: languageCode,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // react already safes from xss
    },
    compatibilityJSON: 'v3', // Required for React Native to handle some i18next v4+ features
  });

export default i18n;

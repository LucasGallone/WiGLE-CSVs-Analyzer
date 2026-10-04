import React from 'react';
import {
  Radio,
  Database,
  Sun,
  Moon,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';

interface HeaderProps {
  onOpenOuiManager: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenOuiManager,
}) => {
  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800/80 px-4 lg:px-8 py-3.5 shadow-sm dark:shadow-xl transition-colors">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Brand Logo & Title */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-gradient-to-br from-cyan-600 to-blue-700 shadow-md shadow-cyan-500/20 text-white">
            <Radio className="w-6 h-6" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
                WiGLE <span className="bg-gradient-to-r from-cyan-600 to-blue-600 dark:from-cyan-400 dark:to-blue-400 bg-clip-text text-transparent">CSVs Analyzer</span>
              </h1>
            </div>
          </div>
        </div>

        {/* Global Controls & Actions */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* OUI Database Manager */}
          <button
            onClick={onOpenOuiManager}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-500 text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-300 text-xs font-semibold shadow-sm transition-all cursor-pointer"
          >
            <Database className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
            <span>{t('header.oui')}</span>
          </button>

          {/* Theme Toggle Button (Dark / Light) */}
          <button
            onClick={toggleTheme}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:border-amber-400 dark:hover:border-amber-400 text-slate-700 dark:text-slate-200 text-xs font-semibold shadow-sm transition-all cursor-pointer"
            title={
              theme === 'dark'
                ? language === 'fr'
                  ? 'Passer au mode clair'
                  : 'Switch to Light Mode'
                : language === 'fr'
                ? 'Passer au mode sombre'
                : 'Switch to Dark Mode'
            }
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-4 h-4 text-amber-400" />
                <span className="hidden sm:inline">
                  {language === 'fr' ? 'Passer au mode clair' : 'Switch to Light Mode'}
                </span>
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-indigo-600" />
                <span className="hidden sm:inline">
                  {language === 'fr' ? 'Passer au mode sombre' : 'Switch to Dark Mode'}
                </span>
              </>
            )}
          </button>

          {/* Language Selector EN / FR (Default English) */}
          <div className="flex items-center rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 p-0.5 text-xs font-bold shadow-xs">
            <button
              onClick={() => setLanguage('en')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                language === 'en'
                  ? 'bg-cyan-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="English (Default)"
            >
              EN
            </button>
            <button
              onClick={() => setLanguage('fr')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                language === 'fr'
                  ? 'bg-cyan-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Français"
            >
              FR
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

interface ThemeContextType {
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  theme: 'light' | 'dark';
  fontSize: 'small' | 'medium' | 'large';
  language: 'pt' | 'en';
  sidebarCollapsed: boolean;
  
  // Métodos
  setPrimaryColor: (color: string) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setFontSize: (size: 'small' | 'medium' | 'large') => void;
  setLanguage: (lang: 'pt' | 'en') => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [primaryColor, setPrimaryColor] = useState('#2563eb');
  const [secondaryColor, setSecondaryColor] = useState('#64748b');
  const [backgroundColor, setBackgroundColor] = useState('#ffffff');
  const [textColor, setTextColor] = useState('#1e293b');
  const [accentColor, setAccentColor] = useState('#f59e0b');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [fontSize, setFontSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [language, setLanguage] = useState<'pt' | 'en'>('pt');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Carregar settings do servidor na primeira vez
  useEffect(() => {
    const carregarSettings = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setIsLoading(false);
          return;
        }

        const response = await fetch('/api/settings/tema', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.themeSettings) {
            if (data.themeSettings.primaryColor) {
              setPrimaryColor(data.themeSettings.primaryColor);
            }
            if (data.themeSettings.backgroundColor) {
              setBackgroundColor(data.themeSettings.backgroundColor);
            }
            if (data.themeSettings.theme) {
              setTheme(data.themeSettings.theme);
            }
            if (data.themeSettings.fontSize) {
              setFontSize(data.themeSettings.fontSize);
            }
            if (data.themeSettings.language) {
              setLanguage(data.themeSettings.language);
            }
            if (data.themeSettings.sidebarCollapsed !== undefined) {
              setSidebarCollapsed(data.themeSettings.sidebarCollapsed);
            }
          }
        }
      } catch (error) {
        console.error('Erro carregando settings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    carregarSettings();
  }, []);

  // Aplicar variáveis CSS quando as cores mudarem
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const root = document.documentElement;
      root.style.setProperty('--color-primary', primaryColor);
      root.style.setProperty('--color-secondary', secondaryColor);
      root.style.setProperty('--color-background', backgroundColor);
      root.style.setProperty('--color-text', textColor);
      root.style.setProperty('--color-accent', accentColor);
      root.classList.toggle('dark', theme === 'dark');
    }
  }, [primaryColor, secondaryColor, backgroundColor, textColor, accentColor, theme]);

  const handleSetPrimaryColor = (color: string) => {
    setPrimaryColor(color);
    salvarSettings({ primaryColor: color });
  };

  const handleSetTheme = (newTheme: 'light' | 'dark') => {
    setTheme(newTheme);
    salvarSettings({ theme: newTheme });
  };

  const handleSetFontSize = (size: 'small' | 'medium' | 'large') => {
    setFontSize(size);
    salvarSettings({ fontSize: size });
  };

  const handleSetLanguage = (lang: 'pt' | 'en') => {
    setLanguage(lang);
    salvarSettings({ language: lang });
  };

  const handleSetSidebarCollapsed = (collapsed: boolean) => {
    setSidebarCollapsed(collapsed);
    salvarSettings({ sidebarCollapsed: collapsed });
  };

  const salvarSettings = async (updates: any) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      await fetch('/api/settings/tema', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });
    } catch (error) {
      console.error('Erro salvando settings:', error);
    }
  };

  const value: ThemeContextType = {
    primaryColor,
    secondaryColor,
    backgroundColor,
    textColor,
    accentColor,
    theme,
    fontSize,
    language,
    sidebarCollapsed,
    setPrimaryColor: handleSetPrimaryColor,
    setTheme: handleSetTheme,
    setFontSize: handleSetFontSize,
    setLanguage: handleSetLanguage,
    setSidebarCollapsed: handleSetSidebarCollapsed,
  };

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Carregando...</div>;
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme deve ser usado dentro de ThemeProvider');
  }
  return context;
};

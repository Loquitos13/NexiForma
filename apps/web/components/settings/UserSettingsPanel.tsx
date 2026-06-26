'use client';

import React, { useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';

export const UserSettingsPanel: React.FC = () => {
  const {
    primaryColor,
    theme,
    fontSize,
    language,
    sidebarCollapsed,
    setPrimaryColor,
    setTheme,
    setFontSize,
    setLanguage,
    setSidebarCollapsed,
  } = useTheme();

  const [corCustomizada, setCorCustomizada] = useState(primaryColor);

  const cores = [
    '#2563eb', // Azul
    '#dc2626', // Vermelho
    '#16a34a', // Verde
    '#d97706', // Laranja
    '#7c3aed', // Roxo
    '#0891b2', // Ciano
    '#e11d48', // Rosa
    '#EA580C', // Laranja escuro
  ];

  const handleCorChange = (cor: string) => {
    setCorCustomizada(cor);
    setPrimaryColor(cor);
  };

  const bgPainel = theme === 'dark' ? '#1e293b' : '#f8fafc';
  const bgInput = theme === 'dark' ? '#0f172a' : '#ffffff';
  const borderColor = theme === 'dark' ? '#334155' : '#e2e8f0';

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold" style={{ color: primaryColor }}>
          Definições Pessoais
        </h1>
        <p className="text-gray-500 mt-2">
          Customize sua experiência na plataforma
        </p>
      </div>

      {/* Tema */}
      <div
        className="p-6 rounded-lg"
        style={{ backgroundColor: bgPainel }}
      >
        <h2 className="text-xl font-bold mb-4" style={{ color: primaryColor }}>
          🎨 Tema Visual
        </h2>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Escolha entre tema claro ou escuro</p>
          <div className="flex gap-4">
            {(['light', 'dark'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`flex-1 py-3 px-4 rounded-lg font-semibold transition border-2 ${
                  theme === t
                    ? 'border-current'
                    : 'border-transparent'
                }`}
                style={{
                  backgroundColor: theme === t ? primaryColor : bgInput,
                  color: theme === t ? '#ffffff' : primaryColor,
                  borderColor: theme === t ? primaryColor : 'transparent',
                }}
              >
                {t === 'light' ? '☀️ Claro' : '🌙 Escuro'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Cor Primária */}
      <div
        className="p-6 rounded-lg"
        style={{ backgroundColor: bgPainel }}
      >
        <h2 className="text-xl font-bold mb-4" style={{ color: primaryColor }}>
          🎯 Cor Primária
        </h2>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Escolha uma cor ou customize a sua
          </p>
          <div className="grid grid-cols-4 gap-3">
            {cores.map((cor) => (
              <button
                key={cor}
                onClick={() => handleCorChange(cor)}
                className="w-full aspect-square rounded-lg hover:shadow-lg transition border-4"
                style={{
                  backgroundColor: cor,
                  borderColor:
                    corCustomizada === cor ? '#ffffff' : 'transparent',
                  boxShadow:
                    corCustomizada === cor
                      ? `0 0 0 3px ${cor}`
                      : 'none',
                }}
              />
            ))}
          </div>
          <div>
            <label className="block text-sm font-semibold mb-2">
              Cor Customizada
            </label>
            <input
              type="color"
              value={corCustomizada}
              onChange={(e) => handleCorChange(e.target.value)}
              className="w-full h-12 rounded-lg cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Tamanho da Fonte */}
      <div
        className="p-6 rounded-lg"
        style={{ backgroundColor: bgPainel }}
      >
        <h2 className="text-xl font-bold mb-4" style={{ color: primaryColor }}>
          📝 Tamanho da Fonte
        </h2>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Ajuste o tamanho para melhor legibilidade</p>
          <div className="flex gap-4">
            {(['small', 'medium', 'large'] as const).map((size) => (
              <button
                key={size}
                onClick={() => setFontSize(size)}
                className={`flex-1 py-3 px-4 rounded-lg font-semibold transition border-2`}
                style={{
                  backgroundColor: fontSize === size ? primaryColor : bgInput,
                  color: fontSize === size ? '#ffffff' : primaryColor,
                  borderColor: fontSize === size ? primaryColor : 'transparent',
                }}
              >
                {size === 'small' ? 'A Pequeno' : size === 'medium' ? 'A Normal' : 'A Grande'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Idioma */}
      <div
        className="p-6 rounded-lg"
        style={{ backgroundColor: bgPainel }}
      >
        <h2 className="text-xl font-bold mb-4" style={{ color: primaryColor }}>
          🌐 Idioma
        </h2>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Escolha seu idioma preferido</p>
          <div className="flex gap-4">
            {(['pt', 'en'] as const).map((lang) => (
              <button
                key={lang}
                onClick={() => setLanguage(lang)}
                className={`flex-1 py-3 px-4 rounded-lg font-semibold transition border-2`}
                style={{
                  backgroundColor: language === lang ? primaryColor : bgInput,
                  color: language === lang ? '#ffffff' : primaryColor,
                  borderColor: language === lang ? primaryColor : 'transparent',
                }}
              >
                {lang === 'pt' ? '🇵🇹 Português' : '🇬🇧 English'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <div
        className="p-6 rounded-lg"
        style={{ backgroundColor: bgPainel }}
      >
        <h2 className="text-xl font-bold mb-4" style={{ color: primaryColor }}>
          📌 Layout
        </h2>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Preferências de layout</p>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="w-full py-3 px-4 rounded-lg font-semibold transition border-2"
            style={{
              backgroundColor: sidebarCollapsed ? primaryColor : bgInput,
              color: sidebarCollapsed ? '#ffffff' : primaryColor,
              borderColor: primaryColor,
            }}
          >
            {sidebarCollapsed ? '⬅️ Expandir Sidebar' : '➡️ Ocultar Sidebar'}
          </button>
        </div>
      </div>

      {/* Nota Importante */}
      <div
        className="p-4 rounded-lg border-l-4"
        style={{
          backgroundColor: bgPainel,
          borderLeftColor: primaryColor,
        }}
      >
        <p className="text-sm text-gray-600">
          <strong>💡 Nota:</strong> Estas configurações afetam apenas sua experiência. 
          Configurações globais da empresa devem ser alteradas pelo gestor do tenant.
        </p>
      </div>

      {/* Salvo com Sucesso */}
      <div
        className="p-4 rounded-lg"
        style={{
          backgroundColor: '#10b98120',
          borderLeftColor: '#10b981',
          borderLeftWidth: '4px',
        }}
      >
        <p className="text-sm font-semibold" style={{ color: '#10b981' }}>
          ✅ Suas preferências são salvas automaticamente
        </p>
      </div>
    </div>
  );
};

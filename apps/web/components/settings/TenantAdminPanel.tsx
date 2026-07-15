'use client';

import React, { useEffect, useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { bffFetch } from '@/lib/client/bff-fetch';

interface TenantBranding {
  logoUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  companyName: string;
  supportEmail: string;
  supportPhone?: string;
  footerText?: string;
}

interface PlanoSubscricao {
  id: string;
  nome: string;
  preco: number;
  features: string[];
  limites: Record<string, any>;
}

interface PlanoAtual {
  planoAtual: PlanoSubscricao | null;
  status: string;
  terminaEm: string;
  diasRestantes: number;
}

export const TenantAdminPanel: React.FC = () => {
  const { primaryColor, accentColor, theme } = useTheme();
  const [branding, setBranding] = useState<TenantBranding>({
    primaryColor: '#2563eb',
    secondaryColor: '#64748b',
    companyName: '',
    supportEmail: '',
  });
  const [planoAtual, setPlanoAtual] = useState<PlanoAtual | null>(null);
  const [planosDisponiveis, setPlanosDisponiveis] = useState<PlanoSubscricao[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      const brandingRes = await bffFetch('/api/settings/tenant/branding', {
        headers: { accept: 'application/json' },
      });
      if (brandingRes.ok) {
        const data = await brandingRes.json();
        setBranding(data.branding);
      }

      const planoRes = await bffFetch('/api/settings/tenant/plano', {
        headers: { accept: 'application/json' },
      });
      if (planoRes.ok) {
        setPlanoAtual(await planoRes.json());
      }

      const planosRes = await bffFetch('/api/settings/planos', {
        headers: { accept: 'application/json' },
      });
      if (planosRes.ok) {
        setPlanosDisponiveis(await planosRes.json());
      }
    } catch (error) {
      console.error('Erro carregando dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBrandingChange = (field: keyof TenantBranding, value: any) => {
    setBranding((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSaveBranding = async () => {
    setSaving(true);
    try {
      const response = await bffFetch('/api/settings/tenant/branding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(branding),
      });

      if (response.ok) {
        setMessage('Branding atualizado com sucesso! ✅');
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage('Erro ao salvar. Verifique suas permissões.');
      }
    } catch (error) {
      setMessage('Erro: ' + (error as any).message);
    } finally {
      setSaving(false);
    }
  };

  const bgPainel = theme === 'dark' ? '#1e293b' : '#f8fafc';
  const bgInput = theme === 'dark' ? '#0f172a' : '#ffffff';
  const borderColor = theme === 'dark' ? '#334155' : '#e2e8f0';

  if (loading) {
    return <div className="p-6 text-center">Carregando...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold" style={{ color: primaryColor }}>
          Administração da Empresa
        </h1>
        <p className="text-gray-500 mt-2">
          Apenas o gestor do tenant pode alterar estas configurações
        </p>
      </div>

      {message && (
        <div
          className="p-4 rounded-lg"
          style={{
            backgroundColor:
              message.includes('sucesso') || message.includes('✅')
                ? '#10b98120'
                : '#ef444420',
            borderLeftWidth: '4px',
            borderLeftColor: message.includes('sucesso') || message.includes('✅')
              ? '#10b981'
              : '#ef4444',
          }}
        >
          <p
            className="text-sm font-semibold"
            style={{
              color: message.includes('sucesso') || message.includes('✅')
                ? '#10b981'
                : '#ef4444',
            }}
          >
            {message}
          </p>
        </div>
      )}

      {/* Branding Empresarial */}
      <div className="p-6 rounded-lg" style={{ backgroundColor: bgPainel }}>
        <h2 className="text-2xl font-bold mb-6" style={{ color: primaryColor }}>
          🏢 Branding Empresarial
        </h2>

        <div className="space-y-4">
          {/* Nome Empresa */}
          <div>
            <label className="block text-sm font-semibold mb-2">
              Nome da Empresa
            </label>
            <input
              type="text"
              value={branding.companyName}
              onChange={(e) =>
                handleBrandingChange('companyName', e.target.value)
              }
              placeholder="Tech Solutions PT"
              className="w-full px-4 py-2 rounded-lg border transition focus:outline-none"
              style={{
                backgroundColor: bgInput,
                borderColor: borderColor,
                borderWidth: '1px',
              }}
            />
            <p className="text-xs text-gray-500 mt-1">
              Este nome aparecerá em toda a plataforma
            </p>
          </div>

          {/* Logo URL */}
          <div>
            <label className="block text-sm font-semibold mb-2">
              URL do Logo
            </label>
            <input
              type="url"
              value={branding.logoUrl || ''}
              onChange={(e) =>
                handleBrandingChange('logoUrl', e.target.value)
              }
              placeholder="https://seu-dominio.com/logo.png"
              className="w-full px-4 py-2 rounded-lg border transition focus:outline-none"
              style={{
                backgroundColor: bgInput,
                borderColor: borderColor,
                borderWidth: '1px',
              }}
            />
            {branding.logoUrl && (
              <div className="mt-3 p-4 bg-gray-100 rounded-lg">
                <img
                  src={branding.logoUrl}
                  alt="Preview Logo"
                  className="max-h-24"
                />
              </div>
            )}
          </div>

          {/* Cores */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-2">
                Cor Primária
              </label>
              <input
                type="color"
                value={branding.primaryColor}
                onChange={(e) =>
                  handleBrandingChange('primaryColor', e.target.value)
                }
                className="w-full h-12 rounded-lg cursor-pointer"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">
                Cor Secundária
              </label>
              <input
                type="color"
                value={branding.secondaryColor}
                onChange={(e) =>
                  handleBrandingChange('secondaryColor', e.target.value)
                }
                className="w-full h-12 rounded-lg cursor-pointer"
              />
            </div>
          </div>

          {/* Contactos */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-2">
                Email Suporte
              </label>
              <input
                type="email"
                value={branding.supportEmail}
                onChange={(e) =>
                  handleBrandingChange('supportEmail', e.target.value)
                }
                placeholder="support@empresa.pt"
                className="w-full px-4 py-2 rounded-lg border transition focus:outline-none"
                style={{
                  backgroundColor: bgInput,
                  borderColor: borderColor,
                  borderWidth: '1px',
                }}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">
                Telefone Suporte
              </label>
              <input
                type="tel"
                value={branding.supportPhone || ''}
                onChange={(e) =>
                  handleBrandingChange('supportPhone', e.target.value)
                }
                placeholder="+351 21 1234567"
                className="w-full px-4 py-2 rounded-lg border transition focus:outline-none"
                style={{
                  backgroundColor: bgInput,
                  borderColor: borderColor,
                  borderWidth: '1px',
                }}
              />
            </div>
          </div>

          {/* Footer */}
          <div>
            <label className="block text-sm font-semibold mb-2">
              Texto Footer
            </label>
            <textarea
              value={branding.footerText || ''}
              onChange={(e) =>
                handleBrandingChange('footerText', e.target.value)
              }
              placeholder="© 2026 Tech Solutions. Todos os direitos reservados."
              rows={3}
              className="w-full px-4 py-2 rounded-lg border transition focus:outline-none"
              style={{
                backgroundColor: bgInput,
                borderColor: borderColor,
                borderWidth: '1px',
              }}
            />
          </div>

          {/* Botão Salvar */}
          <button
            onClick={handleSaveBranding}
            disabled={saving}
            className="w-full py-3 rounded-lg text-white font-semibold transition hover:shadow-lg disabled:opacity-50"
            style={{ backgroundColor: primaryColor }}
          >
            {saving ? 'Guardando...' : '💾 Guardar Branding'}
          </button>
        </div>
      </div>

      {/* Plano de Subscrição */}
      <div className="p-6 rounded-lg" style={{ backgroundColor: bgPainel }}>
        <h2 className="text-2xl font-bold mb-6" style={{ color: primaryColor }}>
          💳 Plano de Subscrição
        </h2>

        {planoAtual && (
          <div className="mb-6 p-4 rounded-lg border-l-4" style={{ borderLeftColor: accentColor }}>
            <p className="text-sm text-gray-600">Plano Atual</p>
            <p className="text-2xl font-bold" style={{ color: accentColor }}>
              {planoAtual.planoAtual?.nome || 'Sem Plano'}
            </p>
            <p className="text-sm text-gray-500 mt-2">
              {planoAtual.planoAtual
                ? `€${planoAtual.planoAtual.preco}/mês`
                : 'Status: ' + planoAtual.status}
            </p>
            {planoAtual.diasRestantes && (
              <p className="text-sm text-yellow-600 mt-2">
                ⏰ {planoAtual.diasRestantes} dias restantes
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {planosDisponiveis.map((plano) => (
            <div
              key={plano.id}
              className="p-6 rounded-lg border-2"
              style={{
                backgroundColor: bgInput,
                borderColor:
                  planoAtual?.planoAtual?.id === plano.id
                    ? primaryColor
                    : borderColor,
              }}
            >
              <h3 className="text-xl font-bold mb-2" style={{ color: primaryColor }}>
                {plano.nome}
              </h3>
              <p className="text-3xl font-bold mb-4">
                €{plano.preco}
                <span className="text-sm text-gray-500">/mês</span>
              </p>
              <ul className="space-y-2 mb-4">
                {plano.features.slice(0, 3).map((feature, idx) => (
                  <li key={idx} className="text-sm text-gray-600">
                    ✓ {feature}
                  </li>
                ))}
                {plano.features.length > 3 && (
                  <li className="text-sm text-gray-600">
                    +{plano.features.length - 3} mais
                  </li>
                )}
              </ul>
              <button
                disabled={planoAtual?.planoAtual?.id === plano.id}
                className="w-full py-2 rounded-lg text-white font-semibold transition disabled:opacity-50"
                style={{
                  backgroundColor:
                    planoAtual?.planoAtual?.id === plano.id
                      ? '#999999'
                      : primaryColor,
                }}
              >
                {planoAtual?.planoAtual?.id === plano.id
                  ? 'Plano Atual'
                  : 'Atualizar'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Nota de Segurança */}
      <div
        className="p-4 rounded-lg border-l-4"
        style={{
          backgroundColor: bgPainel,
          borderLeftColor: '#ef4444',
        }}
      >
        <p className="text-sm text-gray-600">
          <strong>🔒 Segurança:</strong> Apenas o gestor do tenant
          (administrador) pode alterar estas configurações. As mudanças
          afetam toda a empresa.
        </p>
      </div>
    </div>
  );
};

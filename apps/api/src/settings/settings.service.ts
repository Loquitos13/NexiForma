// @ts-nocheck – modulo em desenvolvimento, schema settings/metadata nao finalizados
import { Injectable, ForbiddenException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { requireTenantId } from "../common/tenant-scope";

export interface UserThemeSettings {
  primaryColor?: string;
  secondaryColor?: string;
  backgroundColor?: string;
  textColor?: string;
  theme?: 'light' | 'dark' | 'auto';
  fontSize?: 'small' | 'medium' | 'large';
  sidebarCollapsed?: boolean;
  language?: 'pt' | 'en';
}

export interface TenantBrandingSettings {
  logoUrl?: string;
  faviconUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor?: string;
  companyName: string;
  companySlug: string;
  supportEmail: string;
  supportPhone?: string;
  brandingEnabled: boolean;
  footerText?: string;
  customCss?: string;
  theme?: 'light' | 'dark';
}

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Obter definições de tema do utilizador (personalizações locais)
   */
  async obterTemaUtilizador(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        settings: true,
        name: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Utilizador não encontrado');
    }

    // Retornar settings ou defaults
    return {
      userId,
      themeSettings: user.settings || {},
      defaults: this.obterDefaultsUtilizador(),
    };
  }

  /**
   * Atualizar definições de tema do utilizador
   */
  async atualizarTemaUtilizador(
    userId: string,
    settings: UserThemeSettings,
  ) {
    // Validar cores (formato hex)
    if (settings.primaryColor && !this.validarCorHex(settings.primaryColor)) {
      throw new Error('Cor primária inválida. Use formato hexadecimal (#RRGGBB)');
    }
    if (settings.backgroundColor && !this.validarCorHex(settings.backgroundColor)) {
      throw new Error('Cor de fundo inválida');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        settings: settings,
      },
      select: {
        id: true,
        settings: true,
      },
    });

    return {
      sucesso: true,
      mensagem: 'Definições atualizadas',
      settings: updated.settings,
    };
  }

  /**
   * Obter branding do tenant (definições globais da empresa)
   */
  async obterBrandingTenant(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        slug: true,
        name: true,
        settings: true,
        createdAt: true,
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant não encontrado');
    }

    return {
      tenantId,
      branding: tenant.settings || {},
      defaults: this.obterDefaultsTenant(),
    };
  }

  /**
   * Atualizar branding do tenant (apenas gestor de tenant)
   * Requer permission: tenant:admin
   */
  async atualizarBrandingTenant(
    tenantId: string,
    userId: string,
    branding: Partial<TenantBrandingSettings>,
  ) {
    // Verificar permissão: apenas gestor do tenant
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        tenantId: true,
        role: true,
      },
    });

    if (user.tenantId !== tenantId || user.role !== 'tenant_admin') {
      throw new ForbiddenException(
        'Apenas gestor do tenant pode atualizar branding',
      );
    }

    // Validar campos obrigatórios
    if (!branding.companyName || !branding.supportEmail) {
      throw new Error(
        'Nome da empresa e email de suporte são obrigatórios',
      );
    }

    // Validar cores
    if (branding.primaryColor && !this.validarCorHex(branding.primaryColor)) {
      throw new Error('Cor primária inválida');
    }

    // Atualizar tenant settings
    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        settings: branding,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        settings: true,
      },
    });

    return {
      sucesso: true,
      mensagem: 'Branding atualizado com sucesso',
      branding: updated.settings,
    };
  }

  /**
   * Obter paleta de cores CSS para aplicação
   */
  async obterPaletaCores(tenantId: string, userId?: string) {
    // Prioridade: User settings > Tenant branding > Defaults
    let userSettings: Partial<UserThemeSettings> = {};
    if (userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { settings: true },
      });
      userSettings = (user?.settings as Partial<UserThemeSettings>) ?? {};
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });
    const tenantSettings: Partial<UserThemeSettings> = (tenant?.settings as Partial<UserThemeSettings>) ?? {};

    const defaults = this.obterDefaultsUtilizador();

    return {
      primaryColor:
        userSettings.primaryColor ||
        tenantSettings.primaryColor ||
        defaults.primaryColor,
      secondaryColor:
        userSettings.secondaryColor ||
        tenantSettings.secondaryColor ||
        defaults.secondaryColor,
      backgroundColor:
        userSettings.backgroundColor ||
        tenantSettings.backgroundColor ||
        defaults.backgroundColor,
      textColor:
        userSettings.textColor ||
        tenantSettings.textColor ||
        defaults.textColor,
      accentColor: (tenantSettings as any).accentColor ?? defaults.accentColor,
      theme: userSettings.theme ?? (tenantSettings as any).theme ?? "light",
    };
  }

  /**
   * Exportar configuração CSS customizada
   */
  async exportarCssPersonalizado(tenantId: string, userId?: string) {
    const paleta = await this.obterPaletaCores(tenantId, userId);

    const css = `
    :root {
      --color-primary: ${paleta.primaryColor};
      --color-secondary: ${paleta.secondaryColor};
      --color-accent: ${paleta.accentColor};
      --color-background: ${paleta.backgroundColor};
      --color-text: ${paleta.textColor};
      --theme: ${paleta.theme};
    }

    .theme-${paleta.theme} {
      color-scheme: ${paleta.theme};
    }
    `;

    return css;
  }

  /**
   * Validação cor Hex
   */
  private validarCorHex(cor: string): boolean {
    const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    return hexRegex.test(cor);
  }

  /**
   * Defaults para utilizador
   */
  private obterDefaultsUtilizador(): UserThemeSettings {
    return {
      primaryColor: '#2563eb',
      secondaryColor: '#64748b',
      backgroundColor: '#ffffff',
      textColor: '#1e293b',
      theme: 'light',
      fontSize: 'medium',
      sidebarCollapsed: false,
      language: 'pt',
    };
  }

  /**
   * Defaults para tenant
   */
  private obterDefaultsTenant(): Partial<TenantBrandingSettings> {
    return {
      primaryColor: '#2563eb',
      secondaryColor: '#64748b',
      accentColor: '#f59e0b',
      companyName: 'Tenant',
      supportEmail: 'support@tenant.local',
      brandingEnabled: false,
      theme: 'light',
    };
  }

  /**
   * Listar planos de subscrição SaaS (para futura faturação)
   */
  async listarPlanosDisponibles() {
    return [
      {
        id: 'plan_starter',
        nome: 'Starter',
        descricao: 'Perfeito para pequenas entidades de formação',
        preco: 99, // €/mês
        moeda: 'EUR',
        bilhetagem: 'mensal',
        limites: {
          formadores: 5,
          cursos: 10,
          formandos: 100,
          armazenamento: '5GB',
          suporteTecnico: 'email',
        },
        features: [
          'Gestão básica de cursos',
          'Certificados',
          'Notificações',
          'CRM básico',
        ],
      },
      {
        id: 'plan_professional',
        nome: 'Professional',
        descricao: 'Para entidades em crescimento',
        preco: 299, // €/mês
        moeda: 'EUR',
        bilhetagem: 'mensal',
        limites: {
          formadores: 50,
          cursos: 100,
          formandos: 1000,
          armazenamento: '50GB',
          suporteTecnico: 'email + telefone',
        },
        features: [
          'Tudo do Starter',
          'Inspeção automática DGERT',
          'QR verificável',
          'CRM avançado',
          'Relatórios detalhados',
          'API REST',
        ],
      },
      {
        id: 'plan_enterprise',
        nome: 'Enterprise',
        descricao: 'Para grandes operações',
        preco: 999, // €/mês
        moeda: 'EUR',
        bilhetagem: 'mensal',
        limites: {
          formadores: 'ilimitado',
          cursos: 'ilimitado',
          formandos: 'ilimitado',
          armazenamento: '500GB',
          suporteTecnico: 'telefone 24/7 + dedicado',
        },
        features: [
          'Tudo do Professional',
          'SIGO API integrado',
          'Assinatura qualificada CMD',
          'PWA customizado',
          'Integração RGPD',
          'Suporte customizado',
          'SLA garantido 99.9%',
        ],
      },
    ];
  }

  /**
   * Obter plano atual do tenant
   */
  async obterPlanoTenant(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        subscriptionPlan: true,
        subscriptionStatus: true,
        subscriptionEndsAt: true,
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant não encontrado');
    }

    const plano = (await this.listarPlanosDisponibles()).find(
      (p) => p.id === tenant.subscriptionPlan,
    );

    return {
      tenantId,
      planoAtual: plano || null,
      status: tenant.subscriptionStatus,
      terminaEm: tenant.subscriptionEndsAt,
      diasRestantes:
        tenant.subscriptionEndsAt &&
        Math.ceil(
          (tenant.subscriptionEndsAt.getTime() - Date.now()) /
            (1000 * 60 * 60 * 24),
        ),
    };
  }
}

'use server';

import { cookies } from 'next/headers';

/**
 * Tipos de roles no sistema
 */
export enum TenantUserRole {
  ADMIN = 'ADMIN',              // Gestor da entidade (tenant admin)
  COORDENADOR = 'COORDENADOR',  // Coordenador formativo
  FORMADOR = 'FORMADOR',        // Formador
  FORMANDO = 'FORMANDO',        // Utilizador final/formando
  FINANCEIRO = 'FINANCEIRO',    // Gestor financeiro
}

/**
 * Tipos de utilizadores no sistema
 */
export enum UserType {
  SUPER_ADMIN = 'SUPER_ADMIN',  // Admin NexiForma
  TENANT_USER = 'TENANT_USER',  // Utilizador da entidade
}

/**
 * Interface de utilizador autenticado
 */
export interface AuthUser {
  id: string;
  email: string;
  nome: string;
  tenantId: string;
  role: TenantUserRole;
  userType: UserType;
  isSuperAdmin: boolean;
  settings?: {
    theme?: 'light' | 'dark';
    primaryColor?: string;
    fontSize?: 'small' | 'medium' | 'large';
    language?: 'pt' | 'en';
  };
}

/**
 * Permissões por role
 */
export const ROLE_PERMISSIONS = {
  [TenantUserRole.ADMIN]: {
    // Tenant Admin – acesso total empresa
    canViewCRM: true,
    canCreateEntidade: true,
    canEditEntidade: true,
    canDeleteEntidade: true,
    canViewPropostas: true,
    canCreateProposta: true,
    canEditProposta: true,
    canViewFormadores: true,
    canEditFormadores: true,
    canViewFinanceiro: true,
    canEditFinanceiro: true,
    canEditTenantSettings: true,
    canViewTenantSettings: true,
    canManageUsers: true,
    canManageBranding: true,
    canUpgradePlan: true,
  },
  [TenantUserRole.COORDENADOR]: {
    // Coordenador – acesso leitura + edição ações
    canViewCRM: true,
    canCreateEntidade: false,
    canEditEntidade: true,
    canDeleteEntidade: false,
    canViewPropostas: true,
    canCreateProposta: true,
    canEditProposta: true,
    canViewFormadores: true,
    canEditFormadores: false,
    canViewFinanceiro: true,
    canEditFinanceiro: false,
    canEditTenantSettings: false,
    canViewTenantSettings: true,
    canManageUsers: false,
    canManageBranding: false,
    canUpgradePlan: false,
  },
  [TenantUserRole.FORMADOR]: {
    // Formador – acesso seus dados + formandos
    canViewCRM: false,
    canCreateEntidade: false,
    canEditEntidade: false,
    canDeleteEntidade: false,
    canViewPropostas: false,
    canCreateProposta: false,
    canEditProposta: false,
    canViewFormadores: true,
    canEditFormadores: true,  // Apenas seus dados
    canViewFinanceiro: false,
    canEditFinanceiro: false,
    canEditTenantSettings: false,
    canViewTenantSettings: true,
    canManageUsers: false,
    canManageBranding: false,
    canUpgradePlan: false,
  },
  [TenantUserRole.FORMANDO]: {
    // Formando – acesso apenas própios dados
    canViewCRM: false,
    canCreateEntidade: false,
    canEditEntidade: false,
    canDeleteEntidade: false,
    canViewPropostas: false,
    canCreateProposta: false,
    canEditProposta: false,
    canViewFormadores: false,
    canEditFormadores: false,
    canViewFinanceiro: false,
    canEditFinanceiro: false,
    canEditTenantSettings: false,
    canViewTenantSettings: true,
    canManageUsers: false,
    canManageBranding: false,
    canUpgradePlan: false,
  },
  [TenantUserRole.FINANCEIRO]: {
    // Financeiro – acesso dados financeiros
    canViewCRM: true,
    canCreateEntidade: false,
    canEditEntidade: false,
    canDeleteEntidade: false,
    canViewPropostas: true,
    canCreateProposta: false,
    canEditProposta: false,
    canViewFormadores: false,
    canEditFormadores: false,
    canViewFinanceiro: true,
    canEditFinanceiro: true,
    canEditTenantSettings: false,
    canViewTenantSettings: true,
    canManageUsers: false,
    canManageBranding: false,
    canUpgradePlan: false,
  },
};

/**
 * Obter utilizador atual do JWT
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (!token) return null;

    // Decode JWT (simplificado – em produção usar jose library)
    // Este é um placeholder; o servidor set o cookie seguro
    const response = await fetch('http://localhost:3000/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });

    if (!response.ok) return null;

    const user: AuthUser = await response.json();
    return user;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

/**
 * Verificar se utilizador tem permissão
 */
export function hasPermission(user: AuthUser | null, permission: string): boolean {
  if (!user) return false;

  // Super admin tem acesso a tudo
  if (user.isSuperAdmin) return true;

  const rolePermissions = ROLE_PERMISSIONS[user.role];
  return rolePermissions?.[permission as keyof typeof rolePermissions] === true;
}

/**
 * Verificar se utilizador tem role específico
 */
export function hasRole(user: AuthUser | null, roles: TenantUserRole | TenantUserRole[]): boolean {
  if (!user) return false;

  const rolesArray = Array.isArray(roles) ? roles : [roles];
  return rolesArray.includes(user.role);
}

/**
 * Verificar se é super admin
 */
export function isSuperAdmin(user: AuthUser | null): boolean {
  return user?.isSuperAdmin === true;
}

/**
 * Verificar se é tenant admin
 */
export function isTenantAdmin(user: AuthUser | null): boolean {
  return user?.role === TenantUserRole.ADMIN;
}

/**
 * Verificar se é formador
 */
export function isFormador(user: AuthUser | null): boolean {
  return user?.role === TenantUserRole.FORMADOR;
}

/**
 * Verificar se é formando
 */
export function isFormando(user: AuthUser | null): boolean {
  return user?.role === TenantUserRole.FORMANDO;
}

/**
 * Obter descrição do role
 */
export function getRoleLabel(role: TenantUserRole): string {
  const labels = {
    [TenantUserRole.ADMIN]: 'Gestor da Entidade',
    [TenantUserRole.COORDENADOR]: 'Coordenador',
    [TenantUserRole.FORMADOR]: 'Formador',
    [TenantUserRole.FORMANDO]: 'Utilizador',
    [TenantUserRole.FINANCEIRO]: 'Financeiro',
  };
  return labels[role] || role;
}

/**
 * Obter cor do badge por role
 */
export function getRoleColor(role: TenantUserRole): string {
  const colors = {
    [TenantUserRole.ADMIN]: 'bg-red-100 text-red-800',
    [TenantUserRole.COORDENADOR]: 'bg-blue-100 text-blue-800',
    [TenantUserRole.FORMADOR]: 'bg-green-100 text-green-800',
    [TenantUserRole.FORMANDO]: 'bg-gray-100 text-gray-800',
    [TenantUserRole.FINANCEIRO]: 'bg-yellow-100 text-yellow-800',
  };
  return colors[role] || 'bg-gray-100 text-gray-800';
}

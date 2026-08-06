# Checklist de experimentação - Role Comercial

> Conta de teste com perfil **Comercial**. Marca cada ponto após experimentar.
> Home típica: `/portal/crm/leads`

**Pré-requisitos**
- [ ] Consegues entrar no portal com a conta comercial (email/password ou Google/Microsoft)
- [ ] Se o email existir em várias entidades, aparece o modal de escolha de tenant e o login conclui na correcta
- [ ] Vês o menu CRM (Leads, Notas, Sugestões IA, Clientes, Propostas, …) e **não** vês Faturas / Dados de faturação (só gestor)

---

## 1. Leads (`/portal/crm/leads`)

- [ ] Criar um lead novo (nome, email/telefone, origem se existir)
- [ ] Filtrar / pesquisar leads
- [ ] Avançar estados: **Novo → Contactado → Qualificado**
- [ ] Marcar um lead como **Perdido** (com motivo, se pedido)
- [ ] **Converter** um lead qualificado em cliente (entidade B2B)
- [ ] Após conversão, abrir a ficha do cliente criado

## 2. Clientes (`/portal/clientes`)

- [ ] Listar clientes e abrir uma ficha
- [ ] Editar dados básicos (contacto, morada, NIF se editável)
- [ ] Ver histórico / propostas / notas associadas na ficha
- [ ] Confirmar que o cliente convertido a partir do lead aparece na lista

## 3. Parceiros (`/portal/parceiros`)

- [ ] Abrir a lista de parceiros
- [ ] Adicionar um parceiro a partir de um **cliente existente** e definir desconto %
- [ ] Editar o desconto de um parceiro já listado
- [ ] Confirmar que não dá para criar parceiro “do zero” (só via clientes)

## 4. Propostas (`/portal/propostas`)

- [ ] Criar proposta em **Rascunho** ligada a um cliente
- [ ] Editar linhas / valores / título enquanto está em rascunho
- [ ] Gerar / pré-visualizar **PDF**
- [ ] **Enviar** proposta ao cliente (email) → estado **Enviada**
- [ ] Confirmar que em **Rascunho** e **Enviada** **não** aparece o botão **Faturar**
- [ ] Reenviar proposta já enviada
- [ ] Simular resposta do cliente (aceitar / rejeitar) se tiveres link de resposta ou ajuda do gestor
- [ ] Com proposta **Aceite**, verificar se vês acções disponíveis (PDF, reenviar) e que faturação fica a cargo do **gestor**

## 5. Notas comerciais (`/portal/crm/interaccoes`)

- [ ] Criar uma nota / interacção ligada a cliente ou lead
- [ ] Registar tipos diferentes (chamada, email, reunião, outro)
- [ ] Editar ou consultar notas existentes
- [ ] Filtrar por cliente / data / tipo
- [ ] Se Teams estiver configurado: criar / abrir reunião e terminar reunião com nota

## 6. Calendário comercial (`/portal/calendario`)

- [ ] Ver eventos / reuniões no calendário
- [ ] Criar um compromisso / reunião comercial
- [ ] (Opcional) Criar sala **Teams** se a integração estiver activa
- [ ] Abrir o evento e confirmar dados / link da reunião

## 7. Sugestões IA (`/portal/crm/sugestoes-ia`)

- [ ] Abrir a inbox de sugestões
- [ ] Ler o detalhe de uma sugestão pendente
- [ ] **Aceitar** / executar uma sugestão (ex.: follow-up, nota)
- [ ] **Rejeitar** / dispensar outra
- [ ] Confirmar que o badge de pendentes actualiza após acção

## 8. Notificações e sessão

- [ ] Abrir o sino de notificações e marcar como lida
- [ ] Usar a pesquisa global do portal (cliente / proposta / lead)
- [ ] Logout e novo login - sessão e tenant correcto
- [ ] “Memorizar sessão” (opcional) e reabrir o browser

---

## Fora do alcance do comercial (só validar que está bloqueado)

- [ ] **Faturas** e **Dados de faturação** não aparecem / acesso negado
- [ ] **Contratos** não estão acessíveis ao comercial
- [ ] **Dashboard CRM** completo / Audit / Config CRM (gestor) não estão no teu menu
- [ ] Pedir ao gestor para faturar uma proposta **Aceite** e confirmar o ciclo completo do lado dele

---

## Feedback rápido (preencher no fim)

| Tema | OK? | Notas / bugs |
|------|-----|----------------|
| Login / multi-tenant | ☐ | |
| Leads → cliente | ☐ | |
| Propostas (rascunho → enviada) | ☐ | |
| Notas / reuniões / Teams | ☐ | |
| Calendário | ☐ | |
| Sugestões IA | ☐ | |
| Performance / UX geral | ☐ | |

**Testador:** _______________  
**Tenant / data:** _______________  
**Browser:** _______________

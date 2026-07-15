import { Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ServerErrorAlertFilter } from "./common/server-error-alert.filter";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";
import { ThrottlerBehindProxyGuard } from "./common/throttler-behind-proxy.guard";
import { apiGlobalLimitPerMin, DDOS_WINDOW_MS } from "./common/ddos-throttle.config";
import { resolveEnvFilePaths } from "./config/env-paths";
import { ProductionConfigModule } from "./config/production-config.module";
import { AppController } from "./app.controller";
import { PrismaModule } from "./prisma/prisma.module";
import { CommonModule } from "./common/common.module";
import { TenantRlsInterceptor } from "./prisma/tenant-rls.interceptor";
import { MailModule } from "./mail/mail.module";
import { AuthModule } from "./auth/auth.module";
import { HealthModule } from "./health/health.module";
import { TenantsModule } from "./tenants/tenants.module";
import { PortalModule } from "./portal/portal.module";
import { CursosModule } from "./cursos/cursos.module";
import { AcoesFormacaoModule } from "./acoes-formacao/acoes-formacao.module";
import { FormandosModule } from "./formandos/formandos.module";
import { FormadoresModule } from "./formadores/formadores.module";
import { EntidadesClienteModule } from "./entidades-cliente/entidades-cliente.module";
import { PropostasModule } from "./propostas/propostas.module";
import { MatriculasModule } from "./matriculas/matriculas.module";
import { TurmasModule } from "./turmas/turmas.module";
import { CronogramasModule } from "./cronogramas/cronogramas.module";
import { SessoesFormacaoModule } from "./sessoes-formacao/sessoes-formacao.module";
import { FolhasPresencaModule } from "./folhas-presenca/folhas-presenca.module";
import { SumariosModule } from "./sumarios/sumarios.module";
import { DossiePedagogicoModule } from "./dossie-pedagogico/dossie-pedagogico.module";
import { ComplianceModule } from "./compliance/compliance.module";
import { CertificadosModule } from "./certificados/certificados.module";
import { NotificacoesModule } from "./notificacoes/notificacoes.module";
import { VerificacaoModule } from "./verificacao/verificacao.module";
import { CmdModule } from "./cmd/cmd.module";
import { UsersModule } from "./users/users.module";
import { BillingModule } from "./billing/billing.module";
import { AuditModule } from "./audit/audit.module";
import { LmsModule } from "./lms/lms.module";
import { AssiduidadeModule } from "./assiduidade/assiduidade.module";
import { ControlPlaneModule } from "./control-plane/control-plane.module";
import { ConteudosLmsModule } from "./conteudos-lms/conteudos-lms.module";
import { QueueModule } from "./queue/queue.module";
import { ObservabilityModule } from "./observability/observability.module";
import { SigoModule } from "./sigo/sigo.module";
import { StorageModule } from "./storage/storage.module";
import { IntegracoesModule } from "./integracoes/integracoes.module";
import { QuizzesModule } from "./quizzes/quizzes.module";
import { CatalogoUfcdModule } from "./catalogo-ufcd/catalogo-ufcd.module";
import { RgpdModule } from "./rgpd/rgpd.module";
import { ConsentModule } from "./consent/consent.module";
import { DocumentosModule } from "./documentos/documentos.module";
import { RelatoriosModule } from "./relatorios/relatorios.module";
import { PublicApiModule } from "./public-api/public-api.module";
import { PublicSalesModule } from "./public-sales/public-sales.module";
import { SupportModule } from "./support/support.module";
import { AvaliacoesModule } from "./avaliacoes/avaliacoes.module";
import { CrmModule } from "./crm/crm.module";
import { FaturasModule } from "./faturas/faturas.module";
import { EnterpriseModule } from "./enterprise/enterprise.module";
import { OpenApiModule } from "./openapi/openapi.module";
import { FormacoesModule } from "./formacoes/formacoes.module";
import { CalendarioModule } from "./calendario/calendario.module";
import { GuideModule } from "./guide/guide.module";
import { ImpersonationReadonlyInterceptor } from "./auth/impersonation-readonly.interceptor";
import { MustChangePasswordInterceptor } from "./auth/must-change-password.interceptor";
import { StructuredLogInterceptor } from "./observability/structured-log.interceptor";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: resolveEnvFilePaths(),
    }),
    ProductionConfigModule,
    ThrottlerModule.forRoot([
      {
        name: "default",
        ttl: DDOS_WINDOW_MS,
        limit: apiGlobalLimitPerMin(),
      },
    ]),
    PrismaModule,
    CommonModule,
    AuditModule,
    MailModule,
    AuthModule,
    HealthModule,
    TenantsModule,
    PortalModule,
    CursosModule,
    AcoesFormacaoModule,
    TurmasModule,
    FormandosModule,
    FormadoresModule,
    EntidadesClienteModule,
    PropostasModule,
    MatriculasModule,
    CronogramasModule,
    SessoesFormacaoModule,
    FolhasPresencaModule,
    SumariosModule,
    DossiePedagogicoModule,
    ComplianceModule,
    CertificadosModule,
    NotificacoesModule,
    VerificacaoModule,
    CmdModule,
    UsersModule,
    BillingModule,
    LmsModule,
    AssiduidadeModule,
    ControlPlaneModule,
    ConteudosLmsModule,
    QueueModule,
    ObservabilityModule,
    SigoModule,
    StorageModule,
    IntegracoesModule,
    QuizzesModule,
    CatalogoUfcdModule,
    RgpdModule,
    ConsentModule,
    DocumentosModule,
    RelatoriosModule,
    PublicApiModule,
    PublicSalesModule,
    SupportModule,
    FormacoesModule,
    CalendarioModule,
    AvaliacoesModule,
    CrmModule,
    FaturasModule,
    EnterpriseModule,
    OpenApiModule,
    GuideModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerBehindProxyGuard,
    },
    {
      provide: APP_FILTER,
      useClass: ServerErrorAlertFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantRlsInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ImpersonationReadonlyInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: MustChangePasswordInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: StructuredLogInterceptor,
    },
  ],
})
export class AppModule {}

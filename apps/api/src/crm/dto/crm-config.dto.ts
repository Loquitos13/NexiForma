import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import {
  CRM_WEBHOOK_EVENTS,
  type CrmAutomationAction,
  type CrmAutomationRule,
  type CrmAutomationTrigger,
  type CrmCustomFieldDef,
  type CrmCustomFieldEntity,
  type CrmCustomFieldType,
  type CrmOutboundWebhook,
  type CrmWebhookEvent,
} from "@nexiforma/shared";

class CustomFieldDefDto {
  @IsString()
  id!: string;

  @IsIn(["lead", "entidade", "proposta"])
  entity!: CrmCustomFieldEntity;

  @IsString()
  @MaxLength(64)
  key!: string;

  @IsString()
  @MaxLength(120)
  label!: string;

  @IsIn(["text", "number", "date", "select"])
  type!: CrmCustomFieldType;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];

  @IsOptional()
  @IsBoolean()
  required?: boolean;
}

class OutboundWebhookDto {
  @IsString()
  id!: string;

  @IsUrl({ require_tld: false })
  url!: string;

  @IsArray()
  @IsIn(CRM_WEBHOOK_EVENTS, { each: true })
  events!: CrmWebhookEvent[];

  @IsOptional()
  @IsString()
  secret?: string;

  @IsBoolean()
  active!: boolean;
}

class AutomationRuleDto {
  @IsString()
  id!: string;

  @IsString()
  @MaxLength(120)
  name!: string;

  @IsIn(["LEAD_CREATED", "LEAD_STALE", "PROPOSTA_SENT"])
  trigger!: CrmAutomationTrigger;

  @IsOptional()
  @IsInt()
  @Min(1)
  daysAfter?: number;

  @IsIn(["CREATE_NOTA", "CREATE_SUGESTAO", "WEBHOOK"])
  action!: CrmAutomationAction;

  @IsBoolean()
  active!: boolean;
}

class EmailSyncConfigDto {
  @IsIn(["GMAIL", "M365"])
  provider!: "GMAIL" | "M365";

  @IsBoolean()
  enabled!: boolean;

  @IsOptional()
  @IsString()
  mailbox?: string;
}

export class UpdateCrmConfigDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomFieldDefDto)
  customFieldDefs?: CustomFieldDefDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OutboundWebhookDto)
  outboundWebhooks?: OutboundWebhookDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AutomationRuleDto)
  automations?: AutomationRuleDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => EmailSyncConfigDto)
  emailSync?: EmailSyncConfigDto;
}

export class UpdateLeadMetadataDto {
  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown>;
}

import { IsOptional, IsString, IsUUID } from "class-validator";

export class SincronizarAssiduidadeDto {
  @IsUUID()
  turmaId!: string;
}

export class ZoomWebhookDto {
  @IsString()
  meetingId!: string;

  @IsString()
  participantEmail!: string;

  @IsString()
  event!: "participant_joined" | "participant_left";

  @IsOptional()
  @IsString()
  timestamp?: string;
}

export class TeamsWebhookDto {
  @IsString()
  meetingId!: string;

  @IsString()
  participantEmail!: string;

  @IsString()
  event!: "participant_joined" | "participant_left";

  @IsOptional()
  @IsString()
  timestamp?: string;
}

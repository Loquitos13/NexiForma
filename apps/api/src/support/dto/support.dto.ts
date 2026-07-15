import { IsEmail, IsIn, IsOptional, IsString, Length, Matches } from "class-validator";

export class CreateSupportTicketDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(2, 64)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: "Slug: apenas minúsculas, números e hífens.",
  })
  slug!: string;

  @IsString()
  @Length(3, 200)
  subject!: string;

  @IsString()
  @Length(10, 8000)
  body!: string;
}

const TICKET_STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;

export class UpdateSupportTicketDto {
  @IsIn(TICKET_STATUSES)
  status!: (typeof TICKET_STATUSES)[number];
}

import { IsBoolean } from "class-validator";

export class UpdateConsentDto {
  @IsBoolean()
  accepted!: boolean;
}

import { IsEmail, IsString, MinLength } from "class-validator";

export class TenantLoginDto {
  @IsString()
  @MinLength(1)
  tenantSlug!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}

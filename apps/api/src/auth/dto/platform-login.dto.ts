import { IsBoolean, IsEmail, IsOptional, IsString, MinLength } from "class-validator";

export class PlatformLoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;

  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}

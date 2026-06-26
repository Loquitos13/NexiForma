import { IsObject } from "class-validator";

export class ScormCmiCommitDto {
  @IsObject()
  cmi!: Record<string, string>;
}

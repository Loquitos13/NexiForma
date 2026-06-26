import { Type } from "class-transformer";

import {

  ArrayMaxSize,

  IsArray,

  IsIn,

  IsOptional,

  IsString,

  MaxLength,

  MinLength,

  ValidateNested,

} from "class-validator";



class GuideHistoryTurnDto {

  @IsIn(["user", "assistant"])

  role!: "user" | "assistant";



  @IsString()

  @MaxLength(1000)

  text!: string;

}



export class GuideChatDto {

  @IsString()

  @MinLength(1)

  @MaxLength(500)

  message!: string;



  @IsString()

  @MaxLength(200)

  pathname!: string;



  @IsOptional()

  @IsArray()

  @ArrayMaxSize(10)

  @ValidateNested({ each: true })

  @Type(() => GuideHistoryTurnDto)

  history?: GuideHistoryTurnDto[];

}


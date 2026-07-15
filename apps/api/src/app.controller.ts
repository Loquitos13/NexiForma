import { Controller, Get } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { APP_NAME } from "@nexiforma/shared";
import { Public } from "./auth/decorators/public.decorator";

@Public()
@SkipThrottle()
@Controller()
export class AppController {
  @Get()
  root() {
    return { name: APP_NAME, message: "API Gateway tenant – ver /v1/health" };
  }
}

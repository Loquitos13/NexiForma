import { Controller, Get } from "@nestjs/common";
import { APP_NAME } from "@nexiforma/shared";

@Controller()
export class AppController {
  @Get()
  root() {
    return { name: APP_NAME, message: "API Gateway tenant – ver /v1/health" };
  }
}

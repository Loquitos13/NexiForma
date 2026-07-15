import { Controller, Get } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { Public } from "../auth/decorators/public.decorator";

@Public()
@SkipThrottle()
@Controller("health")
export class HealthController {
  @Get()
  check() {
    return { status: "ok", service: "nexiforma-api", ts: new Date().toISOString() };
  }
}

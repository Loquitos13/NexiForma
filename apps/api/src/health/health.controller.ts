import { Controller, Get } from "@nestjs/common";

@Controller("health")
export class HealthController {
  @Get()
  check() {
    return { status: "ok", service: "nexiforma-api", ts: new Date().toISOString() };
  }
}

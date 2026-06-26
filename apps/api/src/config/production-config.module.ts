import { Global, Module, OnModuleInit } from "@nestjs/common";
import { validateProductionConfig } from "./production-config";

@Global()
@Module({})
export class ProductionConfigModule implements OnModuleInit {
  onModuleInit() {
    validateProductionConfig();
  }
}

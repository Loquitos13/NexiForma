import { Global, Module } from "@nestjs/common";
import { FormadorScopeService } from "./formador-scope.service";

@Global()
@Module({
  providers: [FormadorScopeService],
  exports: [FormadorScopeService],
})
export class CommonModule {}

import { Global, Module } from "@nestjs/common";
import { AssiduidadeModule } from "../assiduidade/assiduidade.module";
import { AssiduidadeQueueService } from "./assiduidade-queue.service";

@Global()
@Module({
  imports: [AssiduidadeModule],
  providers: [AssiduidadeQueueService],
  exports: [AssiduidadeQueueService],
})
export class QueueModule {}

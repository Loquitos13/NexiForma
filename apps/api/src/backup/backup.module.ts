import { Module } from "@nestjs/common";
import { StorageModule } from "../storage/storage.module";
import { DbBackupService } from "./db-backup.service";
import { DbBackupSchedulerService } from "./db-backup-scheduler.service";

@Module({
  imports: [StorageModule],
  providers: [DbBackupService, DbBackupSchedulerService],
  exports: [DbBackupService],
})
export class BackupModule {}

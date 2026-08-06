-- IDs de onlineMeetings do Microsoft Graph excedem VARCHAR(128)
ALTER TABLE "public"."interaccoes_comerciais"
  ALTER COLUMN "teams_meeting_id" TYPE TEXT;

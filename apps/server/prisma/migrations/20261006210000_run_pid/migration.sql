-- Track the provider CLI process so a restart can clean up orphaned process trees.
ALTER TABLE "Run" ADD COLUMN "pid" INTEGER;

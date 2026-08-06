-- CreateTable
CREATE TABLE "audit_logs" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "user_id" uuid,
    "action" text NOT NULL,
    "module" text NOT NULL,
    "entity_type" text,
    "entity_id" uuid,
    "ip_address" text,
    "user_agent" text,
    "request_method" text,
    "request_path" text,
    "response_status" integer,
    "metadata" jsonb,
    "created_at" timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_module_idx" ON "audit_logs"("module");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

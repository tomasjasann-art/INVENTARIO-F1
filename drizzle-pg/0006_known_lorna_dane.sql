ALTER TABLE "app_users" ADD COLUMN "username" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "app_users" ADD COLUMN "auth_user_id" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "app_users" ADD COLUMN "must_change_password" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "app_users" ADD COLUMN "password_updated_at" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "app_users" ADD COLUMN "last_login_at" text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "app_users_username_unique" ON "app_users" USING btree ("username") WHERE "app_users"."username" <> '';--> statement-breakpoint
CREATE UNIQUE INDEX "app_users_auth_user_id_unique" ON "app_users" USING btree ("auth_user_id") WHERE "app_users"."auth_user_id" <> '';
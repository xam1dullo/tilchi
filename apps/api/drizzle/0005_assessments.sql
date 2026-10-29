CREATE TYPE "public"."question_type" AS ENUM('single', 'multi', 'speaking');--> statement-breakpoint
CREATE TYPE "public"."question_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TYPE "public"."attempt_status" AS ENUM('assigned', 'submitted', 'graded', 'missed');--> statement-breakpoint
CREATE TABLE "questions" (
  "id" uuid PRIMARY KEY NOT NULL,
  "type" "question_type" NOT NULL,
  "prompt" text NOT NULL,
  "options" jsonb,
  "answer_key" jsonb,
  "status" "question_status" DEFAULT 'draft' NOT NULL,
  "author_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  CONSTRAINT "questions_shape" CHECK (("questions"."type" = 'speaking' and "questions"."options" is null and "questions"."answer_key" is null)
        or ("questions"."type" <> 'speaking' and "questions"."options" is not null and "questions"."answer_key" is not null))
);--> statement-breakpoint
CREATE TABLE "tests" (
  "id" uuid PRIMARY KEY NOT NULL,
  "title" text NOT NULL,
  "author_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "test_questions" (
  "test_id" uuid NOT NULL,
  "question_id" uuid NOT NULL,
  "position" integer NOT NULL,
  CONSTRAINT "test_questions_test_id_question_id_pk" PRIMARY KEY("test_id","question_id")
);--> statement-breakpoint
CREATE TABLE "assignments" (
  "id" uuid PRIMARY KEY NOT NULL,
  "test_id" uuid NOT NULL,
  "group_id" uuid NOT NULL,
  "deadline" timestamp with time zone NOT NULL,
  "created_by" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "attempts" (
  "id" uuid PRIMARY KEY NOT NULL,
  "assignment_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "status" "attempt_status" DEFAULT 'assigned' NOT NULL,
  "answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "score" integer,
  "result" jsonb,
  "feedback" text,
  "submitted_at" timestamp with time zone,
  "graded_at" timestamp with time zone,
  "graded_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "attempts_state_shape" CHECK (("attempts"."status" not in ('submitted', 'graded') or "attempts"."submitted_at" is not null)
        and ("attempts"."status" <> 'graded'
          or ("attempts"."score" is not null and "attempts"."graded_at" is not null and "attempts"."graded_by" is not null)))
);--> statement-breakpoint
CREATE TABLE "audio_objects" (
  "attempt_id" uuid NOT NULL,
  "question_id" uuid NOT NULL,
  "object_key" text NOT NULL,
  "content_type" text NOT NULL,
  "size" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "audio_objects_attempt_id_question_id_pk" PRIMARY KEY("attempt_id","question_id"),
  CONSTRAINT "audio_objects_object_key_unique" UNIQUE("object_key")
);--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tests" ADD CONSTRAINT "tests_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_questions" ADD CONSTRAINT "test_questions_test_id_tests_id_fk" FOREIGN KEY ("test_id") REFERENCES "public"."tests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_questions" ADD CONSTRAINT "test_questions_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_test_id_tests_id_fk" FOREIGN KEY ("test_id") REFERENCES "public"."tests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_assignment_id_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_graded_by_users_id_fk" FOREIGN KEY ("graded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audio_objects" ADD CONSTRAINT "audio_objects_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audio_objects" ADD CONSTRAINT "audio_objects_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "test_questions_position_idx" ON "test_questions" USING btree ("test_id","position");--> statement-breakpoint
CREATE INDEX "test_questions_question_idx" ON "test_questions" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "assignments_group_idx" ON "assignments" USING btree ("group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "attempts_assignment_user_idx" ON "attempts" USING btree ("assignment_id","user_id");--> statement-breakpoint
CREATE INDEX "attempts_user_idx" ON "attempts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "attempts_open_idx" ON "attempts" USING btree ("assignment_id") WHERE "attempts"."status" = 'assigned';

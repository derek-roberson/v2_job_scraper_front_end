alter table "public"."queries" drop constraint "queries_keywords_check";

alter table "public"."queries" drop constraint "queries_work_types_check";

alter table "public"."notification_preferences" drop column "timezone";

alter table "public"."notification_preferences" alter column "email_notifications" set default true;

alter table "public"."queries" add constraint "queries_keywords_check" CHECK ((((length(TRIM(BOTH FROM keywords)) >= 2) AND (length(TRIM(BOTH FROM keywords)) <= 500)) AND (keywords ~ '^[a-zA-Z0-9\s\-\+\#\.\,\(\)]+$'::text))) not valid;

alter table "public"."queries" validate constraint "queries_keywords_check";

alter table "public"."queries" add constraint "queries_work_types_check" CHECK ((((array_length(work_types, 1) >= 1) AND (array_length(work_types, 1) <= 3)) AND (work_types <@ ARRAY[1, 2, 3]))) not valid;

alter table "public"."queries" validate constraint "queries_work_types_check";



alter table "public"."queries" drop constraint "queries_keywords_check";

alter table "public"."queries" drop constraint "queries_work_types_check";

alter table "public"."notification_preferences" alter column "email_notifications" set default false;

alter table "public"."notification_preferences" alter column "timezone" set data type text using "timezone"::text;

alter table "public"."notification_preferences" add constraint "notification_preferences_timezone_format" CHECK (((timezone IS NULL) OR (timezone = ANY (ARRAY['America/New_York'::text, 'America/Chicago'::text, 'America/Denver'::text, 'America/Phoenix'::text, 'America/Los_Angeles'::text, 'America/Anchorage'::text, 'Pacific/Honolulu'::text, 'UTC'::text])))) not valid;

alter table "public"."notification_preferences" validate constraint "notification_preferences_timezone_format";

alter table "public"."notification_preferences" add constraint "notification_preferences_timezone_required_for_email" CHECK (((email_notifications = false) OR ((email_notifications = true) AND (timezone IS NOT NULL) AND (length(timezone) > 0)))) not valid;

alter table "public"."notification_preferences" validate constraint "notification_preferences_timezone_required_for_email";

alter table "public"."queries" add constraint "queries_keywords_check" CHECK ((((length(TRIM(BOTH FROM keywords)) >= 2) AND (length(TRIM(BOTH FROM keywords)) <= 500)) AND (keywords ~ '^[a-zA-Z0-9\s\-\+\#\.\,\(\)]+$'::text))) not valid;

alter table "public"."queries" validate constraint "queries_keywords_check";

alter table "public"."queries" add constraint "queries_work_types_check" CHECK ((((array_length(work_types, 1) >= 1) AND (array_length(work_types, 1) <= 3)) AND (work_types <@ ARRAY[1, 2, 3]))) not valid;

alter table "public"."queries" validate constraint "queries_work_types_check";



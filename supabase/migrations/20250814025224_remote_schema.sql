drop extension if exists "pg_net";

drop policy "Users can update own jobs" on "public"."jobs";

alter table "public"."queries" drop constraint "queries_keywords_check";

alter table "public"."queries" drop constraint "queries_work_types_check";

alter table "public"."queries" add constraint "queries_keywords_check" CHECK ((((length(TRIM(BOTH FROM keywords)) >= 2) AND (length(TRIM(BOTH FROM keywords)) <= 500)) AND (keywords ~ '^[a-zA-Z0-9\s\-\+\#\.\,\(\)]+$'::text))) not valid;

alter table "public"."queries" validate constraint "queries_keywords_check";

alter table "public"."queries" add constraint "queries_work_types_check" CHECK ((((array_length(work_types, 1) >= 1) AND (array_length(work_types, 1) <= 3)) AND (work_types <@ ARRAY[1, 2, 3]))) not valid;

alter table "public"."queries" validate constraint "queries_work_types_check";


  create policy "Users can update own jobs"
  on "public"."jobs"
  as permissive
  for update
  to public
using ((auth.uid() = user_id))
with check (((auth.uid() = user_id) AND (title = ( SELECT jobs_1.title
   FROM jobs jobs_1
  WHERE (jobs_1.id = jobs_1.id))) AND (company = ( SELECT jobs_1.company
   FROM jobs jobs_1
  WHERE (jobs_1.id = jobs_1.id))) AND (link = ( SELECT jobs_1.link
   FROM jobs jobs_1
  WHERE (jobs_1.id = jobs_1.id))) AND (NOT (location IS DISTINCT FROM ( SELECT jobs_1.location
   FROM jobs jobs_1
  WHERE (jobs_1.id = jobs_1.id)))) AND (NOT (posted IS DISTINCT FROM ( SELECT jobs_1.posted
   FROM jobs jobs_1
  WHERE (jobs_1.id = jobs_1.id)))) AND (NOT (scraped_at IS DISTINCT FROM ( SELECT jobs_1.scraped_at
   FROM jobs jobs_1
  WHERE (jobs_1.id = jobs_1.id)))) AND (NOT (query_id IS DISTINCT FROM ( SELECT jobs_1.query_id
   FROM jobs jobs_1
  WHERE (jobs_1.id = jobs_1.id)))) AND (NOT (created_at IS DISTINCT FROM ( SELECT jobs_1.created_at
   FROM jobs jobs_1
  WHERE (jobs_1.id = jobs_1.id))))));




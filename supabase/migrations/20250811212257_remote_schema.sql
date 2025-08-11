

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."check_rate_limit"("p_user_id" "uuid", "p_action_type" "text", "p_window_minutes" integer DEFAULT 60, "p_max_requests" integer DEFAULT NULL::integer) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  window_start TIMESTAMP WITH TIME ZONE;
  window_end TIMESTAMP WITH TIME ZONE;
  current_count INTEGER;
  user_limit INTEGER;
BEGIN
  SELECT rate_limit_per_hour INTO user_limit
  FROM user_profiles WHERE id = p_user_id;
  
  p_max_requests := COALESCE(p_max_requests, user_limit, 10);
  
  window_start := DATE_TRUNC('hour', NOW());
  window_end := window_start + INTERVAL '1 hour';
  
  SELECT COALESCE(request_count, 0) INTO current_count
  FROM rate_limits
  WHERE user_id = p_user_id 
    AND action_type = p_action_type 
    AND window_start = window_start;
  
  IF current_count >= p_max_requests THEN
    INSERT INTO security_audit_log (user_id, action_type, severity, metadata)
    VALUES (
      p_user_id, 'rate_limit_exceeded', 'warning',
      jsonb_build_object('action_type', p_action_type, 'current_count', current_count, 'limit', p_max_requests)
    );
    RETURN FALSE;
  END IF;
  
  INSERT INTO rate_limits (user_id, action_type, window_start, window_end, request_count)
  VALUES (p_user_id, p_action_type, window_start, window_end, 1)
  ON CONFLICT (user_id, action_type, window_start)
  DO UPDATE SET 
    request_count = rate_limits.request_count + 1,
    limit_exceeded = (rate_limits.request_count + 1) >= p_max_requests;
  
  RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."check_rate_limit"("p_user_id" "uuid", "p_action_type" "text", "p_window_minutes" integer, "p_max_requests" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_user_profile"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  -- Insert with default account_type, trigger will set max_active_queries automatically
  INSERT INTO public.user_profiles (id, account_type)
  VALUES (NEW.id, 'user');
  
  -- Only insert audit log if security_audit_log table exists
  BEGIN
    INSERT INTO public.security_audit_log (user_id, action_type, resource_type, resource_id, metadata)
    VALUES (
      NEW.id, 'profile_created', 'user_profile', NEW.id::text,
      jsonb_build_object('email', NEW.email, 'created_via', 'auth_trigger')
    );
  EXCEPTION WHEN undefined_table THEN
    -- Ignore if audit table doesn't exist yet
    NULL;
  END;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log the error but don't fail the user creation
  RAISE WARNING 'Failed to create user profile for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."create_user_profile"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_max_queries_for_account_type"("account_type_val" "text") RETURNS integer
    LANGUAGE "plpgsql" IMMUTABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  CASE account_type_val
    WHEN 'admin' THEN RETURN -1; -- unlimited
    WHEN 'privileged' THEN RETURN 5;
    WHEN 'user' THEN RETURN 3;
    ELSE RETURN 3; -- default to user level
  END CASE;
END;
$$;


ALTER FUNCTION "public"."get_max_queries_for_account_type"("account_type_val" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sanitize_text_input"("input_text" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  IF input_text IS NULL THEN
    RETURN NULL;
  END IF;
  
  RETURN left(
    regexp_replace(
      trim(input_text),
      '[<>"\x00-\x08\x0B\x0C\x0E-\x1F\x7F]',
      '', 'g'
    ), 1000
  );
END;
$$;


ALTER FUNCTION "public"."sanitize_text_input"("input_text" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_max_queries_by_account_type"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  -- Set max_active_queries based on account_type
  NEW.max_active_queries := public.get_max_queries_for_account_type(NEW.account_type);
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_max_queries_by_account_type"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_query_hash"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  -- Regenerate query hash when relevant fields change
  IF OLD.keywords IS DISTINCT FROM NEW.keywords OR 
     OLD.work_types IS DISTINCT FROM NEW.work_types OR 
     OLD.city_id IS DISTINCT FROM NEW.city_id THEN
    NEW.query_hash := md5(NEW.user_id::text || NEW.keywords || NEW.work_types::text || COALESCE(NEW.city_id::text, ''));
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_query_hash"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_query_creation"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  user_profile_rec public.user_profiles%ROWTYPE;
  active_query_count INTEGER;
BEGIN
  SELECT * INTO user_profile_rec FROM public.user_profiles WHERE id = NEW.user_id;
  
  IF NOT FOUND OR user_profile_rec.is_suspended THEN
    RAISE EXCEPTION 'User not found or suspended';
  END IF;
  
  -- Check query limits (skip check for admins with unlimited queries)
  IF user_profile_rec.max_active_queries != -1 THEN
    SELECT COUNT(*) INTO active_query_count
    FROM public.queries WHERE user_id = NEW.user_id AND is_active = TRUE;
    
    IF active_query_count >= user_profile_rec.max_active_queries THEN
      RAISE EXCEPTION 'Maximum active queries limit exceeded: %', user_profile_rec.max_active_queries;
    END IF;
  END IF;
  
  -- Sanitize keywords
  NEW.keywords := trim(NEW.keywords);
  NEW.keywords := regexp_replace(NEW.keywords, '[<>"]', '', 'g');
  
  -- Generate query hash
  NEW.query_hash := md5(NEW.user_id::text || NEW.keywords || NEW.work_types::text || COALESCE(NEW.city_id::text, ''));
  
  -- Only insert audit log if security_audit_log table exists
  BEGIN
    INSERT INTO public.security_audit_log (user_id, action_type, resource_type, resource_id, new_values)
    VALUES (NEW.user_id, 'query_created', 'query', NEW.id::text, to_jsonb(NEW));
  EXCEPTION WHEN undefined_table THEN
    -- Ignore if audit table doesn't exist yet
    NULL;
  END;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_query_creation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_webhook_url"("url" "text") RETURNS boolean
    LANGUAGE "plpgsql" IMMUTABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  IF url !~ '^https://' THEN RETURN FALSE; END IF;
  IF url ~ 'localhost|127\.|192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.' THEN RETURN FALSE; END IF;
  IF url ~* '(bit\.ly|tinyurl|t\.co|goo\.gl|short|redirect)' THEN RETURN FALSE; END IF;
  RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."validate_webhook_url"("url" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."jobs" (
    "id" integer NOT NULL,
    "query_id" integer,
    "user_id" "uuid",
    "title" "text" NOT NULL,
    "company" "text" NOT NULL,
    "link" "text" NOT NULL,
    "location" "text",
    "posted" timestamp with time zone,
    "scraped_at" timestamp with time zone DEFAULT "now"(),
    "is_deleted" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "jobs_company_check" CHECK ((("length"("company") >= 1) AND ("length"("company") <= 255))),
    CONSTRAINT "jobs_link_check" CHECK ((("link" ~ '^https://([a-z]+\.)?linkedin\.com/jobs/'::"text") AND ("length"("link") <= 2000))),
    CONSTRAINT "jobs_location_check" CHECK (("length"("location") <= 255)),
    CONSTRAINT "jobs_title_check" CHECK ((("length"("title") >= 1) AND ("length"("title") <= 500)))
);


ALTER TABLE "public"."jobs" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."jobs_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."jobs_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."jobs_id_seq" OWNED BY "public"."jobs"."id";



CREATE TABLE IF NOT EXISTS "public"."load_balancer_logs" (
    "id" integer NOT NULL,
    "timestamp" timestamp with time zone DEFAULT "now"(),
    "total_users" integer NOT NULL,
    "total_queries" integer NOT NULL,
    "users_per_chunk" integer NOT NULL,
    "total_chunks" integer NOT NULL,
    "user_processors_used" integer NOT NULL,
    "successful_users" integer DEFAULT 0,
    "failed_users" integer DEFAULT 0,
    "total_jobs_found" integer DEFAULT 0,
    "execution_time_ms" integer NOT NULL,
    "system_load" "text",
    "scaling_strategy" "text",
    CONSTRAINT "load_balancer_logs_system_load_check" CHECK (("system_load" = ANY (ARRAY['light'::"text", 'moderate'::"text", 'heavy'::"text", 'critical'::"text"])))
);


ALTER TABLE "public"."load_balancer_logs" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."load_balancer_logs_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."load_balancer_logs_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."load_balancer_logs_id_seq" OWNED BY "public"."load_balancer_logs"."id";



CREATE TABLE IF NOT EXISTS "public"."notification_logs" (
    "id" integer NOT NULL,
    "user_id" "uuid",
    "notification_type" "text" NOT NULL,
    "trigger_event" "text" NOT NULL,
    "job_count" integer DEFAULT 0,
    "query_ids" integer[],
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "recipient" "text",
    "error_message" "text",
    "metadata" "jsonb",
    "sent_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "notification_logs_notification_type_check" CHECK (("notification_type" = ANY (ARRAY['email'::"text", 'mobile_push'::"text", 'web_push'::"text", 'webhook'::"text"]))),
    CONSTRAINT "notification_logs_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'sent'::"text", 'failed'::"text", 'skipped'::"text"]))),
    CONSTRAINT "notification_logs_trigger_event_check" CHECK (("trigger_event" = ANY (ARRAY['new_jobs'::"text", 'query_complete'::"text", 'system_alert'::"text", 'digest'::"text"])))
);


ALTER TABLE "public"."notification_logs" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."notification_logs_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."notification_logs_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."notification_logs_id_seq" OWNED BY "public"."notification_logs"."id";



CREATE TABLE IF NOT EXISTS "public"."notification_preferences" (
    "id" integer NOT NULL,
    "user_id" "uuid",
    "email_notifications" boolean DEFAULT true,
    "mobile_push_notifications" boolean DEFAULT false,
    "webhook_notifications" boolean DEFAULT false,
    "webhook_url" "text",
    "webhook_secret" "text",
    "notification_frequency" "text" DEFAULT 'immediate'::"text",
    "email_digest" boolean DEFAULT false,
    "push_subscription_data" "jsonb",
    "expo_push_token" "text",
    "data_sharing_consent" boolean DEFAULT false,
    "marketing_consent" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "notification_preferences_expo_push_token_check" CHECK (("length"("expo_push_token") <= 500)),
    CONSTRAINT "notification_preferences_notification_frequency_check" CHECK (("notification_frequency" = ANY (ARRAY['immediate'::"text", 'hourly'::"text", 'daily'::"text"]))),
    CONSTRAINT "notification_preferences_webhook_secret_check" CHECK (("length"("webhook_secret") <= 255)),
    CONSTRAINT "notification_preferences_webhook_url_check" CHECK ((("webhook_url" IS NULL) OR (("webhook_url" ~ '^https://[a-zA-Z0-9\-\.]+\.[a-zA-Z]{2,}'::"text") AND ("length"("webhook_url") <= 2000)))),
    CONSTRAINT "webhook_url_security_check" CHECK ((("webhook_url" IS NULL) OR "public"."validate_webhook_url"("webhook_url")))
);


ALTER TABLE "public"."notification_preferences" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."notification_preferences_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."notification_preferences_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."notification_preferences_id_seq" OWNED BY "public"."notification_preferences"."id";



CREATE TABLE IF NOT EXISTS "public"."queries" (
    "id" integer NOT NULL,
    "user_id" "uuid",
    "keywords" "text" NOT NULL,
    "work_types" integer[] NOT NULL,
    "city_id" integer,
    "location_string" "text",
    "is_active" boolean DEFAULT false,
    "query_hash" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "max_keywords_length" CHECK (("length"("keywords") <= 500)),
    CONSTRAINT "queries_keywords_check" CHECK (((("length"(TRIM(BOTH FROM "keywords")) >= 2) AND ("length"(TRIM(BOTH FROM "keywords")) <= 500)) AND ("keywords" ~ '^[a-zA-Z0-9\s\-\+\#\.\,\(\)]+$'::"text"))),
    CONSTRAINT "queries_location_string_check" CHECK (("length"("location_string") <= 255)),
    CONSTRAINT "queries_work_types_check" CHECK (((("array_length"("work_types", 1) >= 1) AND ("array_length"("work_types", 1) <= 3)) AND ("work_types" <@ ARRAY[1, 2, 3])))
);


ALTER TABLE "public"."queries" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."queries_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."queries_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."queries_id_seq" OWNED BY "public"."queries"."id";



CREATE TABLE IF NOT EXISTS "public"."query_executions" (
    "id" integer NOT NULL,
    "query_id" integer,
    "user_execution_id" integer,
    "started_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone,
    "status" "text" DEFAULT 'running'::"text" NOT NULL,
    "jobs_found" integer DEFAULT 0,
    "pages_processed" integer DEFAULT 0,
    "error_message" "text",
    "proxy_ip" "text",
    "user_agent" "text",
    "proxy_location" "text",
    "calculated_tpr" "text",
    "linkedin_url" "text",
    CONSTRAINT "query_executions_status_check" CHECK (("status" = ANY (ARRAY['running'::"text", 'success'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."query_executions" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."query_executions_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."query_executions_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."query_executions_id_seq" OWNED BY "public"."query_executions"."id";



CREATE OR REPLACE VIEW "public"."query_performance" WITH ("security_invoker"='on') AS
 SELECT "q"."id" AS "query_id",
    "q"."keywords",
    "q"."user_id",
    "count"(DISTINCT "j"."id") AS "jobs_found",
    "max"("qe"."completed_at") AS "last_execution",
    "avg"("qe"."jobs_found") AS "avg_jobs_per_execution",
    "count"(DISTINCT "qe"."id") AS "total_executions",
    "count"(DISTINCT
        CASE
            WHEN ("qe"."status" = 'success'::"text") THEN "qe"."id"
            ELSE NULL::integer
        END) AS "successful_executions"
   FROM (("public"."queries" "q"
     LEFT JOIN "public"."jobs" "j" ON ((("q"."id" = "j"."query_id") AND ("j"."is_deleted" = false))))
     LEFT JOIN "public"."query_executions" "qe" ON (("q"."id" = "qe"."query_id")))
  GROUP BY "q"."id", "q"."keywords", "q"."user_id";


ALTER VIEW "public"."query_performance" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rate_limits" (
    "id" integer NOT NULL,
    "user_id" "uuid",
    "action_type" "text" NOT NULL,
    "window_start" timestamp with time zone NOT NULL,
    "window_end" timestamp with time zone NOT NULL,
    "request_count" integer DEFAULT 1,
    "limit_exceeded" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "rate_limits_action_type_check" CHECK (("action_type" = ANY (ARRAY['query_creation'::"text", 'job_search'::"text", 'api_call'::"text", 'notification_send'::"text"]))),
    CONSTRAINT "rate_limits_window_check" CHECK (("window_end" > "window_start"))
);


ALTER TABLE "public"."rate_limits" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."rate_limits_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."rate_limits_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."rate_limits_id_seq" OWNED BY "public"."rate_limits"."id";



CREATE TABLE IF NOT EXISTS "public"."security_audit_log" (
    "id" integer NOT NULL,
    "user_id" "uuid",
    "action_type" "text" NOT NULL,
    "resource_type" "text",
    "resource_id" "text",
    "old_values" "jsonb",
    "new_values" "jsonb",
    "ip_address" "inet",
    "user_agent" "text",
    "request_id" "uuid",
    "severity" "text" DEFAULT 'info'::"text",
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "security_audit_log_action_type_check" CHECK (("action_type" = ANY (ARRAY['login'::"text", 'logout'::"text", 'query_created'::"text", 'query_modified'::"text", 'query_deleted'::"text", 'profile_updated'::"text", 'admin_action'::"text", 'rate_limit_exceeded'::"text", 'suspicious_activity'::"text", 'profile_created'::"text", 'subscription_created'::"text", 'notification_sent'::"text"]))),
    CONSTRAINT "security_audit_log_resource_type_check" CHECK (("resource_type" = ANY (ARRAY['user_profile'::"text", 'query'::"text", 'job'::"text", 'notification_preferences'::"text", 'subscription'::"text"]))),
    CONSTRAINT "security_audit_log_severity_check" CHECK (("severity" = ANY (ARRAY['info'::"text", 'warning'::"text", 'error'::"text", 'critical'::"text"])))
);


ALTER TABLE "public"."security_audit_log" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."security_alerts" WITH ("security_invoker"='on') AS
 SELECT "user_id",
    "action_type",
    "count"(*) AS "incident_count",
    "max"("created_at") AS "last_incident",
    "array_agg"(DISTINCT ("ip_address")::"text") AS "ip_addresses"
   FROM "public"."security_audit_log"
  WHERE (("severity" = ANY (ARRAY['error'::"text", 'critical'::"text"])) AND ("created_at" > ("now"() - '24:00:00'::interval)))
  GROUP BY "user_id", "action_type"
 HAVING ("count"(*) > 5);


ALTER VIEW "public"."security_alerts" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."security_audit_log_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."security_audit_log_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."security_audit_log_id_seq" OWNED BY "public"."security_audit_log"."id";



CREATE TABLE IF NOT EXISTS "public"."subscriptions" (
    "id" integer NOT NULL,
    "user_id" "uuid",
    "stripe_customer_id" "text",
    "stripe_subscription_id" "text",
    "status" "text" NOT NULL,
    "plan_id" "text" DEFAULT 'monthly_10'::"text" NOT NULL,
    "current_period_start" timestamp with time zone,
    "current_period_end" timestamp with time zone,
    "cancel_at_period_end" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "subscriptions_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'inactive'::"text", 'canceled'::"text", 'past_due'::"text"])))
);


ALTER TABLE "public"."subscriptions" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."subscriptions_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."subscriptions_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."subscriptions_id_seq" OWNED BY "public"."subscriptions"."id";



CREATE OR REPLACE VIEW "public"."system_health" WITH ("security_invoker"='on') AS
 SELECT 'last_hour'::"text" AS "period",
    "count"(DISTINCT "lbl"."id") AS "executions",
    "avg"("lbl"."total_users") AS "avg_users",
    "avg"("lbl"."total_queries") AS "avg_queries",
    "avg"(((("lbl"."execution_time_ms")::numeric / 1000.0) / 60.0)) AS "avg_minutes",
    "round"("avg"(((("lbl"."successful_users")::numeric / (NULLIF("lbl"."total_users", 0))::numeric) * (100)::numeric)), 2) AS "success_rate",
    "count"(
        CASE
            WHEN ("lbl"."system_load" = 'critical'::"text") THEN 1
            ELSE NULL::integer
        END) AS "critical_loads"
   FROM "public"."load_balancer_logs" "lbl"
  WHERE ("lbl"."timestamp" > ("now"() - '01:00:00'::interval))
UNION ALL
 SELECT 'last_24_hours'::"text" AS "period",
    "count"(DISTINCT "lbl"."id") AS "executions",
    "avg"("lbl"."total_users") AS "avg_users",
    "avg"("lbl"."total_queries") AS "avg_queries",
    "avg"(((("lbl"."execution_time_ms")::numeric / 1000.0) / 60.0)) AS "avg_minutes",
    "round"("avg"(((("lbl"."successful_users")::numeric / (NULLIF("lbl"."total_users", 0))::numeric) * (100)::numeric)), 2) AS "success_rate",
    "count"(
        CASE
            WHEN ("lbl"."system_load" = 'critical'::"text") THEN 1
            ELSE NULL::integer
        END) AS "critical_loads"
   FROM "public"."load_balancer_logs" "lbl"
  WHERE ("lbl"."timestamp" > ("now"() - '24:00:00'::interval));


ALTER VIEW "public"."system_health" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."us_cities" (
    "id" integer NOT NULL,
    "city" "text" NOT NULL,
    "state_id" "text" NOT NULL,
    "state_name" "text" NOT NULL,
    "linkedin_id" bigint,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."us_cities" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."us_cities_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."us_cities_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."us_cities_id_seq" OWNED BY "public"."us_cities"."id";



CREATE TABLE IF NOT EXISTS "public"."user_executions" (
    "id" integer NOT NULL,
    "user_id" "uuid",
    "chunk_id" integer NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone,
    "status" "text" DEFAULT 'running'::"text" NOT NULL,
    "queries_processed" integer DEFAULT 0,
    "jobs_found" integer DEFAULT 0,
    "error_message" "text",
    "execution_delay_seconds" integer,
    "hour_start" timestamp with time zone,
    CONSTRAINT "user_executions_status_check" CHECK (("status" = ANY (ARRAY['running'::"text", 'success'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."user_executions" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."user_executions_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."user_executions_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."user_executions_id_seq" OWNED BY "public"."user_executions"."id";



CREATE TABLE IF NOT EXISTS "public"."user_profiles" (
    "id" "uuid" NOT NULL,
    "account_type" "text" DEFAULT 'user'::"text" NOT NULL,
    "full_name" "text",
    "company" "text",
    "subscription_tier" "text" DEFAULT 'free'::"text",
    "max_active_queries" integer DEFAULT 3,
    "is_suspended" boolean DEFAULT false,
    "last_login_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_profiles_account_type_check" CHECK (("account_type" = ANY (ARRAY['admin'::"text", 'privileged'::"text", 'user'::"text"]))),
    CONSTRAINT "user_profiles_company_check" CHECK (("length"("company") <= 255)),
    CONSTRAINT "user_profiles_full_name_check" CHECK ((("length"("full_name") <= 255) AND ("full_name" ~ '^[a-zA-Z\s\-\.'']*$'::"text"))),
    CONSTRAINT "user_profiles_max_active_queries_check" CHECK ((("max_active_queries" >= '-1'::integer) AND ("max_active_queries" <= 100))),
    CONSTRAINT "user_profiles_subscription_tier_check" CHECK (("subscription_tier" = ANY (ARRAY['free'::"text", 'basic'::"text", 'premium'::"text"])))
);


ALTER TABLE "public"."user_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "session_token_hash" "text" NOT NULL,
    "ip_address" "inet",
    "user_agent" "text",
    "last_activity" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone NOT NULL,
    "is_revoked" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_sessions" OWNER TO "postgres";


ALTER TABLE ONLY "public"."jobs" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."jobs_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."load_balancer_logs" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."load_balancer_logs_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."notification_logs" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."notification_logs_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."notification_preferences" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."notification_preferences_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."queries" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."queries_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."query_executions" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."query_executions_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."rate_limits" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."rate_limits_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."security_audit_log" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."security_audit_log_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."subscriptions" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."subscriptions_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."us_cities" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."us_cities_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."user_executions" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."user_executions_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_link_key" UNIQUE ("link");



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."load_balancer_logs"
    ADD CONSTRAINT "load_balancer_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_logs"
    ADD CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."queries"
    ADD CONSTRAINT "queries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."query_executions"
    ADD CONSTRAINT "query_executions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rate_limits"
    ADD CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rate_limits"
    ADD CONSTRAINT "rate_limits_user_id_action_type_window_start_key" UNIQUE ("user_id", "action_type", "window_start");



ALTER TABLE ONLY "public"."security_audit_log"
    ADD CONSTRAINT "security_audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_stripe_customer_id_key" UNIQUE ("stripe_customer_id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_stripe_subscription_id_key" UNIQUE ("stripe_subscription_id");



ALTER TABLE ONLY "public"."queries"
    ADD CONSTRAINT "unique_user_query" UNIQUE ("user_id", "query_hash");



ALTER TABLE ONLY "public"."us_cities"
    ADD CONSTRAINT "us_cities_linkedin_id_key" UNIQUE ("linkedin_id");



ALTER TABLE ONLY "public"."us_cities"
    ADD CONSTRAINT "us_cities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_executions"
    ADD CONSTRAINT "user_executions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_sessions"
    ADD CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_jobs_link" ON "public"."jobs" USING "btree" ("link");



CREATE INDEX "idx_jobs_posted" ON "public"."jobs" USING "btree" ("posted");



CREATE INDEX "idx_jobs_query_id" ON "public"."jobs" USING "btree" ("query_id");



CREATE INDEX "idx_jobs_user_id" ON "public"."jobs" USING "btree" ("user_id");



CREATE INDEX "idx_jobs_user_security" ON "public"."jobs" USING "btree" ("user_id", "is_deleted") WHERE ("is_deleted" = false);



CREATE INDEX "idx_notification_logs_created_at" ON "public"."notification_logs" USING "btree" ("created_at");



CREATE INDEX "idx_notification_logs_type_status" ON "public"."notification_logs" USING "btree" ("notification_type", "status");



CREATE INDEX "idx_notification_logs_user_id" ON "public"."notification_logs" USING "btree" ("user_id");



CREATE INDEX "idx_notification_preferences_email" ON "public"."notification_preferences" USING "btree" ("email_notifications") WHERE ("email_notifications" = true);



CREATE INDEX "idx_notification_preferences_push" ON "public"."notification_preferences" USING "btree" ("mobile_push_notifications") WHERE ("mobile_push_notifications" = true);



CREATE INDEX "idx_notification_preferences_user_id" ON "public"."notification_preferences" USING "btree" ("user_id");



CREATE INDEX "idx_notification_preferences_webhook" ON "public"."notification_preferences" USING "btree" ("webhook_notifications") WHERE ("webhook_notifications" = true);



CREATE INDEX "idx_queries_active" ON "public"."queries" USING "btree" ("is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_queries_city_id" ON "public"."queries" USING "btree" ("city_id");



CREATE INDEX "idx_queries_hash_security" ON "public"."queries" USING "btree" ("query_hash");



CREATE INDEX "idx_queries_user_active" ON "public"."queries" USING "btree" ("user_id") WHERE ("is_active" = true);



CREATE INDEX "idx_query_executions_query_id" ON "public"."query_executions" USING "btree" ("query_id");



CREATE INDEX "idx_query_executions_user_execution_id" ON "public"."query_executions" USING "btree" ("user_execution_id");



CREATE INDEX "idx_rate_limits_exceeded" ON "public"."rate_limits" USING "btree" ("limit_exceeded", "created_at" DESC) WHERE ("limit_exceeded" = true);



CREATE INDEX "idx_rate_limits_user_action" ON "public"."rate_limits" USING "btree" ("user_id", "action_type", "window_start" DESC);



CREATE INDEX "idx_security_audit_action" ON "public"."security_audit_log" USING "btree" ("action_type", "created_at" DESC);



CREATE INDEX "idx_security_audit_severity" ON "public"."security_audit_log" USING "btree" ("severity", "created_at" DESC);



CREATE INDEX "idx_security_audit_user" ON "public"."security_audit_log" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_subscriptions_status" ON "public"."subscriptions" USING "btree" ("status");



CREATE INDEX "idx_subscriptions_stripe_customer_id" ON "public"."subscriptions" USING "btree" ("stripe_customer_id");



CREATE INDEX "idx_subscriptions_user_id" ON "public"."subscriptions" USING "btree" ("user_id");



CREATE INDEX "idx_us_cities_city_state" ON "public"."us_cities" USING "btree" ("city", "state_name");



CREATE INDEX "idx_us_cities_full_text_search" ON "public"."us_cities" USING "gin" ("to_tsvector"('"english"'::"regconfig", (("city" || ' '::"text") || "state_name")));



CREATE INDEX "idx_us_cities_linkedin_id" ON "public"."us_cities" USING "btree" ("linkedin_id");



CREATE INDEX "idx_us_cities_state_city_lookup" ON "public"."us_cities" USING "btree" ("state_id", "city");



CREATE INDEX "idx_us_cities_state_name" ON "public"."us_cities" USING "btree" ("state_name");



CREATE INDEX "idx_user_executions_started_at" ON "public"."user_executions" USING "btree" ("started_at");



CREATE INDEX "idx_user_executions_status" ON "public"."user_executions" USING "btree" ("status");



CREATE INDEX "idx_user_executions_user_id" ON "public"."user_executions" USING "btree" ("user_id");



CREATE INDEX "idx_user_profiles_account_type" ON "public"."user_profiles" USING "btree" ("account_type");



CREATE INDEX "idx_user_profiles_suspended" ON "public"."user_profiles" USING "btree" ("is_suspended") WHERE ("is_suspended" = true);



CREATE INDEX "idx_user_sessions_cleanup" ON "public"."user_sessions" USING "btree" ("expires_at") WHERE ("is_revoked" = false);



CREATE INDEX "idx_user_sessions_security" ON "public"."user_sessions" USING "btree" ("user_id", "last_activity" DESC);



CREATE OR REPLACE TRIGGER "set_max_queries_trigger" BEFORE INSERT OR UPDATE ON "public"."user_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_max_queries_by_account_type"();



CREATE OR REPLACE TRIGGER "update_query_hash_trigger" BEFORE UPDATE ON "public"."queries" FOR EACH ROW EXECUTE FUNCTION "public"."update_query_hash"();



CREATE OR REPLACE TRIGGER "validate_query_trigger" BEFORE INSERT ON "public"."queries" FOR EACH ROW EXECUTE FUNCTION "public"."validate_query_creation"();



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_query_id_fkey" FOREIGN KEY ("query_id") REFERENCES "public"."queries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_logs"
    ADD CONSTRAINT "notification_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."queries"
    ADD CONSTRAINT "queries_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "public"."us_cities"("id");



ALTER TABLE ONLY "public"."queries"
    ADD CONSTRAINT "queries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."query_executions"
    ADD CONSTRAINT "query_executions_query_id_fkey" FOREIGN KEY ("query_id") REFERENCES "public"."queries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."query_executions"
    ADD CONSTRAINT "query_executions_user_execution_id_fkey" FOREIGN KEY ("user_execution_id") REFERENCES "public"."user_executions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rate_limits"
    ADD CONSTRAINT "rate_limits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."security_audit_log"
    ADD CONSTRAINT "security_audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_executions"
    ADD CONSTRAINT "user_executions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_sessions"
    ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Admins can update any profile" ON "public"."user_profiles" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "user_profiles_1"
  WHERE (("user_profiles_1"."id" = "auth"."uid"()) AND ("user_profiles_1"."account_type" = 'admin'::"text")))));



CREATE POLICY "Admins can view all profiles" ON "public"."user_profiles" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "user_profiles_1"
  WHERE (("user_profiles_1"."id" = "auth"."uid"()) AND ("user_profiles_1"."account_type" = 'admin'::"text")))));



CREATE POLICY "No direct profile creation" ON "public"."user_profiles" FOR INSERT WITH CHECK (false);



CREATE POLICY "System can create jobs" ON "public"."jobs" FOR INSERT WITH CHECK ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "System can insert audit logs" ON "public"."security_audit_log" FOR INSERT WITH CHECK ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "System can insert load balancer logs" ON "public"."load_balancer_logs" FOR INSERT WITH CHECK ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "System can manage notification logs" ON "public"."notification_logs" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "System manages query executions" ON "public"."query_executions" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "System manages rate limits" ON "public"."rate_limits" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "System manages sessions" ON "public"."user_sessions" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "System manages subscriptions" ON "public"."subscriptions" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "System manages user executions" ON "public"."user_executions" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "US Cities are publicly readable" ON "public"."us_cities" FOR SELECT USING (true);



CREATE POLICY "Users can delete own queries" ON "public"."queries" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own notification preferences" ON "public"."notification_preferences" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can soft delete own jobs" ON "public"."jobs" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK ((("auth"."uid"() = "user_id") AND ("title" = ( SELECT "jobs_1"."title"
   FROM "public"."jobs" "jobs_1"
  WHERE ("jobs_1"."id" = "jobs_1"."id"))) AND ("company" = ( SELECT "jobs_1"."company"
   FROM "public"."jobs" "jobs_1"
  WHERE ("jobs_1"."id" = "jobs_1"."id"))) AND ("link" = ( SELECT "jobs_1"."link"
   FROM "public"."jobs" "jobs_1"
  WHERE ("jobs_1"."id" = "jobs_1"."id")))));



CREATE POLICY "Users can update own profile" ON "public"."user_profiles" FOR UPDATE USING (("auth"."uid"() = "id")) WITH CHECK ((("auth"."uid"() = "id") AND ("account_type" = ( SELECT "user_profiles_1"."account_type"
   FROM "public"."user_profiles" "user_profiles_1"
  WHERE ("user_profiles_1"."id" = "auth"."uid"())))));



CREATE POLICY "Users can update own queries" ON "public"."queries" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own jobs" ON "public"."jobs" FOR SELECT USING ((("auth"."uid"() = "user_id") AND ("is_deleted" = false)));



CREATE POLICY "Users can view own notification logs" ON "public"."notification_logs" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own profile" ON "public"."user_profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view own queries" ON "public"."queries" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own sessions" ON "public"."user_sessions" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own subscription" ON "public"."subscriptions" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."jobs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."load_balancer_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notification_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notification_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."queries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."query_executions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rate_limits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."security_audit_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."us_cities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_executions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_sessions" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."check_rate_limit"("p_user_id" "uuid", "p_action_type" "text", "p_window_minutes" integer, "p_max_requests" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."check_rate_limit"("p_user_id" "uuid", "p_action_type" "text", "p_window_minutes" integer, "p_max_requests" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_rate_limit"("p_user_id" "uuid", "p_action_type" "text", "p_window_minutes" integer, "p_max_requests" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."create_user_profile"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_user_profile"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_user_profile"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_max_queries_for_account_type"("account_type_val" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_max_queries_for_account_type"("account_type_val" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_max_queries_for_account_type"("account_type_val" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."sanitize_text_input"("input_text" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."sanitize_text_input"("input_text" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sanitize_text_input"("input_text" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_max_queries_by_account_type"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_max_queries_by_account_type"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_max_queries_by_account_type"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_query_hash"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_query_hash"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_query_hash"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_query_creation"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_query_creation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_query_creation"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_webhook_url"("url" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."validate_webhook_url"("url" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_webhook_url"("url" "text") TO "service_role";


















GRANT ALL ON TABLE "public"."jobs" TO "anon";
GRANT ALL ON TABLE "public"."jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."jobs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."jobs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."jobs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."jobs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."load_balancer_logs" TO "anon";
GRANT ALL ON TABLE "public"."load_balancer_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."load_balancer_logs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."load_balancer_logs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."load_balancer_logs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."load_balancer_logs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."notification_logs" TO "anon";
GRANT ALL ON TABLE "public"."notification_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_logs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."notification_logs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."notification_logs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."notification_logs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."notification_preferences" TO "anon";
GRANT ALL ON TABLE "public"."notification_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_preferences" TO "service_role";



GRANT ALL ON SEQUENCE "public"."notification_preferences_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."notification_preferences_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."notification_preferences_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."queries" TO "anon";
GRANT ALL ON TABLE "public"."queries" TO "authenticated";
GRANT ALL ON TABLE "public"."queries" TO "service_role";



GRANT ALL ON SEQUENCE "public"."queries_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."queries_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."queries_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."query_executions" TO "anon";
GRANT ALL ON TABLE "public"."query_executions" TO "authenticated";
GRANT ALL ON TABLE "public"."query_executions" TO "service_role";



GRANT ALL ON SEQUENCE "public"."query_executions_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."query_executions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."query_executions_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."query_performance" TO "anon";
GRANT ALL ON TABLE "public"."query_performance" TO "authenticated";
GRANT ALL ON TABLE "public"."query_performance" TO "service_role";



GRANT ALL ON TABLE "public"."rate_limits" TO "anon";
GRANT ALL ON TABLE "public"."rate_limits" TO "authenticated";
GRANT ALL ON TABLE "public"."rate_limits" TO "service_role";



GRANT ALL ON SEQUENCE "public"."rate_limits_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."rate_limits_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."rate_limits_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."security_audit_log" TO "anon";
GRANT ALL ON TABLE "public"."security_audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."security_audit_log" TO "service_role";



GRANT ALL ON TABLE "public"."security_alerts" TO "anon";
GRANT ALL ON TABLE "public"."security_alerts" TO "authenticated";
GRANT ALL ON TABLE "public"."security_alerts" TO "service_role";



GRANT ALL ON SEQUENCE "public"."security_audit_log_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."security_audit_log_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."security_audit_log_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."subscriptions" TO "service_role";



GRANT ALL ON SEQUENCE "public"."subscriptions_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."subscriptions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."subscriptions_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."system_health" TO "anon";
GRANT ALL ON TABLE "public"."system_health" TO "authenticated";
GRANT ALL ON TABLE "public"."system_health" TO "service_role";



GRANT ALL ON TABLE "public"."us_cities" TO "anon";
GRANT ALL ON TABLE "public"."us_cities" TO "authenticated";
GRANT ALL ON TABLE "public"."us_cities" TO "service_role";



GRANT ALL ON SEQUENCE "public"."us_cities_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."us_cities_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."us_cities_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."user_executions" TO "anon";
GRANT ALL ON TABLE "public"."user_executions" TO "authenticated";
GRANT ALL ON TABLE "public"."user_executions" TO "service_role";



GRANT ALL ON SEQUENCE "public"."user_executions_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."user_executions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."user_executions_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."user_profiles" TO "anon";
GRANT ALL ON TABLE "public"."user_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."user_sessions" TO "anon";
GRANT ALL ON TABLE "public"."user_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."user_sessions" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






























RESET ALL;

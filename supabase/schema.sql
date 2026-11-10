create table if not exists public.users (
  id text primary key,
  name text not null,
  email text not null unique,
  role text not null check (role in ('admin', 'participant')),
  department text not null default '',
  title text not null default '',
  status text not null check (status in ('active', 'inactive')),
  "lastLogin" timestamptz,
  "createdAt" timestamptz,
  __position integer not null default 0
);

create table if not exists public.activities (
  id text primary key,
  title text not null,
  "activityType" text not null check ("activityType" in ('training', 'livelihood', 'seminar', 'outreach', 'community_service')),
  description text not null default '',
  instructions text,
  date date not null,
  "startDate" date,
  deadline date,
  venue text not null default '',
  "targetBeneficiaries" text not null default '',
  "organizingDepartment" text not null default '',
  "leadCoordinator" text not null default '',
  "trainerOrSpeaker" text not null default '',
  status text not null check (status in ('active', 'completed', 'upcoming', 'draft', 'archived')),
  "surveyMode" text not null default 'online' check ("surveyMode" in ('online', 'offline')),
  "totalTargetParticipants" integer not null default 0,
  "assignedFormId" text,
  "createdAt" timestamptz,
  __position integer not null default 0
);

alter table public.activities
  add column if not exists "surveyMode" text not null default 'online';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'activities_surveymode_check'
      and conrelid = 'public.activities'::regclass
  ) then
    alter table public.activities
      add constraint activities_surveymode_check check ("surveyMode" in ('online', 'offline'));
  end if;
end;
$$;

create table if not exists public.evaluation_forms (
  id text primary key,
  title text not null,
  description text not null default '',
  instructions text,
  status text not null check (status in ('draft', 'published', 'archived')),
  "publicEnabled" boolean not null default true,
  "expiresAt" date,
  version integer not null default 1,
  "targetActivityType" text,
  "activityId" text,
  "targetRespondent" text,
  purpose text,
  "originalFileName" text,
  sections jsonb not null default '[]'::jsonb,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  __position integer not null default 0
);

alter table public.evaluation_forms
  add column if not exists "publicEnabled" boolean not null default true,
  add column if not exists "expiresAt" date;

create table if not exists public.evaluations (
  id text primary key,
  "activityId" text not null references public.activities(id) on delete cascade,
  "formId" text,
  "formSnapshot" jsonb,
  "customAnswers" jsonb,
  "participantName" text not null,
  "participantEmail" text not null,
  "participantPhone" text,
  "participantCategory" text not null,
  "controlNumber" text not null,
  "verificationMethod" text not null,
  "coreRatings" jsonb not null default '{}'::jsonb,
  "specificRatings" jsonb not null default '{}'::jsonb,
  "meanRating" numeric not null default 0,
  comments jsonb not null default '{}'::jsonb,
  sentiment jsonb not null default '{}'::jsonb,
  "submissionSource" text not null check ("submissionSource" in ('online', 'offline_synced')),
  "submittedAt" timestamptz not null default now(),
  "syncedAt" timestamptz,
  "deviceInfo" text not null default '',
  verified boolean not null default false,
  "consentAccepted" boolean not null default false,
  "adminFollowUpStatus" text,
  "adminNotes" text,
  __position integer not null default 0
);

create table if not exists public.audit_logs (
  id text primary key,
  timestamp timestamptz not null default now(),
  "adminName" text not null,
  action text not null,
  "resourceId" text not null,
  "participantControlNumber" text,
  reason text not null,
  "ipAddress" text,
  status text,
  __position integer not null default 0
);

create table if not exists public.surveys (
  id text primary key,
  title text not null,
  description text not null default '',
  instructions text,
  status text not null check (status in ('draft', 'published', 'closed')),
  "isAnonymous" boolean not null default true,
  "targetAudience" text not null default '',
  "startDate" date not null,
  "endDate" date not null,
  questions jsonb not null default '[]'::jsonb,
  "createdAt" timestamptz not null default now(),
  __position integer not null default 0
);

create table if not exists public.survey_responses (
  id text primary key,
  "surveyId" text not null,
  "respondentName" text,
  "respondentEmail" text,
  "isAnonymous" boolean not null default true,
  answers jsonb not null default '{}'::jsonb,
  "submittedAt" timestamptz not null default now(),
  __position integer not null default 0
);

create table if not exists public.system_settings (
  id text primary key check (id = 'default'),
  data jsonb not null,
  "updatedAt" timestamptz not null default now(),
  version bigint not null default 1
);

create table if not exists public.website_themes (
  id text primary key check (id = 'default'),
  data jsonb not null,
  "updatedAt" timestamptz not null default now(),
  version bigint not null default 1
);

alter table public.system_settings add column if not exists version bigint not null default 1;
alter table public.website_themes add column if not exists version bigint not null default 1;

create table if not exists public.public_evaluation_submission_limits (
  rate_limit_key text primary key,
  window_started_at timestamptz not null,
  request_count integer not null check (request_count > 0)
);

create index if not exists public_evaluation_submission_limits_window_idx
  on public.public_evaluation_submission_limits (window_started_at);

create index if not exists evaluations_activity_id_idx on public.evaluations ("activityId");
create index if not exists evaluations_participant_email_idx on public.evaluations (lower("participantEmail"));
create index if not exists survey_responses_survey_id_idx on public.survey_responses ("surveyId");
create index if not exists audit_logs_timestamp_idx on public.audit_logs (timestamp desc);

alter table public.users enable row level security;
alter table public.activities enable row level security;
alter table public.evaluation_forms enable row level security;
alter table public.evaluations enable row level security;
alter table public.audit_logs enable row level security;
alter table public.surveys enable row level security;
alter table public.survey_responses enable row level security;
alter table public.system_settings enable row level security;
alter table public.website_themes enable row level security;

grant all on public.users, public.activities, public.evaluation_forms, public.evaluations,
  public.audit_logs, public.surveys, public.survey_responses, public.system_settings,
  public.website_themes, public.public_evaluation_submission_limits to service_role;
grant usage on schema public to service_role;

alter table public.public_evaluation_submission_limits enable row level security;

create or replace function public.reserve_public_evaluation_submission(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if p_key is null or length(p_key) <> 64 or p_limit < 1 or p_window_seconds < 1 then
    raise exception 'Invalid public submission rate-limit parameters.';
  end if;

  delete from public.public_evaluation_submission_limits
  where window_started_at < now() - interval '1 day';

  insert into public.public_evaluation_submission_limits (rate_limit_key, window_started_at, request_count)
  values (p_key, now(), 1)
  on conflict (rate_limit_key) do update
  set window_started_at = case
        when public.public_evaluation_submission_limits.window_started_at <= now() - make_interval(secs => p_window_seconds)
          then now()
        else public.public_evaluation_submission_limits.window_started_at
      end,
      request_count = case
        when public.public_evaluation_submission_limits.window_started_at <= now() - make_interval(secs => p_window_seconds)
          then 1
        else public.public_evaluation_submission_limits.request_count + 1
      end
  returning request_count into v_count;

  return v_count <= p_limit;
end;
$$;

revoke all on function public.reserve_public_evaluation_submission(text, integer, integer) from public, anon, authenticated;
grant execute on function public.reserve_public_evaluation_submission(text, integer, integer) to service_role;

-- Versioned configuration writes prevent another device from overwriting newer edits.
drop function if exists public.save_website_theme(jsonb, jsonb);
create or replace function public.save_website_theme(
  p_theme jsonb,
  p_audit_log jsonb,
  p_expected_version bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_version bigint;
  saved_row public.website_themes%rowtype;
begin
  perform pg_advisory_xact_lock(730001);
  select version into current_version
  from public.website_themes
  where id = 'default'
  for update;

  current_version := coalesce(current_version, 0);
  if current_version <> p_expected_version then
    raise exception using errcode = '40001', message = 'CONFIGURATION_VERSION_CONFLICT';
  end if;

  insert into public.website_themes (id, data, "updatedAt", version)
  values ('default', p_theme, now(), current_version + 1)
  on conflict (id) do update
    set data = excluded.data,
        "updatedAt" = excluded."updatedAt",
        version = excluded.version
  returning * into saved_row;

  insert into public.audit_logs (
    id, timestamp, "adminName", action, "resourceId", reason, __position
  )
  values (
    p_audit_log->>'id',
    (p_audit_log->>'timestamp')::timestamptz,
    p_audit_log->>'adminName',
    p_audit_log->>'action',
    p_audit_log->>'resourceId',
    p_audit_log->>'reason',
    (select coalesce(min(__position), 0) - 1 from public.audit_logs)
  )
  on conflict (id) do nothing;

  return jsonb_build_object(
    'data', saved_row.data,
    'version', saved_row.version,
    'updatedAt', saved_row."updatedAt"
  );
end;
$$;

revoke all on function public.save_website_theme(jsonb, jsonb, bigint) from public, anon, authenticated;
grant execute on function public.save_website_theme(jsonb, jsonb, bigint) to service_role;

create or replace function public.save_system_settings(
  p_settings jsonb,
  p_audit_log jsonb,
  p_expected_version bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_version bigint;
  saved_row public.system_settings%rowtype;
begin
  perform pg_advisory_xact_lock(730002);
  select version into current_version
  from public.system_settings
  where id = 'default'
  for update;

  current_version := coalesce(current_version, 0);
  if current_version <> p_expected_version then
    raise exception using errcode = '40001', message = 'CONFIGURATION_VERSION_CONFLICT';
  end if;

  insert into public.system_settings (id, data, "updatedAt", version)
  values ('default', p_settings, now(), current_version + 1)
  on conflict (id) do update
    set data = excluded.data,
        "updatedAt" = excluded."updatedAt",
        version = excluded.version
  returning * into saved_row;

  insert into public.audit_logs (
    id, timestamp, "adminName", action, "resourceId", reason, __position
  )
  values (
    p_audit_log->>'id',
    (p_audit_log->>'timestamp')::timestamptz,
    p_audit_log->>'adminName',
    p_audit_log->>'action',
    p_audit_log->>'resourceId',
    p_audit_log->>'reason',
    (select coalesce(min(__position), 0) - 1 from public.audit_logs)
  )
  on conflict (id) do nothing;

  return jsonb_build_object(
    'data', saved_row.data,
    'version', saved_row.version,
    'updatedAt', saved_row."updatedAt"
  );
end;
$$;

revoke all on function public.save_system_settings(jsonb, jsonb, bigint) from public, anon, authenticated;
grant execute on function public.save_system_settings(jsonb, jsonb, bigint) to service_role;

create or replace function public.load_application_configuration()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'theme', (
      select jsonb_build_object('data', data, 'version', version, 'updatedAt', "updatedAt")
      from public.website_themes where id = 'default'
    ),
    'systemSettings', (
      select jsonb_build_object('data', data, 'version', version, 'updatedAt', "updatedAt")
      from public.system_settings where id = 'default'
    )
  );
$$;

revoke all on function public.load_application_configuration() from public, anon, authenticated;
grant execute on function public.load_application_configuration() to service_role;

create or replace function public.create_application_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is null then
    return new;
  end if;

  -- Google sign-ins may bind only to an existing application account.
  if new.raw_app_meta_data->>'provider' = 'google' then
    update public.users
    set id = new.id::text
    where lower(email) = lower(new.email);
    return new;
  end if;

  insert into public.users (id, name, email, role, department, title, status)
  values (
    new.id::text,
    coalesce(nullif(new.raw_user_meta_data->>'name', ''), split_part(new.email, '@', 1)),
    lower(new.email),
    'participant',
    '',
    '',
    'active'
  )
  on conflict (email) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.create_application_profile();

create or replace function public.save_app_snapshot(p_snapshot jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.survey_responses;
  delete from public.evaluations;
  delete from public.audit_logs;
  delete from public.surveys;
  delete from public.evaluation_forms;
  delete from public.activities;
  delete from public.users;

  insert into public.users
  select r.* from jsonb_populate_recordset(
    null::public.users,
    coalesce(p_snapshot->'users', '[]'::jsonb)
  ) as r;

  insert into public.activities
  select r.* from jsonb_populate_recordset(
    null::public.activities,
    coalesce(p_snapshot->'activities', '[]'::jsonb)
  ) as r;

  insert into public.evaluation_forms
  select r.* from jsonb_populate_recordset(
    null::public.evaluation_forms,
    coalesce(p_snapshot->'evaluationForms', '[]'::jsonb)
  ) as r;

  insert into public.evaluations
  select r.* from jsonb_populate_recordset(
    null::public.evaluations,
    coalesce(p_snapshot->'evaluations', '[]'::jsonb)
  ) as r;

  insert into public.audit_logs
  select r.* from jsonb_populate_recordset(
    null::public.audit_logs,
    coalesce(p_snapshot->'auditLogs', '[]'::jsonb)
  ) as r;

  insert into public.surveys
  select r.* from jsonb_populate_recordset(
    null::public.surveys,
    coalesce(p_snapshot->'surveys', '[]'::jsonb)
  ) as r;

  insert into public.survey_responses
  select r.* from jsonb_populate_recordset(
    null::public.survey_responses,
    coalesce(p_snapshot->'surveyResponses', '[]'::jsonb)
  ) as r;

  -- Configuration has its own versioned save RPCs; snapshots must never overwrite it.
end;
$$;

create or replace function public.load_app_snapshot()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'users', coalesce((select jsonb_agg(to_jsonb(t) - '__position' order by t.__position) from public.users t), '[]'::jsonb),
    'activities', coalesce((select jsonb_agg(to_jsonb(t) - '__position' order by t.__position) from public.activities t), '[]'::jsonb),
    'evaluationForms', coalesce((select jsonb_agg(to_jsonb(t) - '__position' order by t.__position) from public.evaluation_forms t), '[]'::jsonb),
    'evaluations', coalesce((select jsonb_agg(to_jsonb(t) - '__position' order by t.__position) from public.evaluations t), '[]'::jsonb),
    'auditLogs', coalesce((select jsonb_agg(to_jsonb(t) - '__position' order by t.__position) from public.audit_logs t), '[]'::jsonb),
    'surveys', coalesce((select jsonb_agg(to_jsonb(t) - '__position' order by t.__position) from public.surveys t), '[]'::jsonb),
    'surveyResponses', coalesce((select jsonb_agg(to_jsonb(t) - '__position' order by t.__position) from public.survey_responses t), '[]'::jsonb),
    'systemSettings', (select data from public.system_settings where id = 'default'),
    'currentTheme', coalesce((select data from public.website_themes where id = 'default'), '{}'::jsonb),
    'websiteThemes', coalesce((select data from public.website_themes where id = 'default'), '{}'::jsonb),
    'themePersistenceReady',
      to_regprocedure('public.save_website_theme(jsonb,jsonb,bigint)') is not null
      and to_regprocedure('public.save_system_settings(jsonb,jsonb,bigint)') is not null
  );
$$;

revoke all on function public.save_app_snapshot(jsonb) from public, anon, authenticated;
revoke all on function public.load_app_snapshot() from public, anon, authenticated;
grant execute on function public.save_app_snapshot(jsonb) to service_role;
grant execute on function public.load_app_snapshot() to service_role;

-- Promote the first administrator after creating their Auth user:
-- update public.users set role = 'admin' where email = 'admin@example.com';

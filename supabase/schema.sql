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
  "totalTargetParticipants" integer not null default 0,
  "assignedFormId" text,
  "createdAt" timestamptz,
  __position integer not null default 0
);

create table if not exists public.evaluation_forms (
  id text primary key,
  title text not null,
  description text not null default '',
  instructions text,
  status text not null check (status in ('draft', 'published', 'archived')),
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
  "updatedAt" timestamptz not null default now()
);

create table if not exists public.website_themes (
  id text primary key check (id = 'default'),
  data jsonb not null,
  "updatedAt" timestamptz not null default now()
);

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
  public.website_themes to service_role;
grant usage on schema public to service_role;

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

  insert into public.system_settings (id, data, "updatedAt")
  values ('default', coalesce(p_snapshot->'systemSettings', '{}'::jsonb), now())
  on conflict (id) do update set data = excluded.data, "updatedAt" = excluded."updatedAt";

  insert into public.website_themes (id, data, "updatedAt")
  values ('default', coalesce(p_snapshot->'currentTheme', '{}'::jsonb), now())
  on conflict (id) do update set data = excluded.data, "updatedAt" = excluded."updatedAt";
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
    'currentTheme', (select data from public.website_themes where id = 'default')
  );
$$;

revoke all on function public.save_app_snapshot(jsonb) from public, anon, authenticated;
revoke all on function public.load_app_snapshot() from public, anon, authenticated;
grant execute on function public.save_app_snapshot(jsonb) to service_role;
grant execute on function public.load_app_snapshot() to service_role;

-- Promote the first administrator after creating their Auth user:
-- update public.users set role = 'admin' where email = 'admin@example.com';

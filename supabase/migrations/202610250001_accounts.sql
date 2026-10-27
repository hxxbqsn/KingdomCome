create table public.login_attempts (
  key_hash text primary key,
  attempts integer not null,
  window_started timestamptz not null
);
alter table public.login_attempts enable row level security;
revoke all on public.login_attempts from anon, authenticated;

create function public.consume_login_attempt(attempt_key text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare total integer;
begin
  delete from public.login_attempts where window_started < now() - interval '1 day';
  insert into public.login_attempts values (attempt_key, 1, now())
  on conflict (key_hash) do update set
    attempts = case when public.login_attempts.window_started < now() - interval '15 minutes' then 1 else public.login_attempts.attempts + 1 end,
    window_started = case when public.login_attempts.window_started < now() - interval '15 minutes' then now() else public.login_attempts.window_started end
  returning attempts into total;
  return total <= 10;
end;
$$;
revoke all on function public.consume_login_attempt(text) from public, anon, authenticated;
grant execute on function public.consume_login_attempt(text) to service_role;

create table public.archives (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  revision bigint not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.archives enable row level security;
revoke all on public.archives from anon, authenticated;
grant select on public.archives to authenticated;
create policy "Read own archive" on public.archives for select to authenticated
  using ((select auth.uid()) = owner_id);

create table public.archive_versions (
  owner_id uuid not null references auth.users(id) on delete cascade,
  revision bigint not null,
  data jsonb not null,
  saved_at timestamptz not null,
  primary key (owner_id, revision)
);
alter table public.archive_versions enable row level security;
revoke all on public.archive_versions from anon, authenticated;
grant select on public.archive_versions to authenticated;
create policy "Read own versions" on public.archive_versions for select to authenticated
  using ((select auth.uid()) = owner_id);

create function public.save_archive(expected_revision bigint, contents jsonb)
returns table (revision bigint, updated_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare owner uuid := auth.uid(); previous public.archives%rowtype;
begin
  if owner is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  if jsonb_typeof(contents) is distinct from 'object'
    or contents->>'version' is distinct from '3'
    or jsonb_typeof(contents->'worlds') is distinct from 'array'
    or jsonb_typeof(contents->'trees') is distinct from 'array'
    or jsonb_typeof(contents->'people') is distinct from 'array'
    or jsonb_typeof(contents->'items') is distinct from 'array'
    then raise exception 'INVALID_ARCHIVE'; end if;
  perform pg_advisory_xact_lock(hashtextextended(owner::text, 0));
  select * into previous from public.archives where owner_id = owner for update;
  if coalesce(previous.revision, 0) <> expected_revision then
    raise exception 'ARCHIVE_CONFLICT' using errcode = '40001';
  end if;
  if previous.owner_id is not null then
    insert into public.archive_versions values (owner, previous.revision, previous.data, previous.updated_at);
    delete from public.archive_versions where owner_id = owner and archive_versions.revision <= previous.revision - 20;
  end if;
  return query insert into public.archives (owner_id, data, revision, updated_at)
    values (owner, contents, expected_revision + 1, now())
    on conflict (owner_id) do update set data = excluded.data, revision = excluded.revision, updated_at = excluded.updated_at
    returning archives.revision, archives.updated_at;
end;
$$;
revoke all on function public.save_archive(bigint, jsonb) from public, anon;
grant execute on function public.save_archive(bigint, jsonb) to authenticated;

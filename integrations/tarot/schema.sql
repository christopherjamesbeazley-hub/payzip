begin;
create table public.tarot_draws (
  session_id text primary key,
  owner_hash text not null,
  card_id text not null,
  reversed boolean not null,
  created_at timestamptz not null default now()
);
alter table public.tarot_draws enable row level security;
revoke all on public.tarot_draws from public, anon, authenticated;
create function public.claim_tarot_draw(purchase text, buyer text, candidate text, flipped boolean)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare result jsonb;
begin
  insert into public.tarot_draws(session_id, owner_hash, card_id, reversed)
  values (purchase, buyer, candidate, flipped) on conflict (session_id) do nothing;
  select jsonb_build_object('id', card_id, 'reversed', reversed) into strict result
  from public.tarot_draws where session_id = purchase and owner_hash = buyer;
  return result;
end;
$$;
revoke all on function public.claim_tarot_draw(text,text,text,boolean) from public, anon, authenticated;
grant execute on function public.claim_tarot_draw(text,text,text,boolean) to service_role;
grant select, insert on public.tarot_draws to service_role;
commit;

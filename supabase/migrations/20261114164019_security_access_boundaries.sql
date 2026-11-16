-- Preserve the two existing ERP accounts; newly registered accounts are not staff.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
create table if not exists private.erp_staff (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table private.erp_staff enable row level security;
revoke all on private.erp_staff from public, anon, authenticated;
insert into private.erp_staff(user_id) values
 ('03cd1d2d-9d0e-4ac4-a785-ad78e34168ef'),
 ('d6a2c214-7b31-408e-abda-01a9e3806bcd')
on conflict do nothing;

create or replace function private.is_erp_staff() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists(select 1 from private.erp_staff where user_id = (select auth.uid())) $$;
revoke all on function private.is_erp_staff() from public, anon, authenticated;
grant execute on function private.is_erp_staff() to authenticated;

-- A restrictive policy ANDs with the existing per-operation policies.
-- It preserves their intended shared-staff behavior, while denying unapproved users.
do $$ declare t text; begin
  foreach t in array array['bom','bookkeeping','calendar_events','expenses','meeting_logs',
    'memo_folders','memos','orders','partners','price_list_items','products','projects',
    'purchase_orders','purchases','quotes','rental_items','rentals','sales','website_inquiries']
  loop
    execute format('drop policy if exists erp_staff_boundary on public.%I',t);
    execute format('create policy erp_staff_boundary on public.%I as restrictive for all to authenticated using ((select private.is_erp_staff())) with check ((select private.is_erp_staff()))',t);
    execute format('revoke all on table public.%I from anon',t);
    execute format('revoke truncate, references, trigger on table public.%I from authenticated',t);
  end loop;
end $$;

drop policy if exists purchase_orders_public_token_select on public.purchase_orders;
drop policy if exists sales_public_token_select on public.sales;

-- Explicit projection: never expose tokens, collection notes, remittances, or future columns.
create or replace function private.shared_document_fields(doc jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select coalesce((select jsonb_object_agg(key,value) from jsonb_each(doc)
    where key = any(array['id','date','po_number','partner_name','partner_address',
      'partner_manager','phone','email','manager','total_supply','total_vat','total_amount',
      'note','delivery_date','payment_terms'])), '{}'::jsonb)
    || jsonb_build_object('items',coalesce((select jsonb_agg(
      (select jsonb_object_agg(key,value) from jsonb_each(item)
       where key = any(array['name','spec','unit','qty','price','supply','vat','total'])) order by ord)
      from jsonb_array_elements(case when jsonb_typeof(doc->'items')='array'
        then doc->'items' else '[]'::jsonb end) with ordinality as a(item,ord)), '[]'::jsonb))
$$;
revoke all on function private.shared_document_fields(jsonb) from public, anon, authenticated;

-- These narrowly-scoped definers are intentional capability endpoints. All lookup
-- predicates are inside the functions; client-side filters cannot bypass them.
create or replace function public.get_shared_purchase_order(p_token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select private.shared_document_fields(to_jsonb(p)) from public.purchase_orders p
  where p.public_token = p_token and p_token ~ '^[a-f0-9]{64}$' limit 1
$$;
create or replace function public.get_shared_sale(p_token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select private.shared_document_fields(to_jsonb(s)) || jsonb_build_object('document_no',
    'ASPEC-' || to_char(s.date,'YYMMDD') || '-T' || (select
      lpad(count(*)::text,greatest(2,length(count(*)::text)),'0')
      from public.sales n where n.date=s.date and n.id<=s.id))
  from public.sales s where s.public_token = p_token and p_token ~ '^[a-f0-9]{64}$' limit 1
$$;
revoke all on function public.get_shared_purchase_order(text), public.get_shared_sale(text) from public;
grant execute on function public.get_shared_purchase_order(text), public.get_shared_sale(text) to anon, authenticated;

-- Storage metadata policies also apply to uploads, replacement, signing and removal.
drop policy if exists "Allow All 1psdx5_0" on storage.objects;
drop policy if exists "Allow All 1psdx5_1" on storage.objects;
drop policy if exists "Allow All 1psdx5_2" on storage.objects;
drop policy if exists "Allow All 1psdx5_3" on storage.objects;
drop policy if exists "Allow All 25pf_0" on storage.objects;
drop policy if exists "Allow All 25pf_1" on storage.objects;
drop policy if exists "Allow All 25pf_2" on storage.objects;
drop policy if exists "Allow All 25pf_3" on storage.objects;
create policy erp_private_files_select on storage.objects for select to authenticated
 using (bucket_id in ('erp','memos') and (select private.is_erp_staff()));
create policy erp_private_files_insert on storage.objects for insert to authenticated
 with check (bucket_id in ('erp','memos') and (select private.is_erp_staff()));
create policy erp_private_files_update on storage.objects for update to authenticated
 using (bucket_id in ('erp','memos') and (select private.is_erp_staff()))
 with check (bucket_id in ('erp','memos') and (select private.is_erp_staff()));
create policy erp_private_files_delete on storage.objects for delete to authenticated
 using (bucket_id in ('erp','memos') and (select private.is_erp_staff()));

-- Durable references in existing records remain valid through PrivateStorage.
update storage.buckets set public=false where id in ('erp','memos');
notify pgrst, 'reload schema';

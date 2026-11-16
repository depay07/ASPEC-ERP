-- Run after the migration in a transaction and ALWAYS roll back. No business rows
-- or files are changed; request claims are local to this connection.
do $$ declare doc jsonb; token text; begin
  select public_token into token from public.sales where public_token is not null limit 1;
  if token is not null then
    doc := public.get_shared_sale(token);
    if doc is null or doc ?| array['public_token','collection_note','collected_amount','is_tax_invoice']
      then raise exception 'Sale capability projection failed'; end if;
    perform set_config('test.sale_token',token,true);
  end if;
  select public_token into token from public.purchase_orders where public_token is not null limit 1;
  if token is not null then
    doc := public.get_shared_purchase_order(token);
    if doc is null or doc ?| array['public_token','remitted_amount','end_user']
      then raise exception 'Purchase capability projection failed'; end if;
    perform set_config('test.po_token',token,true);
  end if;
end $$;

set local role anon;
do $$ begin
  begin perform 1 from public.sales limit 1; raise exception 'Anonymous sales enumeration allowed';
    exception when insufficient_privilege then null; end;
  begin perform 1 from public.purchase_orders limit 1; raise exception 'Anonymous PO enumeration allowed';
    exception when insufficient_privilege then null; end;
  if exists(select 1 from storage.objects where bucket_id in ('erp','memos'))
    then raise exception 'Anonymous file enumeration allowed'; end if;
  begin
    insert into storage.objects(bucket_id,name) values ('memos','security-test-never-committed');
    raise exception 'Anonymous upload allowed';
    exception when insufficient_privilege then null;
  end;
  if public.get_shared_sale(null) is not null
    or public.get_shared_sale('') is not null
    or public.get_shared_sale(repeat('0',64)) is not null
    or public.get_shared_purchase_order('%') is not null
    then raise exception 'Invalid capability accepted'; end if;
  if current_setting('test.sale_token',true) is not null and
    public.get_shared_sale(current_setting('test.sale_token')) is null
    then raise exception 'Valid sale token rejected'; end if;
  if current_setting('test.po_token',true) is not null and
    public.get_shared_purchase_order(current_setting('test.po_token')) is null
    then raise exception 'Valid PO token rejected'; end if;
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"ffffffff-ffff-4fff-8fff-ffffffffffff","role":"authenticated"}',true);
do $$ declare t text; n bigint; begin
  foreach t in array array['bom','bookkeeping','calendar_events','expenses','meeting_logs',
    'memo_folders','memos','orders','partners','price_list_items','products','projects',
    'purchase_orders','purchases','quotes','rental_items','rentals','sales','website_inquiries'] loop
    execute format('select count(*) from public.%I',t) into n;
    if n<>0 then raise exception 'Unapproved account can read %',t; end if;
  end loop;
  if exists(select 1 from storage.objects where bucket_id in ('erp','memos'))
    then raise exception 'Unapproved account can list files'; end if;
  begin
    insert into storage.objects(bucket_id,name) values ('erp','security-test-never-committed');
    raise exception 'Unapproved account can upload';
    exception when insufficient_privilege then null;
  end;
  begin
    insert into private.erp_staff(user_id) values ('ffffffff-ffff-4fff-8fff-ffffffffffff');
    raise exception 'Account can grant itself staff access';
    exception when insufficient_privilege then null;
  end;
end $$;

select set_config('request.jwt.claims','{"sub":"03cd1d2d-9d0e-4ac4-a785-ad78e34168ef","role":"authenticated"}',true);
do $$ begin
  if not private.is_erp_staff() or not exists(select 1 from public.partners)
    or not exists(select 1 from storage.objects where bucket_id='erp')
    then raise exception 'Existing staff access broken'; end if;
end $$;
select set_config('request.jwt.claims','{"sub":"d6a2c214-7b31-408e-abda-01a9e3806bcd","role":"authenticated"}',true);
do $$ begin
  if not private.is_erp_staff() or not exists(select 1 from public.partners)
    then raise exception 'Second staff access broken'; end if;
end $$;
reset role;
select 'PASS: token-only shares, private files, staff allowlist, no self-enrolment' AS security_checks;

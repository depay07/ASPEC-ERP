// Install the pinned test-only engine with:
// npm install --prefix dist/security-test-tools --no-audit --no-fund @electric-sql/pglite@0.3.14
import {PGlite} from '../dist/security-test-tools/node_modules/@electric-sql/pglite/dist/index.js';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

const db = new PGlite();
const tables = ['bom','bookkeeping','calendar_events','expenses','meeting_logs','memo_folders',
 'memos','orders','partners','price_list_items','products','projects','purchase_orders',
 'purchases','quotes','rental_items','rentals','sales','website_inquiries'];
try {
 await db.exec(`
  create role anon; create role authenticated;
  create schema auth; create schema storage;
  create table auth.users(id uuid primary key);
  insert into auth.users values ('03cd1d2d-9d0e-4ac4-a785-ad78e34168ef'),('d6a2c214-7b31-408e-abda-01a9e3806bcd');
  create function auth.uid() returns uuid language sql stable as
    $$ select (nullif(current_setting('request.jwt.claims',true),'')::jsonb ->> 'sub')::uuid $$;
  grant usage on schema auth,public,storage to anon,authenticated;
  create table storage.buckets(id text primary key, public boolean);
  insert into storage.buckets values ('erp',true),('memos',true),('erp-files',true);
  create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
  alter table storage.objects enable row level security;
  grant all on storage.objects to anon,authenticated;
  insert into storage.objects(bucket_id,name) values ('erp','fixture.pdf'),('memos','fixture.png');
 `);
 for (const table of tables) {
  await db.exec(`create table public.${table}(id bigint primary key,date date,public_token text,items jsonb,
    partner_name text,collection_note text,collected_amount numeric,remitted_amount numeric,end_user text);
    alter table public.${table} enable row level security;
    grant all on public.${table} to anon,authenticated;
    create policy staff_all on public.${table} for all to authenticated using(true) with check(true);
    insert into public.${table}(id,date,public_token,items,partner_name,collection_note,end_user)
      values(1,'2026-11-15',repeat('a',64),'[{"name":"fixture","qty":1,"cost_price":999}]','fixture','private','private');`);
 }
 await db.exec(`create policy sales_public_token_select on public.sales for select to anon using(public_token is not null);
 create policy purchase_orders_public_token_select on public.purchase_orders for select to anon using(public_token is not null);`);
 for(const [bucket,prefix] of [['memos','1psdx5'],['erp','25pf']]) {
  for (const [i,command] of ['select','insert','update','delete'].entries()) {
   const clause = command==='insert' ? 'with check' : 'using';
   await db.exec(`create policy "Allow All ${prefix}_${i}" on storage.objects for ${command}
      to anon,authenticated ${clause} (bucket_id='${bucket}');`);
  }
 }
 const migration = await readFile(new URL('../supabase/migrations/20261114164019_security_access_boundaries.sql',import.meta.url),'utf8');
 const checks = await readFile(new URL('./security-access.sql',import.meta.url),'utf8');
 await db.exec('begin;'+migration+checks+'rollback;');
 // Also assert writes/deletes under the final policies, using synthetic rows only.
 await db.exec(migration);
 await db.exec(`begin;set local role anon;delete from storage.objects where bucket_id='erp';reset role;`);
 assert.equal((await db.query("select count(*)::integer as n from storage.objects where bucket_id='erp'")).rows[0].n,1);
 await db.exec('rollback;');
 await db.exec(`begin;set local role authenticated;
 select set_config('request.jwt.claims','{"sub":"03cd1d2d-9d0e-4ac4-a785-ad78e34168ef"}',true);
 insert into storage.objects(bucket_id,name) values('erp','allowed.pdf');
 update storage.objects set name='renamed.pdf' where name='allowed.pdf';
 delete from storage.objects where name='renamed.pdf';
 insert into public.partners(id,partner_name) values (2,'allowed');
 update public.partners set partner_name='renamed' where id=2;
 delete from public.partners where id=2;
 rollback;`);
 const result = await db.query("select public.get_shared_sale(repeat('a',64)) as doc");
 assert.equal(result.rows[0].doc.items[0].cost_price,undefined);
 assert.equal(result.rows[0].doc.document_no,'ASPEC-261115-T01');
 console.log('PASS: real PostgreSQL RLS denies anon/outsider reads, uploads and deletion; staff CRUD and token lookup work; private columns excluded.');
} finally { await db.close(); }

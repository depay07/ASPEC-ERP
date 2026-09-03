alter table public.orders
    add column if not exists status text;

update public.orders
set status = 'pending'
where status is null or status not in ('pending', 'completed');

alter table public.orders
    alter column status set default 'pending',
    alter column status set not null;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'orders_status_check'
          and conrelid = 'public.orders'::regclass
    ) then
        alter table public.orders
            add constraint orders_status_check
            check (status in ('pending', 'completed'));
    end if;
end $$;

alter table public.sales
    add column if not exists source_order_id bigint;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'sales_source_order_id_fkey'
          and conrelid = 'public.sales'::regclass
    ) then
        alter table public.sales
            add constraint sales_source_order_id_fkey
            foreign key (source_order_id)
            references public.orders(id)
            on delete set null;
    end if;
end $$;

-- 기존 자료는 거래처, 금액, 품목이 모두 같고 양쪽에서 유일한 경우에만 연결한다.
with candidate_pairs as (
    select s.id as sale_id, o.id as order_id
    from public.sales s
    join public.orders o
      on nullif(btrim(s.partner_name), '') = nullif(btrim(o.partner_name), '')
     and coalesce(s.total_supply, 0) = coalesce(o.total_supply, 0)
     and coalesce(s.total_vat, 0) = coalesce(o.total_vat, 0)
     and coalesce(s.total_amount, 0) = coalesce(o.total_amount, 0)
     and coalesce(s.items, '[]'::jsonb) = coalesce(o.items, '[]'::jsonb)
     and (s.date is null or o.date is null or s.date >= o.date)
    where s.source_order_id is null
),
sale_counts as (
    select sale_id, count(*) as candidate_count
    from candidate_pairs
    group by sale_id
),
order_counts as (
    select order_id, count(*) as candidate_count
    from candidate_pairs
    group by order_id
),
safe_pairs as (
    select p.sale_id, p.order_id
    from candidate_pairs p
    join sale_counts sc on sc.sale_id = p.sale_id and sc.candidate_count = 1
    join order_counts oc on oc.order_id = p.order_id and oc.candidate_count = 1
)
update public.sales s
set source_order_id = p.order_id
from safe_pairs p
where s.id = p.sale_id
  and s.source_order_id is null;

create unique index if not exists sales_source_order_id_unique_idx
    on public.sales(source_order_id)
    where source_order_id is not null;

update public.orders o
set status = case
    when exists (
        select 1
        from public.sales s
        where s.source_order_id = o.id
    ) then 'completed'
    else 'pending'
end;

create or replace function public.sync_order_delivery_status_from_sales()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
    if tg_op in ('UPDATE', 'DELETE') and old.source_order_id is not null then
        update public.orders o
        set status = case
            when exists (
                select 1 from public.sales s
                where s.source_order_id = old.source_order_id
            ) then 'completed'
            else 'pending'
        end
        where o.id = old.source_order_id;
    end if;

    if tg_op in ('INSERT', 'UPDATE') and new.source_order_id is not null then
        update public.orders
        set status = 'completed'
        where id = new.source_order_id;
    end if;

    if tg_op = 'DELETE' then
        return old;
    end if;
    return new;
end;
$$;

drop trigger if exists sync_order_delivery_status_from_sales on public.sales;
create trigger sync_order_delivery_status_from_sales
after insert or update of source_order_id or delete
on public.sales
for each row
execute function public.sync_order_delivery_status_from_sales();

comment on column public.orders.status is '판매등록에 따른 납품 상태: pending 또는 completed';
comment on column public.sales.source_order_id is '판매등록 시 불러온 원본 주문 ID';

notify pgrst, 'reload schema';

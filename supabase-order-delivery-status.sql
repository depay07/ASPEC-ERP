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

comment on column public.orders.status is '사용자가 주문 수정 화면에서 지정하는 납품 상태: pending 또는 completed';

notify pgrst, 'reload schema';

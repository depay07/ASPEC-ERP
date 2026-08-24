alter table public.purchase_orders
    add column if not exists payment_terms text;

update public.purchase_orders
set payment_terms = 'next_month_end'
where payment_terms is null;

alter table public.purchase_orders
    alter column payment_terms set default 'next_month_end',
    alter column payment_terms set not null;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'purchase_orders_payment_terms_check'
          and conrelid = 'public.purchase_orders'::regclass
    ) then
        alter table public.purchase_orders
            add constraint purchase_orders_payment_terms_check
            check (payment_terms in ('current_month_end', 'next_month_end'));
    end if;
end $$;

comment on column public.purchase_orders.delivery_date is '실제 입고일';
comment on column public.purchase_orders.payment_terms is '송금 결제조건: current_month_end 또는 next_month_end';

notify pgrst, 'reload schema';

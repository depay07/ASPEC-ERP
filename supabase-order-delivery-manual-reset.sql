drop trigger if exists sync_order_delivery_status_from_sales on public.sales;
drop function if exists public.sync_order_delivery_status_from_sales();
drop index if exists public.sales_source_order_id_unique_idx;

alter table public.sales
    drop constraint if exists sales_source_order_id_fkey,
    drop column if exists source_order_id;

-- 이전 자동 매칭 결과를 제거하고 사용자가 직접 체크하도록 초기화한다.
update public.orders
set status = 'pending';

comment on column public.orders.status is '사용자가 주문 수정 화면에서 지정하는 납품 상태: pending 또는 completed';

notify pgrst, 'reload schema';

alter table public.sales
add column if not exists public_token text;

create unique index if not exists sales_public_token_key
on public.sales (public_token)
where public_token is not null;

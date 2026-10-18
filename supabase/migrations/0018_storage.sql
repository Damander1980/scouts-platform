-- 0018: private storage for receipts; public storage for site photos (consent enforced in app).
insert into storage.buckets (id, name, public) values ('receipts', 'receipts', false) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('site', 'site', true) on conflict (id) do nothing;

-- Paths are "<org_id>/<file>". Members upload their own receipts; the treasurer reads them.
create policy "receipts: members upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and public.is_org_member(((storage.foldername(name))[1])::uuid));
create policy "receipts: treasurer read" on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and public.is_treasurer(((storage.foldername(name))[1])::uuid));

create policy "site: leaders upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'site' and public.is_org_leader(((storage.foldername(name))[1])::uuid));
create policy "site: leaders delete" on storage.objects for delete to authenticated
  using (bucket_id = 'site' and public.is_org_leader(((storage.foldername(name))[1])::uuid));

create or replace function public.public_campaign(p_slug text)
returns table (slug text, title text, description text, target_cents int, active boolean, org_name text, org_slug text, raised bigint, connected boolean)
language sql stable security definer as $$
  select c.slug, c.title, c.description, c.target_cents, c.active, o.name, o.slug,
         (select coalesce(sum(amount_cents), 0) from public.donations d where d.campaign_id = c.id),
         o.stripe_account_id is not null
  from public.donation_campaigns c join public.organizations o on o.id = c.org_id where c.slug = p_slug;
$$;
grant execute on function public.public_campaign(text) to anon;

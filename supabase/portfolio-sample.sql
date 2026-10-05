-- Run only in the fresh local portfolio database after migrations.
-- This deliberately fictional account has no government-source identity.
insert into public.providers (
  id, abn, entity_name, business_name, normalized_entity_name,
  normalized_business_name, first_seen_at, last_seen_at, is_sample
) values (
  '10000000-0000-4000-8000-000000000001', '00000000000',
  'Portfolio Example Care', 'Portfolio Example Care',
  'PORTFOLIO EXAMPLE CARE', 'PORTFOLIO EXAMPLE CARE', now(), now(), true
) on conflict (id) do nothing;

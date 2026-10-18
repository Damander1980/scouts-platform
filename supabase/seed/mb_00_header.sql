-- 0004: Replace the merit badge catalog with the full official 2026 list.
-- Requirement text is our own plain-language summary that follows the official
-- numbering and counts; the exact wording lives on scouting.org (linked in-app).
-- Generated from supabase/seed/mb_*.sql. Safe only while no scout has badge progress.

delete from public.advancement_items where kind = 'badge';

insert into public.advancement_items (kind, code, name, eagle_required, eagle_group, sort)
select 'badge', replace(v.slug, '-', '_'), v.name,
       v.slug in ('camping','citizenship-in-the-community','citizenship-in-the-nation','citizenship-in-the-world',
                  'citizenship-in-society','communication','cooking','emergency-preparedness','lifesaving',
                  'environmental-science','sustainability','family-life','first-aid','personal-fitness',
                  'personal-management','swimming','hiking','cycling'),
       case when v.slug in ('emergency-preparedness','lifesaving') then 'emergency'
            when v.slug in ('environmental-science','sustainability') then 'environment'
            when v.slug in ('swimming','hiking','cycling') then 'aquatic' end,
       100 + row_number() over (order by v.name)
from (values

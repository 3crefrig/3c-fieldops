-- Tie completion photos to the milestone (project "part") they document.
alter table public.project_photos
  add column if not exists milestone_id uuid;
create index if not exists project_photos_milestone_idx on public.project_photos(milestone_id);

create type public.membership_tier as enum ('free', 'paid');
create type public.news_category as enum ('top', 'world', 'politics', 'business', 'technology', 'science', 'health', 'sports');
create type public.theme_name as enum ('light', 'dark', 'warm');
create type public.font_size_name as enum ('small', 'normal', 'large');

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  membership_tier public.membership_tier not null default 'free',
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.stories (
  id text primary key,
  category public.news_category not null,
  headline text not null,
  summary text not null,
  source text not null,
  source_url text not null,
  published_at timestamptz not null,
  why_it_matters text not null,
  background text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.saved_stories (
  user_id uuid not null references auth.users(id) on delete cascade,
  story_id text not null references public.stories(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, story_id)
);

create table public.read_stories (
  user_id uuid not null references auth.users(id) on delete cascade,
  story_id text not null references public.stories(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (user_id, story_id)
);

create table public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme public.theme_name not null default 'light',
  font_size public.font_size_name not null default 'normal',
  categories public.news_category[] not null default array['top','world','politics','business','technology','science','health','sports']::public.news_category[],
  notification_time text not null default '08:00',
  updated_at timestamptz not null default now()
);

create index stories_published_at_idx on public.stories (published_at desc);
create index stories_category_published_at_idx on public.stories (category, published_at desc);
create index saved_stories_user_created_idx on public.saved_stories (user_id, created_at desc);
create index read_stories_user_read_idx on public.read_stories (user_id, read_at desc);

alter table public.profiles enable row level security;
alter table public.stories enable row level security;
alter table public.saved_stories enable row level security;
alter table public.read_stories enable row level security;
alter table public.user_settings enable row level security;

create policy "Users can read own profile" on public.profiles
  for select using (auth.uid() = user_id);

create policy "Users can read stories" on public.stories
  for select using (auth.role() = 'authenticated');

create policy "Users can read own saved stories" on public.saved_stories
  for select using (auth.uid() = user_id);

create policy "Users can insert own saved stories" on public.saved_stories
  for insert with check (auth.uid() = user_id);

create policy "Users can delete own saved stories" on public.saved_stories
  for delete using (auth.uid() = user_id);

create policy "Users can read own read stories" on public.read_stories
  for select using (auth.uid() = user_id);

create policy "Users can insert own read stories" on public.read_stories
  for insert with check (auth.uid() = user_id);

create policy "Users can update own read stories" on public.read_stories
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users can read own settings" on public.user_settings
  for select using (auth.uid() = user_id);

create policy "Users can insert own settings" on public.user_settings
  for insert with check (auth.uid() = user_id);

create policy "Users can update own settings" on public.user_settings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

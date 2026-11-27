# Avaliacao

## Development

You need Node.js 22.12 or newer and npm.

```sh
npm install
npm run dev
```

## Deploy to Netlify

Import the repository in Netlify. The build command and publish directory are
configured in `netlify.toml`.

Add these environment variables in the Netlify site settings before deploying:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`

Use the Supabase project URL and publishable key for both pairs. The `VITE_`
variables are included in the browser build. No secret key is required in
Netlify: privileged team-management operations run in the Supabase Edge
Function using the managed secret key. Never put a secret key in Netlify or in
a `VITE_` variable.

## Set up a new Supabase project

Create a new Supabase project and configure the local and Netlify environment
variables above with that project's URL and publishable key. The old Drizzle
migration contains an administrator email and is intentionally excluded; the
safe initial schema is provided in `supabase/migrations` without personal data.

Install the Supabase CLI, then link the new project and apply the migrations:

```sh
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
supabase functions deploy manage-team-users
```

The function keeps JWT verification enabled and reads the managed secret key
from Supabase's Edge Function environment. Do not copy that key to Netlify or
include it in the browser build.

Before creating the first admin account, add its email to the private
`admin_email_allowlist` table using the Supabase SQL Editor:

```sql
insert into public.admin_email_allowlist (email)
values (lower('admin@example.com'))
on conflict do nothing;
```

Then create that user under **Authentication → Users**. The database trigger
will grant the `admin` role. Public signups should remain disabled. If the Auth
user already exists, add the allowlist entry and grant the role explicitly
through `public.user_roles`.

Set the new project's Auth Site URL and allowed redirect URLs to include the
local development URL and the Netlify site URL, including `/reset-password`.
This setup starts with an empty database; it does not copy triagens or user
accounts from Lovable Cloud.

If the initial Auth user already exists before the allowlist entry is added,
grant the role explicitly in the SQL Editor:

```sql
insert into public.user_roles (user_id, role)
select id, 'admin'
from auth.users
where lower(email) = lower('admin@example.com')
on conflict (user_id, role) do nothing;
```

## Manage assessments

The assessment catalog is available at `/`; published assessments have a
shareable `/avaliacoes/<slug>` URL. Administrators can create and maintain
assessments from **Painel → Avaliações**. Each assessment stores its questions,
answer values, scoring method, result bands, and configurable participant fields.
Each response stores the submitted participant data with a versioned snapshot.
Scores are normalized to 0–100; review every instrument's scoring rules and
interpretation bands with the clinical team before publishing. Use the
`sem_classificacao` result category when an assessment has no defensible cutoff;
apply `20261127133000_neutral_assessment_category.sql` before accepting responses
with that category. Assessments configured for two-decimal scores also require
`20261127134500_decimal_assessment_scores.sql` before accepting responses.

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS

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
variables are included in the browser build; never put a service-role key in a
`VITE_` variable. The current app uses Supabase RLS with the publishable key.

After Netlify assigns the site URL, add it to the Supabase Auth site's URL and
allowed redirect URLs so login and password-reset links return to production.

This deployment uses the existing Supabase project. Database migrations are
kept out of this public repository because they contain an administrator email.

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS

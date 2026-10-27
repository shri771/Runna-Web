# Deploying to Vercel

Everything in the repo is ready. These are the steps only you can do.

## 1. Push the branch

```bash
git push -u origin feat/scaffold-and-plan-engine
```

Or merge to `main` first, which is simpler for a submission since evaluators
will look at the default branch:

```bash
git checkout main && git merge feat/scaffold-and-plan-engine && git push
```

## 2. Import the project

Go to **[vercel.com/new](https://vercel.com/new)** → import `shri771/Runna-Web`.

Vercel reads `vercel.json`, so the framework, build command and region are
already set. **Do not deploy yet** — add the environment variables first, or
the first build fails on a missing `DATABASE_URL`.

## 3. Environment variables

Before the first deploy, open **Environment Variables** and add these for
**Production, Preview and Development**:

| Name | Value |
|---|---|
| `DATABASE_URL` | the same Neon pooled string from your `.env.local` |
| `AUTH_SECRET` | the same value from `.env.local` |
| `ENCRYPTION_KEY` | the same value from `.env.local` |
| `AUTH_URL` | *leave unset for now* — you need the deployment URL first |

You can copy the first three out of `.env.local`. Never paste them into chat,
a commit, or an issue.

## 4. Deploy

Hit **Deploy**. The build runs `drizzle-kit migrate && next build`, so the
schema is applied automatically. Migrations are tracked in a table, so repeat
deploys are a no-op.

If the build fails, the log will say why — send it over and I will fix it.

## 5. Set `AUTH_URL` and redeploy

Once you have the URL (something like `runna-web.vercel.app`):

1. Add `AUTH_URL` = `https://<your-app>.vercel.app` — **https, no trailing slash**
2. Deployments → latest → **Redeploy**

Sign-in will not work until this is set and redeployed.

## 6. Seed the demo account

So an evaluator lands on a working plan instead of an empty database:

```bash
# from your machine, pointed at the same Neon database
npm run db:seed
```

That gives them `demo@runna.local` / `runna-demo-2026`.

## 7. Check it in an incognito window

The brief requires every link to work without extra permissions.

- [ ] Landing page loads
- [ ] Sign up with a new email, reach the plan builder
- [ ] Drag the mileage slider, the curve redraws
- [ ] Create the plan, land on Today
- [ ] Sign out, sign in as the demo account
- [ ] Today, Plan, Calendar, Link, Progress, Settings all render
- [ ] Log a run by hand on Link, link it to a session
- [ ] Delete the plan from Settings, build a new one

## Optional: Strava

If you want the consent screen in the demo video, register at
[strava.com/settings/api](https://www.strava.com/settings/api) with callback
domain `<your-app>.vercel.app`, then add to Vercel:

| Name | Value |
|---|---|
| `STRAVA_CLIENT_ID` | from the Strava app page |
| `STRAVA_REDIRECT_URI` | `https://<your-app>.vercel.app/api/integrations/strava/callback` |

Importing runs back is not implemented, so the return trip reports that and
sends the user to the hand-logged form.

## Known free-tier behaviour

**Neon suspends an idle database.** The first request after a quiet spell takes
roughly half a second longer while it wakes. Worth mentioning in your demo
video so it does not read as a bug.

**Vercel Hobby is non-commercial only**, which is fine for a student project.

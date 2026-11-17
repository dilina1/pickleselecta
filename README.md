# 🥒 PickleSelecta

Build harmonically mixed DJ sets. Pick a seed song, get tracks that mix with it (same key, ±1 on the Camelot wheel, relative major/minor, within a BPM range), add them to a set, and save it to YouTube Music.

Forked from [Selecta](https://github.com/knightspore/selecta) by Ciaran, rebuilt to run without a Spotify account.

## How it works

- **Search, cover art, 30s previews:** Deezer public API (no key)
- **Key, BPM, similar tracks:** ReccoBeats (no key), matched by ISRC
- **Save to YouTube Music:** YouTube Data API v3 via Google sign-in (only needed for saving)

## Setup

Env vars (see `.env.example`):

| Var | Purpose |
| --- | --- |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google OAuth client (Web) with the YouTube Data API v3 enabled |
| `NEXTAUTH_SECRET` | Any long random string |
| `NEXTAUTH_URL` | Your deployed URL |

Authorised redirect URI in Google Cloud: `<NEXTAUTH_URL>/api/auth/callback/google`

Saving a 20-track set costs about 3,000 of YouTube's free 10,000 daily quota units (each track needs a search and an insert).

## Dev

```
yarn install
yarn dev
yarn test
```

MIT licensed.

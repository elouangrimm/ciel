# Minimal Bluesky Client

A hyper-minimal Bluesky client. Read your timeline. Post text. That's it.

## Features

- View timeline (plain text posts only)
- Post plain text messages (300 chars max)
- Like and repost
- Nothing else

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create an app password on Bluesky:

   - Go to https://bsky.app/settings/app-passwords
   - Create a new app password
   - Save it securely

3. Run the server:

```bash
node server.js
```

4. Open http://localhost:3000

## Deployment to Vercel

1. Fork or clone this repository
2. Connect your repository to Vercel
3. Set the following environment variable in your Vercel dashboard:
   - `SESSION_SECRET`: A secure random string for signing session cookies
4. Deploy!

The app is configured to work with Vercel's serverless functions via the included `vercel.json` configuration.

## Usage

1. Login with your Bluesky handle and app password
2. View your timeline
3. Post plain text
4. Like and repost

## Security Notes

- App passwords have full account access
- Never share your app password
- Use HTTPS in production
- Set a secure SESSION_SECRET environment variable in production

## Limitations

- Plain text only (no rich text, links, mentions)
- No embeds (images, videos, quotes)
- No replies or threads
- No profiles or search
- Manual refresh only

This is intentionally minimal. If you want features, use the real Bluesky app.

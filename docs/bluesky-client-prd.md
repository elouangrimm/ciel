# Hyper-Minimal Bluesky Client PRD

## Overview

An actually minimal Bluesky client. Read your timeline. Post text. That's it.

## What This Actually Is

- A timeline viewer showing plain text posts from people you follow
- A text box to post your own plain text
- Like and repost buttons
- Nothing else

No rich text, no embeds, no replies, no threads, no profiles. If a post has a link, it shows as plain text. If someone mentions you, it's just text. This is SMS for Bluesky.

## Technical Constraints

- **Dependencies**: Only `@atproto/api` (non-negotiable) and Express for serving
- **Frontend**: Raw HTML, vanilla JS, minimal CSS
- **No build tools**: No webpack, no bundlers, no transpilation
- **No frameworks**: No React, Vue, or any UI libraries

## Core Architecture

### Backend (Express Server)

```
server.js
├── Serves static files
├── Proxies AT Protocol API calls (CORS workaround)
└── Handles auth token storage (server-side sessions)
```

### Frontend Structure

```
public/
├── index.html     (single page, all UI elements)
├── app.js         (all client logic)
└── style.css      (sub-100 lines)
```

## Authentication Flow

**Critical**: Users must create an app password at https://bsky.app/settings/app-passwords

1. Login form: handle + app password
2. POST to `/api/login` → server calls `agent.login()`
3. Server stores session + tokens
4. All API calls include session cookie

**Security Note**: App passwords = full account access. This ain't OAuth.

## Features Specification

### 1. Feed Display

```html
<div id="feed">
  <div class="post" data-uri="at://did:plc:xxx/app.bsky.feed.post/xxx">
    <div class="author">
      <img class="avatar" src="...">
      <span class="display-name">Name</span>
      <span class="handle">@handle</span>
    </div>
    <div class="content">Plain text content only</div>
    <div class="actions">
      <button class="like">♥ 42</button>
      <button class="repost">↻ 12</button>
    </div>
  </div>
</div>
```

**Implementation Notes**:
- Simple pagination with "Load More" button
- Store cursor for next page
- No caching, just append to DOM
- Display text as-is (no parsing)

### 2. Post Composition

```html
<div id="composer">
  <textarea id="post-text" maxlength="300"></textarea>
  <span id="char-count">0/300</span>
  <button id="post-btn">Post</button>
</div>
```

**Simplified**:
- Basic string length counting (good enough)
- No facet parsing
- Just send plain text

### 3. Interactions

**Like**: 
```js
POST /api/like
body: { uri, cid }
→ agent.like(uri, cid)
```

**Repost**:
```js
POST /api/repost  
body: { uri, cid }
→ agent.repost(uri, cid)
```

## Data Flow

```
Browser ←→ Express Server ←→ Bluesky API
         (cookies)        (app password)
```

Every action goes through your server. No direct API calls.

## Implementation Priorities

### Phase 1 (MVP)
1. Auth flow with session management
2. Read-only feed display (plain text)
3. Load more pagination

### Phase 2 
1. Post plain text messages
2. Like/unlike functionality
3. Repost functionality

### Phase 3
1. Auto-refresh feed
2. Better error messages
3. Logout functionality

## Key Technical Decisions

### Server-Side Everything
All auth and API calls go through Express. Simpler than handling tokens in the browser.

### Plain Text Only
No parsing facets, no rendering rich text. What you type is what you get.

### Manual Refresh
No WebSockets, no polling. Want new posts? Refresh the page.

### Minimal CSS Approach
```css
/* Entire theme in ~30 lines */
body { max-width: 600px; margin: 0 auto; font: 16px/1.5 system-ui; }
.post { border-bottom: 1px solid #e0e0e0; padding: 12px; }
.avatar { width: 48px; height: 48px; border-radius: 24px; }
button { cursor: pointer; }
```

## Gotchas & Warnings

1. **No Real-time Updates**: Manual refresh only
2. **No Rich Text**: Links and mentions show as plain text
3. **Rate Limits**: Bluesky will throttle you - add delays
4. **URI vs CID**: Every post needs both for interactions
5. **Session Expiry**: Tokens expire, handle re-login gracefully

## Security Requirements

1. **Never** expose app passwords to client
2. Use HTTPS in production
3. Escape HTML in posts (XSS prevention)
4. Session cookies with httpOnly flag

## Development Setup

```bash
mkdir minimal-bsky && cd minimal-bsky
npm init -y
npm install express express-session @atproto/api

# Create files
touch server.js
mkdir public
touch public/{index.html,app.js,style.css}

# Run it
node server.js
```

## API Endpoints Needed

```
POST /api/login     - Create session
POST /api/logout    - Destroy session  
GET  /api/feed      - Get timeline
POST /api/post      - Create post
POST /api/like      - Like a post
POST /api/repost    - Repost
```

## Metrics for Success

- Initial load < 50KB total
- Zero client-side dependencies
- Under 200 lines of JS
- Works on a phone (barely)

## Out of Scope (Forever)

- Rich text (links, mentions, hashtags)
- Quote posts
- Embeds (images, links, videos)
- Reply threads
- Notifications
- DMs  
- Media uploads
- User profiles
- Search
- Custom feeds
- Following/unfollowing
- User discovery

---

**Final Note**: This is stupid simple. No fancy text parsing, no embed rendering, no complex interactions. Just read posts from people you follow and post plain text. If you want links to be clickable, use a browser extension.
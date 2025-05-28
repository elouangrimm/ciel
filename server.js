const express = require("express");
const session = require("express-session");
const { BskyAgent } = require("@atproto/api");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static("public"));

// Session configuration
// WARNING: In production/serverless environments, you need a persistent session store
// The default MemoryStore is not suitable for production
app.use(
  session({
    secret:
      process.env.SESSION_SECRET || "your-secret-key-change-this-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // Use secure cookies in production (HTTPS)
      maxAge: 1000 * 60 * 60 * 2, // 2 hours
      sameSite: "lax", // Help with cross-site cookie issues
    },
  })
);

// Store agents per session - removed for serverless compatibility
// const agents = new Map();

// Helper to get or create agent for session
async function getAgent(session, authHeader = null) {
  const agent = new BskyAgent({
    service: "https://bsky.social",
  });

  // Try to get auth from header first (for serverless compatibility)
  if (authHeader) {
    try {
      const authData = JSON.parse(authHeader);
      if (
        authData.accessJwt &&
        authData.refreshJwt &&
        authData.did &&
        authData.handle
      ) {
        await agent.resumeSession({
          did: authData.did,
          handle: authData.handle,
          accessJwt: authData.accessJwt,
          refreshJwt: authData.refreshJwt,
        });
        return agent;
      }
    } catch (error) {
      console.error("Failed to parse auth header:", error);
    }
  }

  // Fall back to session auth
  if (
    session.accessJwt &&
    session.refreshJwt &&
    session.did &&
    session.handle
  ) {
    try {
      await agent.resumeSession({
        did: session.did,
        handle: session.handle,
        accessJwt: session.accessJwt,
        refreshJwt: session.refreshJwt,
      });
    } catch (error) {
      console.error("Failed to resume session:", error);
      throw new Error("Session expired");
    }
  }

  return agent;
}

// API Routes

// Serve index.html for root and non-API routes
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Check session status
app.get("/api/session", (req, res) => {
  if (req.session.authenticated) {
    res.json({
      authenticated: true,
      handle: req.session.handle,
    });
  } else {
    res.json({ authenticated: false });
  }
});

// Login
app.post("/api/login", async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ error: "Handle and password required" });
    }

    const agent = await getAgent(req.session);
    const response = await agent.login({ identifier, password });

    // Store auth info and tokens in session
    req.session.did = response.data.did;
    req.session.handle = response.data.handle;
    req.session.accessJwt = response.data.accessJwt;
    req.session.refreshJwt = response.data.refreshJwt;
    req.session.authenticated = true;

    // Explicitly save the session
    req.session.save((err) => {
      if (err) {
        console.error("Session save error:", err);
        return res.status(500).json({ error: "Failed to save session" });
      }
      // Return auth tokens to client for client-side storage as backup
      res.json({
        success: true,
        handle: response.data.handle,
        did: response.data.did,
        accessJwt: response.data.accessJwt,
        refreshJwt: response.data.refreshJwt,
      });
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(401).json({ error: "Login failed" });
  }
});

// Logout
app.post("/api/logout", (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// Get user profile
app.get("/api/profile", async (req, res) => {
  const authHeader = req.headers["x-auth-data"];

  if (!req.session.authenticated && !authHeader) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    console.log("Profile request - Session data:", {
      did: req.session.did,
      handle: req.session.handle,
      hasAccessToken: !!req.session.accessJwt,
      hasRefreshToken: !!req.session.refreshJwt,
      hasAuthHeader: !!authHeader,
    });

    const agent = await getAgent(req.session, authHeader);

    // Get DID from auth header if not in session
    let actorDid = req.session.did;
    if (!actorDid && authHeader) {
      try {
        const authData = JSON.parse(authHeader);
        actorDid = authData.did;
      } catch (e) {}
    }

    // Fetch the user's profile
    const profile = await agent.getProfile({
      actor: actorDid,
    });

    res.json({
      handle: profile.data.handle,
      displayName: profile.data.displayName,
      avatar: profile.data.avatar,
      description: profile.data.description,
    });
  } catch (error) {
    console.error("Profile error:", error);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

// Get feed
app.get("/api/feed", async (req, res) => {
  const authHeader = req.headers["x-auth-data"];

  if (!req.session.authenticated && !authHeader) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const agent = await getAgent(req.session, authHeader);
    const { cursor } = req.query;

    const timeline = await agent.getTimeline({
      cursor,
      limit: 50,
    });

    res.json(timeline.data);
  } catch (error) {
    console.error("Feed error:", error);
    res.status(500).json({ error: "Failed to fetch feed" });
  }
});

// Create post
app.post("/api/post", async (req, res) => {
  const authHeader = req.headers["x-auth-data"];

  if (!req.session.authenticated && !authHeader) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const { text } = req.body;

    if (!text || text.length > 300) {
      return res.status(400).json({ error: "Invalid post text" });
    }

    const agent = await getAgent(req.session, authHeader);
    const post = await agent.post({ text });

    res.json({ success: true, uri: post.uri });
  } catch (error) {
    console.error("Post error:", error);
    res.status(500).json({ error: "Failed to create post" });
  }
});

// Like post
app.post("/api/like", async (req, res) => {
  const authHeader = req.headers["x-auth-data"];

  if (!req.session.authenticated && !authHeader) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const { uri, cid } = req.body;

    if (!uri || !cid) {
      return res.status(400).json({ error: "URI and CID required" });
    }

    const agent = await getAgent(req.session, authHeader);
    await agent.like(uri, cid);

    res.json({ success: true });
  } catch (error) {
    console.error("Like error:", error);
    res.status(500).json({ error: "Failed to like post" });
  }
});

// Unlike post
app.post("/api/unlike", async (req, res) => {
  const authHeader = req.headers["x-auth-data"];

  if (!req.session.authenticated && !authHeader) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const { uri } = req.body;

    if (!uri) {
      return res.status(400).json({ error: "URI required" });
    }

    const agent = await getAgent(req.session, authHeader);
    await agent.deleteLike(uri);

    res.json({ success: true });
  } catch (error) {
    console.error("Unlike error:", error);
    res.status(500).json({ error: "Failed to unlike post" });
  }
});

// Repost
app.post("/api/repost", async (req, res) => {
  const authHeader = req.headers["x-auth-data"];

  if (!req.session.authenticated && !authHeader) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const { uri, cid } = req.body;

    if (!uri || !cid) {
      return res.status(400).json({ error: "URI and CID required" });
    }

    const agent = await getAgent(req.session, authHeader);
    await agent.repost(uri, cid);

    res.json({ success: true });
  } catch (error) {
    console.error("Repost error:", error);
    res.status(500).json({ error: "Failed to repost" });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Export for Vercel
module.exports = app;

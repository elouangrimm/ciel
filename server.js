const express = require("express");
const session = require("express-session");
const { BskyAgent } = require("@atproto/api");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static("public"));
app.use(
  session({
    secret: "your-secret-key-change-this-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false, // Set to true in production with HTTPS
      maxAge: 1000 * 60 * 60 * 2, // 2 hours
    },
  })
);

// Store agents per session
const agents = new Map();

// Helper to get or create agent for session
function getAgent(sessionId) {
  if (!agents.has(sessionId)) {
    agents.set(
      sessionId,
      new BskyAgent({
        service: "https://bsky.social",
      })
    );
  }
  return agents.get(sessionId);
}

// API Routes

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

    const agent = getAgent(req.sessionID);
    const response = await agent.login({ identifier, password });

    // Store auth info in session
    req.session.did = response.data.did;
    req.session.handle = response.data.handle;
    req.session.authenticated = true;

    res.json({ success: true, handle: response.data.handle });
  } catch (error) {
    console.error("Login error:", error);
    res.status(401).json({ error: "Login failed" });
  }
});

// Logout
app.post("/api/logout", (req, res) => {
  agents.delete(req.sessionID);
  req.session.destroy();
  res.json({ success: true });
});

// Get feed
app.get("/api/feed", async (req, res) => {
  if (!req.session.authenticated) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const agent = getAgent(req.sessionID);
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
  if (!req.session.authenticated) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const { text } = req.body;

    if (!text || text.length > 300) {
      return res.status(400).json({ error: "Invalid post text" });
    }

    const agent = getAgent(req.sessionID);
    const post = await agent.post({ text });

    res.json({ success: true, uri: post.uri });
  } catch (error) {
    console.error("Post error:", error);
    res.status(500).json({ error: "Failed to create post" });
  }
});

// Like post
app.post("/api/like", async (req, res) => {
  if (!req.session.authenticated) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const { uri, cid } = req.body;

    if (!uri || !cid) {
      return res.status(400).json({ error: "URI and CID required" });
    }

    const agent = getAgent(req.sessionID);
    await agent.like(uri, cid);

    res.json({ success: true });
  } catch (error) {
    console.error("Like error:", error);
    res.status(500).json({ error: "Failed to like post" });
  }
});

// Unlike post
app.post("/api/unlike", async (req, res) => {
  if (!req.session.authenticated) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const { uri } = req.body;

    if (!uri) {
      return res.status(400).json({ error: "URI required" });
    }

    const agent = getAgent(req.sessionID);
    await agent.deleteLike(uri);

    res.json({ success: true });
  } catch (error) {
    console.error("Unlike error:", error);
    res.status(500).json({ error: "Failed to unlike post" });
  }
});

// Repost
app.post("/api/repost", async (req, res) => {
  if (!req.session.authenticated) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const { uri, cid } = req.body;

    if (!uri || !cid) {
      return res.status(400).json({ error: "URI and CID required" });
    }

    const agent = getAgent(req.sessionID);
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

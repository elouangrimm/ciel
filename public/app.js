// State
let currentCursor = null;
let isLoading = false;
let currentUser = null; // Store current user info
let authData = null; // Store auth tokens for serverless compatibility

// DOM elements
const loginScreen = document.getElementById("login-screen");
const mainScreen = document.getElementById("main-screen");
const loginForm = document.getElementById("login-form");
const logoutBtn = document.getElementById("logout-btn");
const postText = document.getElementById("post-text");
const charCount = document.getElementById("char-count");
const postBtn = document.getElementById("post-btn");
const feed = document.getElementById("feed");

// Event listeners
loginForm.addEventListener("submit", handleLogin);
logoutBtn.addEventListener("click", handleLogout);
postText.addEventListener("input", updateCharCount);
postBtn.addEventListener("click", handlePost);

// Check for existing session on page load
checkSession();

// Check session
async function checkSession() {
  const loadingEl = document.getElementById("loading");

  try {
    const response = await fetch("/api/session");
    const data = await response.json();

    loadingEl.style.display = "none";

    if (data.authenticated) {
      loginScreen.style.display = "none";
      mainScreen.style.display = "block";
      currentUser = data; // Store user info
      updateComposerProfile(); // Update composer with user info
      loadFeed();
    } else {
      loginScreen.style.display = "block";
    }
  } catch (error) {
    console.error("Session check failed:", error);
    loadingEl.style.display = "none";
    loginScreen.style.display = "block";
  }
}

// Update composer with user profile
function updateComposerProfile() {
  if (!currentUser) return;

  // We'll need to fetch the full profile to get avatar and display name
  fetchUserProfile();
}

// Fetch user profile
async function fetchUserProfile() {
  try {
    const response = await fetch(`/api/profile`, {
      headers: getAuthHeaders(),
    });
    if (response.ok) {
      const profile = await response.json();
      currentUser = { ...currentUser, ...profile };

      // Update composer UI
      const composerAvatar = document.querySelector(".composer-avatar");
      const authorInfoEl = document.querySelector(".composer-author-info");

      if (profile.avatar) {
        composerAvatar.style.backgroundImage = `url(${profile.avatar})`;
        composerAvatar.style.backgroundSize = "cover";
        composerAvatar.style.backgroundPosition = "center";
      }

      // Update author info
      if (authorInfoEl) {
        authorInfoEl.innerHTML = `
          <div class="composer-display-name">${
            profile.displayName || profile.handle
          }</div>
          <div class="composer-handle">@${profile.handle}</div>
        `;
      }
    }
  } catch (error) {
    console.error("Failed to fetch profile:", error);
  }
}

// Login
async function handleLogin(e) {
  e.preventDefault();

  const identifier = document.getElementById("handle").value;
  const password = document.getElementById("password").value;

  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, password }),
    });

    if (response.ok) {
      const data = await response.json();
      currentUser = { handle: data.handle };

      // Store auth data for serverless compatibility
      if (data.accessJwt && data.refreshJwt) {
        authData = {
          did: data.did,
          handle: data.handle,
          accessJwt: data.accessJwt,
          refreshJwt: data.refreshJwt,
        };
      }

      loginScreen.style.display = "none";
      mainScreen.style.display = "block";
      updateComposerProfile(); // Fetch and display profile
      loadFeed();
    } else {
      showError("Login failed. Check your handle and app password.");
    }
  } catch (error) {
    showError("Connection error. Please try again.");
  }
}

// Logout
async function handleLogout() {
  await fetch("/api/logout", { method: "POST" });
  mainScreen.style.display = "none";
  loginScreen.style.display = "block";
  loginForm.reset();
  feed.innerHTML = "";
  currentCursor = null;
  authData = null; // Clear auth data
}

// Load feed
async function loadFeed() {
  if (isLoading) return;
  isLoading = true;

  try {
    const params = currentCursor ? `?cursor=${currentCursor}` : "";
    const response = await fetch(`/api/feed${params}`, {
      headers: getAuthHeaders(),
    });

    if (!response.ok) throw new Error("Failed to load feed");

    const data = await response.json();
    renderPosts(data.feed);

    currentCursor = data.cursor;
  } catch (error) {
    showError("Failed to load feed");
  } finally {
    isLoading = false;
  }
}

// Render posts
function renderPosts(posts) {
  posts.forEach((item) => {
    const post = item.post;

    // Skip reply posts (posts that have a reply field)
    if (post.record && post.record.reply) {
      return; // Skip this post
    }

    const postEl = createPostElement(post);
    feed.appendChild(postEl);
  });
}

// Create post element
function createPostElement(post) {
  const div = document.createElement("div");
  div.className = "post";
  div.dataset.uri = post.uri;
  div.dataset.cid = post.cid;

  // Escape HTML to prevent XSS
  const escapeHtml = (text) => {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  };

  const authorName = escapeHtml(post.author.displayName || post.author.handle);
  const handle = escapeHtml(post.author.handle);
  const content = escapeHtml(post.record.text || "");

  // Check if this post has images
  let imageHintHtml = "";
  if (post.embed && post.embed.$type === "app.bsky.embed.images#view") {
    const imageCount = post.embed.images?.length || 0;
    if (imageCount > 0) {
      imageHintHtml = `
        <div class="image-hint">
          <div class="image-placeholder"></div>
          ${
            imageCount > 1
              ? `<span class="image-count">+${imageCount - 1}</span>`
              : ""
          }
        </div>
      `;
    }
  }

  // Check if this post has a quote (embedded record)
  let quoteHtml = "";

  // Handle both record embeds and recordWithMedia embeds
  let quotedRecord = null;

  if (post.embed && post.embed.$type === "app.bsky.embed.record#view") {
    // This is the actual type returned by the API for quote posts
    quotedRecord = post.embed.record;
  } else if (
    post.embed &&
    post.embed.$type === "app.bsky.embed.recordWithMedia#view"
  ) {
    // Quote posts with media have the record in a different location
    quotedRecord = post.embed.record?.record;

    // Also check if this recordWithMedia has images
    if (
      post.embed.media &&
      post.embed.media.$type === "app.bsky.embed.images#view"
    ) {
      const imageCount = post.embed.media.images?.length || 0;
      if (imageCount > 0) {
        imageHintHtml = `
          <div class="image-hint">
            <div class="image-placeholder"></div>
            ${
              imageCount > 1
                ? `<span class="image-count">+${imageCount - 1}</span>`
                : ""
            }
          </div>
        `;
      }
    }
  }

  if (quotedRecord) {
    // Check if the quoted post is available (not deleted/blocked)
    if (quotedRecord.$type === "app.bsky.embed.record#viewNotFound") {
      quoteHtml = `
        <div class="quoted-post quoted-post-unavailable">
          <div class="quote-content">Post not available</div>
        </div>
      `;
    } else if (quotedRecord.$type === "app.bsky.embed.record#viewBlocked") {
      quoteHtml = `
        <div class="quoted-post quoted-post-unavailable">
          <div class="quote-content">Post from blocked account</div>
        </div>
      `;
    } else if (quotedRecord.$type === "app.bsky.embed.record#viewRecord") {
      // This is the actual format for quoted posts in the API response
      const quoteAuthor = quotedRecord.author || {};
      const quoteText = quotedRecord.value?.text || "";

      const quoteAuthorName = escapeHtml(
        quoteAuthor.displayName || quoteAuthor.handle || "Unknown"
      );
      const quoteHandle = escapeHtml(quoteAuthor.handle || "unknown");
      const quoteContent = escapeHtml(quoteText);

      quoteHtml = `
        <div class="quoted-post">
          <div class="quote-author">
            ${
              quoteAuthor.avatar
                ? `<img class="quote-avatar" src="${quoteAuthor.avatar}" alt="">`
                : '<div class="quote-avatar"></div>'
            }
            <div class="quote-author-details">
              <div class="quote-display-name">${quoteAuthorName}</div>
              <div class="quote-handle">@${quoteHandle}</div>
            </div>
          </div>
          <div class="quote-content">${quoteContent}</div>
        </div>
      `;
    }
  }

  div.innerHTML = `
    <div class="author">
      ${
        post.author.avatar
          ? `<img class="avatar" src="${post.author.avatar}" alt="">`
          : '<div class="avatar"></div>'
      }
      <div class="author-details">
        <div class="display-name">${authorName}</div>
        <div class="handle">@${handle}</div>
      </div>
    </div>
    <div class="content">${content}</div>
    ${imageHintHtml}
    ${quoteHtml}
    <div class="actions">
      <button class="like-btn ${
        post.viewer?.like ? "liked" : ""
      }" onclick="toggleLike(this)">
        ♥ ${post.likeCount || 0}
      </button>
      <button class="repost-btn ${
        post.viewer?.repost ? "reposted" : ""
      }" onclick="toggleRepost(this)">
        ↻ ${post.repostCount || 0}
      </button>
    </div>
  `;

  return div;
}

// Post text
async function handlePost() {
  const text = postText.value.trim();
  if (!text) return;

  postBtn.disabled = true;

  try {
    const response = await fetch("/api/post", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ text }),
    });

    if (response.ok) {
      postText.value = "";
      updateCharCount();
      // Reload feed to show new post
      feed.innerHTML = "";
      currentCursor = null;
      loadFeed();
    } else {
      showError("Failed to post");
    }
  } catch (error) {
    showError("Failed to post");
  } finally {
    postBtn.disabled = false;
  }
}

// Character count
function updateCharCount() {
  const count = postText.value.length;
  charCount.textContent = `${count}/300`;
  charCount.style.color = count > 280 ? "#d32f2f" : "#666";
}

// Like/unlike
async function toggleLike(btn) {
  const post = btn.closest(".post");
  const uri = post.dataset.uri;
  const cid = post.dataset.cid;
  const isLiked = btn.classList.contains("liked");

  btn.disabled = true;

  try {
    const endpoint = isLiked ? "/api/unlike" : "/api/like";
    const body = isLiked ? { uri } : { uri, cid };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(body),
    });

    if (response.ok) {
      btn.classList.toggle("liked");
      const count = parseInt(btn.textContent.match(/\d+/)[0]);
      btn.innerHTML = `♥ ${isLiked ? count - 1 : count + 1}`;
    }
  } catch (error) {
    showError("Action failed");
  } finally {
    btn.disabled = false;
  }
}

// Repost
async function toggleRepost(btn) {
  const post = btn.closest(".post");
  const uri = post.dataset.uri;
  const cid = post.dataset.cid;
  const isReposted = btn.classList.contains("reposted");

  if (isReposted) return; // Can't unrepost in this simple client

  btn.disabled = true;

  try {
    const response = await fetch("/api/repost", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ uri, cid }),
    });

    if (response.ok) {
      btn.classList.add("reposted");
      const count = parseInt(btn.textContent.match(/\d+/)[0]);
      btn.innerHTML = `↻ ${count + 1}`;
    }
  } catch (error) {
    showError("Repost failed");
  } finally {
    btn.disabled = false;
  }
}

// Show error
function showError(message) {
  const error = document.createElement("div");
  error.className = "error";
  error.textContent = message;
  document.body.appendChild(error);

  setTimeout(() => error.remove(), 3000);
}

// Add after feed is defined:
let feedContainer = feed;
window.addEventListener("scroll", handleScroll);

function handleScroll() {
  if (isLoading || !currentCursor) return;
  const scrollPosition = window.innerHeight + window.scrollY;
  const threshold = document.body.offsetHeight - window.innerHeight * 1.5;
  if (scrollPosition >= threshold) {
    loadFeed();
  }
}

// Helper function to get auth headers
function getAuthHeaders() {
  const headers = { "Content-Type": "application/json" };
  if (authData) {
    headers["X-Auth-Data"] = JSON.stringify(authData);
  }
  return headers;
}

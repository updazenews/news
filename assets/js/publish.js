import { auth, db } from "./firebase-config.js";
import { canManageUsers, guardAdminRoute, isSuperAdmin } from "./auth.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const CLOUDINARY_CLOUD_NAME = "dtrvtmpu5";
const CLOUDINARY_API_KEY = "426579875859513";
const CLOUDINARY_API_SECRET = "5PKwQz2d2-yyadY3FGVBqmQW3kQ";
const CLOUDINARY_FOLDER = "updaze-news";

const form = document.getElementById("publishForm");
const previewPane = document.getElementById("previewPane");
const publishMessage = document.getElementById("publishMessage");
const guardMessage = document.getElementById("guardMessage");
const adminUserLabel = document.getElementById("adminUserLabel");
const publishedArticlesBody = document.getElementById("publishedArticlesBody");
const publishedArticlesStatus = document.getElementById("publishedArticlesStatus");
const manageUsersLink = document.getElementById("manageUsersLink");
const adminLogsLink = document.getElementById("adminLogsLink");
const footballDemoLink = document.getElementById("footballDemoLink");
const dashboardAnalyticsStatus = document.getElementById("dashboardAnalyticsStatus");
const analyticsTotalArticles = document.getElementById("analyticsTotalArticles");
const analyticsTotalViews = document.getElementById("analyticsTotalViews");
const analyticsTopCategory = document.getElementById("analyticsTopCategory");
const categoryChart = document.getElementById("categoryChart");
const viewsChart = document.getElementById("viewsChart");
const adminLogsSection = document.getElementById("adminLogsSection");
const adminLogsBody = document.getElementById("adminLogsBody");
const adminLogsStatus = document.getElementById("adminLogsStatus");
const demoDownloadBtn = document.getElementById("demoDownloadBtn");
const demoGithubUploadBtn = document.getElementById("demoGithubUploadBtn");
const demoGithubFields = document.getElementById("demoGithubFields");

const editSlug = new URLSearchParams(window.location.search).get("edit");
let editingArticleSlug = "";
let categoryChartInstance = null;
let viewsChartInstance = null;
let authInfo = null;

function slugify(value) { return value.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-"); }
function toArticleUrl(slug) { return new URL(`../article.html?slug=${encodeURIComponent(slug)}`, window.location.href).toString(); }
function formatPublishDate(rawValue) { if (!rawValue) return "-"; if (typeof rawValue.toDate === "function") return rawValue.toDate().toLocaleString(); if (rawValue.seconds) return new Date(rawValue.seconds * 1000).toLocaleString(); return new Date(rawValue).toLocaleString(); }
function escapeHtml(value = "") { const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }; return value.replace(/[&<>"']/g, (char) => map[char]); }
function formatInlineMarkdown(text = "") { return text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>"); }

function splitTableRow(row = "") {
  return row.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((col) => col.trim());
}

function isTableDividerRow(row = "") {
  const cols = splitTableRow(row);
  if (!cols.length) return false;
  return cols.every((col) => /^:?-{3,}:?$/.test(col));
}

function getTableAlignments(dividerRow = "") {
  return splitTableRow(dividerRow).map((col) => {
    const left = col.startsWith(":");
    const right = col.endsWith(":");
    if (left && right) return "center";
    if (right) return "right";
    if (left) return "left";
    return "left";
  });
}

function renderMarkdownTableBlock(lines = []) {
  if (lines.length < 2 || !isTableDividerRow(lines[1])) return "";
  const headers = splitTableRow(lines[0]);
  const alignments = getTableAlignments(lines[1]);
  const bodyRows = lines.slice(2).map((row) => splitTableRow(row));

  const thead = `<thead><tr>${headers.map((cell, idx) => `<th style=\"text-align:${alignments[idx] || "left"}\">${formatInlineMarkdown(escapeHtml(cell))}</th>`).join("")}</tr></thead>`;
  const tbody = bodyRows.length ? `<tbody>${bodyRows.map((cells) => `<tr>${headers.map((_, idx) => `<td style=\"text-align:${alignments[idx] || "left"}\">${formatInlineMarkdown(escapeHtml(cells[idx] || ""))}</td>`).join("")}</tr>`).join("")}</tbody>` : "";

  return `<div class=\"table-responsive my-3\"><table class=\"table table-sm table-bordered article-inline-table\">${thead}${tbody}</table></div>`;
}

function normalizeVideoEmbedUrl(input = "") {
  if (!input) return "";
  try {
    const parsed = new URL(input.trim());
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();

    if (host === "youtube.com" || host === "m.youtube.com") {
      const videoId = parsed.searchParams.get("v");
      if (videoId) return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`;
      if (parsed.pathname.startsWith("/embed/")) {
        const id = parsed.pathname.split("/embed/")[1]?.split("/")[0];
        if (id) return `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1`;
      }
    }

    if (host === "youtu.be") {
      const videoId = parsed.pathname.replace(/^\//, "");
      if (videoId) return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`;
    }

    if (host === "vimeo.com") {
      const videoId = parsed.pathname.replace(/^\//, "").split("/")[0];
      if (videoId) return `https://player.vimeo.com/video/${videoId}`;
    }

    if (host === "player.vimeo.com" && parsed.pathname.startsWith("/video/")) {
      return input.trim();
    }

    return "";
  } catch {
    return "";
  }
}


function updateVideoPreviewField(rawUrl = "") {
  const wrap = document.getElementById("videoPreviewWrap");
  const frame = document.getElementById("videoPreviewFrame");
  if (!wrap || !frame) return "";
  const embedUrl = normalizeVideoEmbedUrl(rawUrl);
  if (embedUrl) {
    frame.src = embedUrl;
    wrap.classList.remove("d-none");
  } else {
    frame.removeAttribute("src");
    wrap.classList.add("d-none");
  }
  return embedUrl;
}

function renderFormattedContent(rawContent = "") {
  const lines = rawContent.split("\n");
  let html = "";
  let inUl = false;
  let inOl = false;
  let inBlockquote = false;

  const closeLists = () => {
    if (inUl) { html += "</ul>"; inUl = false; }
    if (inOl) { html += "</ol>"; inOl = false; }
  };

  const closeBlockquote = () => {
    if (inBlockquote) { html += "</blockquote>"; inBlockquote = false; }
  };

  const closeAllStructures = () => {
    closeLists();
    closeBlockquote();
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      closeAllStructures();
      continue;
    }

    if (trimmed.includes("|") && i + 1 < lines.length && isTableDividerRow(lines[i + 1])) {
      closeAllStructures();
      const tableLines = [line, lines[i + 1]];
      i += 2;
      while (i < lines.length && lines[i].trim().includes("|")) {
        tableLines.push(lines[i]);
        i += 1;
      }
      i -= 1;
      const tableHtml = renderMarkdownTableBlock(tableLines);
      if (tableHtml) html += tableHtml;
      continue;
    }

    if (/^###\s+/.test(trimmed)) { closeAllStructures(); html += `<h3>${formatInlineMarkdown(escapeHtml(trimmed.replace(/^###\s+/, "")))}</h3>`; continue; }
    if (/^##\s+/.test(trimmed)) { closeAllStructures(); html += `<h2>${formatInlineMarkdown(escapeHtml(trimmed.replace(/^##\s+/, "")))}</h2>`; continue; }
    if (/^[-*]\s+/.test(trimmed)) { closeBlockquote(); if (inOl) { html += "</ol>"; inOl = false; } if (!inUl) { html += "<ul>"; inUl = true; } html += `<li>${formatInlineMarkdown(escapeHtml(trimmed.replace(/^[-*]\s+/, "")))}</li>`; continue; }
    if (/^\d+\.\s+/.test(trimmed)) { closeBlockquote(); if (inUl) { html += "</ul>"; inUl = false; } if (!inOl) { html += "<ol>"; inOl = true; } html += `<li>${formatInlineMarkdown(escapeHtml(trimmed.replace(/^\d+\.\s+/, "")))}</li>`; continue; }

    if (/^>\s?/.test(trimmed)) {
      closeLists();
      if (!inBlockquote) { html += "<blockquote class=\"article-quote\">"; inBlockquote = true; }
      html += `<p>${formatInlineMarkdown(escapeHtml(trimmed.replace(/^>\s?/, "")))}</p>`;
      continue;
    }

    closeAllStructures();
    html += `<p>${formatInlineMarkdown(escapeHtml(trimmed))}</p>`;
  }

  closeAllStructures();
  return html;
}

function toIsoDate(value) {
  if (!value) return new Date().toISOString();
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  if (value.seconds) return new Date(value.seconds * 1000).toISOString();
  return new Date(value).toISOString();
}

function buildStaticArticleHtml(article, slug) {
  const siteUrl = "https://updaze-news.github.io";
  const articleUrl = `${siteUrl}/articles/${encodeURIComponent(slug)}.html`;
  const title = escapeHtml(article.title || "Untitled");
  const excerpt = escapeHtml(article.excerpt || "Latest update from Updaze News.");
  const author = escapeHtml(article.author || "Updaze Desk");
  const category = escapeHtml((article.category || "general").toLowerCase());
  const publishedIso = toIsoDate(article.publishedAt);
  const updatedIso = toIsoDate(article.updatedAt);
  const image = article.imageUrl || "https://updaze-news.github.io/assets/logo.png";
  const safeImage = escapeHtml(image);
  const canonical = escapeHtml(articleUrl);
  const contentHtml = renderFormattedContent(article.content || "");
  const caption = article.imageCaption ? `<p class="article-image-caption">${escapeHtml(article.imageCaption)}</p>` : "";
  const featureImage = article.imageUrl ? `<img src="${safeImage}" alt="${title}" class="img-fluid rounded mb-2" loading="lazy" />${caption}` : "";
  const video = article.videoUrl ? `<section class="my-4"><h2 class="h6 mb-2">Article Video</h2><div class="ratio ratio-16x9"><iframe src="${escapeHtml(article.videoUrl)}" title="Embedded article video" loading="lazy" referrerpolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-presentation" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div></section>` : "";
  const keywordContent = escapeHtml(`${category}, updaze news, breaking news`);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.title || "Untitled",
    image: [image],
    datePublished: publishedIso,
    dateModified: updatedIso,
    author: { "@type": "Person", name: article.author || "Updaze Desk" },
    publisher: {
      "@type": "Organization",
      name: "Updaze News",
      logo: { "@type": "ImageObject", url: "https://updaze-news.github.io/assets/logo.png" }
    },
    mainEntityOfPage: articleUrl,
    description: article.excerpt || "Latest update from Updaze News."
  };

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="google-adsense-account" content="ca-pub-5731928992880799" />
  <title>${title} | Updaze News</title>
  <meta name="description" content="${excerpt}" />
  <meta name="author" content="${author}" />
  <meta name="keywords" content="${keywordContent}" />
  <link rel="canonical" href="${canonical}" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${excerpt}" />
  <meta property="og:type" content="article" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:image" content="${safeImage}" />
  <meta property="article:published_time" content="${publishedIso}" />
  <meta property="article:modified_time" content="${updatedIso}" />
  <meta property="article:author" content="${author}" />
  <meta property="article:section" content="${category}" />
  <meta property="article:tag" content="${category}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${excerpt}" />
  <meta name="twitter:image" content="${safeImage}" />
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5731928992880799" crossorigin="anonymous"></script>
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet" crossorigin="anonymous" />
  <link rel="stylesheet" href="../assets/css/style.css" />
</head>
<body>
  <main class="main-content container-lg py-4">
    <article>
      <header class="mb-4">
        <p class="text-uppercase text-primary fw-semibold mb-2">${category}</p>
        <h1>${title}</h1>
        <p class="article-meta mb-0">By ${author} • ${escapeHtml(new Date(publishedIso).toLocaleString())}</p>
      </header>
      ${featureImage}
      <section class="fs-5 lh-lg">${contentHtml}</section>
      ${video}
    </article>
  </main>
</body>
</html>`;
}

function collectDraftArticle() {
  const title = document.getElementById("title").value.trim();
  const slug = editingArticleSlug || slugify(title);
  return {
    slug,
    article: {
      title,
      category: document.getElementById("category").value.trim(),
      author: (authInfo?.profile?.displayName || authInfo?.user?.email || "Updaze Desk").trim(),
      imageCaption: document.getElementById("imageCaption").value.trim(),
      videoUrl: normalizeVideoEmbedUrl(document.getElementById("videoUrl")?.value?.trim() || ""),
      excerpt: document.getElementById("excerpt").value.trim(),
      content: document.getElementById("content").value.trim(),
      imageUrl: ""
    }
  };
}

async function handleDemoDownload() {
  const { slug, article } = collectDraftArticle();
  if (!slug || !article.title || !article.content || !article.excerpt) {
    publishMessage.className = "mt-3 mb-0 small text-danger";
    publishMessage.textContent = "Fill in title, excerpt, and content before downloading static HTML.";
    return;
  }
  const html = buildStaticArticleHtml(article, slug);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${slug}.html`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
  publishMessage.className = "mt-3 mb-0 small text-success";
  publishMessage.textContent = `Demo static file downloaded: ${slug}.html`;
}

async function fetchGithubUploadToken() {
  const tokenSnap = await getDoc(doc(db, "tokens", "github_upload"));
  if (!tokenSnap.exists()) throw new Error("Firestore token document tokens/github_upload not found.");
  const token = `${tokenSnap.data()?.value || ""}`.trim();
  if (!token) throw new Error("GitHub token in tokens/github_upload.value is empty.");
  return token;
}

function toBase64Unicode(value = "") {
  return btoa(unescape(encodeURIComponent(value)));
}

async function handleDemoGithubUpload() {
  const { slug, article } = collectDraftArticle();
  if (!slug || !article.title || !article.content || !article.excerpt) throw new Error("Fill in title, excerpt, and content before GitHub upload.");

  const owner = document.getElementById("demoGithubOwner")?.value?.trim();
  const repo = document.getElementById("demoGithubRepo")?.value?.trim();
  const branch = document.getElementById("demoGithubBranch")?.value?.trim() || "main";
  const targetPathInput = document.getElementById("demoGithubPath")?.value?.trim() || "articles/";
  const normalizedPrefix = targetPathInput.replace(/^\/+/, "").replace(/\/?$/, "/");
  if (!owner || !repo) throw new Error("GitHub owner and repository are required.");
  const targetPath = `${normalizedPrefix}${slug}.html`;

  const token = await fetchGithubUploadToken();
  const html = buildStaticArticleHtml(article, slug);
  const encodedPath = targetPath.split("/").map(encodeURIComponent).join("/");
  const repoApiBase = `https://api.github.com/repos/${owner}/${repo}`;
  const apiUrl = `${repoApiBase}/contents/${encodedPath}`;
  const headers = { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" };

  const repoCheck = await fetch(repoApiBase, { headers });
  if (!repoCheck.ok) {
    if (repoCheck.status === 404) {
      throw new Error(`Repository "${owner}/${repo}" was not found for this token. Verify owner/repo and ensure token has repository access.`);
    }
    throw new Error(`GitHub repository check failed: ${repoCheck.status} ${repoCheck.statusText}`);
  }

  let currentSha = "";
  const existing = await fetch(`${apiUrl}?ref=${encodeURIComponent(branch)}`, { headers });
  if (existing.ok) {
    const payload = await existing.json();
    currentSha = payload.sha || "";
  } else if (existing.status !== 404) {
    throw new Error(`GitHub lookup failed: ${existing.status} ${existing.statusText}`);
  }

  const uploadResponse = await fetch(apiUrl, {
    method: "PUT",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: `demo: publish static news page for ${slug}`,
      content: toBase64Unicode(html),
      branch,
      ...(currentSha ? { sha: currentSha } : {})
    })
  });

  if (!uploadResponse.ok) {
    const failure = await uploadResponse.text();
    if (uploadResponse.status === 404) {
      throw new Error(`GitHub upload failed with 404. Confirm branch "${branch}" exists and token can write contents in ${owner}/${repo}. Raw response: ${failure}`);
    }
    throw new Error(`GitHub upload failed: ${uploadResponse.status} ${failure}`);
  }
  const uploadPayload = await uploadResponse.json();
  const url = uploadPayload?.content?.html_url || `https://github.com/${owner}/${repo}/blob/${branch}/${targetPath}`;
  publishMessage.className = "mt-3 mb-0 small text-success";
  publishMessage.textContent = `Demo upload complete: ${url}`;
  await logAdminAction("github_demo_upload", `Uploaded ${targetPath} on ${owner}/${repo}@${branch}`);
}


function applyEditorFormat(type) {
  const contentField = document.getElementById("content");
  if (!contentField) return;

  const start = contentField.selectionStart;
  const end = contentField.selectionEnd;
  const selected = contentField.value.slice(start, end);

  if (type === "bold") contentField.setRangeText(`**${selected || "bold text"}**`, start, end, "end");
  if (type === "italic") contentField.setRangeText(`*${selected || "italic text"}*`, start, end, "end");
  if (type === "h2") contentField.setRangeText(`## ${selected || "Title"}`, start, end, "end");
  if (type === "h3") contentField.setRangeText(`### ${selected || "Sub Title"}`, start, end, "end");
  if (type === "bullet" || type === "number") {
    const lines = (selected || "list item").split("\n").filter(Boolean);
    contentField.setRangeText(lines.map((line, idx) => (type === "bullet" ? `- ${line}` : `${idx + 1}. ${line}`)).join("\n"), start, end, "end");
  }
  if (type === "table") {
    const tableTemplate = `| Column 1 | Column 2 | Column 3 |\n| :--- | :---: | ---: |\n| Value A | Value B | Value C |\n| Value D | Value E | Value F |`;
    contentField.setRangeText(tableTemplate, start, end, "end");
  }
  if (type === "quote") {
    const lines = (selected || "Quoted words").split("\n").filter(Boolean);
    contentField.setRangeText(lines.map((line) => `> ${line}`).join("\n"), start, end, "end");
  }

  contentField.focus();
}

function generateLogId(prefix = "log") {
  if (crypto?.randomUUID) return `${prefix}_${crypto.randomUUID()}`;
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

async function logAdminAction(eventType, details = "") {
  if (!authInfo) return;
  try {
    const role = authInfo.role || "unknown";
    if (!["admin", "super admin", "editor"].includes(role)) return;
    const logId = generateLogId(eventType.replace(/\s+/g, "_"));
    await setDoc(doc(db, "admin_logs", logId), {
      eventType,
      status: "success",
      role,
      uid: authInfo.user.uid,
      email: authInfo.user.email || "",
      details,
      timestamp: new Date().toISOString(),
      createdAt: serverTimestamp()
    }, { merge: true });
  } catch (_error) {
    // Non-blocking logging
  }
}

async function sha1Hex(text) {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-1", data);
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function uploadSelectedImageToCloudinary(slug) {
  const imageFileInput = document.getElementById("imageFile");
  const imageUploadStatus = document.getElementById("imageUploadStatus");
  const file = imageFileInput?.files?.[0];
  if (!file) return "";

  if (imageUploadStatus) { imageUploadStatus.textContent = "Uploading image to Cloudinary..."; imageUploadStatus.className = "small text-muted mt-1"; }
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = await sha1Hex(`folder=${CLOUDINARY_FOLDER}&timestamp=${timestamp}${CLOUDINARY_API_SECRET}`);

  const formData = new FormData();
  formData.append("file", file);
  formData.append("api_key", CLOUDINARY_API_KEY);
  formData.append("timestamp", `${timestamp}`);
  formData.append("signature", signature);
  formData.append("folder", CLOUDINARY_FOLDER);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, { method: "POST", body: formData });
  if (!response.ok) throw new Error(`Cloudinary upload failed: ${await response.text()}`);
  const result = await response.json();
  if (imageUploadStatus) { imageUploadStatus.textContent = "Image uploaded successfully."; imageUploadStatus.className = "small text-success mt-1"; }
  return result.secure_url || "";
}

async function loadDashboardAnalytics(authCtx) {
  dashboardAnalyticsStatus.textContent = "Loading analytics...";
  try {
    const constraints = [where("status", "==", "published"), orderBy("publishedAt", "desc"), limit(100)];
    if (authCtx.role === "publisher" || authCtx.role === "editor") constraints.unshift(where("authorUid", "==", authCtx.user.uid));

    const snap = await getDocs(query(collection(db, "articles"), ...constraints));
    const articles = snap.docs.map((item) => ({ id: item.id, ...item.data() }));

    const totalArticles = articles.length;
    const totalViews = articles.reduce((sum, article) => sum + Number(article.viewCount || 0), 0);
    const categoryTotals = articles.reduce((acc, article) => {
      const category = (article.category || "general").toLowerCase();
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {});
    const sortedCategories = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
    const topCategory = sortedCategories.length ? sortedCategories[0][0] : "-";

    if (analyticsTotalArticles) analyticsTotalArticles.textContent = `${totalArticles}`;
    if (analyticsTotalViews) analyticsTotalViews.textContent = totalViews.toLocaleString();
    if (analyticsTopCategory) analyticsTopCategory.textContent = topCategory;

    if (!window.Chart) {
      dashboardAnalyticsStatus.textContent = "Analytics loaded (chart library unavailable).";
      return;
    }

    const topViewed = [...articles].sort((a, b) => Number(b.viewCount || 0) - Number(a.viewCount || 0)).slice(0, 7);

    if (categoryChartInstance) categoryChartInstance.destroy();
    categoryChartInstance = new window.Chart(categoryChart, {
      type: "bar",
      data: {
        labels: sortedCategories.map(([name]) => name.toUpperCase()),
        datasets: [{ label: "Articles", data: sortedCategories.map(([, count]) => count), backgroundColor: "rgba(31,109,168,0.75)" }]
      },
      options: { responsive: true, plugins: { legend: { display: false } } }
    });

    if (viewsChartInstance) viewsChartInstance.destroy();
    viewsChartInstance = new window.Chart(viewsChart, {
      type: "line",
      data: {
        labels: topViewed.map((item) => (item.title || "Untitled").slice(0, 30)),
        datasets: [{ label: "Views", data: topViewed.map((item) => Number(item.viewCount || 0)), borderColor: "rgba(140,63,151,1)", backgroundColor: "rgba(140,63,151,0.2)", tension: 0.25, fill: true }]
      },
      options: { responsive: true }
    });

    dashboardAnalyticsStatus.textContent = `Analytics updated for ${totalArticles} published article(s).`;
  } catch (error) {
    dashboardAnalyticsStatus.textContent = `Unable to load analytics: ${error.message}`;
  }
}

async function loadSuperAdminLogs() {
  if (!adminLogsBody || !adminLogsStatus || !adminLogsSection) return;
  adminLogsSection.classList.remove("d-none");
  adminLogsStatus.textContent = "Loading logs...";

  try {
    const logQuery = query(collection(db, "admin_logs"), orderBy("createdAt", "desc"), limit(25));
    const snap = await getDocs(logQuery);

    if (snap.empty) {
      adminLogsBody.innerHTML = '<tr><td colspan="5" class="text-muted">No logs found.</td></tr>';
      adminLogsStatus.textContent = "No log entries yet.";
      return;
    }

    adminLogsBody.innerHTML = snap.docs.map((entry) => {
      const log = entry.data();
      const when = log.createdAt?.toDate ? log.createdAt.toDate().toLocaleString() : (log.timestamp || "-");
      return `<tr><td>${escapeHtml(log.eventType || "-")}</td><td>${escapeHtml(log.status || "-")}</td><td>${escapeHtml(log.email || "-")}</td><td>${escapeHtml(log.details || "-")}</td><td>${escapeHtml(when)}</td></tr>`;
    }).join("");

    adminLogsStatus.textContent = `Showing ${snap.size} latest log entries.`;
  } catch (error) {
    adminLogsBody.innerHTML = '<tr><td colspan="5" class="text-danger">Unable to load logs.</td></tr>';
    adminLogsStatus.textContent = `Error: ${error.message}`;
  }
}

async function loadPublishedArticles(authCtx) {
  publishedArticlesStatus.textContent = "Loading articles...";

  try {
    const constraints = [where("status", "==", "published"), orderBy("publishedAt", "desc"), limit(50)];
    if (authCtx.role === "publisher" || authCtx.role === "editor") constraints.unshift(where("authorUid", "==", authCtx.user.uid));

    const snap = await getDocs(query(collection(db, "articles"), ...constraints));
    const columnCount = window.location.pathname.endsWith("/my-articles.html") ? 5 : 6;

    if (snap.empty) {
      publishedArticlesBody.innerHTML = `<tr><td colspan="${columnCount}" class="text-muted">No articles found.</td></tr>`;
      publishedArticlesStatus.textContent = "No articles yet.";
      return;
    }

    const allowDelete = isSuperAdmin(authCtx.role);
    publishedArticlesBody.innerHTML = snap.docs.map((item) => {
      const article = item.data();
      const slug = article.slug || item.id;
      const articleUrl = toArticleUrl(slug);
      const actionButtons = [
        `<a class="btn btn-sm btn-outline-primary" href="${articleUrl}" target="_blank" rel="noopener">View</a>`,
        `<a class="btn btn-sm btn-outline-secondary" href="/admin/publish.html?edit=${encodeURIComponent(slug)}">Edit</a>`,
        `<button class="btn btn-sm btn-outline-warning" data-action="unpublish" data-slug="${escapeHtml(slug)}">Unpublish</button>`
      ];
      if (allowDelete) actionButtons.push(`<button class="btn btn-sm btn-outline-danger" data-action="delete" data-slug="${escapeHtml(slug)}">Delete</button>`);

      if (window.location.pathname.endsWith("/my-articles.html")) {
        return `<tr><td>${escapeHtml(article.title || "Untitled")}</td><td class="text-uppercase">${escapeHtml(article.category || "general")}</td><td>${formatPublishDate(article.publishedAt)}</td><td>${Number(article.viewCount || 0)}</td><td class="d-flex gap-1 flex-wrap">${actionButtons.join("")}</td></tr>`;
      }

      return `<tr><td>${escapeHtml(article.title || "Untitled")}</td><td class="text-uppercase">${escapeHtml(article.category || "general")}</td><td>${escapeHtml(article.author || "Updaze Desk")}</td><td>${formatPublishDate(article.publishedAt)}</td><td>${Number(article.viewCount || 0)}</td><td class="d-flex gap-1 flex-wrap">${actionButtons.join("")}</td></tr>`;
    }).join("");

    publishedArticlesStatus.textContent = `Showing ${snap.size} published article(s).`;
  } catch (error) {
    const col = window.location.pathname.endsWith("/my-articles.html") ? 5 : 6;
    publishedArticlesBody.innerHTML = `<tr><td colspan="${col}" class="text-danger">Unable to load articles.</td></tr>`;
    publishedArticlesStatus.textContent = `Error: ${error.message}`;
  }
}

async function loadArticleForEditing(slug, authCtx) {
  try {
    const snap = await getDoc(doc(db, "articles", slug));
    if (!snap.exists()) return;

    const article = snap.data();
    if ((authCtx.role === "publisher" || authCtx.role === "editor") && article.authorUid !== authCtx.user.uid) {
      guardMessage?.classList.remove("d-none");
      if (guardMessage) guardMessage.textContent = "You can only edit your own articles.";
      return;
    }

    editingArticleSlug = slug;
    document.getElementById("publishFormTitle").textContent = "Edit Article";
    document.getElementById("title").value = article.title || "";
    document.getElementById("category").value = article.category || "";
    document.getElementById("excerpt").value = article.excerpt || "";
    document.getElementById("content").value = article.content || "";
    document.getElementById("imageCaption").value = article.imageCaption || "";
    const videoUrlField = document.getElementById("videoUrl");
    if (videoUrlField) {
      videoUrlField.value = article.videoUrl || "";
      updateVideoPreviewField(videoUrlField.value);
    }

    const authorDisplay = document.getElementById("authorDisplay");
    if (authorDisplay) authorDisplay.value = article.author || authorDisplay.value;

    if (publishMessage) {
      publishMessage.className = "mt-3 mb-0 small text-info";
      publishMessage.textContent = `Editing: ${article.title || slug}`;
    }
  } catch (error) {
    if (publishMessage) {
      publishMessage.className = "mt-3 mb-0 small text-danger";
      publishMessage.textContent = `Unable to load article for editing: ${error.message}`;
    }
  }
}

async function handleArticleAction(event) {
  const target = event.target.closest("button[data-action]");
  if (!target || !authInfo) return;

  const action = target.dataset.action;
  const slug = target.dataset.slug;
  if (!slug) return;

  if (action === "unpublish") {
    const confirmed = window.confirm("Unpublish this article? It will be hidden from end users but kept in Firebase.");
    if (!confirmed) return;

    await updateDoc(doc(db, "articles", slug), { status: "draft", updatedAt: serverTimestamp() });
    await logAdminAction("article_unpublished", `Unpublished article id ${slug}`);
  }

  if (action === "delete") {
    if (!isSuperAdmin(authInfo.role)) {
      window.alert("Only super admin can delete articles.");
      return;
    }

    const confirmed = window.confirm(`Delete article ${slug}? This action cannot be undone.`);
    if (!confirmed) return;

    await deleteDoc(doc(db, "articles", slug));
    await logAdminAction("article_deleted", `Deleted article id ${slug}`);
  }

  await loadPublishedArticles(authInfo);
  if (dashboardAnalyticsStatus && categoryChart && viewsChart) await loadDashboardAnalytics(authInfo);
}

const resolvedAuth = await guardAdminRoute();
authInfo = resolvedAuth;
if (!authInfo) {
  if (guardMessage) {
    guardMessage.classList.remove("d-none");
    guardMessage.textContent = "Unauthorized access.";
  }
} else {
  const resolvedAuthorName = (authInfo.profile.displayName || authInfo.user.email || "Updaze Desk").trim();
  if (adminUserLabel) adminUserLabel.textContent = `${resolvedAuthorName} (${authInfo.role})`;

  const authorDisplay = document.getElementById("authorDisplay");
  if (authorDisplay) authorDisplay.value = resolvedAuthorName;

  if (manageUsersLink && canManageUsers(authInfo.role)) manageUsersLink.classList.remove("d-none");
  if (adminLogsLink && isSuperAdmin(authInfo.role)) adminLogsLink.classList.remove("d-none");
  if (footballDemoLink && isSuperAdmin(authInfo.role)) footballDemoLink.classList.remove("d-none");
  if (demoDownloadBtn && (authInfo.role === "publisher" || authInfo.role === "super admin")) {
    demoDownloadBtn.classList.remove("d-none");
  }
  if (demoGithubUploadBtn && demoGithubFields && (authInfo.role === "publisher" || authInfo.role === "super admin")) {
    demoGithubUploadBtn.classList.remove("d-none");
    demoGithubFields.classList.remove("d-none");
  }

  if (form && editSlug) await loadArticleForEditing(editSlug, authInfo);
  if (publishedArticlesBody && publishedArticlesStatus) await loadPublishedArticles(authInfo);
  if (dashboardAnalyticsStatus && categoryChart && viewsChart) await loadDashboardAnalytics(authInfo);
  if (isSuperAdmin(authInfo.role)) await loadSuperAdminLogs();

  await logAdminAction("admin_portal_access", "Accessed admin portal");
}

document.getElementById("logoutBtn")?.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "/admin/login.html";
});

publishedArticlesBody?.addEventListener("click", async (event) => {
  try {
    await handleArticleAction(event);
  } catch (error) {
    window.alert(`Action failed: ${error.message}`);
  }
});

document.querySelectorAll("[data-format]").forEach((button) => button.addEventListener("click", () => applyEditorFormat(button.dataset.format)));

const contentField = document.getElementById("content");
contentField?.addEventListener("keydown", (event) => {
  if (!(event.ctrlKey || event.metaKey)) return;
  const key = event.key.toLowerCase();
  if (key === "b") { event.preventDefault(); applyEditorFormat("bold"); }
  if (key === "i") { event.preventDefault(); applyEditorFormat("italic"); }
});

const videoUrlField = document.getElementById("videoUrl");
videoUrlField?.addEventListener("input", () => updateVideoPreviewField(videoUrlField.value));

document.getElementById("previewBtn")?.addEventListener("click", () => {
  const title = document.getElementById("title").value.trim();
  const content = document.getElementById("content").value.trim();
  const excerpt = document.getElementById("excerpt").value.trim();
  const imageCaption = document.getElementById("imageCaption").value.trim();
  const rawVideoUrl = document.getElementById("videoUrl")?.value?.trim() || "";
  const embedVideoUrl = updateVideoPreviewField(rawVideoUrl);
  const file = document.getElementById("imageFile")?.files?.[0];
  const previewImage = file ? `<img src="${URL.createObjectURL(file)}" alt="Preview image" class="img-fluid rounded my-3" />${imageCaption ? `<p class="article-image-caption">${escapeHtml(imageCaption)}</p>` : ""}` : "";
  const previewVideo = embedVideoUrl ? `<div class="ratio ratio-16x9 my-3"><iframe src="${escapeHtml(embedVideoUrl)}" title="Article video preview" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>` : "";
  if (previewPane) previewPane.innerHTML = `<h3>${escapeHtml(title || "Untitled draft")}</h3><p class="text-muted">${escapeHtml(excerpt)}</p>${previewImage}${previewVideo}${renderFormattedContent(content)}`;
});

demoDownloadBtn?.addEventListener("click", async () => {
  try {
    await handleDemoDownload();
  } catch (error) {
    publishMessage.className = "mt-3 mb-0 small text-danger";
    publishMessage.textContent = `Demo download failed: ${error.message}`;
  }
});

demoGithubUploadBtn?.addEventListener("click", async () => {
  publishMessage.className = "mt-3 mb-0 small text-muted";
  publishMessage.textContent = "Uploading demo HTML to GitHub...";
  try {
    await handleDemoGithubUpload();
  } catch (error) {
    publishMessage.className = "mt-3 mb-0 small text-danger";
    publishMessage.textContent = `Demo GitHub upload failed: ${error.message}`;
  }
});

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!authInfo) return;

  const article = {
    title: document.getElementById("title").value.trim(),
    category: document.getElementById("category").value,
    author: (authInfo.profile.displayName || authInfo.user.email || "Updaze Desk").trim(),
    authorUid: authInfo.user.uid,
    imageCaption: document.getElementById("imageCaption").value.trim(),
    videoUrl: normalizeVideoEmbedUrl(document.getElementById("videoUrl")?.value?.trim() || ""),
    excerpt: document.getElementById("excerpt").value.trim(),
    content: document.getElementById("content").value.trim(),
    status: "published"
  };

  const targetDocId = editingArticleSlug || slugify(article.title);

  try {
    const uploadedImageUrl = await uploadSelectedImageToCloudinary(targetDocId);
    if (uploadedImageUrl) article.imageUrl = uploadedImageUrl;

    await setDoc(doc(db, "articles", targetDocId), {
      ...article,
      slug: targetDocId,
      publishedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });

    await logAdminAction(editingArticleSlug ? "article_updated" : "article_added", `${editingArticleSlug ? "Updated" : "Added"} article id ${targetDocId}`);

    const notice = document.createElement("div");
    notice.className = "alert alert-success";
    notice.textContent = editingArticleSlug ? "Article updated successfully. Redirecting to dashboard..." : "Article published successfully. Redirecting to dashboard...";
    publishMessage.replaceChildren(notice);

    setTimeout(() => { window.location.href = "/admin/index.html?published=1"; }, 1200);
  } catch (error) {
    publishMessage.className = "mt-3 mb-0 small text-danger";
    publishMessage.textContent = `Publish failed: ${error.message}`;
  }
});

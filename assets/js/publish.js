import { auth, db } from "./firebase-config.js";
import { canManageUsers, guardAdminRoute, isSuperAdmin } from "./auth.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, doc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const CLOUDINARY_CLOUD_NAME = "dtrvtmpu5";
const CLOUDINARY_API_KEY = "426579875859513";
const CLOUDINARY_API_SECRET = "5PKwQz2d2-yyadY3FGVBqmQW3kQ";
const CLOUDINARY_FOLDER = "updaze-news";

function slugify(value) { return value.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-"); }
function toArticleUrl(slug) { return new URL(`../article.html?slug=${encodeURIComponent(slug)}`, window.location.href).toString(); }
function formatPublishDate(rawValue) { if (!rawValue) return "-"; if (typeof rawValue.toDate === "function") return rawValue.toDate().toLocaleString(); if (rawValue.seconds) return new Date(rawValue.seconds * 1000).toLocaleString(); return new Date(rawValue).toLocaleString(); }
function escapeHtml(value = "") { const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }; return value.replace(/[&<>"']/g, (char) => map[char]); }
function formatInlineMarkdown(text = "") { return text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>"); }

function renderFormattedContent(rawContent = "") {
  const lines = rawContent.split("\n"); let html = ""; let inUl = false; let inOl = false;
  const closeLists = () => { if (inUl) { html += "</ul>"; inUl = false; } if (inOl) { html += "</ol>"; inOl = false; } };
  lines.forEach((line) => {
    const trimmed = line.trim(); if (!trimmed) { closeLists(); return; }
    if (/^[-*]\s+/.test(trimmed)) { if (inOl) { html += "</ol>"; inOl = false; } if (!inUl) { html += "<ul>"; inUl = true; } html += `<li>${formatInlineMarkdown(escapeHtml(trimmed.replace(/^[-*]\s+/, "")))}</li>`; return; }
    if (/^\d+\.\s+/.test(trimmed)) { if (inUl) { html += "</ul>"; inUl = false; } if (!inOl) { html += "<ol>"; inOl = true; } html += `<li>${formatInlineMarkdown(escapeHtml(trimmed.replace(/^\d+\.\s+/, "")))}</li>`; return; }
    closeLists(); html += `<p>${formatInlineMarkdown(escapeHtml(trimmed))}</p>`;
  });
  closeLists(); return html;
}

function applyEditorFormat(type) {
  const contentField = document.getElementById("content"); if (!contentField) return;
  const start = contentField.selectionStart; const end = contentField.selectionEnd; const selected = contentField.value.slice(start, end);
  if (type === "bold") contentField.setRangeText(`**${selected || "bold text"}**`, start, end, "end");
  if (type === "italic") contentField.setRangeText(`*${selected || "italic text"}*`, start, end, "end");
  if (type === "bullet" || type === "number") {
    const lines = (selected || "list item").split("\n").filter(Boolean);
    contentField.setRangeText(lines.map((line, idx) => (type === "bullet" ? `- ${line}` : `${idx + 1}. ${line}`)).join("\n"), start, end, "end");
  }
  contentField.focus();
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
  formData.append("file", file); formData.append("api_key", CLOUDINARY_API_KEY); formData.append("timestamp", `${timestamp}`); formData.append("signature", signature); formData.append("folder", CLOUDINARY_FOLDER);
  const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, { method: "POST", body: formData });
  if (!response.ok) throw new Error(`Cloudinary upload failed: ${await response.text()}`);
  const result = await response.json();
  if (imageUploadStatus) { imageUploadStatus.textContent = "Image uploaded successfully."; imageUploadStatus.className = "small text-success mt-1"; }
  return result.secure_url || "";
}

const form = document.getElementById("publishForm");
const previewPane = document.getElementById("previewPane");
const publishMessage = document.getElementById("publishMessage");
const guardMessage = document.getElementById("guardMessage");
const adminUserLabel = document.getElementById("adminUserLabel");
const publishedArticlesBody = document.getElementById("publishedArticlesBody");
const publishedArticlesStatus = document.getElementById("publishedArticlesStatus");
const manageUsersLink = document.getElementById("manageUsersLink");

const authInfo = await guardAdminRoute();
if (!authInfo) {
  if (guardMessage) { guardMessage.classList.remove("d-none"); guardMessage.textContent = "Unauthorized access."; }
} else {
  const resolvedAuthorName = (authInfo.profile.displayName || authInfo.user.email || "Updaze Desk").trim();
  if (adminUserLabel) adminUserLabel.textContent = `${resolvedAuthorName} (${authInfo.role})`;
  const authorDisplay = document.getElementById("authorDisplay");
  if (authorDisplay) authorDisplay.value = resolvedAuthorName;
  if (manageUsersLink && canManageUsers(authInfo.role)) manageUsersLink.classList.remove("d-none");
  if (publishedArticlesBody && publishedArticlesStatus) await loadPublishedArticles(authInfo);
}

async function loadPublishedArticles(authCtx) {
  publishedArticlesStatus.textContent = "Loading articles...";
  try {
    const articlesRef = collection(db, "articles");
    const constraints = [where("status", "==", "published"), orderBy("publishedAt", "desc"), limit(50)];
    if (window.location.pathname.endsWith("/my-articles.html") || authCtx.role === "publisher") constraints.unshift(where("authorUid", "==", authCtx.user.uid));
    const snap = await getDocs(query(articlesRef, ...constraints));

    if (snap.empty) {
      const col = window.location.pathname.endsWith("/my-articles.html") ? 5 : 6;
      publishedArticlesBody.innerHTML = `<tr><td colspan="${col}" class="text-muted">No articles found.</td></tr>`;
      publishedArticlesStatus.textContent = "No articles yet.";
      return;
    }

    publishedArticlesBody.innerHTML = snap.docs.map((item) => {
      const article = item.data();
      const articleUrl = toArticleUrl(article.slug || item.id);
      if (window.location.pathname.endsWith("/my-articles.html")) {
        return `<tr><td>${article.title || "Untitled"}</td><td class="text-uppercase">${article.category || "general"}</td><td>${formatPublishDate(article.publishedAt)}</td><td>${Number(article.viewCount || 0)}</td><td><a class="btn btn-sm btn-outline-primary" href="${articleUrl}" target="_blank" rel="noopener">View</a></td></tr>`;
      }
      return `<tr><td>${article.title || "Untitled"}</td><td class="text-uppercase">${article.category || "general"}</td><td>${article.author || "Updaze Desk"}</td><td>${formatPublishDate(article.publishedAt)}</td><td>${Number(article.viewCount || 0)}</td><td><a class="btn btn-sm btn-outline-primary" href="${articleUrl}" target="_blank" rel="noopener">View</a></td></tr>`;
    }).join("");

    publishedArticlesStatus.textContent = `Showing ${snap.size} articles.`;
  } catch (error) {
    publishedArticlesBody.innerHTML = '<tr><td colspan="6" class="text-danger">Unable to load articles.</td></tr>';
    publishedArticlesStatus.textContent = `Error: ${error.message}`;
  }
}

document.getElementById("logoutBtn")?.addEventListener("click", async () => { await signOut(auth); window.location.href = "/admin/login.html"; });
document.querySelectorAll("[data-format]").forEach((button) => button.addEventListener("click", () => applyEditorFormat(button.dataset.format)));

document.getElementById("previewBtn")?.addEventListener("click", () => {
  const title = document.getElementById("title").value.trim();
  const content = document.getElementById("content").value.trim();
  const excerpt = document.getElementById("excerpt").value.trim();
  const imageCaption = document.getElementById("imageCaption").value.trim();
  const file = document.getElementById("imageFile")?.files?.[0];
  const previewImage = file ? `<img src="${URL.createObjectURL(file)}" alt="Preview image" class="img-fluid rounded my-3" />${imageCaption ? `<p class="article-image-caption">${escapeHtml(imageCaption)}</p>` : ""}` : "";
  if (previewPane) previewPane.innerHTML = `<h3>${escapeHtml(title || "Untitled draft")}</h3><p class="text-muted">${escapeHtml(excerpt)}</p>${previewImage}${renderFormattedContent(content)}`;
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
    excerpt: document.getElementById("excerpt").value.trim(),
    content: document.getElementById("content").value.trim(),
    status: "published"
  };
  article.slug = slugify(article.title);

  try {
    article.imageUrl = await uploadSelectedImageToCloudinary(article.slug);
    await setDoc(doc(db, "articles", article.slug), { ...article, publishedAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true });

    const notice = document.createElement("div");
    notice.className = "alert alert-success";
    notice.textContent = "Article published successfully. Redirecting to dashboard...";
    publishMessage.replaceChildren(notice);

    setTimeout(() => {
      window.location.href = "/admin/index.html?published=1";
    }, 1200);
  } catch (error) {
    publishMessage.className = "mt-3 mb-0 small text-danger";
    publishMessage.textContent = `Publish failed: ${error.message}`;
  }
});

import { auth, db, storage } from "./firebase-config.js";
import { guardAdminRoute } from "./auth.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getDownloadURL, ref, uploadBytes } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function toArticleUrl(slug) {
  return new URL(`../article.html?slug=${encodeURIComponent(slug)}`, window.location.href).toString();
}

function formatPublishDate(rawValue) {
  if (!rawValue) return "-";
  if (typeof rawValue.toDate === "function") return rawValue.toDate().toLocaleString();
  if (rawValue.seconds) return new Date(rawValue.seconds * 1000).toLocaleString();
  return new Date(rawValue).toLocaleString();
}

function escapeHtml(value = "") {
  const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
  return value.replace(/[&<>"']/g, (char) => map[char]);
}

function formatInlineMarkdown(text = "") {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>");
}

function renderFormattedContent(rawContent = "") {
  const lines = rawContent.split("\n");
  let html = "";
  let inUl = false;
  let inOl = false;

  const closeLists = () => {
    if (inUl) {
      html += "</ul>";
      inUl = false;
    }
    if (inOl) {
      html += "</ol>";
      inOl = false;
    }
  };

  lines.forEach((line) => {
    const trimmed = line.trim();

    if (!trimmed) {
      closeLists();
      return;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      if (inOl) {
        html += "</ol>";
        inOl = false;
      }
      if (!inUl) {
        html += "<ul>";
        inUl = true;
      }
      const item = escapeHtml(trimmed.replace(/^[-*]\s+/, ""));
      html += `<li>${formatInlineMarkdown(item)}</li>`;
      return;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      if (inUl) {
        html += "</ul>";
        inUl = false;
      }
      if (!inOl) {
        html += "<ol>";
        inOl = true;
      }
      const item = escapeHtml(trimmed.replace(/^\d+\.\s+/, ""));
      html += `<li>${formatInlineMarkdown(item)}</li>`;
      return;
    }

    closeLists();
    html += `<p>${formatInlineMarkdown(escapeHtml(trimmed))}</p>`;
  });

  closeLists();
  return html;
}

function applyEditorFormat(type) {
  const contentField = document.getElementById("content");
  if (!contentField) return;

  const start = contentField.selectionStart;
  const end = contentField.selectionEnd;
  const selected = contentField.value.slice(start, end);

  if (type === "bold") {
    const replacement = `**${selected || "bold text"}**`;
    contentField.setRangeText(replacement, start, end, "end");
  }

  if (type === "italic") {
    const replacement = `*${selected || "italic text"}*`;
    contentField.setRangeText(replacement, start, end, "end");
  }

  if (type === "bullet" || type === "number") {
    const baseText = selected || "list item";
    const lines = baseText.split("\n").filter(Boolean);
    const replacement = lines
      .map((line, index) => (type === "bullet" ? `- ${line}` : `${index + 1}. ${line}`))
      .join("\n");
    contentField.setRangeText(replacement, start, end, "end");
  }

  contentField.focus();
}

async function uploadSelectedImage(slug) {
  const imageFileInput = document.getElementById("imageFile");
  const imageUploadStatus = document.getElementById("imageUploadStatus");
  const file = imageFileInput?.files?.[0];

  if (!file) return "";

  if (imageUploadStatus) {
    imageUploadStatus.textContent = "Uploading image...";
    imageUploadStatus.className = "small text-muted mt-1";
  }

  const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const storageRef = ref(storage, `article-images/${slug}-${Date.now()}-${sanitizedName}`);
  await uploadBytes(storageRef, file);
  const downloadUrl = await getDownloadURL(storageRef);

  if (imageUploadStatus) {
    imageUploadStatus.textContent = "Image uploaded successfully.";
    imageUploadStatus.className = "small text-success mt-1";
  }

  return downloadUrl;
}

const form = document.getElementById("publishForm");
const previewPane = document.getElementById("previewPane");
const publishMessage = document.getElementById("publishMessage");
const guardMessage = document.getElementById("guardMessage");
const adminUserLabel = document.getElementById("adminUserLabel");
const publishedArticlesBody = document.getElementById("publishedArticlesBody");
const publishedArticlesStatus = document.getElementById("publishedArticlesStatus");

async function loadPublishedArticles() {
  if (!publishedArticlesBody || !publishedArticlesStatus) return;

  publishedArticlesStatus.textContent = "Loading published articles...";
  publishedArticlesStatus.className = "small text-muted mb-3";

  try {
    const articlesRef = collection(db, "articles");
    const publishedQuery = query(
      articlesRef,
      where("status", "==", "published"),
      orderBy("publishedAt", "desc"),
      limit(50)
    );

    const snap = await getDocs(publishedQuery);

    if (snap.empty) {
      publishedArticlesBody.innerHTML = '<tr><td colspan="6" class="text-muted">No published articles yet.</td></tr>';
      publishedArticlesStatus.textContent = "No articles published yet.";
      return;
    }

    publishedArticlesBody.innerHTML = snap.docs
      .map((item) => {
        const article = item.data();
        const articleUrl = toArticleUrl(article.slug || item.id);

        return `
          <tr>
            <td class="fw-semibold">${article.title || "Untitled"}</td>
            <td class="text-uppercase">${article.category || "general"}</td>
            <td>${article.author || "Updaze Desk"}</td>
            <td>${formatPublishDate(article.publishedAt)}</td>
            <td>${Number(article.viewCount || 0)}</td>
            <td><a class="btn btn-sm btn-outline-primary" href="${articleUrl}" target="_blank" rel="noopener">View</a></td>
          </tr>`;
      })
      .join("");

    publishedArticlesStatus.textContent = `Showing ${snap.size} published articles.`;
  } catch (error) {
    publishedArticlesBody.innerHTML = '<tr><td colspan="6" class="text-danger">Unable to load published articles.</td></tr>';
    publishedArticlesStatus.textContent = `Failed to load dashboard data: ${error.message}`;
    publishedArticlesStatus.className = "small text-danger mb-3";
  }
}

const authInfo = await guardAdminRoute();
if (!authInfo) {
  guardMessage.classList.remove("d-none");
  guardMessage.textContent = "Unauthorized access.";
} else {
  adminUserLabel.textContent = `${authInfo.user.email} (${authInfo.role})`;
  await loadPublishedArticles();
}

document.getElementById("logoutBtn")?.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "/admin/login.html";
});

document.querySelectorAll("[data-format]")?.forEach((button) => {
  button.addEventListener("click", () => applyEditorFormat(button.dataset.format));
});

document.getElementById("previewBtn")?.addEventListener("click", () => {
  const title = document.getElementById("title").value.trim();
  const content = document.getElementById("content").value.trim();
  const excerpt = document.getElementById("excerpt").value.trim();
  const imageUrl = document.getElementById("imageUrl").value.trim();
  const imageCaption = document.getElementById("imageCaption").value.trim();

  const previewImage = imageUrl
    ? `<img src="${escapeHtml(imageUrl)}" alt="Preview image" class="img-fluid rounded my-3" />${
      imageCaption ? `<p class="article-image-caption">${escapeHtml(imageCaption)}</p>` : ""
    }`
    : "";

  previewPane.innerHTML = `<h3>${escapeHtml(title || "Untitled draft")}</h3>
    <p class="text-muted">${escapeHtml(excerpt)}</p>
    ${previewImage}
    ${renderFormattedContent(content)}`;
});

form?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const article = {
    title: document.getElementById("title").value.trim(),
    category: document.getElementById("category").value,
    author: document.getElementById("author").value.trim(),
    imageUrl: document.getElementById("imageUrl").value.trim(),
    imageCaption: document.getElementById("imageCaption").value.trim(),
    excerpt: document.getElementById("excerpt").value.trim(),
    content: document.getElementById("content").value.trim(),
    status: "published"
  };

  article.slug = slugify(article.title);

  try {
    if (!article.imageUrl) {
      article.imageUrl = await uploadSelectedImage(article.slug);
    }

    const articleRef = doc(db, "articles", article.slug);
    await setDoc(
      articleRef,
      {
        ...article,
        publishedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );

    const articleUrl = toArticleUrl(article.slug);

    publishMessage.className = "mt-3 mb-0 small text-success";
    publishMessage.innerHTML = `Published successfully. Live page: <a href="${articleUrl}" target="_blank" rel="noopener">${articleUrl}</a>`;

    await loadPublishedArticles();
  } catch (error) {
    publishMessage.className = "mt-3 mb-0 small text-danger";
    publishMessage.textContent = `Publish failed: ${error.message}`;
  }
});

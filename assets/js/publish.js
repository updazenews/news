import { auth, db } from "./firebase-config.js";
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

document.getElementById("previewBtn")?.addEventListener("click", () => {
  const title = document.getElementById("title").value.trim();
  const content = document.getElementById("content").value.trim();
  const excerpt = document.getElementById("excerpt").value.trim();

  previewPane.innerHTML = `<h3>${title || "Untitled draft"}</h3><p class="text-muted">${excerpt}</p>${content
    .split("\n")
    .filter(Boolean)
    .map((paragraph) => `<p>${paragraph}</p>`)
    .join("")}`;
});

form?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const article = {
    title: document.getElementById("title").value.trim(),
    category: document.getElementById("category").value,
    author: document.getElementById("author").value.trim(),
    imageUrl: document.getElementById("imageUrl").value.trim(),
    excerpt: document.getElementById("excerpt").value.trim(),
    content: document.getElementById("content").value.trim(),
    status: "published"
  };

  article.slug = slugify(article.title);

  try {
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

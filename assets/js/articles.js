import { db } from "./firebase-config.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  serverTimestamp,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const fallbackArticles = [
  {
    slug: "global-tech-summit-highlights",
    title: "Global Tech Summit Highlights: AI Policy Takes Center Stage",
    excerpt: "World leaders and innovators announced cross-border guardrails for responsible AI.",
    content: "Global leaders closed the summit with a framework focused on AI transparency, safety audits, and talent upskilling.",
    category: "technology",
    author: "Updaze Desk",
    imageUrl: "",
    status: "published",
    viewCount: 0,
    publishedAt: { toDate: () => new Date() }
  }
];

function parsePublishedAt(article) {
  if (article?.publishedAt?.toDate) return article.publishedAt.toDate();
  if (article?.publishedAt?.seconds) return new Date(article.publishedAt.seconds * 1000);
  return new Date(article?.publishedAt || 0);
}

function sortByPublishedDateDesc(articles) {
  return [...articles].sort((a, b) => parsePublishedAt(b) - parsePublishedAt(a));
}

export function getArticleViewCount(article) {
  return Number.isFinite(Number(article?.viewCount)) ? Number(article.viewCount) : 0;
}

export async function fetchArticles(category = null) {
  try {
    const articlesRef = collection(db, "articles");
    const snap = await getDocs(articlesRef);

    const publishedArticles = snap.docs
      .map((item) => item.data())
      .filter((entry) => entry?.status === "published")
      .filter((entry) => (category ? entry?.category === category : true));

    return sortByPublishedDateDesc(publishedArticles).slice(0, 24);
  } catch {
    return category ? fallbackArticles.filter((entry) => entry.category === category) : fallbackArticles;
  }
}

export async function fetchMostViewedArticle() {
  const articles = await fetchArticles();
  if (!articles.length) return null;

  return [...articles].sort((a, b) => getArticleViewCount(b) - getArticleViewCount(a))[0];
}

export async function fetchTopViewedArticles(limitCount = 3) {
  const articles = await fetchArticles();
  if (!articles.length) return [];
  return [...articles].sort((a, b) => getArticleViewCount(b) - getArticleViewCount(a)).slice(0, Math.max(1, limitCount));
}

export async function fetchArticleBySlug(slug) {
  try {
    const articleRef = doc(db, "articles", slug);
    const articleSnap = await getDoc(articleRef);
    if (articleSnap.exists()) return articleSnap.data();
  } catch {
    // ignore and use fallback
  }

  return fallbackArticles.find((entry) => entry.slug === slug) || null;
}

export async function incrementArticleView(slug) {
  try {
    const articleRef = doc(db, "articles", slug);
    await updateDoc(articleRef, {
      viewCount: increment(1),
      updatedAt: serverTimestamp()
    });
  } catch {
    // ignore view tracking failures
  }
}

export function renderArticleCards(containerId, articles) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!articles.length) {
    container.innerHTML = '<p class="text-muted">No published stories available yet.</p>';
    return;
  }

  container.innerHTML = articles
    .map((article) => {
      const dateValue = article.publishedAt?.toDate ? article.publishedAt.toDate() : new Date(article.publishedAt || Date.now());
      return `
      <article class="col-md-6 col-lg-4">
        <div class="card article-card h-100">
          <div class="card-body d-flex flex-column">
            <p class="text-uppercase text-primary small fw-semibold mb-2">${article.category || "general"}</p>
            <h3 class="h5">${article.title}</h3>
            <p class="text-muted">${article.excerpt || "Read the latest update from Updaze News."}</p>
            <p class="article-meta mt-auto mb-3">${article.author || "Updaze Desk"} • ${dateValue.toLocaleDateString()}</p>
            <a class="btn btn-sm btn-outline-primary" href="article.html?slug=${article.slug}">Read Article</a>
          </div>
        </div>
      </article>`;
    })
    .join("");
}

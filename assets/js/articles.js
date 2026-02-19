import { db } from "./firebase-config.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  where
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
    publishedAt: { toDate: () => new Date() }
  }
];

export async function fetchArticles(category = null) {
  try {
    const articlesRef = collection(db, "articles");
    const constraints = [where("status", "==", "published"), orderBy("publishedAt", "desc"), limit(24)];
    if (category) constraints.unshift(where("category", "==", category));
    const snap = await getDocs(query(articlesRef, ...constraints));
    return snap.docs.map((item) => item.data());
  } catch {
    return category ? fallbackArticles.filter((entry) => entry.category === category) : fallbackArticles;
  }
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

import { fetchArticleBySlug, fetchArticles, renderArticleCards } from "./articles.js";

const params = new URLSearchParams(window.location.search);

async function initHomePage() {
  const homeList = document.getElementById("homeArticleList");
  if (!homeList) return;
  const articles = await fetchArticles();
  renderArticleCards("homeArticleList", articles);
}

async function initCategoryPage() {
  const categoryList = document.getElementById("categoryArticleList");
  if (!categoryList) return;

  const category = params.get("category") || "breaking-news";
  const titleElement = document.getElementById("categoryTitle");
  titleElement.textContent = `${category.replace(/-/g, " ")} News`;

  const articles = await fetchArticles(category);
  renderArticleCards("categoryArticleList", articles);
}

async function initArticlePage() {
  const articleBody = document.getElementById("articleBody");
  if (!articleBody) return;

  const slug = params.get("slug");
  if (!slug) {
    articleBody.textContent = "Article not found.";
    return;
  }

  const article = await fetchArticleBySlug(slug);
  if (!article) {
    articleBody.textContent = "Article not found.";
    return;
  }

  document.title = `${article.title} | Updaze News`;
  document.getElementById("articleTitle").textContent = article.title;
  document.getElementById("articleCategory").textContent = article.category || "general";
  document.getElementById("articleMeta").textContent = `${article.author || "Updaze Desk"} • ${new Date(article.publishedAt?.seconds ? article.publishedAt.seconds * 1000 : article.publishedAt || Date.now()).toLocaleString()}`;
  articleBody.innerHTML = article.content
    .split("\n")
    .filter(Boolean)
    .map((paragraph) => `<p>${paragraph}</p>`)
    .join("");

  if (article.imageUrl) {
    const image = document.getElementById("articleImage");
    image.src = article.imageUrl;
    image.classList.remove("d-none");
  }
}

function initFooterYear() {
  const yearElement = document.getElementById("year");
  if (yearElement) yearElement.textContent = `${new Date().getFullYear()}`;
}

initHomePage();
initCategoryPage();
initArticlePage();
initFooterYear();

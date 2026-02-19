import {
  fetchArticleBySlug,
  fetchArticles,
  fetchMostViewedArticle,
  getArticleViewCount,
  incrementArticleView,
  renderArticleCards
} from "./articles.js";

const params = new URLSearchParams(window.location.search);

function toggleLoading(loadingId, contentId, isLoading) {
  const loadingElement = document.getElementById(loadingId);
  const contentElement = document.getElementById(contentId);

  if (loadingElement) loadingElement.classList.toggle("d-none", !isLoading);
  if (contentElement) contentElement.classList.toggle("d-none", isLoading);
}

async function initHomePage() {
  const homeList = document.getElementById("homeArticleList");
  if (!homeList) return;

  toggleLoading("homeLoadingSpinner", "homeArticleList", true);

  const articles = await fetchArticles();
  renderArticleCards("homeArticleList", articles);
  toggleLoading("homeLoadingSpinner", "homeArticleList", false);

  const topStoryLoader = document.getElementById("topStoryLoader");
  const topStoryCategory = document.getElementById("topStoryCategory");
  const heroTitle = document.getElementById("hero-title");
  const heroSummary = document.getElementById("hero-summary");
  const heroLink = document.getElementById("hero-link");

  const topStory = await fetchMostViewedArticle();

  if (!topStory) {
    if (topStoryLoader) topStoryLoader.classList.add("d-none");
    if (topStoryCategory) {
      topStoryCategory.classList.remove("d-none");
      topStoryCategory.textContent = "Top Story";
    }
    if (heroTitle) {
      heroTitle.classList.remove("d-none");
      heroTitle.textContent = "Your trusted source for verified headlines and real-time context.";
    }
    if (heroSummary) {
      heroSummary.classList.remove("d-none");
      heroSummary.textContent = "Get updates from politics, business, technology, sports and world news—curated for clarity and speed.";
    }
    return;
  }

  if (topStoryLoader) topStoryLoader.classList.add("d-none");

  if (topStoryCategory) {
    topStoryCategory.classList.remove("d-none");
    topStoryCategory.textContent = `Top Story • ${topStory.category || "general"}`;
  }

  if (heroTitle) {
    heroTitle.classList.remove("d-none");
    heroTitle.textContent = topStory.title || "Top Story";
  }

  if (heroSummary) {
    heroSummary.classList.remove("d-none");
    heroSummary.textContent = topStory.excerpt || "Read the most viewed story right now.";
  }

  if (heroLink && topStory.slug) {
    heroLink.href = `article.html?slug=${topStory.slug}`;
    heroLink.classList.remove("d-none");
  }
}

async function initCategoryPage() {
  const categoryList = document.getElementById("categoryArticleList");
  if (!categoryList) return;

  toggleLoading("categoryLoadingSpinner", "categoryArticleList", true);

  const category = params.get("category") || "breaking-news";
  const titleElement = document.getElementById("categoryTitle");
  titleElement.textContent = `${category.replace(/-/g, " ")} News`;

  const articles = await fetchArticles(category);
  renderArticleCards("categoryArticleList", articles);

  toggleLoading("categoryLoadingSpinner", "categoryArticleList", false);
}

async function initArticlePage() {
  const articleBody = document.getElementById("articleBody");
  if (!articleBody) return;

  toggleLoading("articleLoadingSpinner", "articleContent", true);

  const slug = params.get("slug");
  if (!slug) {
    articleBody.textContent = "Article not found.";
    toggleLoading("articleLoadingSpinner", "articleContent", false);
    return;
  }

  const article = await fetchArticleBySlug(slug);
  if (!article) {
    articleBody.textContent = "Article not found.";
    toggleLoading("articleLoadingSpinner", "articleContent", false);
    return;
  }

  document.title = `${article.title} | Updaze News`;
  document.getElementById("articleTitle").textContent = article.title;
  document.getElementById("articleCategory").textContent = article.category || "general";

  const publishedDate = new Date(
    article.publishedAt?.seconds ? article.publishedAt.seconds * 1000 : article.publishedAt || Date.now()
  ).toLocaleString();
  const currentViews = getArticleViewCount(article);

  document.getElementById("articleMeta").textContent = `${article.author || "Updaze Desk"} • ${publishedDate} • ${currentViews} views`;

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

  toggleLoading("articleLoadingSpinner", "articleContent", false);
  await incrementArticleView(slug);
}

function initFooterYear() {
  const yearElement = document.getElementById("year");
  if (yearElement) yearElement.textContent = `${new Date().getFullYear()}`;
}

initHomePage();
initCategoryPage();
initArticlePage();
initFooterYear();

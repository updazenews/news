import { fetchArticleBySlug, fetchArticles, fetchTopViewedArticles, getArticleViewCount, incrementArticleView, renderArticleCards } from "./articles.js";

const params = new URLSearchParams(window.location.search);

function toggleLoading(loadingId, contentId, isLoading) {
  const loadingElement = document.getElementById(loadingId);
  const contentElement = document.getElementById(contentId);
  if (loadingElement) loadingElement.classList.toggle("d-none", !isLoading);
  if (contentElement) contentElement.classList.toggle("d-none", isLoading);
}

function escapeHtml(value = "") {
  const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
  return value.replace(/[&<>"']/g, (char) => map[char]);
}

function formatInlineMarkdown(text = "") {
  return text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>");
}

function renderFormattedContent(rawContent = "") {
  const lines = rawContent.split("\n");
  let html = ""; let inUl = false; let inOl = false;
  const closeLists = () => { if (inUl) { html += "</ul>"; inUl = false; } if (inOl) { html += "</ol>"; inOl = false; } };
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) { closeLists(); return; }
    if (/^###\s+/.test(trimmed)) { closeLists(); html += `<h3>${formatInlineMarkdown(escapeHtml(trimmed.replace(/^###\s+/, "")))}</h3>`; return; }
    if (/^##\s+/.test(trimmed)) { closeLists(); html += `<h2>${formatInlineMarkdown(escapeHtml(trimmed.replace(/^##\s+/, "")))}</h2>`; return; }
    if (/^[-*]\s+/.test(trimmed)) { if (inOl) { html += "</ol>"; inOl = false; } if (!inUl) { html += "<ul>"; inUl = true; } html += `<li>${formatInlineMarkdown(escapeHtml(trimmed.replace(/^[-*]\s+/, "")))}</li>`; return; }
    if (/^\d+\.\s+/.test(trimmed)) { if (inUl) { html += "</ul>"; inUl = false; } if (!inOl) { html += "<ol>"; inOl = true; } html += `<li>${formatInlineMarkdown(escapeHtml(trimmed.replace(/^\d+\.\s+/, "")))}</li>`; return; }
    closeLists(); html += `<p>${formatInlineMarkdown(escapeHtml(trimmed))}</p>`;
  });
  closeLists(); return html;
}

function upsertMeta(attr, key, content) {
  const selector = attr === "name" ? `meta[name='${key}']` : `meta[property='${key}']`;
  let node = document.querySelector(selector);
  if (!node) {
    node = document.createElement("meta");
    node.setAttribute(attr, key);
    document.head.appendChild(node);
  }
  node.setAttribute("content", content || "");
}

function setArticleMeta(article, articleUrl) {
  document.title = `${article.title} | Updaze News`;
  upsertMeta("name", "description", article.excerpt || "Latest update from Updaze News.");
  upsertMeta("name", "author", article.author || "Updaze Desk");
  upsertMeta("name", "keywords", `${article.category || "news"}, updaze news, breaking news`);

  upsertMeta("property", "og:title", article.title || "Updaze News");
  upsertMeta("property", "og:description", article.excerpt || "Latest update from Updaze News.");
  upsertMeta("property", "og:type", "article");
  upsertMeta("property", "og:url", articleUrl);
  upsertMeta("property", "og:image", article.imageUrl || "https://updaze-news.github.io/assets/logo.png");
  upsertMeta("property", "og:published_time", new Date(article.publishedAt?.seconds ? article.publishedAt.seconds * 1000 : article.publishedAt || Date.now()).toISOString());
  upsertMeta("property", "og:author", article.author || "Updaze Desk");

  upsertMeta("name", "twitter:card", "summary_large_image");
  upsertMeta("name", "twitter:title", article.title || "Updaze News");
  upsertMeta("name", "twitter:description", article.excerpt || "Latest update from Updaze News.");
  upsertMeta("name", "twitter:image", article.imageUrl || "https://updaze-news.github.io/assets/logo.png");

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.title,
    image: [article.imageUrl || "https://updaze-news.github.io/assets/logo.png"],
    datePublished: new Date(article.publishedAt?.seconds ? article.publishedAt.seconds * 1000 : article.publishedAt || Date.now()).toISOString(),
    dateModified: new Date(article.updatedAt?.seconds ? article.updatedAt.seconds * 1000 : article.updatedAt || Date.now()).toISOString(),
    author: { "@type": "Person", name: article.author || "Updaze Desk" },
    publisher: {
      "@type": "Organization",
      name: "Updaze News",
      logo: { "@type": "ImageObject", url: "https://updaze-news.github.io/assets/logo.png" }
    },
    mainEntityOfPage: articleUrl,
    description: article.excerpt || "Latest update from Updaze News."
  };

  let script = document.getElementById("newsArticleJsonLd");
  if (!script) {
    script = document.createElement("script");
    script.type = "application/ld+json";
    script.id = "newsArticleJsonLd";
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(jsonLd);
}

function setShareLinks(article, articleUrl) {
  const text = encodeURIComponent(article.title || "Updaze News");
  const url = encodeURIComponent(articleUrl);
  const image = encodeURIComponent(article.imageUrl || "");

  const fb = document.getElementById("shareFacebook");
  const x = document.getElementById("shareX");
  const wa = document.getElementById("shareWhatsApp");
  const li = document.getElementById("shareLinkedIn");

  if (fb) fb.href = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
  if (x) x.href = `https://twitter.com/intent/tweet?url=${url}&text=${text}`;
  if (wa) wa.href = `https://api.whatsapp.com/send?text=${text}%20${url}`;
  if (li) li.href = `https://www.linkedin.com/sharing/share-offsite/?url=${url}&title=${text}&summary=${text}&source=${image}`;
}

async function initHomePage() {
  const homeList = document.getElementById("homeArticleList"); if (!homeList) return;
  toggleLoading("homeLoadingSpinner", "homeArticleList", true);
  const articles = await fetchArticles(); renderArticleCards("homeArticleList", articles);
  toggleLoading("homeLoadingSpinner", "homeArticleList", false);
  const topStories = await fetchTopViewedArticles(3);
  const topStoryLoader = document.getElementById("topStoryLoader");
  const carouselWrap = document.getElementById("topStoryCarouselWrap");
  const indicators = document.getElementById("topStoryIndicators");
  const inner = document.getElementById("topStoryCarouselInner");
  if (topStoryLoader) topStoryLoader.classList.add("d-none");
  if (!topStories.length || !indicators || !inner || !carouselWrap) return;

  indicators.innerHTML = topStories.map((article, idx) => `
    <button type="button" data-bs-target="#topStoryCarousel" data-bs-slide-to="${idx}" class="${idx === 0 ? "active" : ""}" aria-current="${idx === 0 ? "true" : "false"}" aria-label="Slide ${idx + 1}"></button>
  `).join("");

  inner.innerHTML = topStories.map((article, idx) => {
    const bg = article.imageUrl ? `style="background-image: linear-gradient(rgba(10,18,30,0.55), rgba(10,18,30,0.35)), url('${article.imageUrl}')"` : "";
    return `
    <div class="carousel-item ${idx === 0 ? "active" : ""}">
      <div class="top-story-carousel-item" ${bg}>
        <div class="top-story-overlay p-4 p-md-5">
          <p class="text-uppercase mb-2 fw-semibold">Top Story #${idx + 1} • ${article.category || "general"}</p>
          <h1 class="display-6">${escapeHtml(article.title || "Top Story")}</h1>
          <p class="lead mb-3">${escapeHtml(article.excerpt || "Read one of the most viewed stories right now.")}</p>
          <a class="btn btn-light btn-sm" href="article.html?slug=${encodeURIComponent(article.slug || "")}">Read Top Story</a>
        </div>
      </div>
    </div>`;
  }).join("");

  carouselWrap.classList.remove("d-none");
}

async function initCategoryPage() {
  const categoryList = document.getElementById("categoryArticleList"); if (!categoryList) return;
  toggleLoading("categoryLoadingSpinner", "categoryArticleList", true);
  const category = params.get("category") || "breaking-news";
  const titleElement = document.getElementById("categoryTitle"); titleElement.textContent = `${category.replace(/-/g, " ")} News`;
  const articles = await fetchArticles(category); renderArticleCards("categoryArticleList", articles);
  toggleLoading("categoryLoadingSpinner", "categoryArticleList", false);
}

async function initArticlePage() {
  const articleBody = document.getElementById("articleBody"); if (!articleBody) return;
  toggleLoading("articleLoadingSpinner", "articleContent", true);
  const slug = params.get("slug"); if (!slug) { articleBody.textContent = "Article not found."; toggleLoading("articleLoadingSpinner", "articleContent", false); return; }
  const article = await fetchArticleBySlug(slug); if (!article) { articleBody.textContent = "Article not found."; toggleLoading("articleLoadingSpinner", "articleContent", false); return; }

  const articleUrl = window.location.href;
  setArticleMeta(article, articleUrl);
  setShareLinks(article, articleUrl);

  document.getElementById("articleTitle").textContent = article.title;
  document.getElementById("articleCategory").textContent = article.category || "general";
  const publishedDate = new Date(article.publishedAt?.seconds ? article.publishedAt.seconds * 1000 : article.publishedAt || Date.now()).toLocaleString();
  document.getElementById("articleMeta").textContent = `${article.author || "Updaze Desk"} • ${publishedDate} • ${getArticleViewCount(article)} views`;
  articleBody.innerHTML = renderFormattedContent(article.content || "");

  if (article.imageUrl) { const image = document.getElementById("articleImage"); image.src = article.imageUrl; image.classList.remove("d-none"); }
  const imageCaption = document.getElementById("articleImageCaption");
  if (imageCaption && article.imageCaption) { imageCaption.textContent = article.imageCaption; imageCaption.classList.remove("d-none"); }

  toggleLoading("articleLoadingSpinner", "articleContent", false);
  await incrementArticleView(slug);
}

function initFooterYear() { const yearElement = document.getElementById("year"); if (yearElement) yearElement.textContent = `${new Date().getFullYear()}`; }
initHomePage(); initCategoryPage(); initArticlePage(); initFooterYear();

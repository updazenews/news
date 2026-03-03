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

function renderFormattedContent(rawContent = "") {
  const lines = rawContent.split("\n");
  let html = "";
  let inUl = false;
  let inOl = false;

  const closeLists = () => {
    if (inUl) { html += "</ul>"; inUl = false; }
    if (inOl) { html += "</ol>"; inOl = false; }
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      closeLists();
      continue;
    }

    if (trimmed.includes("|") && i + 1 < lines.length && isTableDividerRow(lines[i + 1])) {
      closeLists();
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

    if (/^###\s+/.test(trimmed)) { closeLists(); html += `<h3>${formatInlineMarkdown(escapeHtml(trimmed.replace(/^###\s+/, "")))}</h3>`; continue; }
    if (/^##\s+/.test(trimmed)) { closeLists(); html += `<h2>${formatInlineMarkdown(escapeHtml(trimmed.replace(/^##\s+/, "")))}</h2>`; continue; }
    if (/^[-*]\s+/.test(trimmed)) { if (inOl) { html += "</ol>"; inOl = false; } if (!inUl) { html += "<ul>"; inUl = true; } html += `<li>${formatInlineMarkdown(escapeHtml(trimmed.replace(/^[-*]\s+/, "")))}</li>`; continue; }
    if (/^\d+\.\s+/.test(trimmed)) { if (inUl) { html += "</ul>"; inUl = false; } if (!inOl) { html += "<ol>"; inOl = true; } html += `<li>${formatInlineMarkdown(escapeHtml(trimmed.replace(/^\d+\.\s+/, "")))}</li>`; continue; }

    closeLists();
    html += `<p>${formatInlineMarkdown(escapeHtml(trimmed))}</p>`;
  }

  closeLists();
  return html;
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

    if (host === "player.vimeo.com" && parsed.pathname.startsWith("/video/")) return input.trim();

    return "";
  } catch {
    return "";
  }
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

  const videoWrap = document.getElementById("articleVideoWrap");
  const videoFrame = document.getElementById("articleVideoFrame");
  const embedVideoUrl = normalizeVideoEmbedUrl(article.videoUrl || "");
  if (videoWrap && videoFrame && embedVideoUrl) {
    videoFrame.src = embedVideoUrl;
    videoWrap.classList.remove("d-none");
  }

  toggleLoading("articleLoadingSpinner", "articleContent", false);
  await incrementArticleView(slug);
}

function initFooterYear() { const yearElement = document.getElementById("year"); if (yearElement) yearElement.textContent = `${new Date().getFullYear()}`; }
initHomePage(); initCategoryPage(); initArticlePage(); initFooterYear();

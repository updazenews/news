import { auth, db } from "./firebase-config.js";
import { guardAdminRoute } from "./auth.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function generateStaticArticlePage(article) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${article.title} | Updaze News</title>
  <meta name="description" content="${article.excerpt}" />
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet" crossorigin="anonymous" />
  <link rel="stylesheet" href="../assets/css/style.css" />
</head>
<body>
  <main class="container py-5">
    <article>
      <p class="text-uppercase text-primary fw-semibold mb-2">${article.category}</p>
      <h1>${article.title}</h1>
      <p class="text-muted">By ${article.author} • ${new Date().toLocaleString()}</p>
      ${article.imageUrl ? `<img src="${article.imageUrl}" alt="${article.title}" class="img-fluid rounded my-4" />` : ""}
      ${article.content
        .split("\n")
        .filter(Boolean)
        .map((paragraph) => `<p>${paragraph}</p>`)
        .join("\n")}
    </article>
  </main>
</body>
</html>`;
}

function downloadStaticFile(fileName, htmlContent) {
  const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

const form = document.getElementById("publishForm");
const previewPane = document.getElementById("previewPane");
const publishMessage = document.getElementById("publishMessage");
const guardMessage = document.getElementById("guardMessage");
const adminUserLabel = document.getElementById("adminUserLabel");

const authInfo = await guardAdminRoute();
if (!authInfo) {
  guardMessage.classList.remove("d-none");
  guardMessage.textContent = "Unauthorized access.";
} else {
  adminUserLabel.textContent = `${authInfo.user.email} (${authInfo.role})`;
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
    await setDoc(articleRef, {
      ...article,
      publishedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });

    const staticHtml = generateStaticArticlePage(article);
    downloadStaticFile(`${article.slug}.html`, staticHtml);

    publishMessage.className = "mt-3 mb-0 small text-success";
    publishMessage.textContent = `Published. Static page generated for /articles/${article.slug}.html (downloaded locally).`;
  } catch (error) {
    publishMessage.className = "mt-3 mb-0 small text-danger";
    publishMessage.textContent = `Publish failed: ${error.message}`;
  }
});

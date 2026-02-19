# Updaze News

Responsive Bootstrap 5 + Firebase powered news website prepared for GitHub Pages/Firebase Hosting style static deployment.

## Included pages
- `index.html`
- `category.html`
- `article.html`
- `admin/login.html`
- `admin/index.html`
- `admin/dashboard.html` (legacy redirect)
- `admin/publish.html`
- Generated static examples under `articles/`

## Firebase setup
Update `assets/js/firebase-config.js` with your project values.

### Firestore model
- `users/{uid}`
  - `role`: `admin` | `super admin` | `editor`
  - `displayName`: string
- `articles/{slug}`
  - `title`, `slug`, `excerpt`, `content`, `category`, `author`, `imageUrl`
  - `publishedAt`, `updatedAt`
  - `status` (`published`)

## Admin flow
1. Authorized user signs in at `/admin/login.html`.
2. Role check is performed from `users/{uid}`.
3. Dashboard at `/admin/index.html` lists published articles.
4. Publishing is done from `/admin/publish.html`, which writes to Firestore and makes it live at `/article.html?slug=[slug]`.

## Hosting
`firebase.json` is included with SPA rewrite and clean URLs.

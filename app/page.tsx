import Header from '@/components/Header';
import ArticleCard from '@/components/ArticleCard';
import { articles } from '@/lib/articles';

export default function HomePage() {
  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8" aria-label="Homepage content">
        <section aria-labelledby="latest-news-title">
          <h2 id="latest-news-title" className="mb-6 text-3xl font-bold tracking-tight text-slate-900">
            Latest News
          </h2>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {articles.map((article) => (
              <ArticleCard key={article.slug} article={article} />
            ))}
          </div>
        </section>
      </main>
    </>
  );
}

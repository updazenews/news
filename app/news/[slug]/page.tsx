import type { Metadata } from 'next';
import Header from '@/components/Header';
import { articles, getArticleBySlug } from '@/lib/articles';

type ArticlePageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  return articles.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticleBySlug(slug);

  if (!article) {
    return {
      title: 'Article not found | Updaze News Demo',
      description: 'The requested article could not be found.',
    };
  }

  return {
    title: `${article.title} | Updaze News Demo`,
    description: article.excerpt,
  };
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { slug } = await params;
  const article = getArticleBySlug(slug);

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8" aria-label="Article content">
        {!article ? (
          <section className="rounded-xl border border-amber-200 bg-amber-50 p-6">
            <h1 className="mb-2 text-2xl font-bold text-amber-900">Article not found</h1>
            <p className="text-amber-800">The article you are looking for does not exist.</p>
          </section>
        ) : (
          <article>
            <header className="mb-6 border-b border-slate-200 pb-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-700">{article.category}</p>
              <h1 className="mb-3 text-4xl font-extrabold leading-tight text-slate-900">{article.title}</h1>
              <time dateTime={article.date} className="text-sm text-slate-500">
                {new Date(article.date).toLocaleDateString()}
              </time>
            </header>
            <section className="prose prose-slate max-w-none">
              <p className="text-lg leading-8 text-slate-800">{article.content}</p>
            </section>
          </article>
        )}
      </main>
    </>
  );
}

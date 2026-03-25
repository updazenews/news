import Link from 'next/link';
import type { Article } from '@/lib/articles';

export default function ArticleCard({ article }: { article: Article }) {
  return (
    <article className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-700">{article.category}</p>
      <h2 className="mb-2 text-xl font-bold leading-tight text-slate-900">{article.title}</h2>
      <p className="mb-4 text-sm text-slate-500">{new Date(article.date).toLocaleDateString()}</p>
      <p className="mb-5 text-slate-700">{article.excerpt}</p>
      <Link
        href={`/news/${article.slug}`}
        className="mt-auto inline-flex items-center text-sm font-semibold text-brand-700 hover:text-brand-900"
      >
        Read article →
      </Link>
    </article>
  );
}

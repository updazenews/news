export type Article = {
  slug: string;
  title: string;
  date: string;
  category: 'politics' | 'crime' | 'sports';
  excerpt: string;
  content: string;
};

export const articles: Article[] = [
  {
    slug: 'policy-shift-in-parliament',
    title: 'Policy Shift in Parliament Sparks National Debate',
    date: '2026-03-15',
    category: 'politics',
    excerpt: 'Lawmakers introduced a sweeping reform package with implications for local governance.',
    content:
      'Members of parliament unveiled a broad policy proposal focused on municipal accountability, fiscal discipline, and transparency. The debate is expected to continue over the next two weeks.',
  },
  {
    slug: 'metro-task-force-breakthrough',
    title: 'Metro Task Force Reports Breakthrough in Organized Crime Probe',
    date: '2026-03-14',
    category: 'crime',
    excerpt: 'Authorities confirmed multiple arrests following a coordinated overnight operation.',
    content:
      'The operation targeted suspected syndicate activity across several districts. Investigators say forensic analysis and digital evidence gathering played a central role in the breakthrough.',
  },
  {
    slug: 'title-race-intensifies',
    title: 'League Title Race Intensifies After Dramatic Weekend Fixtures',
    date: '2026-03-13',
    category: 'sports',
    excerpt: 'Top teams remain separated by a narrow margin as the season heads into the final stretch.',
    content:
      'Late goals and defensive errors reshaped the standings this weekend. Coaches emphasized consistency and squad depth as crucial factors in the final run of matches.',
  },
];

export function getArticleBySlug(slug: string): Article | undefined {
  return articles.find((article) => article.slug === slug);
}

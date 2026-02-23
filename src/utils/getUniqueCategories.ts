import type { CollectionEntry } from "astro:content";
import postFilter from "./postFilter";

interface Category {
  category: string;
  count: number;
}

const getUniqueCategories = (posts: CollectionEntry<"blog">[]) => {
  const categoryMap = new Map<string, number>();

  posts
    .filter(postFilter)
    .forEach(post => {
      const cat = post.data.category;
      if (cat) {
        categoryMap.set(cat, (categoryMap.get(cat) || 0) + 1);
      }
    });

  const categories: Category[] = Array.from(categoryMap.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);

  return categories;
};

export default getUniqueCategories;

import { apiClient } from "./apiClient";

export interface KbArticle {
  id: string;
  title: string;
  body: string;
  category: string;
  authorId: string;
  published: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function listArticles() {
  const { data } = await apiClient.get<{ articles: KbArticle[] }>("/kb");
  return data.articles;
}

export async function getArticle(id: string) {
  const { data } = await apiClient.get<{ article: KbArticle }>(`/kb/${id}`);
  return data.article;
}

export async function createArticle(input: { title: string; body: string; category: string; published?: boolean }) {
  const { data } = await apiClient.post<{ article: KbArticle }>("/kb", input);
  return data.article;
}

export async function updateArticle(id: string, input: Partial<{ title: string; body: string; category: string; published: boolean }>) {
  const { data } = await apiClient.patch<{ article: KbArticle }>(`/kb/${id}`, input);
  return data.article;
}

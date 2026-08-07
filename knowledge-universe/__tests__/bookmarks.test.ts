import { describe, it, expect } from 'bun:test';
import { addBookmark, getBookmarks, removeBookmark } from '../bookmarks';

describe('knowledge-universe/bookmarks', () => {
  it('adds and retrieves bookmarks', async () => {
    await addBookmark('page-1', ['alpha', 'beta'], 'cto');
    const items = await getBookmarks(['alpha']);
    expect(items.some(b => b.slug === 'page-1')).toBe(true);
  });

  it('removes bookmarks', async () => {
    await removeBookmark('page-1', 'cto');
    const items = await getBookmarks(['alpha']);
    expect(items.some(b => b.slug === 'page-1')).toBe(false);
  });
});

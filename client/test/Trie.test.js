import { Trie } from '../src/Trie.js';

describe('Trie', () => {
  let t;

  beforeEach(() => {
    t = new Trie();
  });

  test('Should insert words and collect them based on prefix', () => {
    // Insert several words
    t.insertWord("hello");
    t.insertWord("hell");
    t.insertWord("heaven");
    t.insertWord("goodbye");

    // Test collecting words that start with "he"
    const results = t.collect("he", 10);
    const words = results.map(pair => pair.word);

    // We expect the words "hello", "hell", and "heaven" to appear, but not "goodbye"
    expect(words).toEqual(expect.arrayContaining(["hello", "hell", "heaven"]));
    expect(words).not.toEqual(expect.arrayContaining(["goodbye"]));
  });

  test('Should return an empty array for a non-existent prefix', () => {
    t.insertWord("hello");
    t.insertWord("world");
    
    const results = t.collect("abc", 5);
    expect(results).toEqual([]);
  });

  test('Should increase frequency on duplicate word insertion', () => {
    t.insertWord("hello");
    t.insertWord("hello");
    
    // Collecting "hello" should show a frequency of 2.
    const results = t.collect("hello", 5);
    // We assume that the Pair structure is preserved from the Trie
    expect(results.length).toBe(1);
    expect(results[0].freq).toBe(2);
  });

  test('Should remove the least frequently searched word from trie if number of search hits exceeds number of searches', () => {
    t.insertWord("hello");
    t.insertWord("hello");
    t.insertWord("hell");
    t.insertWord("hell");
    t.insertWord("hell");
    t.insertWord("hellochickenkatsu");
    t.insertWord("he");
    t.insertWord("he"); 

    //hellochickenkatsu should not be in the search result list
    const results = t.collect("h", 3);
    expect(results.length).toBe(3);
    expect(results).not.toContain("hellochickenkatsu");
  });
});

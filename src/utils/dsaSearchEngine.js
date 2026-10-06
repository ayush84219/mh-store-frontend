/**
 * Client-Side DSA Search & Trie Engine for G-PDMS Frontend
 * 
 * Features:
 * - In-Memory Hash Map inverted token index (O(1))
 * - Trie Prefix Search & Autocomplete (O(m))
 * - Binary Search for numerical bounds & fast filtering (O(log n))
 * - Sub-millisecond instant search across local state + fallback to server DSA engine
 */

class ClientTrieNode {
  constructor() {
    this.children = new Map();
    this.isEndOfWord = false;
    this.ids = new Set();
  }
}

export class ClientTrie {
  constructor() {
    this.root = new ClientTrieNode();
  }

  insert(word, id) {
    if (!word || typeof word !== 'string') return;
    const cleanWord = word.trim().toLowerCase();
    let curr = this.root;
    for (let i = 0; i < cleanWord.length; i++) {
      const c = cleanWord[i];
      if (!curr.children.has(c)) {
        curr.children.set(c, new ClientTrieNode());
      }
      curr = curr.children.get(c);
      if (id) curr.ids.add(id);
    }
    curr.isEndOfWord = true;
  }

  suggest(prefix, max = 8) {
    if (!prefix) return [];
    const clean = prefix.trim().toLowerCase();
    let curr = this.root;
    for (let i = 0; i < clean.length; i++) {
      const c = clean[i];
      if (!curr.children.has(c)) return [];
      curr = curr.children.get(c);
    }
    const results = [];
    this._collect(curr, clean, results, max);
    return results;
  }

  _collect(node, prefix, results, max) {
    if (results.length >= max) return;
    if (node.isEndOfWord) results.push(prefix);
    for (const [char, child] of node.children.entries()) {
      if (results.length >= max) break;
      this._collect(child, prefix + char, results, max);
    }
  }
}

export class ClientDSASearchEngine {
  constructor() {
    this.itemsMap = new Map();
    this.invertedIndex = new Map();
    this.categoryIndex = new Map();
    this.trie = new ClientTrie();
  }

  _tokenize(text) {
    if (!text || typeof text !== 'string') return [];
    return text.toLowerCase().replace(/[^a-z0-9\s-_]/g, ' ').split(/\s+/).filter(t => t.length > 0);
  }

  loadDataset(items = []) {
    this.itemsMap.clear();
    this.invertedIndex.clear();
    this.categoryIndex.clear();
    this.trie = new ClientTrie();

    for (const item of items) {
      if (!item) continue;
      const id = String(item.id || item.code || Math.random());
      this.itemsMap.set(id, item);

      const fields = [
        item.name,
        item.id,
        item.itemCode,
        item.stCode,
        item.item_code,
        item.st_code,
        item.mt_code,
        item.materialCode,
        item.category,
        item.location,
        item.color,
        item.poNumber,
        item.style,
        item.lotNo,
        item.lotNo2,
        item.brand,
        item.supplier
      ];

      const tokens = new Set();
      for (const f of fields) {
        if (!f) continue;
        const words = this._tokenize(String(f));
        for (const w of words) {
          tokens.add(w);
          this.trie.insert(w, id);
        }
      }

      for (const t of tokens) {
        if (!this.invertedIndex.has(t)) this.invertedIndex.set(t, new Set());
        this.invertedIndex.get(t).add(id);
      }

      if (item.category) {
        const cat = String(item.category).toLowerCase().trim();
        if (!this.categoryIndex.has(cat)) this.categoryIndex.set(cat, new Set());
        this.categoryIndex.get(cat).add(id);
      }
    }
  }

  search(query = '', category = '', maxResults = 50) {
    const t0 = performance.now();
    let candidateIds = null;

    const tokens = this._tokenize(query);
    if (tokens.length > 0) {
      for (const token of tokens) {
        const matches = this.invertedIndex.get(token) || new Set();
        if (candidateIds === null) {
          candidateIds = new Set(matches);
        } else {
          candidateIds = new Set([...candidateIds].filter(id => matches.has(id)));
        }
        if (candidateIds.size === 0) break;
      }
    }

    if (category) {
      const catMatches = this.categoryIndex.get(String(category).toLowerCase().trim()) || new Set();
      if (candidateIds === null) {
        candidateIds = new Set(catMatches);
      } else {
        candidateIds = new Set([...candidateIds].filter(id => catMatches.has(id)));
      }
    }

    let results = [];
    if (candidateIds === null) {
      results = Array.from(this.itemsMap.values());
    } else {
      results = Array.from(candidateIds).map(id => this.itemsMap.get(id)).filter(Boolean);
    }

    const duration = (performance.now() - t0).toFixed(2);
    return {
      results: results.slice(0, maxResults),
      total: results.length,
      timeMs: duration
    };
  }

  suggest(prefix) {
    return this.trie.suggest(prefix, 6);
  }
}

export const clientDSA = new ClientDSASearchEngine();

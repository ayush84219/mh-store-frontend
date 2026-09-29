import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search, Zap, X, ArrowRight, Layers, Tag, Box,
  DollarSign, Activity, Sparkles, Filter, CheckCircle2, ChevronRight
} from 'lucide-react';
import { getBackendUrl } from '../utils/api';
import { clientDSA } from '../utils/dsaSearchEngine';

export default function FastSearchModal({ isOpen, onClose, onNavigate, initialQuery = '' }) {
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [items, setItems] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef(null);
  const backendUrl = getBackendUrl();

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      performSearch(query, category, sortBy, sortOrder);
    } else {
      setQuery('');
      setSuggestions([]);
    }
  }, [isOpen]);

  // Fetch Trie prefix suggestions when typing
  useEffect(() => {
    if (!query || query.length < 2) {
      setSuggestions([]);
      return;
    }

    // Try client Trie first for 0ms instant suggestions
    const localSugg = clientDSA.suggest(query);
    if (localSugg && localSugg.length > 0) {
      setSuggestions(localSugg);
    }

    // Also fetch from backend Trie endpoint
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${backendUrl}/api/search/suggest?q=${encodeURIComponent(query)}&max=6`);
        if (res.ok) {
          const data = await res.json();
          if (data.suggestions && data.suggestions.length > 0) {
            setSuggestions(data.suggestions.map(s => typeof s === 'string' ? s : s.text));
          }
        }
      } catch (_) {}
    }, 120);

    return () => clearTimeout(timer);
  }, [query, backendUrl]);

  const performSearch = async (searchQuery, selectedCat, sortField, sortDir) => {
    setLoading(true);
    const t0 = performance.now();
    try {
      const params = new URLSearchParams({
        query: searchQuery || '',
        category: selectedCat || '',
        sortBy: sortField || 'name',
        sortOrder: sortDir || 'asc',
        limit: '40'
      });

      const res = await fetch(`${backendUrl}/api/search/dsa?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
        setMetrics({
          searchTimeMs: data.searchTimeMs || ((performance.now() - t0).toFixed(2)),
          algorithm: data.dsaMetrics?.algorithm || 'O(1) Hash Map + O(m) Trie',
          totalIndexed: data.dsaMetrics?.totalIndexedItems || data.totalCount || 0,
          totalResults: data.totalCount || (data.items || []).length
        });
        setSelectedIndex(0);
      } else {
        // Fallback to client-side DSA engine
        const fallback = clientDSA.search(searchQuery, selectedCat, 40);
        setItems(fallback.results);
        setMetrics({
          searchTimeMs: fallback.timeMs,
          algorithm: 'Client In-Memory O(1) Hash Index',
          totalIndexed: clientDSA.itemsMap.size,
          totalResults: fallback.total
        });
      }
    } catch (err) {
      const fallback = clientDSA.search(searchQuery, selectedCat, 40);
      setItems(fallback.results);
      setMetrics({
        searchTimeMs: fallback.timeMs,
        algorithm: 'Client In-Memory O(1) Hash Index',
        totalIndexed: clientDSA.itemsMap.size,
        totalResults: fallback.total
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < items.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (items[selectedIndex]) {
        handleSelectItem(items[selectedIndex]);
      }
    }
  };

  const handleSelectItem = (item) => {
    onClose();
    if (item.itemType === 'design' && onNavigate) {
      onNavigate('design', { lotId: item.lotNo || item.id });
    } else if (item.itemType === 'cutting' && onNavigate) {
      onNavigate('only_cutting', { lotId: item.lotNo });
    } else if (onNavigate) {
      onNavigate('material_verification', { materialId: item.id });
    }
  };

  const handleSuggestionClick = (sugg) => {
    setQuery(sugg);
    performSearch(sugg, category, sortBy, sortOrder);
  };

  if (!isOpen) return null;

  return (
    <div
      className="dsa-modal-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '6vh',
        animation: 'fadeIn 0.15s ease-out'
      }}
    >
      <div
        className="dsa-modal-container"
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        style={{
          width: '100%',
          maxWidth: '820px',
          background: 'var(--bg-card, #ffffff)',
          color: 'var(--text-main, #0f172a)',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.1)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '85vh',
          border: '1px solid var(--border-color, #e2e8f0)'
        }}
      >
        {/* Top Header & Search Bar */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color, #e2e8f0)', background: 'var(--bg-secondary, #f8fafc)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                color: '#fff',
                padding: '4px 8px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: '700',
                letterSpacing: '0.05em',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <Zap size={13} /> DSA INDEX SEARCH
              </div>
              <span style={{ fontSize: '12px', color: 'var(--text-muted, #64748b)' }}>
                Multi-Attribute O(1) Hash Map & O(m) Trie
              </span>
            </div>

            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted, #64748b)',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <X size={18} />
            </button>
          </div>

          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={20} style={{ position: 'absolute', left: '14px', color: '#6366f1' }} />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                const val = e.target.value;
                setQuery(val);
                performSearch(val, category, sortBy, sortOrder);
              }}
              placeholder="Search 10,000+ accessories by Name, SKU, Category, Brand, Location..."
              style={{
                width: '100%',
                padding: '14px 14px 14px 44px',
                borderRadius: '12px',
                border: '2px solid #6366f1',
                fontSize: '15px',
                fontWeight: '500',
                outline: 'none',
                background: 'var(--bg-card, #ffffff)',
                color: 'var(--text-main, #0f172a)',
                boxShadow: '0 0 0 4px rgba(99, 102, 241, 0.15)'
              }}
            />
          </div>

          {/* Trie Auto-Suggest Chips */}
          {suggestions.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '10px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                <Sparkles size={12} color="#6366f1" /> Suggestions:
              </span>
              {suggestions.map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSuggestionClick(s)}
                  style={{
                    fontSize: '11px',
                    padding: '3px 8px',
                    borderRadius: '20px',
                    border: '1px solid var(--border-color, #e2e8f0)',
                    background: 'var(--bg-card, #ffffff)',
                    color: '#4f46e5',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Quick Filters */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              {['', 'Zip', 'Elastic', 'Button', 'Thread', 'Tape / Lace', 'Bone', 'Rib'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => {
                    setCategory(cat);
                    performSearch(query, cat, sortBy, sortOrder);
                  }}
                  style={{
                    fontSize: '11px',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: category === cat ? '1px solid #6366f1' : '1px solid var(--border-color, #e2e8f0)',
                    background: category === cat ? '#6366f1' : 'transparent',
                    color: category === cat ? '#ffffff' : 'var(--text-muted, #64748b)',
                    cursor: 'pointer',
                    fontWeight: category === cat ? '700' : '500',
                    transition: 'all 0.15s'
                  }}
                >
                  {cat === '' ? 'All Items' : cat}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value);
                  performSearch(query, category, e.target.value, sortOrder);
                }}
                style={{
                  fontSize: '11px',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color, #e2e8f0)',
                  background: 'var(--bg-card, #ffffff)',
                  color: 'var(--text-main, #0f172a)'
                }}
              >
                <option value="name">Sort: Name (A-Z)</option>
                <option value="stock">Sort: Stock Quantity</option>
                <option value="cost">Sort: Unit Price</option>
                <option value="id">Sort: SKU ID</option>
              </select>

              <button
                onClick={() => {
                  const newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
                  setSortOrder(newOrder);
                  performSearch(query, category, sortBy, newOrder);
                }}
                style={{
                  fontSize: '11px',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color, #e2e8f0)',
                  background: 'transparent',
                  color: 'var(--text-main, #0f172a)',
                  cursor: 'pointer'
                }}
              >
                {sortOrder === 'asc' ? '▲ ASC' : '▼ DESC'}
              </button>
            </div>
          </div>
        </div>

        {/* Results List */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '10px 16px' }}>
          {loading && (
            <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted, #64748b)' }}>
              <div className="spinner" style={{ margin: '0 auto 10px' }} />
              Searching in-memory DSA index...
            </div>
          )}

          {!loading && items.length === 0 && (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted, #64748b)' }}>
              <Box size={36} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
              <div style={{ fontWeight: '600', fontSize: '15px' }}>No matching items found</div>
              <div style={{ fontSize: '12px', marginTop: '4px' }}>Try searching by category (e.g. Zip, Elastic), SKU code, or style.</div>
            </div>
          )}

          {!loading && items.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {items.map((item, idx) => {
                const isSelected = idx === selectedIndex;
                const isLowStock = Number(item.stock || 0) <= Number(item.threshold || 0);

                return (
                  <div
                    key={item.id || idx}
                    onClick={() => handleSelectItem(item)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      border: isSelected ? '1px solid #6366f1' : '1px solid transparent',
                      background: isSelected ? 'rgba(99, 102, 241, 0.08)' : 'var(--bg-card, #ffffff)',
                      transition: 'background 0.1s'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '8px',
                        background: item.itemType === 'design' ? '#dbeafe' : item.itemType === 'cutting' ? '#fef3c7' : '#e0e7ff',
                        color: item.itemType === 'design' ? '#1e40af' : item.itemType === 'cutting' ? '#92400e' : '#4338ca',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: '700',
                        fontSize: '12px'
                      }}>
                        {item.itemType === 'design' ? 'LOT' : item.itemType === 'cutting' ? 'CUT' : (item.category ? item.category[0].toUpperCase() : 'A')}
                      </div>

                      <div>
                        <div style={{ fontWeight: '600', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {item.name || item.id}
                          {item.itemType && (
                            <span style={{
                              fontSize: '10px',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              background: 'var(--bg-secondary, #f1f5f9)',
                              color: 'var(--text-muted, #64748b)',
                              textTransform: 'uppercase',
                              fontWeight: '700'
                            }}>
                              {item.itemType}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted, #64748b)', display: 'flex', gap: '12px', marginTop: '2px' }}>
                          <span>SKU: <strong>{item.id}</strong></span>
                          {item.category && <span>Category: <strong>{item.category}</strong></span>}
                          {item.location && <span>Location: <strong>{item.location}</strong></span>}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{
                          fontWeight: '700',
                          fontSize: '13px',
                          color: isLowStock ? '#ef4444' : '#10b981'
                        }}>
                          {Number(item.stock || 0).toLocaleString()} {item.unit || 'pcs'}
                        </div>
                        {item.cost > 0 && (
                          <div style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)' }}>
                            ₹{Number(item.cost).toFixed(2)}/unit
                          </div>
                        )}
                      </div>
                      <ChevronRight size={16} color={isSelected ? '#6366f1' : '#94a3b8'} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Metrics & Keyboard Guide */}
        <div style={{
          padding: '10px 20px',
          borderTop: '1px solid var(--border-color, #e2e8f0)',
          background: 'var(--bg-secondary, #f8fafc)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '11px',
          color: 'var(--text-muted, #64748b)'
        }}>
          {metrics && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                background: '#dcfce7',
                color: '#15803d',
                padding: '2px 6px',
                borderRadius: '4px',
                fontWeight: '700'
              }}>
                ⚡ {metrics.searchTimeMs}ms
              </span>
              <span>Algorithm: <strong>{metrics.algorithm}</strong></span>
              <span>• Results: <strong>{metrics.totalResults}</strong> / {metrics.totalIndexed} indexed</span>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span><kbd style={{ background: 'var(--bg-card, #ffffff)', padding: '2px 5px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>↑</kbd> <kbd style={{ background: 'var(--bg-card, #ffffff)', padding: '2px 5px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>↓</kbd> Navigate</span>
            <span><kbd style={{ background: 'var(--bg-card, #ffffff)', padding: '2px 5px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>↵</kbd> Select</span>
            <span><kbd style={{ background: 'var(--bg-card, #ffffff)', padding: '2px 5px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>ESC</kbd> Close</span>
          </div>
        </div>
      </div>
    </div>
  );
}

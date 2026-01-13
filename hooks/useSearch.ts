import { useState, useMemo, useCallback } from 'react';

/**
 * Custom hook for filtering/searching items
 * 
 * @param items - Array of items to search
 * @param searchFields - Function that extracts searchable text from an item
 * @returns Search state and filtered items
 */
export function useSearch<T>(
  items: T[],
  searchFields: (item: T) => string
) {
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return items;
    
    const lowerSearch = searchTerm.toLowerCase();
    return items.filter(item => 
      searchFields(item).toLowerCase().includes(lowerSearch)
    );
  }, [items, searchTerm, searchFields]);

  const clearSearch = useCallback(() => {
    setSearchTerm('');
  }, []);

  return {
    searchTerm,
    setSearchTerm,
    filtered,
    clearSearch
  };
}

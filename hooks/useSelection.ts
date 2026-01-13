import { useState, useCallback } from 'react';

/**
 * Custom hook for managing item selection
 * Useful for bulk actions, table selections, etc.
 * 
 * @param allIds - Array of all selectable IDs
 * @returns Selection state and helper functions
 */
export function useSelection<T extends string>(allIds: T[] = []) {
  const [selectedIds, setSelectedIds] = useState<Set<T>>(new Set());

  const toggleSelect = useCallback((id: T) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds(prev => {
      if (prev.size === allIds.length) {
        return new Set<T>();
      } else {
        return new Set(allIds);
      }
    });
  }, [allIds]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set<T>());
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(allIds));
  }, [allIds]);

  const isSelected = useCallback((id: T) => {
    return selectedIds.has(id);
  }, [selectedIds]);

  const isAllSelected = allIds.length > 0 && selectedIds.size === allIds.length;

  return {
    selectedIds,
    selectedCount: selectedIds.size,
    isAllSelected,
    isSelected,
    toggleSelect,
    toggleSelectAll,
    clearSelection,
    selectAll
  };
}

import { useState, useMemo, useCallback } from 'react';

/**
 * Hook for managing suggestion state (accept, reject, filter).
 */
export function useSuggestions(paragraphs) {
  const [accepted, setAccepted] = useState(new Set());
  const [rejected, setRejected] = useState(new Set());
  const [activeSuggestionId, setActiveSuggestionId] = useState(null);
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterLevel, setFilterLevel] = useState('all');

  const allSuggestions = useMemo(
    () => paragraphs.flatMap((p) => p.suggestions),
    [paragraphs]
  );

  const filteredSuggestions = useMemo(
    () =>
      allSuggestions.filter((s) => {
        if (accepted.has(s.id) || rejected.has(s.id)) return false;
        if (filterPriority !== 'all' && s.priority !== filterPriority) return false;
        if (filterLevel !== 'all' && s.level !== parseInt(filterLevel)) return false;
        return true;
      }),
    [allSuggestions, accepted, rejected, filterPriority, filterLevel]
  );

  const stats = useMemo(() => ({
    total: allSuggestions.length,
    accepted: accepted.size,
    rejected: rejected.size,
    pending: allSuggestions.length - accepted.size - rejected.size,
    byPriority: {
      red: allSuggestions.filter((s) => s.priority === 'red' && !accepted.has(s.id) && !rejected.has(s.id)).length,
      yellow: allSuggestions.filter((s) => s.priority === 'yellow' && !accepted.has(s.id) && !rejected.has(s.id)).length,
      green: allSuggestions.filter((s) => s.priority === 'green' && !accepted.has(s.id) && !rejected.has(s.id)).length,
    },
  }), [allSuggestions, accepted, rejected]);

  const acceptSuggestion = useCallback((id) => {
    setAccepted((prev) => new Set([...prev, id]));
    setActiveSuggestionId(null);
  }, []);

  const rejectSuggestion = useCallback((id) => {
    setRejected((prev) => new Set([...prev, id]));
    setActiveSuggestionId(null);
  }, []);

  const toggleActiveSuggestion = useCallback((id) => {
    setActiveSuggestionId((prev) => (prev === id ? null : id));
  }, []);

  const isAccepted = useCallback((id) => accepted.has(id), [accepted]);
  const isRejected = useCallback((id) => rejected.has(id), [rejected]);

  return {
    allSuggestions,
    filteredSuggestions,
    stats,
    activeSuggestionId,
    filterPriority,
    filterLevel,
    setFilterPriority,
    setFilterLevel,
    acceptSuggestion,
    rejectSuggestion,
    toggleActiveSuggestion,
    isAccepted,
    isRejected,
  };
}

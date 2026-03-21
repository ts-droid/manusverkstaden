import { useState, useCallback } from 'react';
import { SAMPLE_PROJECT, SAMPLE_CHAPTERS, SAMPLE_PARAGRAPHS } from '../data/sample-data';

/**
 * Hook for managing project state.
 *
 * In production, this will sync with the backend API.
 * Currently uses sample data for the prototype.
 */
export function useProject() {
  const [project, setProject] = useState(SAMPLE_PROJECT);
  const [chapters, setChapters] = useState(SAMPLE_CHAPTERS);
  const [activeChapterId, setActiveChapterId] = useState(3);
  const [paragraphs, setParagraphs] = useState(SAMPLE_PARAGRAPHS);
  const [genres, setGenres] = useState(['realistic']);
  const [modules, setModules] = useState([]);
  const [translationLanguages, setTranslationLanguages] = useState(['en']);

  const activeChapter = chapters.find((c) => c.id === activeChapterId) || chapters[0];
  const totalWords = chapters.reduce((sum, c) => sum + c.wordCount, 0);

  const updateProject = useCallback((updates) => {
    setProject((prev) => ({ ...prev, ...updates }));
  }, []);

  const toggleGenre = useCallback((genreId) => {
    setGenres((prev) =>
      prev.includes(genreId) ? prev.filter((g) => g !== genreId) : [...prev, genreId]
    );
  }, []);

  const toggleModule = useCallback((moduleId) => {
    setModules((prev) =>
      prev.includes(moduleId) ? prev.filter((m) => m !== moduleId) : [...prev, moduleId]
    );
  }, []);

  const toggleTranslationLanguage = useCallback((langId) => {
    setTranslationLanguages((prev) =>
      prev.includes(langId) ? prev.filter((l) => l !== langId) : [...prev, langId]
    );
  }, []);

  return {
    project,
    chapters,
    activeChapter,
    activeChapterId,
    setActiveChapterId,
    paragraphs,
    genres,
    modules,
    translationLanguages,
    totalWords,
    updateProject,
    toggleGenre,
    toggleModule,
    toggleTranslationLanguage,
    setGenres,
    setModules,
    setTranslationLanguages,
  };
}

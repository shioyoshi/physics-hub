import { create } from "zustand";

export interface SearchResult {
  id: string;
  type: "wiki" | "message" | "event" | "inventory";
  title: string;
  snippet: string;
  link: string;
}

interface SearchState {
  query: string;
  results: SearchResult[];
  isSearching: boolean;
  setQuery: (q: string) => void;
  setResults: (r: SearchResult[]) => void;
  setIsSearching: (s: boolean) => void;
  clearSearch: () => void;
}

export const useSearchStore = create<SearchState>((set) => ({
  query: "",
  results: [],
  isSearching: false,
  setQuery: (query) => set({ query }),
  setResults: (results) => set({ results }),
  setIsSearching: (isSearching) => set({ isSearching }),
  clearSearch: () => set({ query: "", results: [], isSearching: false }),
}));

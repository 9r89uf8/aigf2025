/**
 * Character store using Zustand
 * Manages character listings, filtering, and selection
 */
import { create } from 'zustand';
import { apiClient } from '../lib/api/client';
import toast from 'react-hot-toast';

const useCharacterStore = create((set, get) => ({
  // State
  characters: [],
  selectedCharacter: null,
  loading: false,
  error: null,
  filters: {
    search: '',
    gender: '',
    personality: '',
    minAge: null,
    maxAge: null,
  },
  pagination: {
    page: 1,
    limit: 12,
    total: 0,
    hasMore: true,
  },
  favorites: new Set(),
  gallery: {
    items: [],
    loading: false,
    selectedItem: null,
  },

  // Actions
  // Fetch characters with filters
  fetchCharacters: async (resetPagination = false) => {
    const state = get();
    if (resetPagination) {
      set({ pagination: { ...state.pagination, page: 1 } });
    }

    set({ loading: true, error: null });

    try {
      const { filters, pagination } = get();
      const params = new URLSearchParams();
      
      // Add pagination
      const offset = (pagination.page - 1) * pagination.limit;
      params.append('offset', offset);
      params.append('limit', pagination.limit);
      
      // Add filters
      if (filters.search) params.append('search', filters.search);
      if (filters.gender) params.append('gender', filters.gender);
      if (filters.personality) params.append('personality', filters.personality);
      if (filters.minAge) params.append('minAge', filters.minAge);
      if (filters.maxAge) params.append('maxAge', filters.maxAge);

      const response = await apiClient.get(`/characters?${params.toString()}`);
      const { characters, total, hasMore } = response.data;

      set({
        characters: resetPagination ? characters : [...state.characters, ...characters],
        pagination: {
          ...state.pagination,
          total,
          hasMore,
        },
        loading: false,
      });
    } catch (error) {
      console.error('Error fetching characters:', error);
      set({ 
        error: error.response?.data?.message || 'Failed to fetch characters',
        loading: false,
      });
      toast.error('Failed to load characters');
    }
  },

  // Fetch single character details
  fetchCharacterById: async (characterId) => {
    set({ loading: true, error: null });

    try {
      const response = await apiClient.get(`/characters/${characterId}`);
      
      set({
        selectedCharacter: response.data.character,
        loading: false,
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching character:', error);
      set({ 
        error: error.response?.data?.message || 'Failed to fetch character details',
        loading: false,
      });
      toast.error('Failed to load character details');
      throw error;
    }
  },

  // Fetch character gallery
  fetchCharacterGallery: async (characterId) => {
    set({ gallery: { ...get().gallery, loading: true } });

    try {
      const response = await apiClient.get(`/characters/${characterId}/gallery`);
      set({
        gallery: {
          items: response.data.items || [],
          loading: false,
          selectedItem: null,
        },
      });
      return response.data.items;
    } catch (error) {
      console.error('Error fetching gallery:', error);
      set({ gallery: { ...get().gallery, loading: false } });
      toast.error('Failed to load gallery');
      throw error;
    }
  },

  // Track gallery view (for premium content)
  trackGalleryView: async (characterId, itemId) => {
    try {
      await apiClient.post(`/characters/${characterId}/gallery/${itemId}/view`);
    } catch (error) {
      console.error('Error tracking gallery view:', error);
    }
  },

  // Update filters
  setFilters: (newFilters) => {
    set({ 
      filters: { ...get().filters, ...newFilters },
      characters: [], // Clear current results
      pagination: { ...get().pagination, page: 1, hasMore: true }
    });
  },

  // Clear filters
  clearFilters: () => {
    set({ 
      filters: {
        search: '',
        gender: '',
        personality: '',
        minAge: null,
        maxAge: null,
      },
      characters: [],
      pagination: { page: 1, limit: 12, total: 0, hasMore: true }
    });
  },

  // Toggle favorite
  toggleFavorite: (characterId) => {
    const { favorites } = get();
    const newFavorites = new Set(favorites);
    
    if (newFavorites.has(characterId)) {
      newFavorites.delete(characterId);
      toast.success('Removed from favorites');
    } else {
      newFavorites.add(characterId);
      toast.success('Added to favorites');
    }
    
    set({ favorites: newFavorites });
    
    // Persist to localStorage
    localStorage.setItem('favoriteCharacters', JSON.stringify([...newFavorites]));
  },

  // Load favorites from localStorage
  loadFavorites: () => {
    try {
      const stored = localStorage.getItem('favoriteCharacters');
      if (stored) {
        set({ favorites: new Set(JSON.parse(stored)) });
      }
    } catch (error) {
      console.error('Error loading favorites:', error);
    }
  },

  // Load next page
  loadMore: () => {
    const { pagination } = get();
    if (!pagination.hasMore) return;
    
    set({ 
      pagination: { ...pagination, page: pagination.page + 1 } 
    });
    get().fetchCharacters();
  },

  // Select gallery item
  selectGalleryItem: (item) => {
    set({ gallery: { ...get().gallery, selectedItem: item } });
  },

  // Clear selected character
  clearSelectedCharacter: () => {
    set({ 
      selectedCharacter: null,
      gallery: { items: [], loading: false, selectedItem: null }
    });
  },
}));

export default useCharacterStore; 
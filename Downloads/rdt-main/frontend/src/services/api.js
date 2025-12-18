import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Intercepteur pour ajouter le token d'authentification si nécessaire
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Intercepteur pour gérer les erreurs
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export const eventsAPI = {
  getAll: (params = {}) => api.get('/events', { params }),
  getById: (id) => api.get(`/events/${id}`),
  getRecent: (limit = 50) => api.get(`/events?limit=${limit}&sort=-timestamp`),
}

export const camerasAPI = {
  getAll: () => api.get('/cameras'),
  getById: (id) => api.get(`/cameras/${id}`),
  getStreamUrl: (id) => `${API_BASE_URL}/api/cameras/${id}/stream`,
  getSnapshot: (id) => api.get(`/cameras/${id}/snapshot`, { responseType: 'blob' }),
  getSnapshots: (id, params = {}) => api.get(`/cameras/${id}/snapshots`, { params }),
}

export const systemAPI = {
  getStatus: () => api.get('/system/status'),
  getStats: () => api.get('/system/stats'),
}

export default api

import axios from 'axios';
import toast from 'react-hot-toast';

const api = axios.create({
  baseURL: 'https://claimease-algp.onrender.com',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('med_reimburse_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('med_reimburse_token');
      localStorage.removeItem('med_reimburse_user');
      window.location.href = '/login';
    }
    
    const message = error.response?.data?.detail || 'An unexpected error occurred';
    toast.error(message);
    
    return Promise.reject(error);
  }
);

export default api;

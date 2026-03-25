import axios from 'axios';

const API_BASE = (process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:8000').trim().replace(/\/$/, '');

export async function apiGet(path, config = {}) {
  return axios.get(`${API_BASE}${path}`, config);
}

export async function apiPost(path, body, config = {}) {
  return axios.post(`${API_BASE}${path}`, body, config);
}

export async function apiDelete(path, config = {}) {
  return axios.delete(`${API_BASE}${path}`, config);
}

export async function apiPut(path, body, config = {}) {
  return axios.put(`${API_BASE}${path}`, body, config);
}

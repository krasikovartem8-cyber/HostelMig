import axios from 'axios';
import * as localApi from '../services/hostelDeskLocal';

const API_BASE = (process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:8000').trim().replace(/\/$/, '');

/** Пока переменная не задана — локальный режим (данные в localStorage), чтобы клон репозитория работал без .env */
export function isLocalApi() {
  const raw = process.env.REACT_APP_USE_LOCAL_API;
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    return true;
  }
  const v = String(raw).trim().toLowerCase();
  if (v === 'false' || v === '0' || v === 'no') {
    return false;
  }
  return v === 'true' || v === '1' || v === 'yes';
}

function headersFromConfig(config = {}) {
  return config.headers || {};
}

function wrapLocal(data) {
  return Promise.resolve({ data });
}

export async function apiGet(path, config = {}) {
  if (isLocalApi()) {
    return wrapLocal(localApi.request('GET', path, null, headersFromConfig(config)));
  }
  return axios.get(`${API_BASE}${path}`, config);
}

export async function apiPost(path, body, config = {}) {
  if (isLocalApi()) {
    return wrapLocal(localApi.request('POST', path, body, headersFromConfig(config)));
  }
  return axios.post(`${API_BASE}${path}`, body, config);
}

export async function apiDelete(path, config = {}) {
  if (isLocalApi()) {
    return wrapLocal(localApi.request('DELETE', path, null, headersFromConfig(config)));
  }
  return axios.delete(`${API_BASE}${path}`, config);
}

export async function apiPut(path, body, config = {}) {
  if (isLocalApi()) {
    return wrapLocal(localApi.request('PUT', path, body, headersFromConfig(config)));
  }
  return axios.put(`${API_BASE}${path}`, body, config);
}

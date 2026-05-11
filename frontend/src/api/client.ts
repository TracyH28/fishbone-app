import axios from "axios";

const BASE = import.meta.env.VITE_API_URL || "http://localhost:4000";

export const api = axios.create({ baseURL: `${BASE}/api` });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("facilitator_token");
  const pToken = sessionStorage.getItem("participant_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  if (pToken) config.headers["x-participant-token"] = pToken;
  return config;
});

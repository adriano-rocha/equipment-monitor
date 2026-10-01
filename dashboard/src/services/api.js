import axios from 'axios'

const api = axios.create({
  baseURL: 'http://localhost:8000/api/v1',
})

export async function getDevices() {
  const response = await api.get('/devices')
  return response.data
}
import axios from 'axios'

let baseURL = ''

if (__DEV__) {
  baseURL = 'http://localhost:8082'
  // baseURL = 'http://54.233.111.21:8082'
} else {
  baseURL = 'http://54.233.111.21:8082'
}

const instance = axios.create({ baseURL })

export default instance

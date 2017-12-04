import axios from '../utils/axios';

function fetchPhoto() {
  return axios.get('/data/getPhoto/MYZZERO123');
}

function fetchData(limit) {
  return axios.get(`/data/getData/MYZZERO123/limit/${limit}`);
}

export default {
  fetchPhoto,
  fetchData
};

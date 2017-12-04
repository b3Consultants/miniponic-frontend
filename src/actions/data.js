import { FETCH_DATA, FETCH_PHOTO } from '../actions';
import api from '../services/api';

export const fetchPhoto = () => {
  return {
    payload: api.fetchPhoto(),
    type: FETCH_PHOTO
  };
};

export const fetchData = (limit) => {
  return {
    payload: api.fetchData(limit),
    type: FETCH_DATA
  };
};

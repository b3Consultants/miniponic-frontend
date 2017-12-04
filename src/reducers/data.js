import { FETCH_DATA, FETCH_PHOTO } from '../actions';
import cleanData from '../utils/cleanData';

const defaultState = {
  isFetching: false,
  url: 'http://thewallpaper.co/wp-content/uploads/2016/06/nature-full-hd-national-geographic-download-wallpaper-free-display-1920x1080-1366x768.jpg',
  allData: [],
  error: null,
  tab: 0,
  start: true
};

const dataReducer = (state = defaultState, action) => {
  switch (action.type) {
    case `${FETCH_DATA}_FULFILLED`: {
      return {
        ...state,
        allData: cleanData(action.payload.data),
        isFetching: false,
        tab: 1,
        start: false
       };
    }
    case `${FETCH_DATA}_REJECTED`: {
      return { ...state, error: action.payload, isFetching: false };
    }
    case `${FETCH_DATA}_PENDING`: {
      return { ...state, isFetching: true, error: null };
    }
    case `${FETCH_PHOTO}_FULFILLED`: {
      return {
        ...state,
        url: `data:image/jpeg;base64,${action.payload.data}`,
        isFetching: false,
        tab: 0,
        start: false
       };
    }
    case `${FETCH_PHOTO}_REJECTED`: {
      return { ...state, error: action.payload, isFetching: false };
    }
    case `${FETCH_PHOTO}_PENDING`: {
      return { ...state, isFetching: true, error: null };
    }
    default:
      return state;
  }
};

export default dataReducer;

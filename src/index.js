import React from 'react';
import logger from 'redux-logger';
import thunk from 'redux-thunk';
import { Provider } from 'react-redux';
import { applyMiddleware, createStore } from 'redux';
import promise from 'redux-promise-middleware';
import ReactDOM from 'react-dom';
import App from './containers/App';
import reducer from './reducers';


const middleware = applyMiddleware(promise(), thunk, logger);
const store = createStore(reducer, middleware);

ReactDOM.render(
  <Provider store={store}>
    <App />
  </Provider>,
  document.getElementById('root'),
);

import { connect } from 'react-redux';

import { fetchPhoto, fetchData } from '../actions/data';
import App from '../components/App';

function mapStateToProps({ data }) {
  return {
    data
  };
}

export default connect(mapStateToProps, {
  fetchPhoto,
  fetchData
})(App);

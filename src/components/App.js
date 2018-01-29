import React, { Component } from 'react';
import AppBar from 'material-ui/AppBar';
import Tabs, { Tab } from 'material-ui/Tabs';
import {withStyles} from 'material-ui/styles';
import CameraView from '../components/CameraView';
import Historical from '../components/Historical';
import ControlPanel from '../components/ControlPanel';
import Spinner from './Spinner';

const styles = theme => ({
  root: {
    maxWidth: '100%'
  }
})

class App extends Component {
  constructor(props) {
    super(props);
    this.handleHistorical = this.handleHistorical.bind(this);
    this.handlePhoto = this.handlePhoto.bind(this);
    this.state = {
      value: 1
    };
  }

  handleChange = (event, value) => {
    if (value === 0) {
      this.handlePhoto();
    } else if (value === 1 || value === 2) {
      this.handleHistorical();
    }
    this.setState({ value });
  };

  componentDidMount() {
    this.props.fetchPhoto()
    this.props.fetchData(334)
  }

  handleHistorical() {
    this.props.fetchData(334)
  }

  handlePhoto() {
    this.props.fetchPhoto()
  }

  render() {
    const { isFetching, url, allData } = this.props.data
    const {value} = this.state;
    return (
      isFetching ?
        <Spinner /> :
        <div style={{ width: '100%' }}>
          <AppBar position="static" color="default">
            <Tabs
              value={value}
              onChange={this.handleChange}
              indicatorColor="primary"
              textColor="primary"
              fullWidth
            >
              <Tab classes={this.props.classes} label="Historical" />
              <Tab classes={this.props.classes} label="Camera View" />
              <Tab classes={this.props.classes} label="Control Panel" />
            </Tabs>
          </AppBar>
          {value === 0 && <div><Historical data={allData} /></div>}
          {value === 1 && <div><CameraView url={url} data={allData[0]} /></div>}
          {value === 2 && <div><ControlPanel data={allData[0]} /></div>}
        </div>
    )
  }
}
export default withStyles(styles)(App);

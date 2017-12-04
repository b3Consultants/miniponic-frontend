import React, { Component } from 'react';
import {Tabs, Tab} from 'material-ui/Tabs';
import Photo from '../components/Photo';
import Ambient from '../components/Ambient';
import Spinner from './Spinner';

class App extends Component {
  constructor(props) {
    super(props);
    this.handleAmbient = this.handleAmbient.bind(this);
    this.handlePhoto = this.handlePhoto.bind(this);
  }

  componentDidMount() {
    this.props.fetchPhoto()
  }

  handleAmbient(tab) {
    const { fetchData } = this.props
    fetchData(334)
  }

  handlePhoto() {
    const { fetchPhoto } = this.props
    fetchPhoto()
  }

  render() {
    const { isFetching, url, allData, tab } = this.props.data

    return (
      isFetching ?
        <Spinner /> :
        <Tabs initialSelectedIndex={tab} >
          <Tab label="Photo" onActive={this.handlePhoto} >
            <Photo url={url} />
          </Tab>
          <Tab label="Ambient" onActive={this.handleAmbient} >
            <Ambient data={allData} />
          </Tab>
          <Tab label="Humidity" />
          <Tab label="Fan/Heater" />
          <Tab label="Tank" />
        </Tabs>
    )
  }
}
export default App;

import React, { Component } from 'react'
import AmbientTable from './AmbientTable'
import AmbientChart from './AmbientChart'

class Ambient extends Component {

  render() {
    return(
      <div>
        <AmbientChart data={this.props.data} />
        <AmbientTable data={this.props.data} />
      </div>
    )
  }
}

export default Ambient;

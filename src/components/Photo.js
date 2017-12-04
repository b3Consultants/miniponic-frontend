import React, { Component } from 'react'
import { Card, CardMedia } from 'material-ui/Card';

class Photo extends Component {

  render() {
    return(
      <Card>
        <CardMedia>
          <img src={this.props.url} alt='' />
        </CardMedia>
      </Card>
    )
  }
}

export default Photo;

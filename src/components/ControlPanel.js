import React, { Component } from 'react';
import { withStyles } from 'material-ui/styles';
import moment from 'moment';
import getAverage from '../utils/getAverage'

const styles = {
  date: {
    position: 'absolute',
    top: '22%',
    left: '10.5%',
    maxWidth: 80
  },
  location: {
    position: 'absolute',
    top: '23.5%',
    left: '23%',
    maxWidth: 80
  },
  temperature: {
    position: 'absolute',
    top: '35%',
    left: '37%',
    maxWidth: 80
  },
  humidity: {
    position: 'absolute',
    top: '42%',
    left: '37%',
    maxWidth: 80
  },
  luminosity: {
    position: 'absolute',
    top: '47.5%',
    left: '37%',
    maxWidth: 80
  }
};

class ControlPanel extends Component {
  render() {
    const { classes, data } = this.props

    return (
      <div>
        <img width={window.innerWidth} height={window.innerHeight} src='https://i.imgur.com/sHQm7ls.jpg' alt='' />
        <div className={classes.date}>
          { data ? moment(data.timestamp).format('hh:mm a DD/MM/YY') : null }
        </div>
        <div className={classes.location}>
          18 de Julio
        </div>
        <div className={classes.temperature}>
          { data ? getAverage(data.temperature) : null } °C
        </div>
        <div className={classes.humidity}>
          { data ? getAverage(data.humidity) : null } %
        </div>
        <div className={classes.luminosity}>
          { data ? data.luminosity[1].value : null } lux
        </div>
      </div>
    );
  }
}

export default withStyles(styles)(ControlPanel);

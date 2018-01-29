import React, { Component } from 'react';
import { withStyles } from 'material-ui/styles';
import Grid from 'material-ui/Grid';
import Paper from 'material-ui/Paper';
import AppBar from 'material-ui/AppBar';
import Toolbar from 'material-ui/Toolbar';
import Typography from 'material-ui/Typography';
import TemperatureChart from './charts/TemperatureChart';
import HumidityChart from './charts/HumidityChart';
import LuminosityChart from './charts/LuminosityChart';
import TankChart from './charts/TankChart';
import moment from 'moment'
import parseData from '../utils/parseData'

const styles = theme => ({
  root: {
    flexGrow: 1,
    marginTop: 30
  },
  paper: {
    padding: 16,
    textAlign: 'center'
  },
  appbar: {
    maxHeight: 30,
    fontSize: 12,
    fontWeight: 100,
    marginBottom: 10
  },
  toolbar: {
    minHeight: 30
  },
  typography: {
    fontSize: '1.2em',
    fontWeight: 100
  }
});

class Historical extends Component {
  getDatesRange = (data) => {
    const totalRangeOfDates = data.reverse().map(value => {
      return value.timestamp
    })
    const dateStep = Math.floor((totalRangeOfDates.length) / 3)
    return [
      moment(totalRangeOfDates[0]).format('hh:mm a - DD/MM/YYYY'),
      moment(totalRangeOfDates[dateStep]).format('hh:mm a - DD/MM/YYYY'),
      moment(totalRangeOfDates[dateStep*2]).format('hh:mm a - DD/MM/YYYY'),
      moment(totalRangeOfDates[totalRangeOfDates.length-1]).format('hh:mm a - DD/MM/YYYY')
    ].reverse()
  }

  render() {
    const { classes, data } = this.props
    const tempData = parseData(data, 'temperature')
    const humData = parseData(data, 'humidity')
    const lumData = parseData(data, 'luminosity')
    const datesRange = this.getDatesRange(data)
    return (
      <div className={classes.root}>
        <Grid container spacing={24}>
          <Grid item xs={6}>
            <Paper className={classes.paper}>
              <AppBar className={classes.appbar} position="static">
                <Toolbar className={classes.toolbar} >
                  <Typography className={classes.typography} type="title" color="inherit">
                    Temperature Chart
                  </Typography>
                </Toolbar>
              </AppBar>
              <TemperatureChart data={tempData} dates={datesRange} />
            </Paper>
          </Grid>
          <Grid item xs={6}>
            <Paper className={classes.paper}>
              <AppBar className={classes.appbar} position="static">
                <Toolbar className={classes.toolbar} >
                  <Typography className={classes.typography} type="title" color="inherit">
                    Humidity Chart
                  </Typography>
                </Toolbar>
              </AppBar>
              <HumidityChart data={humData.reverse()} dates={datesRange} />
            </Paper>
          </Grid>
          <Grid item xs={6}>
            <Paper className={classes.paper}>
              <AppBar className={classes.appbar} position="static">
                <Toolbar className={classes.toolbar} >
                  <Typography className={classes.typography} type="title" color="inherit">
                    Luminosity Chart
                  </Typography>
                </Toolbar>
              </AppBar>
              <LuminosityChart data={lumData} dates={datesRange} />
            </Paper>
          </Grid>
          <Grid item xs={6}>
            <Paper className={classes.paper}>
              <AppBar className={classes.appbar} position="static">
                <Toolbar className={classes.toolbar} >
                  <Typography className={classes.typography} type="title" color="inherit">
                    Tank Chart
                  </Typography>
                </Toolbar>
              </AppBar>
              <TankChart dates={datesRange} />
            </Paper>
          </Grid>
        </Grid>
      </div>
    );
  }
}

export default withStyles(styles)(Historical);

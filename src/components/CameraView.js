import React, { Component } from 'react';
import { withStyles } from 'material-ui/styles';
import Grid from 'material-ui/Grid';
import Paper from 'material-ui/Paper';
import AppBar from 'material-ui/AppBar';
import Toolbar from 'material-ui/Toolbar';
import Typography from 'material-ui/Typography';
import Switch from 'material-ui/Switch';
import Card, { CardContent } from 'material-ui/Card';
import moment from 'moment'

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
  },
  card_data: {
    width: 158,
    position: 'absolute',
    marginTop: 10,
    right: '26%',
    textAlign: 'initial',
    fontSize: 10
  },
  card_info: {
    width: 158,
    position: 'absolute',
    left: '26%',
    marginTop: 10,
    textAlign: 'initial',
    fontSize: 10
  },
  bullet: {
    display: 'inline-block',
    margin: '0 2px',
    transform: 'scale(0.8)'
  },
  title: {
    marginBottom: 16,
    fontSize: 14,
    color: theme.palette.text.secondary
  },
  pos: {
    marginBottom: 12,
    color: theme.palette.text.secondary
  }
});

class CameraView extends Component {
  constructor(props) {
    super(props);
    this.state = {
      values: false
    };

    this.handleChange = ::this.handleChange;
  }

  handleChange = (event, checked) => {
    this.setState({ values: checked });
  };

  renderData(classes, data) {
    return (
      <div>
        <Card className={classes.card_info}>
          <CardContent>
            <Typography component="p">
              <b>Date:</b>
            </Typography>
            <Typography component="p">
              { data ? moment(data.timestamp).format('hh:mm a - DD/MM/YY') : null }
            </Typography>
            <Typography component="p">
              <b>Greenhouse:</b>
            </Typography>
            <Typography component="p">
              18 de Julio
            </Typography>
          </CardContent>
        </Card>
        <Card className={classes.card_data}>
          <CardContent>
            <Typography component="p">
              <b>t1:</b> { data ? data.temperature[0].value : null }°C
            </Typography>
            <Typography component="p">
              <b>t2:</b> { data ? data.temperature[1].value : null }°C
            </Typography>
            <Typography component="p">
              <b>h1:</b> { data ? data.humidity[0].value : null }%
            </Typography>
            <Typography component="p">
              <b>h2:</b> { data ? data.humidity[0].value : null }%
            </Typography>
            <Typography component="p">
              <b>lux:</b> { data ? data.luminosity[1].value : null } lux
            </Typography>
            <Typography component="p">
              <b>tank1:</b> 54 liters
            </Typography>
          </CardContent>
        </Card>
      </div>
    )
  }

  render() {
    const { classes, data } = this.props
    const  { values } = this.state
    return (
      <div className={classes.root}>
        <Grid container spacing={24}>
          <Grid item xs={2} />
          <Grid item xs={8}>
            <Paper className={classes.paper}>
              <AppBar className={classes.appbar} color="default" position="static">
                <Toolbar className={classes.toolbar} >
                  <Typography className={classes.typography} type="title" color="inherit">
                    Toggle Values:
                  </Typography>
                  <Switch checked={values} color="default" onChange={this.handleChange} aria-label="LoginSwitch" />
                </Toolbar>
              </AppBar>
              { values ? this.renderData(classes, data) : null }
              <img src={this.props.url} alt='' />
            </Paper>
          </Grid>
          <Grid item xs={2} />
        </Grid>
      </div>
    );
  }
}

export default withStyles(styles)(CameraView);

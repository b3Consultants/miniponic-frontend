import React, { Component } from 'react';
import {
  Table,
  TableBody,
  TableHeader,
  TableHeaderColumn,
  TableRow,
  TableRowColumn,
} from 'material-ui/Table';
import Paper from 'material-ui/Paper';
import axios from 'axios';
import moment from 'moment';

const style = (url) => ({
  height: 350,
  width: 350,
  margin: 20,
  textAlign: 'center',
  marginLeft:'35%',
  display: 'inline-block',
  backgroundImage: `url("${url}")`,
  backgroundSize: '100% 100%'
})

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      data: null
    };
  }

  componentDidMount() {
    axios.get('http://localhost:8081/data/getData/MYZZERO123')
    .then((response) => {
      this.setState({data: response.data})
    })
    setInterval(() => {
      axios.get('http://localhost:8081/data/getData/MYZZERO123')
      .then((response) => {
        this.setState({data: response.data})
      })
    }, 150000)
  }

  getAverage(values) {
    let sum = 0
    let counter = 0
    values.forEach((val) => {
      if (val.value !== 'nan' ){
        sum = sum + parseFloat(val.value)
        counter += 1
      }
    })
    return sum / counter
  }

  renderHeader(data) {
    return (
      Object.keys(data).map((key) => {
        if (key !== 'photo'){
          return <TableHeaderColumn>{key.toUpperCase()}</TableHeaderColumn>
        }
        return null
      })
    )
  }

  renderRowData(values) {
    return (
      Object.keys(values).map((key) => {
        if (key !== 'photo') {
          return <TableRowColumn>{this.getAverage(values[key])}</TableRowColumn>
        }
        return null
      })
    )
  }

  renderData(data) {
    return (
      data.map((values) => {
        return (
          <TableRow>
            {this.renderRowData(values.data)}
            <TableRowColumn>{moment(values.timestamp).format('h:m - DD/MM/YYYY ')}</TableRowColumn>
          </ TableRow>
        )
      })
    )
  }

  render() {
    const data = this.state.data
    const today = new Date()
    var startTime = moment('06:30 am', "HH:mm a");
    var endTime = moment('19:00 pm', "HH:mm a");
    const photo = moment(today).isBetween(startTime, endTime) ?
      'https://i.imgur.com/C0ZD2lT.jpg':'https://i.imgur.com/PXbJ5pN.jpg'

    if (data) {
      return (
        <div>
          <Paper style={style(photo)} zDepth={4} />
          <Table selectable={false}>
            <TableHeader
              displaySelectAll={false}
              adjustForCheckbox={false}
              >
              <TableRow>
                {this.renderHeader(data[0].data)}
                <TableHeaderColumn>TIMESTAMP</TableHeaderColumn>
              </TableRow>
            </TableHeader>
            <TableBody
              displayRowCheckbox={false}
            >
              {this.renderData(data)}
            </TableBody>
          </Table>
        </div>
      )
    }
    return null
  }
}

export default App;

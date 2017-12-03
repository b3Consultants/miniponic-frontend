import React, { Component } from 'react'
import {
  Table,
  TableBody,
  TableHeader,
  TableHeaderColumn,
  TableRow,
  TableRowColumn
} from 'material-ui/Table'
import Paper from 'material-ui/Paper'
import axios from '../utils/axios'
import getAverage from '../utils/getAverage'
import moment from 'moment'
import Chart from './Chart'

// const stylePhoto = (url= '') => ({
//   height: 350,
//   width: 350,
//   margin: 20,
//   textAlign: 'center',
//   marginLeft:'35%',
//   display: 'inline-block',
//   backgroundImage: `url("${url}")`,
//   backgroundSize: '100% 100%'
// })

const styleGraphContainer = {
  margin: 20,
  marginLeft:'1.8%'
}

class App extends Component {
  constructor(props) {
    super(props)
    this.state = {
      data: null,
      graphData: null
    }
  }

  componentDidMount() {
    axios.get('/data/getData/MYZZERO123/limit/334')
    .then((response) => {
      this.setState({graphData: response.data})
    })
    axios.get('/data/getData/MYZZERO123/limit/4')
    .then((response) => {
      this.setState({data: response.data})
    })
    setInterval(() => {
      axios.get('/data/getData/MYZZERO123/limit/4')
      .then((response) => {
        this.setState({data: response.data})
      })
      axios.get('/data/getData/MYZZERO123/limit/334')
      .then((response) => {
        this.setState({graphData: response.data})
      })
    }, 150000)
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
          return <TableRowColumn>{getAverage(values[key])}</TableRowColumn>
        }
        return null
      })
    )
  }

  renderData(data) {
    return (
      data.map(value => {
        return (
          <TableRow key>
            {this.renderRowData(value.data)}
            <TableRowColumn>{moment(value.timestamp).format('hh:mm a - DD/MM/YYYY')}</TableRowColumn>
          </TableRow>
        )
      })
    )
  }

  render() {
    const { data, graphData } = this.state
    // const today = new Date()
    // var startTime = moment('06:30 am', "HH:mm a");
    // var endTime = moment('19:00 pm', "HH:mm a");
    // const photo = moment(today).isBetween(startTime, endTime) ?
    //   'https://i.imgur.com/C0ZD2lT.jpg':'https://i.imgur.com/PXbJ5pN.jpg'

    if (graphData) {
      return (
        <div>
          {/* <Paper style={style(photo)} zDepth={4} /> */}
          <Paper style={styleGraphContainer} zDepth={4}>
            <Chart data={graphData} />
          </Paper>
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

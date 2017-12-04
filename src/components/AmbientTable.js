import React, { Component } from 'react'
import {
  Table,
  TableBody,
  TableHeader,
  TableHeaderColumn,
  TableRow,
  TableRowColumn
} from 'material-ui/Table'
import getAverage from '../utils/getAverage'
import moment from 'moment'

class AmbientTable extends Component {

  renderHeader(data) {
    return (
      Object.keys(data).map((key) => {
        if (key !== 'timestamp'){
          return <TableHeaderColumn>{key.toUpperCase()}</TableHeaderColumn>
        }
        return null
      })
    )
  }

  renderRowData(values) {
    return (
      Object.keys(values).map((key) => {
        if (key !== 'timestamp') {
          return <TableRowColumn>{getAverage(values[key])}</TableRowColumn>
        }
        return null
      })
    )
  }

  renderData(data) {
    return (
      data.map((value, key) => {
        return (
          <TableRow key>
            {this.renderRowData(value)}
            <TableRowColumn>{moment(value.timestamp).format('hh:mm a - DD/MM/YYYY')}</TableRowColumn>
          </TableRow>
        )
      })
    )
  }

  render() {
    const data = this.props.data.slice(0, 5)

    return(
      data.length > 0 ?
        <Table selectable={false}>
          <TableHeader
            displaySelectAll={false}
            adjustForCheckbox={false}
            >
            <TableRow>
              {this.renderHeader(data[0])}
              <TableHeaderColumn>TIMESTAMP</TableHeaderColumn>
            </TableRow>
          </TableHeader>
          <TableBody
            displayRowCheckbox={false}
          >
            {this.renderData(data)}
          </TableBody>
        </Table> :
        null
    )
  }
}

export default AmbientTable;

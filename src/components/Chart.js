import React, { Component } from 'react'
import {
  VictoryChart,
  VictoryLine,
  VictoryTheme,
  VictoryAxis,
  VictoryLegend,
  VictoryVoronoiContainer,
  VictoryTooltip
} from 'victory'
import moment from 'moment'
import getAverage from '../utils/getAverage'

class Chart extends Component {

  parseData = (rawData, type) => (
    rawData.reverse().map(value => {
      if (value.data[type]) {
        return { x: value.timestamp, y: parseInt(getAverage(value.data[type])) }
      }
    })
  )

  cleanData = (rawData, type) => {
    const cleanData = []
    for(let i = 0; i < rawData.length; i++) {
      const value = rawData[i]
      if (!this.hasNaNAverages(value)) cleanData.push(value)
    }
    return cleanData
  }

  hasNaNAverages = (value) => {
    return getAverage(value.data['temperature']) === 'NaN'
  }

  getDatesRange = (data) => {
    const totalRangeOfDates = data.reverse().map(value => {
      return value.timestamp
    })
    const dateStep = Math.floor((totalRangeOfDates.length) / 3)
    return [
      totalRangeOfDates[0],
      totalRangeOfDates[dateStep],
      totalRangeOfDates[dateStep*2],
      totalRangeOfDates[totalRangeOfDates.length-1]
    ].reverse()
  }

  render() {
    const data = this.cleanData(this.props.data)
    const tempData = this.parseData(data, 'temperature')
    const humData = this.parseData(data, 'humidity')
    const lumData = this.parseData(data, 'luminosity')
    const datesRange = this.getDatesRange(data)

    return (
      <VictoryChart
        theme={VictoryTheme.material}
        height={300}
        width={900}
        containerComponent={
          <VictoryVoronoiContainer
            dimension="x"
            labels={(d) => `value: ${d.y}, time: ${moment(d.x).format('hh:mm a - DD/MM/YYYY')}`}
            labelComponent={
              <VictoryTooltip
                cornerRadius={0}
                flyoutStyle={{fill: "white"}}
              />}
          />}
      >
        <VictoryAxis
          scale='time'
          standalone={false}
          tickFormat={(x) => moment(x).format('hh:mm a - DD/MM/YY')}
          style={{tickLabels: { fontSize: 8 }}}
          tickValues={datesRange}
        />

        <VictoryAxis
          dependentAxis
          orientation='left'
          style={{tickLabels: { fontSize: 8 }}}
        />

        <VictoryLine
          data={tempData}
          scale={{x: 'time', y: 'linear'}}
          style={{
            data: { stroke: "#c43a31" },
            parent: { border: "1px solid #ccc" }
          }}
        />

        <VictoryLine
          data={humData}
          scale={{x: 'time', y: 'linear'}}
          style={{
            data: { stroke: "#0066ff" },
            parent: { border: "1px solid #ccc" }
          }}
        />

        <VictoryLine
          data={lumData}
          scale={{x: 'time', y: 'linear'}}
          style={{
            data: { stroke: "#ff3399" },
            parent: { border: "1px solid #ccc" }
          }}
        />

        <VictoryLegend x={350} y={10}
          orientation="horizontal"
          gutter={20}
          style={{ labels: { fontSize: 8 } }}
          data={[
            { name: 'Temperature', symbol: { type: 'square', fill: '#c43a31' } },
            { name: 'Humidity', symbol: { type: 'square', fill: '#0066ff' } },
            { name: 'Luminosity', symbol: { type: 'square', fill: '#ff3399' } }
          ]}
        />
      </VictoryChart>
    )
  }
}

export default Chart;

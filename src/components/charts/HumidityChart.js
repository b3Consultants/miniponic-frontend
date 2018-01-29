import React, { Component } from 'react'
import {
  LineChart,
  CartesianGrid,
  XAxis,
  Tooltip,
  Legend,
  Line,
  YAxis,
  Brush
} from 'recharts'

class HumidityChart extends Component {
  constructor(props) {
    super(props);
    this.state = {
      opacity: {
        h1: 1,
        h2: 1
      }
    };

    this.handleMouseEnter = ::this.handleMouseEnter;
    this.handleMouseLeave = ::this.handleMouseLeave;
    this.handleOnClick = ::this.handleOnClick;
  }

  formatXAxis = (tickItem) => {
    return tickItem.split('-')[1]
  }

  handleMouseEnter = (o) => {
    const { dataKey } = o;
    const { opacity } = this.state;

    this.setState({
      opacity: { ...opacity, [dataKey]: 0.2 }
    });
  }

  handleMouseLeave = (o) => {
    const { dataKey } = o;
    const { opacity } = this.state;
    this.setState({
      opacity: { ...opacity, [dataKey]: 1 }
    });
  }

  handleOnClick = (o) => {
    const { dataKey } = o;
    const { opacity } = this.state;
    if (opacity[o.value] !== 1) {
      this.setState({
        opacity: { ...opacity, [dataKey]: 1 }
      });
    } else {
      this.setState({
        opacity: { ...opacity, [dataKey]: 0 }
      });
    }
  }

  render() {
    const width = ( window.innerWidth / 2 ) - 90;
    const height = ( window.innerHeight / 2 ) - 140;
    const { data, dates } = this.props;
    const { opacity } = this.state;

    return (
      <LineChart width={width} height={height} data={data}
        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="5 5" />
        <XAxis ticks={dates} tickFormatter={this.formatXAxis} dataKey="date" fontFamily="Roboto, sans-serif" fontSize="12px" />
        <YAxis unit='%' fontFamily="Roboto, sans-serif" fontSize="12px" />
        <Tooltip fontFamily="Roboto, sans-serif" />
        <Brush dataKey="date" height={20} />
        <Legend onMouseEnter={this.handleMouseEnter} onMouseLeave={this.handleMouseLeave} verticalAlign="top" height={36} fontFamily="Roboto, sans-serif" />
        <Line connectNulls dataKey="h1" dot={false} stroke="#8884d8" strokeOpacity={opacity.h1} />
        <Line connectNulls dataKey="h2" dot={false} stroke="#82ca9d" strokeOpacity={opacity.h2} />
      </LineChart>
    )
  }
}

export default HumidityChart;

import getAverage from './getAverage'

const parseData = (rawData, type) => (
  rawData.reverse().map(value => {
    if (value[type]) {
      return { x: value.timestamp, y: parseInt(getAverage(value[type])) }
    }
  })
)

export default parseData


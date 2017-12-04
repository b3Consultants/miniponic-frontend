import getAverage from './getAverage'

const cleanData = (rawData) => {
  const cleanData = []
  for(let i = 0; i < rawData.length; i++) {
    const value = rawData[i]
    if (!hasNaNAverages(value)) cleanData.push(value)
  }
  return cleanData
}

const hasNaNAverages = (value) => (
  getAverage(value['temperature']) === 'NaN'
)

export default cleanData

import moment from 'moment'

const parseData = (rawData, type) => (
  rawData.reverse().map(value => {
    if (value[type]) {
      const object = { date: moment(value.timestamp).format('hh:mm a - DD/MM/YYYY') };
      const datas = value[type];
      for (let i = 0; i < datas.length; i++) {
        const data = datas[i];
        if (data.value !== 'nan') {
          object[data.sensorName] = parseInt(data.value);
        }
      }
      return object
    }
  })
)

export default parseData


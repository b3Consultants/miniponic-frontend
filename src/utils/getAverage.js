const getAverage = (values) => {
  let sum = 0
  let counter = 0
  values.forEach((val) => {
    if (val.value !== 'nan' ){
      sum = sum + parseFloat(val.value)
      counter += 1
    }
  })
  return (sum / counter).toFixed(2)
}

export default getAverage

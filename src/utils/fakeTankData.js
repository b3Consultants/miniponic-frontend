const fakeTankData = (dates) => (
  dates.map(value => {
    return { date: value, tank1: parseInt(Math.random()*100) }
  })
)

export default fakeTankData


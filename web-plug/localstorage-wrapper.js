module.exports = {
  getItem: (namespace) => {
    console.log('Trying to get', namespace)
    const item = localStorage.getItem(namespace)
    if (!item) {
      console.log('Didnt find so returning null')
      return null
    }
    return JSON.parse(item)
  },

  setItem: (namespace, item) => {
    localStorage.setItem(namespace, JSON.stringify(item))
  }
}
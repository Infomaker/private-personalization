const fs = require('fs')
const articleExtractor = require('../web-plug/article-extractor')

const DATA_BLOB_PATH = '../__data__/24kalmar.se.json'
const ARTICLE_BLOB_PATH = `../__data__/24kalmar.se-converted_${new Date().getTime()}.json`

const dataBlob = JSON.parse(fs.readFileSync(DATA_BLOB_PATH))

const articles = articleExtractor(dataBlob)

fs.writeFileSync(ARTICLE_BLOB_PATH, JSON.stringify(articles, null, 2))

console.log('Done')
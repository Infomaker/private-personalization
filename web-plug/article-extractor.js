/**
  If an object contains the properties slug and body we consider it an article
  Ignore ads
 */
const isArticle = (node) => {
  if (node && typeof node === 'object') {
    return (node.hasOwnProperty('slug') && node.hasOwnProperty('body') && !node.external_sponsored)
  }
  return false
}

/**
  Convert an article node to a normalized article object
 */
const convertNodeToArticle = (node) => {
  const tags = new Set()
  node.tags.forEach(tag => tags.add(tag.toLowerCase()))
  node.categories.forEach(category => tags.add(category.toLowerCase()))

  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = node.body
  const strippedBody = tempDiv.textContent

  const joinedTags = Array.from(tags).join(' ')

  return {
    id: `${node.slug}`,
    body: strippedBody || 'i-really-like-empty-bodies',
    title: node.headline ? node.headline.trim(): 'i-really-like-no-title',
    tags: joinedTags.length ? joinedTags : 'i-really-like-your-lack-of-tags'
  }
}

/**
  Recursively traverse a node tree and extract all articles
 */
const extractArticlesFromNode = (currentNode, articles = {}, level = 0) => {
  // If the current node is an array we want to iterate over the contained items
  if (Array.isArray(currentNode)) {
    currentNode.forEach(node => {
      extractArticlesFromNode(node, articles, level + 1)
    })
  } else if (isArticle(currentNode)) {
    const convertedArticle = convertNodeToArticle(currentNode)
    articles[convertedArticle.id] = convertedArticle
  } else {
    if (typeof currentNode === 'object') {
      Object.keys(currentNode).forEach(nodeKey => {
        if (currentNode[nodeKey]) {
          extractArticlesFromNode(currentNode[nodeKey], articles, level + 1)
        }
      })
    }
  }
  return articles
}

module.exports = (dataBlob) => {
  return extractArticlesFromNode(dataBlob)
}
const ID_PREFIX = 'https://24kalmar.se'
const articleExtractor = require('./article-extractor')

/**
  localStorage wrapper
 */
const ls = {
  getItem: (namespace) => {
    const item = localStorage.getItem(namespace)
    if (!item) {
      return null
    }
    return JSON.parse(item)
  },

  setItem: (namespace, item) => {
    localStorage.setItem(namespace, JSON.stringify(item))
  }
}

// Set initial localStorage
if(!ls.getItem('ppa')){
  ls.setItem('ppa', {})
}

const createArticleVoteResultElement = (article) => {
  const container = document.createElement('span')
  container.classList.add('ALH__vote-result-container')
  container.style.borderRadius = '4px'
  container.style.backgroundColor = 'green'
  container.style.fontSize = '0.5em'
  container.style.padding = '0.25em'

  const voteResultElement = document.createElement('span')
  voteResultElement.classList.add('ALH__vote-result')
  voteResultElement.classList.add(`ALH__article-id-${article.slug}`)
  //voteResultElement.innerText = String(article.score)
  container.appendChild(voteResultElement)

  return container
}

const renderAllVotes = () => {
  const localStorageArticleData = ls.getItem('ppa')

  Object.keys(localStorageArticleData).map(slug => {
    const voteResultElements = document.querySelectorAll(`.ALH__vote-result.ALH__article-id-${slug}`)

    voteResultElements.forEach(voteResultElement => {
      voteResultElement.innerHTML = localStorageArticleData[slug].vote
    })
  })
}

const storeVote = (articleData, vote) => {
  const localStorageArticleData = ls.getItem('ppa')

  if (localStorageArticleData[articleData.slug]) {
    localStorageArticleData[articleData.slug].vote = localStorageArticleData[articleData.slug].vote + vote
  } else {
    localStorageArticleData[articleData.slug] = {
      articleData,
      vote: vote
    }
  }
  
  console.log('local storage update', {
    localStorageArticleData: JSON.stringify(localStorageArticleData, null, 2)
  })
  ls.setItem('ppa', localStorageArticleData)

  renderAllVotes()
}


const createArticleVoteButtonsElement = (articleData) => {
  const container = document.createElement('span')

  const dislikeButtonElement = document.createElement('button')
  dislikeButtonElement.addEventListener('click', () => {
    console.log('dislike!')
    storeVote(articleData, -1)
  }, false)
  dislikeButtonElement.innerText = String('-')


  const likeButtonElement = document.createElement('button')
  likeButtonElement.addEventListener('click', () => {
    console.log('like!!!')
    storeVote(articleData, 1)
  }, false)
  likeButtonElement.innerText = String('+')

  container.appendChild(dislikeButtonElement)
  container.appendChild(likeButtonElement)
  return container
}

const identifyPage = () => {
  let type = 'unknown'
  const ogType = document.head.querySelector("[property='og:type']")
  if (ogType) {
    type = ogType.content
  }
  return type // article|website|uknown
}


/// ---------- Done working on initial parsing

const onArticlePageLoad = () => {
  console.log('ARTICLE PAGE LOADED')
  const availableArticles = articleExtractor(window.__NUXT__)
  const currentArticle = availableArticles[window.location.href]

  console.log('currentArticle', currentArticle)

  // Extract article headline
  const headline = document.querySelector('h1')
  const voteButtonsElement = createArticleVoteButtonsElement(currentArticle)
  const voteResultElement = createArticleVoteResultElement(currentArticle)

  headline.appendChild(voteButtonsElement)
  headline.appendChild(voteResultElement)

  storeVote(currentArticle, 0)  // if it exists, load vote, else set vote to 0
}

const onStartPageLoad = () => {
  console.log('START PAGE LOADED')
  const allArticles = articleExtractor(window.__NUXT__)
  console.log(allArticles)
  const fullArticleUrls = Object.keys(allArticles)
  const articleTitlesShorted = fullArticleUrls.map(articleUrl => allArticles[articleUrl].title.slice(0, 37))
  const articleLinks = Array.from(document.querySelectorAll('a')).filter(link => {
    // Find all links that point to an article (from our json)
    return fullArticleUrls.includes('https://24kalmar.se' + link.getAttribute('href'))
  }).filter(link => {
    // Filter out all text links (remove image links)
    const linkText = link.innerText.trim()
    return articleTitlesShorted.includes(linkText.slice(0, 37))
  })

  articleLinks.forEach(link => {
    const wantedArticle = allArticles[`${ID_PREFIX}${link.getAttribute('href')}`]
    if (wantedArticle) {
      const voteResultElement = createArticleVoteResultElement(wantedArticle)
      link.innerHTML = voteResultElement.outerHTML + link.innerHTML
    }
  })

  console.log('articleLinks', articleLinks)

  renderAllVotes()
}





// -------- Onload ----------
const onPageChange = () => {
  setTimeout(() => {
    // alert('changed! ' + identifyPage()) // initial
    const pageType = identifyPage()
    if (pageType === 'article') {
      console.log('PROCESS ARTICLE')
      onArticlePageLoad()
    } else if (pageType === 'website') {
      console.log('PROCESS STARTPAGE')
      onStartPageLoad()
    } else {
      alert('WARNING: Could not identify page type', pageType)
    }
  }, 500)
}
onPageChange()

// Use it like this:
let lastUrl = window.location.href
setInterval(() => {
  const currentUrl = window.location.href
  if (lastUrl != currentUrl) {
    onPageChange()
  }
  lastUrl = currentUrl
}, 100)
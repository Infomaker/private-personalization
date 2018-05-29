const nbayes = require('nbayes') //https://github.com/derhuerst/nbayes
const articleExtractor = require('./article-extractor')
const ls = require('./localstorage-wrapper')

const ID_PREFIX = 'https://24kalmar.se'


// Set initial localStorage
const localStorageActive = Boolean(localStorage.getItem('articleVotes'))
if (!localStorageActive) {
  console.log('Could not find stuff in localstorage, PANIC!')
  localStorage.setItem('articleVotes', '{}')
} else {
  console.log('Found it in localstorage, PANIC ANYWAYS!')
}

const addPluginStyle = () => {
  const styleElement = document.createElement('style')
  styleElement.textContent = `
    .ALH__classifier-container {
      height: 20px;
      width: 100px;
      border: 1px solid black;
      box-sizing: border-box;
    }

    .ALH__classifier-unit {
      height: 100%;
      display: inline-block;
    }

    .classifier-unit.positive {
      background-color: green;
    }

    .classifier-unit.neutral {
      background-color: #fefefe;
    }

    .classifier-unit.negative {
      background-color: red;
    }
  `
  const headElement = document.querySelector('head')
  headElement.appendChild(styleElement)
}

const createArticleClassificationScore = (article) => {
  const container = document.createElement('span')
  container.classList.add('ALH__vote-result-container')
  container.style.borderRadius = '4px'
  container.style.backgroundColor = '#ffffff'
  container.style.fontSize = '0.5em'
  container.style.padding = '0.25em'

  const classificationScoreElement = document.createElement('span')
  classificationScoreElement.classList.add('ALH__classification-score')
  classificationScoreElement.classList.add(`ALH__article-id-${article.id}`)
  //classificationScoreElement.innerText = String(article.score)
  container.appendChild(classificationScoreElement)

  return container
}

const createArticleVoteResultElement = (article) => {
  const container = document.createElement('span')
  container.classList.add('ALH__vote-result-container')
  container.style.borderRadius = '4px'
  container.style.backgroundColor = '#eaeaea'
  container.style.fontSize = '0.5em'
  container.style.padding = '0.25em'

  const voteResultElement = document.createElement('span')
  voteResultElement.classList.add('ALH__vote-result')
  voteResultElement.classList.add(`ALH__article-id-${article.id}`)
  voteResultElement.innerText = String('oläst')
  container.appendChild(voteResultElement)

  return container
}

const renderAllVotes = () => {
  const localStorageArticleData = ls.getItem('articleVotes')

  Object.keys(localStorageArticleData).map(id => {
    const voteResultElements = document.querySelectorAll(`.ALH__vote-result.ALH__article-id-${id}`)
    voteResultElements.forEach(voteResultElement => {
      voteResultElement.innerHTML = localStorageArticleData[id].vote
    })
  })
}

const renderAllClassificationScores = (classifiedArticles) => {

  Object.keys(classifiedArticles).map(id => {
    const classificationScoreElements = document.querySelectorAll(`.ALH__classification-score.ALH__article-id-${id}`)
    classificationScoreElements.forEach(classificationScoreElement => {
      const probabilities = classifiedArticles[id]
      const probabilitySum =
        probabilities.neutral +
        probabilities.positive +
        probabilities.negative

      const probabilityPercentages = {
        positive: `${Math.floor(probabilities.positive / probabilitySum * 10000)/100}%`,
        neutral: `${Math.floor(probabilities.neutral / probabilitySum * 10000)/100}%`,
        negative: `${Math.floor(probabilities.negative / probabilitySum * 10000)/100}%`
      }
      classificationScoreElement.innerHTML = JSON.stringify(probabilityPercentages)
    })
  })
}

const trainModelOnVotedArticlesAndReturnTrainedClassifiers = () => {
  const votedArticles = ls.getItem('articleVotes')
  const startTime = Date.now()
  const articleIds = Object.keys(votedArticles)

  console.log('Start learning from ...', {
    articleIds
  })

  const classifiers = {
    title: nbayes(),
    tags: nbayes(),
    body: nbayes()
  }

  articleIds.forEach(articleId => {
    Object.keys(classifiers).forEach(classifierType => {
      const article = votedArticles[articleId]
      console.log('Learning from article', {
        articleId,
        vote: article.vote,
        tags: article.articleData.tags
      })

      const stringToClassify = article.articleData[classifierType] || ''

      if (article.vote === 0) {
        classifiers[classifierType].learn('neutral', nbayes.stringToDoc(stringToClassify))

      }

      if (article.vote > 0) {
        for (let i = 0; i < Math.abs(article.vote); i++) {
          classifiers[classifierType].learn('positive', nbayes.stringToDoc(stringToClassify))
        }
      }

      if (article.vote < 0) {
        for (let i = 0; i < Math.abs(article.vote); i++) {
          classifiers[classifierType].learn('negative', nbayes.stringToDoc(stringToClassify))
        }
      }
    })

    console.log('Done learning!', {
      time: `${Date.now() - startTime}ms`
    })
  })
  return classifiers
}

const classifyArticles = (articlesToClassify, trainedClassifiers) => {
  const classifiedArticles = {}
  Object.keys(articlesToClassify).forEach(articleId => {
    const article = articlesToClassify[articleId]
    const probablilities = {
      title: trainedClassifiers['title'].probabilities(nbayes.stringToDoc(article['title'])),
      tags: trainedClassifiers['tags'].probabilities(nbayes.stringToDoc(article['tags'])),
      body: trainedClassifiers['body'].probabilities(nbayes.stringToDoc(article['body']))
    }

    Object.keys(probablilities).forEach(classifierType => {
      const prob = probablilities[classifierType]
      probablilities[classifierType].positive = prob.positive || 0
      probablilities[classifierType].neutral = prob.neutral || 0
      probablilities[classifierType].negative = prob.negative || 0
    })

    const weightedProbabilities = {
      neutral: probablilities.title.neutral + probablilities.tags.neutral + probablilities.body.neutral,
      positive: probablilities.title.positive + probablilities.tags.positive + probablilities.body.positive,
      negative: probablilities.title.negative + probablilities.tags.negative + probablilities.body.negative,
    }
    console.log('probabilities', probablilities)
    console.log('weighted', weightedProbabilities)


    classifiedArticles[articleId] = weightedProbabilities
  })

  // todo: find highest probability
  // const classiefiedArtieclesArray = Object.keys(classifiedArticles).map(classifiedArticle => classifiedArticle)
  // const highestScore2 = Math.max.apply(Math, myArr.map(x => Math.max(x.positive || 0, x.neutral || 0, x.negative || 0)))

  const highestProbability = Object.keys(classifiedArticles).map(key => classifiedArticles[key]).reduce((maxValue, articleProb) => {
    let localMax = maxValue

    if (articleProb.neutral > localMax) {
      localMax = articleProb.neutral
    }

    if (articleProb.negative > localMax) {
      localMax = articleProb.negative
    }

    if (articleProb.positive > localMax) {
      localMax = articleProb.positive
    }

    return localMax
  }, 0)

  const compensationFactor = 1 / highestProbability



  const normalizedClassifiedArticles = {}
  Object.keys(classifiedArticles).map(key => {
    const classifiedArticle = classifiedArticles[key]
    normalizedClassifiedArticles[key] = {
      neutral: classifiedArticle.neutral * compensationFactor,
      positive: classifiedArticle.positive * compensationFactor,
      negative: classifiedArticle.negative * compensationFactor
    }
  })

  console.log('normalizedClassifiedArticles', {
    normalizedClassifiedArticles
  })

  return normalizedClassifiedArticles
}

const storeVote = (articleData, vote) => {
  console.log('VOTE ON ARTICLE!', {
    articleData,
    vote
  })
  const localStorageArticleData = ls.getItem('articleVotes')

  if (localStorageArticleData[articleData.id]) {
    localStorageArticleData[articleData.id].vote = localStorageArticleData[articleData.id].vote + vote
  } else {
    localStorageArticleData[articleData.id] = {
      articleData,
      vote: vote
    }
  }

  console.log('local storage update', {
    localStorageArticleData: JSON.stringify(localStorageArticleData, null, 2)
  })
  ls.setItem('articleVotes', localStorageArticleData)

  renderAllVotes()

  const trainedClassifiers = trainModelOnVotedArticlesAndReturnTrainedClassifiers()
  const classifiedArticles = classifyArticles({
    [articleData.id]: articleData
  }, trainedClassifiers)
  renderAllClassificationScores(classifiedArticles)
}


const createArticleVoteButtonsElement = (articleData) => {
  const container = document.createElement('span')

  const dislikeButtonElement = document.createElement('button')
  dislikeButtonElement.addEventListener('click', () => {
    storeVote(articleData, -1)
  }, false)
  dislikeButtonElement.innerText = String('ointressant')


  const likeButtonElement = document.createElement('button')
  likeButtonElement.addEventListener('click', () => {
    storeVote(articleData, 1)
  }, false)
  likeButtonElement.innerText = String('intressant för mig')

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
  const availableArticles = articleExtractor(window.__NUXT__)
  const currentArticle = availableArticles[window.location.href.replace('https://24kalmar.se/', '')]

  console.log('currentArticle', currentArticle)

  // Extract article headline
  const headline = document.querySelector('h1')
  const voteButtonsElement = createArticleVoteButtonsElement(currentArticle)
  const voteResultElement = createArticleVoteResultElement(currentArticle)
  const classificationScoreElement = createArticleClassificationScore(currentArticle)

  headline.appendChild(voteButtonsElement)
  headline.appendChild(voteResultElement)
  headline.appendChild(classificationScoreElement)

  storeVote(currentArticle, 0) // if it exists, load vote, else set vote to 0
}

const onStartPageLoad = () => {
  const allArticlesOnPage = articleExtractor(window.__NUXT__)

  const trainedClassifiers = trainModelOnVotedArticlesAndReturnTrainedClassifiers()

  const shortenedArticleTitles = Object.keys(allArticlesOnPage).map(id => allArticlesOnPage[id].title.slice(0, 37))
  const fullArticleUrls = Object.keys(allArticlesOnPage).map(articleId => `${ID_PREFIX}/${articleId}`)

  const allArticleLinksOnPage = Array.from(document.querySelectorAll('a')).filter(link => {
    // Find all links that point to an article (from our json)
    return fullArticleUrls.includes('https://24kalmar.se' + link.getAttribute('href'))
  }).filter(link => {
    // Filter out all text links (remove image links)
    const shortenedLinkText = link.innerText.trim().slice(0, 37)
    return shortenedArticleTitles.includes(shortenedLinkText)
  })

  allArticleLinksOnPage.forEach(link => {
    const linkArticleId = link.getAttribute('href').replace('/', '')
    const linkArticle = allArticlesOnPage[linkArticleId]
    if (linkArticle) {
      const voteResultElement = createArticleVoteResultElement(linkArticle)
      const classificationScoreElement = createArticleClassificationScore(linkArticle)
      link.innerHTML = voteResultElement.outerHTML + link.innerHTML + classificationScoreElement.outerHTML
    }
  })
  const classifiedArticles = classifyArticles(allArticlesOnPage, trainedClassifiers)
  renderAllVotes()
  renderAllClassificationScores(classifiedArticles)
}

// -------- Onload ----------
const onPageChange = () => {
  setTimeout(() => {
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

addPluginStyle()

onPageChange()

let lastUrl = window.location.href
setInterval(() => {
  const currentUrl = window.location.href
  if (lastUrl != currentUrl) {
    onPageChange()
  }
  lastUrl = currentUrl
}, 100)
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
    .ALH_article-page-container {
      display: block;
    }


    /* Vote result */

    .ALH__vote-result-container {
      border-radius: 4px;
      background-color: #EEEEEE;
      font-size: 0.5em;
      padding: 0.25em;
      position: relative;
      top: -0.25em;
      margin-right: 0.5em;
    }

    .ALH__vote-result {}

    .ALH__vote-result.positive {
      backgroundColor: #8BC34A;
    }

    .ALH__vote-result.negative {
      backgroundColor: #F44336;
    }


    /* Classifier buttons */

    .ALH__classifier-button-container {}

    .ALH__classifier-button {
      font-size: 0.5em;
      padding: 0 0.8em;
      line-height: 1.6em;
      border-radius: 2px;
      margin-right: 0.5em;
      background: #3cb0fd;
      background-image: linear-gradient(to bottom, #03A9F4, #039BE5);
      border-radius: 4px;
      color: #ffffff;
      border: none;
      text-decoration: none;
    }

    .ALH__classifier-button.not-interesting {}

    .ALH__classifier-button.interesting {}


    /* Classifier bar */

    .ALH__classification-score-container {
      border-radius: 4px;
      font-size: 0.5em;
      padding: 0.25em;
      position: relative;
      top: -0.25em;
    }

    .ALH__classifier-container {
      height: 10px;
      width: 100px;
      box-sizing: border-box;
      display: inline-block;
      border-radius: 0.25em;
    }

    .ALH__classifier-unit {
      height: 100%;
      display: inline-block;
    }

    .ALH__classifier-unit.interesting {
      background-color: #8BC34A;
    }

    .ALH__classifier-unit.neutral {
      background-color: #EEEEEE;
    }

    .ALH__classifier-unit.not-interesting {
      background-color: #F44336;
    }
  `
  const headElement = document.querySelector('head')
  headElement.appendChild(styleElement)
}

const createArticleClassificationScore = (article) => {
  const container = document.createElement('span')
  container.classList.add('ALH__classification-score-container')

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

  const voteResultElement = document.createElement('span')
  voteResultElement.classList.add('ALH__vote-result')
  voteResultElement.classList.add(`ALH__article-id-${article.id}`)
  voteResultElement.innerText = 'Oläst'
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
        probabilities.interesting +
        probabilities.notInteresting

      const probabilityPercentages = {
        interesting: `${Math.floor(probabilities.interesting / probabilitySum * 10000)/100}%`,
        neutral: `${Math.floor(probabilities.neutral / probabilitySum * 10000)/100}%`,
        notInteresting: `${Math.floor(probabilities.notInteresting / probabilitySum * 10000)/100}%`
      }

      const classifierContainerElement = document.createElement('div')
      classifierContainerElement.classList.add('ALH__classifier-container')

      const classifierInterestingElement = document.createElement('div')
      classifierInterestingElement.classList.add('ALH__classifier-unit', 'interesting')
      classifierInterestingElement.style.width = probabilityPercentages.interesting

      const classifierNeutralElement = document.createElement('div')
      classifierNeutralElement.classList.add('ALH__classifier-unit', 'neutral')
      classifierNeutralElement.style.width = probabilityPercentages.neutral

      const classifierNotInterestingElement = document.createElement('div')
      classifierNotInterestingElement.classList.add('ALH__classifier-unit', 'not-interesting')
      classifierNotInterestingElement.style.width = probabilityPercentages.notInteresting

      classifierContainerElement.appendChild(classifierInterestingElement)
      classifierContainerElement.appendChild(classifierNeutralElement)
      classifierContainerElement.appendChild(classifierNotInterestingElement)

      classificationScoreElement.innerHTML = classifierContainerElement.outerHTML
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
    const article = votedArticles[articleId]
    console.log('Learning from article', {
      articleId,
      vote: article.vote,
      title: article.articleData.title,
      tags: article.articleData.tags,
      body: article.articleData.body
    })
    Object.keys(classifiers).forEach(classifierType => {
      const stringToClassify = article.articleData[classifierType] || ''

      if (article.vote === 0) {
        classifiers[classifierType].learn('neutral', nbayes.stringToDoc(stringToClassify))

      }

      if (article.vote > 0) {
        for (let i = 0; i < Math.abs(article.vote); i++) {
          classifiers[classifierType].learn('interesting', nbayes.stringToDoc(stringToClassify))
        }
      }

      if (article.vote < 0) {
        for (let i = 0; i < Math.abs(article.vote); i++) {
          classifiers[classifierType].learn('notInteresting', nbayes.stringToDoc(stringToClassify))
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
      probablilities[classifierType].interesting = prob.interesting || 0
      probablilities[classifierType].neutral = prob.neutral || 0
      probablilities[classifierType].notInteresting = prob.notInteresting || 0
    })

    const weightedProbabilities = {
      neutral: probablilities.title.neutral + probablilities.tags.neutral + probablilities.body.neutral,
      interesting: probablilities.title.interesting + probablilities.tags.interesting + probablilities.body.interesting,
      notInteresting: probablilities.title.notInteresting + probablilities.tags.notInteresting + probablilities.body.notInteresting,
    }

    classifiedArticles[articleId] = weightedProbabilities
  })

  const highestProbability = Object.keys(classifiedArticles).map(key => classifiedArticles[key]).reduce((maxValue, articleProb) => {
    let localMax = maxValue

    if (articleProb.neutral > localMax) {
      localMax = articleProb.neutral
    }

    if (articleProb.notInteresting > localMax) {
      localMax = articleProb.notInteresting
    }

    if (articleProb.interesting > localMax) {
      localMax = articleProb.interesting
    }

    return localMax
  }, 0)

  const compensationFactor = 1 / highestProbability



  const normalizedClassifiedArticles = {}
  Object.keys(classifiedArticles).map(key => {
    const classifiedArticle = classifiedArticles[key]
    normalizedClassifiedArticles[key] = {
      neutral: classifiedArticle.neutral * compensationFactor,
      interesting: classifiedArticle.interesting * compensationFactor,
      notInteresting: classifiedArticle.notInteresting * compensationFactor
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
  container.classList.add('ALH__classifier-button-container')

  const dislikeButtonElement = document.createElement('button')
  dislikeButtonElement.classList.add('ALH__classifier-button', 'not-interesting')
  dislikeButtonElement.addEventListener('click', () => {
    storeVote(articleData, -1)
  }, false)
  dislikeButtonElement.innerText = String('ointressant')


  const likeButtonElement = document.createElement('button')
  likeButtonElement.classList.add('ALH__classifier-button', 'interesting')
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

  const containerElement = document.createElement('span')
  containerElement.classList.add('ALH_article-page-container')

  containerElement.appendChild(voteResultElement)
  containerElement.appendChild(voteButtonsElement)
  containerElement.appendChild(classificationScoreElement)
  headline.appendChild(containerElement)

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
      link.innerHTML = voteResultElement.outerHTML + link.innerHTML
      link.parentElement.appendChild(classificationScoreElement)
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
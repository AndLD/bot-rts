// Get array of all input substrings of specified strings
export function getKeywords(...strings: string[]) {
    return Array.from(new Set(strings.map((str) => _getKeywords(str)).flat()))
}

function _getKeywords(str: string) {
    const keywords = []

    const words = str.toLowerCase().split(' ')

    const phrases = []

    for (let i = 0; i < words.length; i++) {
        keywords.push(_generateKeywords(words[i]))
        if (i > 0) {
            phrases.push(_appendPreviousWord(words.slice(0, i).join(' '), keywords[i]))
        }
    }

    for (let i = words.length - 1; i >= 0; i--) {
        if (i < words.length && i > 0) {
            phrases.push(_appendPreviousWord(words.slice(i - 1, i).join(' '), keywords[i]))
        }
    }

    return [...keywords, ...phrases].flat()
}

function _generateKeywords(word: string) {
    const keywords = []

    for (let i = 0; i < word.length; i++) {
        const localStr = []
        for (let j = 0; j <= i; j++) {
            localStr.push(word[j])
        }
        keywords.push(localStr.join(''))
    }

    return keywords
}

function _appendPreviousWord(prevWord: string, currentKeyword: string[]) {
    const newKeyword = []
    for (let i = 0; i < currentKeyword.length; i++) {
        newKeyword.push(prevWord + ' ' + currentKeyword[i])
    }
    return newKeyword
}

//  Lowercase

// Remove punctuation & symbols

// Trim extra spaces

// Normalize plurals

// Map synonyms

// Tokenize consistently
const synonymDict = require("./ats_synonym_dictionary.json");


function normalizeText(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")   // remove punctuation
    .replace(/\s+/g, " ")           // collapse spaces
    .trim();
}

function tokenize(text) {
  return normalizeText(text).split(" ");
}

async function applySynonyms(tokens) {
  return tokens.map(token => synonymDict[token] || token);
}

const stopwords = new Set([
  "and", "or", "with", "for", "to", "in", "on", "of"
]);

function removeStopwords(tokens) {
  return tokens.filter(token => !stopwords.has(token));
}

function normalizePlural(token) {
  if (token.endsWith("s") && token.length > 3) {
    return token.slice(0, -1);
  }
  return token;
}

function normalizeAndTokenize(text) {
  let tokens = tokenize(text);
  tokens = applySynonyms(tokens);
  tokens = tokens.map(normalizePlural);
  tokens = removeStopwords(tokens);

  return [...new Set(tokens)]; // remove duplicates
}
export default {
  normalizeAndTokenize
};
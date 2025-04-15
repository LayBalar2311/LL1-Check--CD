const {
  eliminateLeftRecursion,
  leftFactor,
  computeFirstSets,
  computeFollowSets,
  buildParsingTable,
  parseInput,
} = require("./grammarUtils");

function processGrammar(rawGrammar, startSymbol, inputString) {
  if (!rawGrammar || !startSymbol || !inputString) {
    throw new Error("Invalid input: grammar, start symbol, or input string missing.");
  }

  let grammar = eliminateLeftRecursion(rawGrammar);
  grammar = leftFactor(grammar);

  const firstSets = computeFirstSets(grammar);
  const followSets = computeFollowSets(grammar, startSymbol, firstSets);

  let parsingTable;
  try {
    parsingTable = buildParsingTable(grammar, firstSets, followSets);
  } catch (error) {
    throw new Error(`Failed to construct LL(1) parsing table: ${error.message}`);
  }

  const { success, steps, parseTree } = parseInput(
    grammar,
    startSymbol,
    parsingTable,
    inputString.split(" ").filter(t => t)
  );

  return {
    grammar,
    firstSets,
    followSets,
    parsingTable,
    steps,
    parseTree,
    accepted: success,
  };
}

module.exports = { processGrammar };
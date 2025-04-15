const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { processGrammar } = require('./ll1Parser');
const { eliminateLeftRecursion, computeFirstSets, computeFollowSets, buildParsingTable } = require('./grammarUtils');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Helper function to parse grammar from string
const parseGrammar = (grammarLines) => {
  const rawGrammar = {};
  let startSymbol = null;
  for (const line of grammarLines) {
    const trimmedLine = line.trim();
    const arrowIndex = trimmedLine.indexOf('->');
    if (arrowIndex === -1) throw new Error('Invalid grammar format. Use "NT -> production" on each line');
    const nonTerminal = trimmedLine.substring(0, arrowIndex).trim();
    const productionStr = trimmedLine.substring(arrowIndex + 2).trim();
    if (!nonTerminal || !productionStr) throw new Error('Invalid grammar format. Non-terminal or production missing');
    if (!startSymbol) startSymbol = nonTerminal;
    const productions = productionStr.split('|').map(prod => prod.trim().split(' ').filter(t => t));
    rawGrammar[nonTerminal] = productions;

    // Warn about potential indirect recursion
    productions.forEach(prod => {
      if (prod[0] === nonTerminal) {
        console.warn(`Direct left recursion detected in ${nonTerminal} -> ${prod.join(' ')}`);
      } else if (prod[0] in rawGrammar && prod[0] !== nonTerminal) {
        console.warn(`Potential indirect recursion in ${nonTerminal} -> ${prod.join(' ')} through ${prod[0]}`);
      }
    });
  }
  return { rawGrammar, startSymbol };
};

// New endpoint to check if grammar is LL(1)
app.post('/check-ll1', (req, res) => {
  console.log('Request body:', req.body);
  try {
    if (!req.body.grammar || typeof req.body.grammar !== 'string') {
      throw new Error('Grammar input is missing or invalid');
    }

    const grammarLines = req.body.grammar.split('\n').filter(line => line.trim() !== '');
    const { rawGrammar, startSymbol } = parseGrammar(grammarLines);

    console.log('Parsed grammar:', rawGrammar);

    // Eliminate left recursion
    const grammar = eliminateLeftRecursion(rawGrammar);
    console.log('Grammar after left recursion elimination:', grammar);

    // Compute First and Follow sets
    const firstSets = computeFirstSets(grammar);
    const followSets = computeFollowSets(grammar, startSymbol, firstSets);

    // Attempt to build parsing table
    let isLL1 = true;
    try {
      const parsingTable = buildParsingTable(grammar, firstSets, followSets);
      console.log('Parsing Table:', parsingTable);
    } catch (error) {
      console.log('Parsing table conflict detected:', error.message);
      isLL1 = false;
    }

    res.json({
      success: true,
      isLL1: isLL1,
      firstSets,
      followSets,
      grammarAfterElimination: grammar
    });
  } catch (err) {
    console.error('Server error:', err);
    res.status(400).json({ success: false, error: err.message });
  }
});



// Existing endpoint for parsing with input
app.post('/parse', (req, res) => {
  console.log('Request body:', req.body);
  try {
    if (!req.body.grammar || typeof req.body.grammar !== 'string') {
      throw new Error('Grammar input is missing or invalid');
    }
    if (!req.body.input || typeof req.body.input !== 'string') {
      throw new Error('Input string is missing or invalid');
    }

    const grammarLines = req.body.grammar.split('\n').filter(line => line.trim() !== '');
    const { rawGrammar, startSymbol } = parseGrammar(grammarLines);

    console.log('Parsed grammar:', rawGrammar);

    const inputTokens = req.body.input.split(' ').filter(t => t);
    const result = processGrammar(rawGrammar, startSymbol, inputTokens.join(' '));

    console.log("Parse Tree before sending:", JSON.stringify(result.parseTree, null, 2));

    res.json({
      success: true,
      first: result.firstSets,
      follow: result.followSets,
      parsingTable: result.parsingTable,
      parsingSteps: result.steps.map(step => `${step.stack.join(' ')} | ${step.input.join(' ')} | ${step.action}`),
      parseTree: result.parseTree
    });
  } catch (err) {
    console.error('Server error:', err);
    res.status(400).json({ success: false, error: err.message });
  }
});

app.listen(5000, () => console.log('Server running on http://localhost:5000'));
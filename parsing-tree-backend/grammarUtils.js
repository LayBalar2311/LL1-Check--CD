function hasLeftRecursion(grammar) {
  for (const nonTerminal in grammar) {
    const productions = grammar[nonTerminal];
    for (const prod of productions) {
      if (prod[0] === nonTerminal) return true;
    }
  }
  return false;
}

function eliminateLeftRecursion(grammar) {
  const newGrammar = { ...grammar };
  for (const nonTerminal in grammar) {
    const productions = grammar[nonTerminal];
    const direct = [];
    const indirect = [];

    productions.forEach(prod => {
      if (prod[0] === nonTerminal) direct.push(prod.slice(1));
      else indirect.push(prod);
    });

    if (direct.length > 0) {
      const newSymbol = nonTerminal + "'";
      newGrammar[nonTerminal] = indirect.map(p => [...p, newSymbol]);
      newGrammar[newSymbol] = direct.map(p => [...p, newSymbol]);
      newGrammar[newSymbol].push(["ε"]);
    }
  }
  return newGrammar;
}

function leftFactor(grammar) {
  const newGrammar = {};
  for (const nonTerminal in grammar) {
    const productions = grammar[nonTerminal];
    const prefixMap = {};

    productions.forEach(prod => {
      const prefix = prod[0];
      if (!prefixMap[prefix]) prefixMap[prefix] = [];
      prefixMap[prefix].push(prod);
    });

    newGrammar[nonTerminal] = [];
    for (const prefix in prefixMap) {
      const prods = prefixMap[prefix];
      if (prods.length === 1) {
        newGrammar[nonTerminal].push(prods[0]);
      } else {
        const newSymbol = nonTerminal + "'";
        newGrammar[nonTerminal].push([prefix, newSymbol]);
        newGrammar[newSymbol] = prods.map(p => p.slice(1).length ? p.slice(1) : ["ε"]);
      }
    }
  }
  return newGrammar;
}

function computeFirstSets(grammar) {
  const first = {};
  const nonTerminals = Object.keys(grammar);
  nonTerminals.forEach(nt => (first[nt] = new Set()));

  let changed = true;
  while (changed) {
    changed = false;
    for (const [nt, prods] of Object.entries(grammar)) {
      for (const prod of prods) {
        if (prod.length === 1 && prod[0] === "ε") {
          if (!first[nt].has("ε")) {
            first[nt].add("ε");
            changed = true;
          }
          continue;
        }
        let i = 0;
        let allEpsilon = true;
        const beforeSize = first[nt].size;

        while (i < prod.length) {
          const symbol = prod[i];
          if (!grammar[symbol]) { // Terminal
            if (!first[nt].has(symbol)) {
              first[nt].add(symbol);
              changed = true;
            }
            allEpsilon = false;
            break;
          }
          const firstYMinusEpsilon = new Set([...first[symbol]].filter(s => s !== "ε"));
          firstYMinusEpsilon.forEach(s => first[nt].add(s));
          if (!first[symbol].has("ε")) {
            allEpsilon = false;
            break;
          }
          i++;
        }
        if (i === prod.length && allEpsilon && !first[nt].has("ε")) {
          first[nt].add("ε");
          changed = true;
        }
        if (first[nt].size > beforeSize) changed = true;
      }
    }
  }
  return Object.fromEntries(Object.entries(first).map(([k, v]) => [k, [...v]]));
}

function computeFirstOfSequence(seq, firstSets) {
  let result = new Set();
  let allEpsilon = true;
  for (const symbol of seq) {
    if (!firstSets[symbol]) { // Terminal
      result.add(symbol);
      allEpsilon = false;
      break;
    }
    for (const s of firstSets[symbol]) {
      if (s !== "ε") result.add(s);
    }
    if (!firstSets[symbol].includes("ε")) {
      allEpsilon = false;
      break;
    }
  }
  if (allEpsilon) result.add("ε");
  return [...result];
}

function computeFollowSets(grammar, start, firstSets) {
  const follow = {};
  const nonTerminals = Object.keys(grammar);
  nonTerminals.forEach(nt => (follow[nt] = new Set()));
  follow[start].add("$");

  // Sort non-terminals to process F first
  const orderedNonTerminals = Object.keys(grammar).sort((a, b) => {
    if (a === "F") return -1;
    if (b === "F") return 1;
    return a.localeCompare(b);
  });

  let changed = true;
  let iteration = 0;
  while (changed) {
    console.log(`Iteration ${iteration}:`, JSON.stringify(Object.fromEntries(Object.entries(follow).map(([k, v]) => [k, [...v]]))));
    changed = false;
    for (const nt of orderedNonTerminals) {
      console.log(`Processing non-terminal ${nt}`);
      const prods = grammar[nt];
      for (const prod of prods) {
        console.log(`  Production ${nt} → ${prod.join(" ")}`);
        for (let i = 0; i < prod.length; i++) {
          const B = prod[i];
          if (!grammar[B]) continue; // Skip terminals
          const after = prod.slice(i + 1);
          const beforeSize = follow[B].size;

          console.log(`    B=${B}, after=${after}`);
          if (after.length) {
            const firstOfBeta = computeFirstOfSequence(after, firstSets);
            console.log(`    First(beta)=${firstOfBeta}`);
            for (const s of firstOfBeta) {
              if (s !== "ε") {
                if (!follow[B].has(s)) {
                  follow[B].add(s);
                  console.log(`    Added ${s} to Follow(${B})`);
                }
              }
            }
            if (firstOfBeta.includes("ε")) {
              for (const s of follow[nt]) {
                if (!follow[B].has(s)) {
                  follow[B].add(s);
                  console.log(`    Added ${s} to Follow(${B}) from Follow(${nt})`);
                }
              }
            }
          } else {
            for (const s of follow[nt]) {
              if (!follow[B].has(s)) {
                follow[B].add(s);
                console.log(`    Added ${s} to Follow(${B}) from Follow(${nt}) (end of production)`);
              }
            }
          }
          if (follow[B].size > beforeSize) {
            changed = true;
            console.log(`    Updated Follow(${B}) = ${[...follow[B]]}`);
          } else {
            console.log(`    No change in Follow(${B})`);
          }
        }
      }
    }
    iteration++;
  }
  console.log(`Final Follow Sets:`, JSON.stringify(Object.fromEntries(Object.entries(follow).map(([k, v]) => [k, [...v]]))));
  return Object.fromEntries(Object.entries(follow).map(([k, v]) => [k, [...v]]));
}

function buildParsingTable(grammar, firstSets, followSets) {
  const table = {};
  const nonTerminals = Object.keys(grammar);

  if (hasLeftRecursion(grammar)) {
    throw new Error("Grammar has left recursion. Please eliminate it first.");
  }

  nonTerminals.forEach(nt => (table[nt] = {}));

  for (const [nt, prods] of Object.entries(grammar)) {
    for (const prod of prods) {
      const firstOfAlpha = computeFirstOfSequence(prod, firstSets);

      firstOfAlpha.forEach(symbol => {
        if (symbol !== "ε") {
          if (table[nt][symbol]) {
            throw new Error(`Conflict at [${nt}, ${symbol}]: Grammar is ambiguous or not LL(1)`);
          }
          table[nt][symbol] = prod;
        }
      });

      if (firstOfAlpha.includes("ε")) {
        followSets[nt].forEach(sym => {
          if (table[nt][sym]) {
            throw new Error(`Conflict at [${nt}, ${sym}]: Grammar is ambiguous or not LL(1)`);
          }
          table[nt][sym] = prod.length === 1 && prod[0] === "ε" ? prod : ["ε"];
        });
      }
    }
  }
  return table;
}

function parseInput(grammar, start, table, input) {
  const stack = ["$", start];
  const tokens = [...input, "$"];
  const steps = [];
  const tree = { name: start, children: [] };
  const treeStack = [{ node: tree, parent: null }];

  let pointer = 0;
  while (stack.length > 0) {
    const top = stack.pop();
    const curr = tokens[pointer];
    const currentTreeNode = treeStack.length > 0 ? treeStack.pop() : null;

    steps.push({
      stack: [...stack, top].reverse(),
      input: tokens.slice(pointer),
      action: "",
    });

    if (top === curr) {
      steps[steps.length - 1].action = `Match ${curr}`;
      pointer++;
    } else if (!grammar[top]) {
      steps[steps.length - 1].action = `Error: Invalid terminal '${curr}'`;
      return { success: false, steps, parseTree: null };
    } else if (table[top] && table[top][curr]) {
      const prod = table[top][curr];
      steps[steps.length - 1].action = `${top} → ${prod.join(" ")}`;
      if (currentTreeNode) {
        if (prod[0] !== "ε") {
          const newNodes = prod.map(symbol => ({ name: symbol, children: [] }));
          currentTreeNode.node.children.push(...newNodes);
          for (let i = prod.length - 1; i >= 0; i--) {
            stack.push(prod[i]);
            treeStack.push({ node: newNodes[i], parent: currentTreeNode.node });
          }
        } else {
          currentTreeNode.node.children.push({ name: "ε", children: [] });
        }
      }
    } else {
      steps[steps.length - 1].action = `Error: No rule for [${top}, ${curr}]`;
      return { success: false, steps, parseTree: null };
    }
  }
  return { success: true, steps, parseTree: tree };
}

module.exports = {
  eliminateLeftRecursion,
  leftFactor,
  computeFirstSets,
  computeFollowSets,
  buildParsingTable,
  parseInput,
  computeFirstOfSequence,
};
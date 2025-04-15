import React, { useState } from "react";
import axios from "axios";
import Tree from "react-d3-tree";
import "./index.css";

const App = () => {
  const [grammar, setGrammar] = useState("");
  const [inputString, setInputString] = useState("");
  const [first, setFirst] = useState({});
  const [follow, setFollow] = useState({});
  const [parsingTable, setParsingTable] = useState({});
  const [parsingSteps, setParsingSteps] = useState([]);
  const [parseTree, setParseTree] = useState(null);
  const [error, setError] = useState("");
  const [isLL1, setIsLL1] = useState(null);
  const [parseAttempted, setParseAttempted] = useState(false); // Track if parsing was attempted

  const handleParse = async () => {
    if (!grammar || !inputString) {
      setError("Please enter both grammar and input string.");
      return;
    }
    console.log("Sending:", { grammar, input: inputString });
    try {
      const res = await axios.post("http://localhost:5000/parse", {
        grammar,
        input: inputString,
      });
      console.log("Received Response:", res.data);
      setFirst(res.data.first || {});
      setFollow(res.data.follow || {});
      setParsingTable(res.data.parsingTable || {});
      setParsingSteps(res.data.parsingSteps || []);
      setParseTree(res.data.parseTree || null);
      console.log("Parse Tree in State:", JSON.stringify(res.data.parseTree, null, 2));
      setParseAttempted(true); // Mark parsing as attempted
      setIsLL1(null); // Reset LL(1) check
      setError("");
    } catch (err) {
      setError(err.response?.data?.error || "Parsing failed.");
      setParseTree(null); // Clear tree on error
      setParseAttempted(true); // Still mark as attempted to show error message
      console.error("Parse error:", err.response?.data || err);
    }
  };

  const handleCheckLL1 = async () => {
    if (!grammar) {
      setError("Please enter a grammar.");
      return;
    }
    console.log("Checking LL(1):", { grammar });
    try {
      const res = await axios.post("http://localhost:5000/check-ll1", { grammar });
      console.log("LL(1) Check Response:", res.data);
      setFirst(res.data.firstSets || {});
      setFollow(res.data.followSets || {});
      setParsingTable(res.data.parsingTable || {});
      setIsLL1(res.data.isLL1);
      setParsingSteps([]); // Clear steps
      setParseTree(null); // Clear tree
      setParseAttempted(false); // Reset parse attempt flag
      setError("");
    } catch (err) {
      setError(err.response?.data?.error || "LL(1) check failed.");
      console.error("LL(1) check error:", err.response?.data || err);
    }
  };

  const renderTable = (table) => {
    if (!table || typeof table !== "object") return null;
    const nonTerminals = Object.keys(table);
    const terminals = Array.from(
      new Set(nonTerminals.flatMap((nt) => Object.keys(table[nt] || {})))
    );

    return (
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Non-Terminal</th>
              {terminals.map((t) => (
                <th key={t}>{t}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {nonTerminals.map((nt) => (
              <tr key={nt}>
                <td>{nt}</td>
                {terminals.map((t) => (
                  <td key={t}>
                    {(table[nt] && table[nt][t]) ? table[nt][t].join(" ") : ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderSets = (sets, title) => {
    if (!sets || typeof sets !== "object") return null;
    return (
      <div className="card">
        <h3>{title} Sets:</h3>
        <ul className="sets-list">
          {Object.entries(sets).map(([key, value]) => (
            <li key={key}>
              <span>{key}:</span>
              <span>{"{ " + (value || []).join(", ") + " }"}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  const renderParseTree = () => {
    if (!parseAttempted) return null; // Don’t show anything until parsing is attempted

    if (!parseTree || typeof parseTree !== "object") {
      console.log("No parseTree:", parseTree);
      return (
        <div className="card">
          <h3>Parse Tree:</h3>
          <div className="error">No valid parse tree</div>
        </div>
      );
    }

    console.log("Rendering Parse Tree (Raw):", JSON.stringify(parseTree, null, 2));
    return (
      <div className="card">
        <h3>Parse Tree:</h3>
        <div className="parse-tree-container">
          <Tree
            data={parseTree}
            orientation="vertical"
            translate={{ x: 400, y: 50 }}
            zoomable={true}
            collapsible={true}
            nodeSize={{ x: 120, y: 120 }}
            separation={{ siblings: 1, nonSiblings: 1.5 }}
            pathFunc="diagonal"
            styles={{
              nodes: {
                node: { circle: { fill: "#4A90E2", r: 10 }, name: { fill: "#333", fontSize: "14px" } },
                leafNode: { circle: { fill: "#50C878", r: 10 }, name: { fill: "#333", fontSize: "14px" } },
              },
              links: { stroke: "#666", strokeWidth: 2 },
            }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="container">
      <h1>LL(1) Parser</h1>
      <div className="card">
        <div className="form-group">
          <label>Enter Grammar (e.g., S -> A a A -> b):</label>
          <textarea
            value={grammar}
            onChange={(e) => setGrammar(e.target.value)}
            placeholder="E -> E + T | T\nT -> T * F | F\nF -> ( E ) | id"
          />
        </div>
        <div className="form-group">
          <label>Enter Input String (space-separated, optional for LL(1) check):</label>
          <input
            type="text"
            value={inputString}
            onChange={(e) => setInputString(e.target.value)}
            placeholder="id + id * id $"
          />
        </div>
        <button onClick={handleParse}>Parse</button>
        <button onClick={handleCheckLL1} style={{ marginLeft: "10px" }}>Check LL(1)</button>
        {error && (
          <div className="error">
            <strong>Error:</strong> {error}
          </div>
        )}
        {isLL1 !== null && (
          <div className={isLL1 ? "success" : "error"}>
            <strong>LL(1) Status:</strong> {isLL1 ? "Grammar is LL(1)" : "Grammar is not LL(1)"}
          </div>
        )}
      </div>
      <div className="sets-grid">
        {Object.keys(first).length > 0 && renderSets(first, "First")}
        {Object.keys(follow).length > 0 && renderSets(follow, "Follow")}
      </div>
      {Object.keys(parsingTable).length > 0 && (
        <div className="card">
          <h3>LL(1) Parsing Table:</h3>
          {renderTable(parsingTable)}
        </div>
      )}
      {Array.isArray(parsingSteps) && parsingSteps.length > 0 && (
        <div className="card">
          <h3>Parsing Steps:</h3>
          <ul className="steps-list">
            {parsingSteps.map((step, idx) => (
              <li key={idx}>{step}</li>
            ))}
          </ul>
        </div>
      )}
      {renderParseTree()}
    </div>
  );
};

export default App;
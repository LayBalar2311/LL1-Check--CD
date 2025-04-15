const express = require("express");
const cors = require("cors");
const { processGrammar } = require("./ll1Parser");
import './index.css';


const app = express();
app.use(cors());
app.use(express.json());

app.post("/parse", (req, res) => {
  const { grammar, startSymbol, input } = req.body;

  try {
    const result = processGrammar(grammar, startSymbol, input);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.listen(4000, () => console.log("LL(1) parser backend running on port 4000"));

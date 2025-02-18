//express test code
import express from "express"; // Correct import for ES modules

const app = express();
const port = 80;

app.get("/", function (req, res) {
  res.send("Hello World");
});

app.listen(port, function () {
  console.log("Example app listening on port 3000!");
});

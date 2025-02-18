//express test code
import express from "express"; // Correct import for ES modules

const app = express();
const port = 80;

//pone los archivos estaticos en la carpeta public
//para acceder a index.html -> http://localhost/index.html
app.use(express.static("public"));

app.listen(port, function () {
  console.log("Example app listening on port: " + port);
});

console.log("🔥 SERVER.JS QUE YO HE EDITADO 🔥", __filename);

const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3100;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/test", (req, res) => {
  res.send("OK");
});


// Helpers
const leerJSON = (file) =>
  JSON.parse(fs.readFileSync(path.join(__dirname, "data", file)));

const escribirJSON = (file, data) =>
  fs.writeFileSync(
    path.join(__dirname, "data", file),
    JSON.stringify(data, null, 2)
  );

// === SOCIOS ===
app.get("/api/socios", (req, res) => {
  res.json(leerJSON("socios.json"));
});

// === RESERVAS ===
app.get("/api/reservas", (req, res) => {
  res.json(leerJSON("reservas.json"));
});

app.post("/api/reservas", (req, res) => {
  const reservas = leerJSON("reservas.json");
  reservas.push(req.body);
  escribirJSON("reservas.json", reservas);
  res.json({ ok: true });
});

app.delete("/api/reservas/:id", (req, res) => {
  const reservas = leerJSON("reservas.json");
  reservas.splice(req.params.id, 1);
  escribirJSON("reservas.json", reservas);
  res.json({ ok: true });
});

// Arranque
app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});

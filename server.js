const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3100;

// ===== CONFIG =====
const ADMIN = {
  email: "admin@eltejar.com",
  password: "1234"
};

// ===== MIDDLEWARE =====
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ===== HELPERS =====
const leerJSON = (file) =>
  JSON.parse(fs.readFileSync(path.join(__dirname, "data", file)));

const escribirJSON = (file, data) =>
  fs.writeFileSync(
    path.join(__dirname, "data", file),
    JSON.stringify(data, null, 2)
  );

// ===== LOGIN =====
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;

  // Admin
  if (email === ADMIN.email && password === ADMIN.password) {
    return res.json({ ok: true, role: "admin", email });
  }

  // Socio
  const socios = leerJSON("socios.json");
  if (socios.includes(email)) {
    return res.json({ ok: true, role: "socio", email });
  }

  res.status(401).json({ ok: false });
});

// ===== SOCIOS (solo admin) =====
app.get("/api/socios", (req, res) => {
  if (req.headers["x-role"] !== "admin") {
    return res.status(403).json({ error: "Prohibido" });
  }
  res.json(leerJSON("socios.json"));
});

app.post("/api/socios", (req, res) => {
  if (req.headers["x-role"] !== "admin") {
    return res.status(403).json({ error: "Prohibido" });
  }

  const socios = leerJSON("socios.json");
  if (!socios.includes(req.body.email)) {
    socios.push(req.body.email);
    escribirJSON("socios.json", socios);
  }

  res.json({ ok: true });
});

// ===== RESERVAS =====
app.get("/api/reservas", (req, res) => {
  res.json(leerJSON("reservas.json"));
});

app.post("/api/reservas", (req, res) => {
  const reservas = leerJSON("reservas.json");
  reservas.push(req.body);
  escribirJSON("reservas.json", reservas);
  res.json({ ok: true });
});

// ===== START =====
app.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en http://localhost:${PORT}`);
});
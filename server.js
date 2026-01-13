const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3100;

// ===== CONFIG ADMIN =====
const ADMIN_EMAIL = "admin@eltejar.com";
const ADMIN_PASSWORD = "1234";

// ===== MIDDLEWARE =====
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ===== HELPERS =====
const leerJSON = (file) => {
  const filePath = path.join(__dirname, "data", file);

  if (!fs.existsSync(filePath)) {
    return [];
  }

  const contenido = fs.readFileSync(filePath, "utf-8").trim();

  if (!contenido) {
    return [];
  }

  return JSON.parse(contenido);
};

const escribirJSON = (file, data) =>
  fs.writeFileSync(
    path.join(__dirname, "data", file),
    JSON.stringify(data, null, 2)
  );

console.log("LEYENDO SOCIOS DESDE:", path.join(__dirname, "data", "socios.json"));

// ===== ADMIN LOGIN =====
app.post("/api/admin/login", (req, res) => {
  const { email, password } = req.body;

  if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
    return res.json({ ok: true });
  }

  res.status(401).json({ ok: false });
});

// ===== SOCIOS =====
app.get("/api/socios", (req, res) => {
  res.json(leerJSON("socios.json"));
});

app.post("/api/socios", (req, res) => {
  const socios = leerJSON("socios.json");
  socios.push(req.body.email);
  escribirJSON("socios.json", socios);
  res.json({ ok: true });
});

app.delete("/api/socios/:email", (req, res) => {
  const socios = leerJSON("socios.json").filter(
    s => s !== req.params.email
  );
  escribirJSON("socios.json", socios);
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

app.delete("/api/reservas/:id", (req, res) => {
  const reservas = leerJSON("reservas.json");
  reservas.splice(req.params.id, 1);
  escribirJSON("reservas.json", reservas);
  res.json({ ok: true });
});

// ===== EXPORTAR CSV =====
app.get("/api/reservas.csv", (req, res) => {
  const reservas = leerJSON("reservas.json");

  let csv = "email,fecha,pista,inicio,fin\n";

  reservas.forEach(r => {
    const inicio = r.bloques[0];
    const fin = (() => {
      const [h, m] = r.bloques[r.bloques.length - 1].split(":").map(Number);
      const d = new Date();
      d.setHours(h, m + 30, 0, 0);
      return d.toTimeString().slice(0, 5);
    })();

    const pista = r.pistaId === "A" ? "Tenis" : "Pádel";

    csv += `${r.email},${r.fecha},${pista},${inicio},${fin}\n`;
  });

  res.header("Content-Type", "text/csv");
  res.header("Content-Disposition", "attachment; filename=reservas.csv");
  res.send(csv);
});


// ===== START =====
app.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en http://localhost:${PORT}`);
});


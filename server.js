console.log("=== SERVER CORRECTO CARGADO ===");

require("dotenv").config();
const express = require("express");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 3100;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ADMIN_EMAIL = "admin@eltejar.com";
const ADMIN_PASSWORD = "1234";

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));


// ===== LOGIN ADMIN =====
app.post("/api/admin/login", (req, res) => {
  const { email, password } = req.body;

  if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
    return res.json({ ok: true });
  }

  res.status(401).json({ ok: false });
});


// ===== SOCIOS =====
app.get("/api/socios", async (req, res) => {

  res.set("Cache-Control", "no-store");

  const { data, error } = await supabase
    .from("socios")
    .select("email, nombre");

  if (error) return res.status(500).json({ error });

  res.json(data);
});



app.post("/api/socios", async (req, res) => {
  const { email } = req.body;

  const { error } = await supabase
    .from("socios")
    .insert([{ email }]);

  if (error) return res.status(400).json({ error });

  res.json({ ok: true });
});

app.delete("/api/socios/:email", async (req, res) => {
  const { error } = await supabase
    .from("socios")
    .delete()
    .eq("email", req.params.email);

  if (error) return res.status(500).json({ error });

  res.json({ ok: true });
});


// ===== RESERVAS =====
app.get("/api/reservas", async (req, res) => {

  const hoy = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("reservas")
    .select("*")
    .gte("fecha", hoy);

  if (error) return res.status(500).json({ error });

  res.json(data);
});


app.post("/api/reservas", async (req, res) => {

  const { email, fecha, pista, hora } = req.body;

const ahora = new Date();

const fechaHoraReserva = new Date(`${fecha}T${hora}`);

if(fechaHoraReserva < ahora){
  return res.status(400).json({
    error: "No es posible reservar en una hora pasada"
  });
}

  const hoy = new Date();
  const limite = new Date();
  limite.setDate(hoy.getDate()+15);

  const { data:activas } = await supabase
    .from("reservas")
    .select("*")
    .eq("email", email)
    .gte("fecha", hoy.toISOString().split("T")[0]);

  if(activas.length >= 4){
    return res.status(400).json({error:"Máximo 4 reservas activas"});
  }

  const { error } = await supabase
    .from("reservas")
    .insert([{ email, fecha, pista, hora }]);

  if (error) return res.status(500).json({ error });

  res.json({ ok: true });
});

app.delete("/api/reservas/:id", async (req, res) => {
  const { error } = await supabase
    .from("reservas")
    .delete()
    .eq("id", req.params.id);

  if (error) return res.status(500).json({ error });

  res.json({ ok: true });
});


// ===== EXPORT CSV =====
app.get("/api/export", async (req, res) => {
  const { data } = await supabase
    .from("reservas")
    .select("*");

  let csv = "email,fecha,pista,hora\n";
  data.forEach(r => {
    csv += `${r.email},${r.fecha},${r.pista},${r.hora}\n`;
  });

  res.header("Content-Type", "text/csv");
  res.attachment("reservas.csv");
  res.send(csv);
});


app.listen(PORT, () => {
  console.log(`🚀 Servidor en http://localhost:${PORT}`);
});

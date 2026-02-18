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

// ===============================
// LOGIN ADMIN
// ===============================
app.post("/api/admin/login", (req, res) => {
  const { email, password } = req.body;
  if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
    return res.json({ ok: true });
  }
  res.status(401).json({ ok: false });
});

// ===============================
// SOCIOS
// ===============================
app.get("/api/socios", async (req, res) => {
  res.set("Cache-Control", "no-store");
  const { data, error } = await supabase.from("socios").select("email, nombre");
  if (error) {
    console.error("ERROR OBTENIENDO SOCIOS:", error);
    return res.status(500).json({ error: error.message });
  }
  res.json(data);
});

app.post("/api/socios", async (req, res) => {
  const { email, nombre } = req.body;
  if (!email) return res.status(400).json({ error: "Email obligatorio" });
  const { error } = await supabase.from("socios").insert([{ email, nombre }]);
  if (error) {
    console.error("ERROR CREANDO SOCIO:", error);
    return res.status(400).json({ error: error.message });
  }
  res.json({ ok: true });
});

app.delete("/api/socios/:email", async (req, res) => {
  const { error } = await supabase
    .from("socios")
    .delete()
    .eq("email", req.params.email);
  if (error) {
    console.error("ERROR BORRANDO SOCIO:", error);
    return res.status(500).json({ error: error.message });
  }
  res.json({ ok: true });
});

// ===============================
// FUNCIÓN CONFLICTO
// ===============================
async function hayConflicto(fecha, hora, pista) {
  const { data } = await supabase
    .from("reservas")
    .select("*")
    .eq("fecha", fecha)
    .eq("hora", hora)
    .eq("pista", pista);
  return data && data.length > 0;
}

// ===============================
// RESERVAS SOCIOS
// ===============================
app.get("/api/reservas", async (req, res) => {
  const hoy = new Date().toISOString().split("T")[0];
  const { data, error } = await supabase
    .from("reservas")
    .select("*")
    .gte("fecha", hoy);
  if (error) {
    console.error("ERROR OBTENIENDO RESERVAS:", error);
    return res.status(500).json({ error: error.message });
  }
  res.json(data);
});

app.post("/api/reservas", async (req, res) => {
  const { email, fecha, pista, hora, duracion } = req.body;
  if (!email || !fecha || !pista || !hora || !duracion) {
    return res.status(400).json({ error: "Faltan datos obligatorios" });
  }

  const ahora = new Date();
  const fechaHoraReserva = new Date(`${fecha}T${hora}`);
  if (fechaHoraReserva < ahora) {
    return res.status(400).json({ error: "No es posible reservar en una hora pasada" });
  }

  // --------------------
  // Verificar límites desde tabla 'limites'
  // --------------------
  const { data: limitesData } = await supabase.from("limites").select("*").limit(1);
  const limite = limitesData && limitesData[0];
  const maxReservas = limite?.max_reservas ?? 4;

  const hoyStr = new Date().toISOString().split("T")[0];

  // Contar solo reservas futuras
  const { data: activas } = await supabase
    .from("reservas")
    .select("*")
    .eq("email", email)
    .gte("fecha", hoyStr);

  if (activas && activas.length >= maxReservas) {
    return res.status(400).json({ error: `Has alcanzado el máximo de ${maxReservas} reservas activas` });
  }

  const { error } = await supabase
    .from("reservas")
    .insert([{ email, fecha, pista, hora, duracion }]);

  if (error) {
    console.error("ERROR INSERTANDO RESERVA:", error);
    return res.status(500).json({ error: error.message });
  }

  res.json({ ok: true });
});

// ===============================
// RESERVAS ADMIN ESPECIALES
// ===============================
app.post("/api/admin/reserva-especial", async (req, res) => {
  const { fecha, hora, pista, duracion, tipo } = req.body;
  const conflicto = await hayConflicto(fecha, hora, pista);
  let emailLabel = tipo === "recurrente" ? "Recurrente" : "Puntual";
  if (conflicto) emailLabel += "-REVISAR";

  const { error } = await supabase
    .from("reservas")
    .insert([{ email: emailLabel, fecha, pista, hora, duracion }]);

  if (error) return res.status(500).json({ error: error.message });

  // ✅ Devolvemos mensaje de confirmación
  res.json({ ok: true, mensaje: `Reserva ${tipo} creada para ${fecha} a las ${hora} en ${pista}` });
});

// ===============================
// DELETE RESERVAS
// ===============================
app.delete("/api/reservas/:id", async (req, res) => {
  const { error } = await supabase
    .from("reservas")
    .delete()
    .eq("id", req.params.id);
  if (error) {
    console.error("ERROR BORRANDO RESERVA:", error);
    return res.status(500).json({ error: error.message });
  }
  res.json({ ok: true });
});

// ===============================
// EXPORT CSV
// ===============================
app.get("/api/export", async (req, res) => {
  const { data, error } = await supabase.from("reservas").select("*");
  if (error) return res.status(500).json({ error: error.message });

  let csv = "email,fecha,pista,hora,duracion\n";
  data.forEach(r => {
    csv += `${r.email},${r.fecha},${r.pista},${r.hora},${r.duracion}\n`;
  });

  res.header("Content-Type", "text/csv");
  res.attachment("reservas.csv");
  res.send(csv);
});

// ===============================
// LÍMITES
// ===============================
app.get("/api/limites", async (req, res) => {
  const { data, error } = await supabase.from("limites").select("*").limit(1);
  if (error || !data || data.length === 0) {
    console.error("ERROR OBTENIENDO LIMITES:", error);
    return res.status(500).json({ error: error?.message || "No limits found" });
  }
  const { max_reservas, dias_anticipacion } = data[0];
  res.json({ maxReservas: max_reservas, diasAnticipacion: dias_anticipacion });
});

app.post("/api/limites", async (req, res) => {
  const { maxReservas, diasAnticipacion } = req.body;
  if (maxReservas == null || diasAnticipacion == null) {
    return res.status(400).json({ error: "Faltan datos" });
  }

  // Obtenemos id de la única fila
  const { data: existentes, error: fetchError } = await supabase
    .from("limites")
    .select("id")
    .limit(1);

  if (fetchError || !existentes || existentes.length === 0) {
    return res.status(500).json({ error: fetchError?.message || "No limits found" });
  }

  const limiteId = existentes[0].id;

  const { data, error } = await supabase
    .from("limites")
    .update({ max_reservas: maxReservas, dias_anticipacion: diasAnticipacion })
    .eq("id", limiteId);

  if (error) {
    console.error("ERROR ACTUALIZANDO LIMITES:", error);
    return res.status(500).json({ error: error.message });
  }

  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor en http://localhost:${PORT}`);
});

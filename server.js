console.log("=== BETA SERVER ===");
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


// =====================================================
// LOGIN ADMIN
// =====================================================
app.post("/api/admin/login", (req, res) => {
  const { email, password } = req.body;
  if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
    return res.json({ ok: true });
  }
  res.status(401).json({ ok: false });
});


// =====================================================
// SOCIOS
// =====================================================
app.get("/api/socios", async (req, res) => {
  res.set("Cache-Control", "no-store");
  const { data, error } = await supabase.from("socios").select("email, nombre");
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post("/api/socios", async (req, res) => {
  const { email, nombre } = req.body;
  if (!email) return res.status(400).json({ error: "Email obligatorio" });

  const { error } = await supabase.from("socios").insert([{ email, nombre }]);
  if (error) return res.status(400).json({ error: error.message });

  res.json({ ok: true });
});

app.delete("/api/socios/:email", async (req, res) => {
  const { error } = await supabase
    .from("socios")
    .delete()
    .eq("email", req.params.email);

  if (error) return res.status(500).json({ error: error.message });

  res.json({ ok: true });
});


// =====================================================
// FUNCIÓN CONFLICTO RESERVAS (Detección de solapes)
// =====================================================
async function hayConflicto(fecha, hora, pista, duracion) {
  const { data: existentes } = await supabase
    .from("reservas")
    .select("*")
    .eq("fecha", fecha)
    .eq("pista", pista);

  if (!existentes) return false;

  const toMin = (h) => {
    const [hrs, mins] = h.split(":").map(Number);
    return hrs * 60 + mins;
  };

  const s1 = toMin(hora);
  const e1 = s1 + parseInt(duracion);

  return existentes.some(r => {
    const s2 = toMin(r.hora);
    const e2 = s2 + parseInt(r.duracion || 60);
    return s1 < e2 && s2 < e1;
  });
}


// =====================================================
// RESERVAS SOCIOS
// =====================================================
app.get("/api/reservas", async (req, res) => {
  const hoy = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("reservas")
    .select("*")
    .gte("fecha", hoy);

  if (error) return res.status(500).json({ error: error.message });

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

  const { data: limitesData } = await supabase
    .from("limites")
    .select("*")
    .limit(1);

  const limite = limitesData?.[0];
  const maxReservas = limite?.max_reservas ?? 4;

  const hoyStr = new Date().toISOString().split("T")[0];

  const { data: activas } = await supabase
    .from("reservas")
    .select("*")
    .eq("email", email)
    .gte("fecha", hoyStr);

  if (activas && activas.length >= maxReservas) {
    return res.status(400).json({
      error: `Has alcanzado el máximo de ${maxReservas} reservas activas`
    });
  }

  const { error } = await supabase
    .from("reservas")
    .insert([{ email, fecha, pista, hora, duracion }]);

  if (error) return res.status(500).json({ error: error.message });

  res.json({ ok: true });
});


// =====================================================
// RESERVAS ADMIN ESPECIALES
// =====================================================
app.post("/api/admin/reserva-especial", async (req, res) => {
  const { fecha, hora, pista, duracion, tipo } = req.body;

  const conflicto = await hayConflicto(fecha, hora, pista, duracion);

  let emailLabel = tipo === "recurrente" ? "Recurrente" : "Puntual";
  if (conflicto) emailLabel += "-REVISAR";

  const { error } = await supabase
    .from("reservas")
    .insert([{ email: emailLabel, fecha, pista, hora, duracion }]);

  if (error) return res.status(500).json({ error: error.message });

  res.json({
    ok: true,
    mensaje: `Reserva ${tipo} creada para ${fecha} a las ${hora} en ${pista}`
  });
});


// =====================================================
// DELETE RESERVAS
// =====================================================
app.delete("/api/reservas/:id", async (req, res) => {
  const { error } = await supabase
    .from("reservas")
    .delete()
    .eq("id", req.params.id);

  if (error) return res.status(500).json({ error: error.message });

  res.json({ ok: true });
});


// =====================================================
// EXPORT CSV
// =====================================================
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


// =====================================================
// LÍMITES
// =====================================================
app.get("/api/limites", async (req, res) => {
  const { data, error } = await supabase
    .from("limites")
    .select("*")
    .limit(1);

  if (error || !data || data.length === 0) {
    return res.status(500).json({ error: error?.message || "No limits found" });
  }

  const { max_reservas, dias_anticipacion } = data[0];

  res.json({
    maxReservas: max_reservas,
    diasAnticipacion: dias_anticipacion
  });
});

app.post("/api/limites", async (req, res) => {
  const { maxReservas, diasAnticipacion } = req.body;

  if (maxReservas == null || diasAnticipacion == null) {
    return res.status(400).json({ error: "Faltan datos" });
  }

  const { data: existentes } = await supabase
    .from("limites")
    .select("id")
    .limit(1);

  const limiteId = existentes[0].id;

  const { error } = await supabase
    .from("limites")
    .update({
      max_reservas: maxReservas,
      dias_anticipacion: diasAnticipacion
    })
    .eq("id", limiteId);

  if (error) return res.status(500).json({ error: error.message });

  res.json({ ok: true });
});


// =====================================================
// CURSOS
// =====================================================

// Función central de recalculo
async function recalcularEstadosCurso(cursoId) {
  const { data: curso } = await supabase
    .from("cursos")
    .select("plazas")
    .eq("id", cursoId)
    .single();

  if (!curso) return;

  const plazas = curso.plazas;
  const maxListaEspera = Math.ceil(plazas * 0.25);
  const maxTotal = plazas + maxListaEspera;

  const { data: inscritos } = await supabase
    .from("cursos_inscripciones")
    .select("*")
    .eq("curso_id", cursoId)
    .order("id", { ascending: true });

  for (let i = 0; i < inscritos.length; i++) {
    let nuevoEstado;

    if (i < plazas) {
      nuevoEstado = "confirmado";
    } else if (i < maxTotal) {
      nuevoEstado = "lista_espera";
    } else {
      nuevoEstado = "bloqueado";
    }

    await supabase
      .from("cursos_inscripciones")
      .update({ estado: nuevoEstado })
      .eq("id", inscritos[i].id);
  }
}


// Obtener cursos (por defecto activos, con ?todo=true históricos)
app.get("/api/cursos", async (req, res) => {
  const hoy = new Date().toISOString().split("T")[0];
  const todo = req.query.todo === "true";

  let query = supabase
    .from("cursos")
    .select(`
      *,
      inscritos:cursos_inscripciones(count)
    `)
    .order("fecha_inicio", { ascending: true });

  if (!todo) {
    query = query.gte("fecha_fin", hoy);
  }

  const { data, error } = await query;

  if (error) return res.status(500).json({ error: error.message });

  // Formatear para que el count sea un número simple
  const formateado = data.map(c => ({
    ...c,
    inscritos_count: c.inscritos && c.inscritos[0] ? c.inscritos[0].count : 0
  }));

  res.json(formateado);
});


// Crear curso
app.post("/api/cursos", async (req, res) => {
  const {
    nombre,
    descripcion,
    fecha_inicio,
    fecha_fin,
    precio,
    profesor,
    telefono,
    plazas
  } = req.body;

  if (!nombre || !plazas) {
    return res.status(400).json({ error: "Nombre y plazas obligatorios" });
  }

  const { error } = await supabase.from("cursos").insert([{
    nombre,
    descripcion,
    fecha_inicio,
    fecha_fin,
    precio,
    profesor,
    telefono,
    plazas
  }]);

  if (error) return res.status(500).json({ error: error.message });

  res.json({ ok: true });
});


// Actualizar plazas
app.put("/api/cursos/:id/plazas", async (req, res) => {
  const { plazas } = req.body;
  const cursoId = req.params.id;

  await supabase
    .from("cursos")
    .update({ plazas })
    .eq("id", cursoId);

  await recalcularEstadosCurso(cursoId);

  res.json({ ok: true });
});


// Eliminar curso
app.delete("/api/cursos/:id", async (req, res) => {
  const { id } = req.params;

  // 1. Borrar inscripciones primero (Cascada manual)
  const { error: errorInsc } = await supabase
    .from("cursos_inscripciones")
    .delete()
    .eq("curso_id", id);

  if (errorInsc) return res.status(500).json({ error: errorInsc.message });

  // 2. Borrar el curso
  const { error: errorCurso } = await supabase
    .from("cursos")
    .delete()
    .eq("id", id);

  if (errorCurso) return res.status(500).json({ error: errorCurso.message });

  res.json({ ok: true });
});


// Obtener inscripciones
app.get("/api/cursos/:id/inscripciones", async (req, res) => {
  const { data, error } = await supabase
    .from("cursos_inscripciones")
    .select("*")
    .eq("curso_id", req.params.id)
    .order("id", { ascending: true });

  if (error) return res.status(500).json({ error: error.message });

  res.json(data);
});


// Inscribir en curso
app.post("/api/cursos/inscribir", async (req, res) => {
  const { curso_id, email, detalle } = req.body;

  if (!curso_id || !email || !detalle) {
    return res.status(400).json({ error: "Faltan datos obligatorios" });
  }

  // Traemos el curso
  const { data: curso, error: cursoError } = await supabase
    .from("cursos")
    .select("plazas")
    .eq("id", curso_id)
    .single();

  if (cursoError || !curso) return res.status(404).json({ error: "Curso no encontrado" });

  const plazas = curso.plazas;

  // Traemos todas las inscripciones del curso
  const { data: inscritos, error: inscritosError } = await supabase
    .from("cursos_inscripciones")
    .select("*")
    .eq("curso_id", curso_id);

  if (inscritosError) return res.status(500).json({ error: inscritosError.message });

  const totalActual = inscritos.length;
  const maxListaEspera = Math.ceil(plazas * 0.25);
  const maxTotal = plazas + maxListaEspera;

  let estado;
  if (totalActual < plazas) {
    estado = "confirmado";
  } else if (totalActual < maxTotal) {
    estado = "lista_espera";
  } else {
    return res.status(400).json({ error: "Curso completo (incluida lista de espera)" });
  }

  // Inserción
  const { error: insertError } = await supabase
    .from("cursos_inscripciones")
    .insert([{
      curso_id,
      email: email.toLowerCase(), // ⚠️ siempre minúsculas
      detalle,
      estado,
      fecha_inscripcion: new Date().toISOString()
    }]);

  if (insertError) return res.status(500).json({ error: insertError.message });

  // Recalcular estados
  await recalcularEstadosCurso(curso_id);

  res.json({
    ok: true,
    estado,
    mensaje: estado === "confirmado" ? "Inscripción confirmada" : "Inscrito en lista de espera"
  });
});

// =====================================================
// MIS CURSOS (inscripciones de un usuario)
// =====================================================
app.get("/api/mis-cursos/:email", async (req, res) => {
  const email = req.params.email.toLowerCase();

  const { data, error } = await supabase
    .from("cursos_inscripciones")
    .select(`
      id,
      estado,
      detalle,
      fecha_inscripcion,
      cursos (
        nombre,
        descripcion,
        profesor,
        fecha_inicio,
        fecha_fin,
        precio
      )
    `)
    .eq("email", email)
    .order("fecha_inscripcion", { ascending: true });

  if (error) return res.status(500).json({ error: error.message });

  res.json(data);
});


// Obtener inscripciones de un curso (admin)
app.get("/api/cursos/:id/inscripciones", async (req, res) => {
  const { data, error } = await supabase
    .from("cursos_inscripciones")
    .select("*")
    .eq("curso_id", req.params.id)
    .order("id", { ascending: true });

  if (error) return res.status(500).json({ error: error.message });

  res.json(data);
});


// Eliminar inscripción individual de curso (admin)
app.delete("/api/cursos/inscripciones/:id", async (req, res) => {
  const inscId = req.params.id;

  // Necesitamos el curso_id para recalcular después
  const { data: insc } = await supabase
    .from("cursos_inscripciones")
    .select("curso_id")
    .eq("id", inscId)
    .single();

  await supabase.from("cursos_inscripciones").delete().eq("id", inscId);

  if (insc?.curso_id) {
    await recalcularEstadosCurso(insc.curso_id);
  }

  res.json({ ok: true });
});



// Endpoint de exportación masiva de inscripciones de cursos (admin)
app.get("/api/admin/cursos/inscripciones/all", async (req, res) => {
  const { data, error } = await supabase
    .from("cursos_inscripciones")
    .select(`
      id,
      email,
      estado,
      curso_id,
      cursos ( nombre )
    `)
    .order("id", { ascending: true });

  if (error) return res.status(500).json({ error: error.message });

  // Aplanamos el objeto del curso para el CSV
  const aplanado = data.map(ins => ({
    id: ins.id,
    email: ins.email,
    estado: ins.estado,
    curso_id: ins.curso_id,
    curso_nombre: ins.cursos?.nombre || "N/A"
  }));

  res.json(aplanado);
});


// =====================================================
// TORNEOS
// =====================================================

// Función central de recalculo (igual que cursos)
async function recalcularEstadosTorneo(torneoId) {
  const { data: torneo } = await supabase
    .from("torneos")
    .select("plazas")
    .eq("id", torneoId)
    .single();

  if (!torneo) return;

  const plazas = torneo.plazas;
  const maxListaEspera = Math.ceil(plazas * 0.25);
  const maxTotal = plazas + maxListaEspera;

  const { data: inscritos } = await supabase
    .from("torneos_inscripciones")
    .select("*")
    .eq("torneo_id", torneoId)
    .order("id", { ascending: true });

  for (let i = 0; i < inscritos.length; i++) {
    let nuevoEstado;
    if (i < plazas) {
      nuevoEstado = "confirmado";
    } else if (i < maxTotal) {
      nuevoEstado = "lista_espera";
    } else {
      nuevoEstado = "bloqueado";
    }
    await supabase
      .from("torneos_inscripciones")
      .update({ estado: nuevoEstado })
      .eq("id", inscritos[i].id);
  }
}


// Obtener torneos (por defecto activos, con ?todo=true históricos)
app.get("/api/torneos", async (req, res) => {
  const hoy = new Date().toISOString().split("T")[0];
  const todo = req.query.todo === "true";

  let query = supabase
    .from("torneos")
    .select(`
      *,
      inscritos:torneos_inscripciones(count)
    `)
    .order("fecha_inicio", { ascending: true });

  if (!todo) {
    query = query.gte("fecha_fin", hoy);
  }

  const { data, error } = await query;

  if (error) return res.status(500).json({ error: error.message });

  const formateado = data.map(t => ({
    ...t,
    inscritos_count: t.inscritos && t.inscritos[0] ? t.inscritos[0].count : 0
  }));

  res.json(formateado);
});


// Endpoint de exportación masiva de inscripciones de torneos (admin)
app.get("/api/admin/torneos/inscripciones/all", async (req, res) => {
  const { data, error } = await supabase
    .from("torneos_inscripciones")
    .select(`
      id,
      email,
      estado,
      progreso,
      torneo_id,
      torneos ( nombre )
    `)
    .order("id", { ascending: true });

  if (error) return res.status(500).json({ error: error.message });

  // Aplanamos el objeto del torneo para el CSV
  const aplanado = data.map(ins => ({
    id: ins.id,
    email: ins.email,
    estado: ins.estado,
    progreso: ins.progreso,
    torneo_id: ins.torneo_id,
    torneo_nombre: ins.torneos?.nombre || "N/A"
  }));

  res.json(aplanado);
});


// Crear torneo
app.post("/api/torneos", async (req, res) => {
  const { nombre, descripcion, fecha_inicio, fecha_fin, precio, deporte, categoria, plazas } = req.body;

  if (!nombre || !plazas) {
    return res.status(400).json({ error: "Nombre y plazas obligatorios" });
  }

  const { error } = await supabase.from("torneos").insert([{
    nombre, descripcion, fecha_inicio, fecha_fin, precio, deporte, categoria, plazas
  }]);

  if (error) return res.status(500).json({ error: error.message });

  res.json({ ok: true });
});


// Eliminar torneo
app.delete("/api/torneos/:id", async (req, res) => {
  const { id } = req.params;

  // 1. Borrar inscripciones primero
  const { error: errorInsc } = await supabase
    .from("torneos_inscripciones")
    .delete()
    .eq("torneo_id", id);

  if (errorInsc) return res.status(500).json({ error: errorInsc.message });

  // 2. Borrar el torneo
  const { error: errorTorneo } = await supabase
    .from("torneos")
    .delete()
    .eq("id", id);

  if (errorTorneo) return res.status(500).json({ error: errorTorneo.message });

  res.json({ ok: true });
});


// Obtener inscripciones de un torneo (admin)
app.get("/api/torneos/:id/inscripciones", async (req, res) => {
  const { data, error } = await supabase
    .from("torneos_inscripciones")
    .select("*")
    .eq("torneo_id", req.params.id)
    .order("id", { ascending: true });

  if (error) return res.status(500).json({ error: error.message });

  res.json(data);
});


// Eliminar inscripción individual (admin)
app.delete("/api/torneos/inscripciones/:id", async (req, res) => {
  const inscId = req.params.id;

  // Necesitamos el torneo_id para recalcular después
  const { data: insc } = await supabase
    .from("torneos_inscripciones")
    .select("torneo_id")
    .eq("id", inscId)
    .single();

  await supabase.from("torneos_inscripciones").delete().eq("id", inscId);

  if (insc?.torneo_id) {
    await recalcularEstadosTorneo(insc.torneo_id);
  }

  res.json({ ok: true });
});


// Inscribirse en torneo (usuario)
app.post("/api/torneos/inscribir", async (req, res) => {
  const { torneo_id, email, detalle } = req.body;

  if (!torneo_id || !email || !detalle) {
    return res.status(400).json({ error: "Faltan datos obligatorios" });
  }

  const { data: torneo, error: torneoError } = await supabase
    .from("torneos")
    .select("plazas")
    .eq("id", torneo_id)
    .single();

  if (torneoError || !torneo) return res.status(404).json({ error: "Torneo no encontrado" });

  const plazas = torneo.plazas;

  const { data: inscritos, error: inscritosError } = await supabase
    .from("torneos_inscripciones")
    .select("*")
    .eq("torneo_id", torneo_id);

  if (inscritosError) return res.status(500).json({ error: inscritosError.message });

  const totalActual = inscritos.length;
  const maxListaEspera = Math.ceil(plazas * 0.25);
  const maxTotal = plazas + maxListaEspera;

  let estado;
  if (totalActual < plazas) {
    estado = "confirmado";
  } else if (totalActual < maxTotal) {
    estado = "lista_espera";
  } else {
    return res.status(400).json({ error: "Torneo completo (incluida lista de espera)" });
  }

  const { error: insertError } = await supabase
    .from("torneos_inscripciones")
    .insert([{
      torneo_id,
      email: email.toLowerCase(),
      detalle,
      estado,
      fecha_inscripcion: new Date().toISOString()
    }]);

  if (insertError) return res.status(500).json({ error: insertError.message });

  await recalcularEstadosTorneo(torneo_id);

  res.json({
    ok: true,
    estado,
    mensaje: estado === "confirmado" ? "Inscripción confirmada" : "Inscrito en lista de espera"
  });
});


// Mis torneos (usuario)
app.get("/api/mis-torneos/:email", async (req, res) => {
  const email = req.params.email.toLowerCase();

  const { data, error } = await supabase
    .from("torneos_inscripciones")
    .select(`
      id,
      estado,
      progreso,
      detalle,
      fecha_inscripcion,
      torneos (
        nombre,
        descripcion,
        deporte,
        categoria,
        fecha_inicio,
        fecha_fin,
        precio
      )
    `)
    .eq("email", email)
    .order("fecha_inscripcion", { ascending: true });

  if (error) return res.status(500).json({ error: error.message });

  res.json(data);
});


// Actualizar progreso de inscripción (admin)
app.patch("/api/torneos/inscripciones/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { progreso } = req.body;

    const { error } = await supabase
      .from("torneos_inscripciones")
      .update({ progreso })
      .eq("id", id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo actualizar el progreso" });
  }
});


app.listen(PORT, () => {
  console.log(`🚀 Servidor en http://localhost:${PORT}`);
});

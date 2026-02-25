console.log("APP NUEVA CARGADA");

let usuario = null; // email
let usuarioNombre = null; // solo visual
let reservas = [];
let fechaSeleccionada = null;
let pistaSeleccionada = null;
let horaSeleccionada = null;
let duracionSeleccionada = 60;
let limites = { maxReservas: 4, diasAnticipacion: 15 };

/* ================= CARGAR LIMITES ================= */
async function cargarLimites() {
  try {
    const res = await fetch("/api/limites");
    if (res.ok) {
      const data = await res.json();
      limites.maxReservas = data.maxReservas;
      limites.diasAnticipacion = data.diasAnticipacion;
    }
  } catch (e) {
    console.error("No se pudieron cargar los límites", e);
  }
}

/* ================= NAVEGACIÓN ================= */
function ocultarTodo() {
  const secciones = [
    "inicioSection",
    "cursosSection",
    "campeonatosSection"
  ];

  secciones.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });
}

function mostrarInicio() {
  ocultarTodo();
  document.getElementById("inicioSection").style.display = "block";
}

function mostrarCursos() {
  ocultarTodo();
  document.getElementById("cursosSection").style.display = "block";
  cargarCursos();
}

function mostrarCampeonatos() {
  ocultarTodo();
  document.getElementById("campeonatosSection").style.display = "block";
  cargarTorneos();
}

const mostrarTorneos = mostrarCampeonatos;

/* ================= VER SOLAPE ================= */
function haySolapamiento(reservaExistente, nuevaFecha, nuevaPista, nuevaHora, nuevaDuracion) {
  if (reservaExistente.fecha !== nuevaFecha) return false;
  if (reservaExistente.pista !== nuevaPista) return false;

  const inicioExistente = convertirHoraAMinutos(reservaExistente.hora);
  const duracionExistente = reservaExistente.duracion || 60;
  const finExistente = inicioExistente + duracionExistente;

  const inicioNueva = convertirHoraAMinutos(nuevaHora);
  const finNueva = inicioNueva + nuevaDuracion;

  return inicioNueva < finExistente && finNueva > inicioExistente;
}

function convertirHoraAMinutos(hora) {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

/* ================= LOGIN ================= */
async function login() {
  await cargarLimites();

  const emailInput = document.getElementById("email").value.trim();
  const passwordInput = document.getElementById("password");

  if (!emailInput) return alert("Introduce correo");

  if (emailInput === "admin@eltejar.com") {
    passwordInput.style.display = "block";
    if (!passwordInput.value) return alert("Introduce contraseña");

    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: emailInput, password: passwordInput.value }),
    });

    if (!res.ok) return alert("Contraseña incorrecta");
    window.location = "/admin.html";
    return;
  }

  const res = await fetch("/api/socios");
  const socios = await res.json();

  const socio = socios.find(
    (s) => s.email.trim().toLowerCase() === emailInput.toLowerCase()
  );

  if (!socio) return alert("No autorizado");

  usuario = emailInput.toLowerCase();
  localStorage.setItem("email", usuario);
  usuarioNombre = socio.nombre;

  document.getElementById("login").style.display = "none";
  document.getElementById("app").style.display = "block";

  document.getElementById("bienvenida").textContent =
    "Hola, " + usuarioNombre + ". Este es el sistema de reservas del Club Deportivo El Tejar.";

  await cargarReservas();
  await cargarMisCursos();
  await cargarMisTorneos();

  mostrarInicio(); // Siempre empieza en Inicio
}

/* ================= LOGOUT ================= */
function logout() {
  usuario = null;
  usuarioNombre = null;
  reservas = [];
  fechaSeleccionada = null;
  pistaSeleccionada = null;
  horaSeleccionada = null;

  localStorage.removeItem("email");
  window.location.reload();
}

/* ================= CARGAR RESERVAS ================= */
async function cargarReservas() {
  await cargarLimites();

  try {
    const res = await fetch("/api/reservas");
    reservas = res.ok ? await res.json() : [];
    if (!Array.isArray(reservas)) reservas = [];
  } catch {
    reservas = [];
  }

  generarFechas();
  renderMisReservas();
}

/* ================= FECHAS ================= */
function generarFechas() {
  const cont = document.getElementById("fechas");
  cont.innerHTML = "";

  for (let i = 0; i < limites.diasAnticipacion; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const fecha = d.toISOString().split("T")[0];

    const btn = document.createElement("button");
    btn.className = "fecha-btn";
    btn.innerHTML = `
      <small>${d.toLocaleDateString("es-ES", { weekday: "short" })}</small><br>
      <strong>${d.getDate()}</strong><br>
      <small>${d.toLocaleDateString("es-ES", { month: "short" })}</small>
    `;

    btn.onclick = () => {
      document.querySelectorAll(".fecha-btn").forEach(b => b.classList.remove("seleccionado"));
      btn.classList.add("seleccionado");
      fechaSeleccionada = fecha;
      generarHoras();
    };

    cont.appendChild(btn);
  }
}

/* ================= PISTAS ================= */
function seleccionarPista(p) {
  pistaSeleccionada = p;

  document.getElementById("btnTenis").classList.remove("seleccionado");
  document.getElementById("btnPadel").classList.remove("seleccionado");

  document.getElementById("btn" + p).classList.add("seleccionado");

  generarHoras();
}

/* ================= DURACIÓN ================= */
function seleccionarDuracion(minutos) {
  duracionSeleccionada = minutos;
  horaSeleccionada = null;

  document.querySelectorAll(".duracion-btn").forEach(b => b.classList.remove("seleccionado"));
  document.querySelectorAll(".duracion-btn").forEach(btn => {
    if (btn.textContent.includes(minutos)) {
      btn.classList.add("seleccionado");
    }
  });

  generarHoras();
}

/* ================= HORAS ================= */
function generarHoras() {
  const cont = document.getElementById("horas");
  const section = document.getElementById("horarioSection");

  cont.innerHTML = "";

  if (!fechaSeleccionada || !pistaSeleccionada || !duracionSeleccionada) {
    if (section) section.style.display = "none";
    return;
  }

  if (section) section.style.display = "block";

  for (let minutos = 9 * 60; minutos <= 21 * 60; minutos += 30) {
    const inicio = minutos;
    const fin = minutos + duracionSeleccionada;

    if (fin > 22 * 60) continue;
    if (inicio < 17 * 60 && fin > 13 * 60) continue;

    const h = Math.floor(minutos / 60);
    const m = minutos % 60;
    const hora = (h < 10 ? "0" + h : h) + ":" + (m === 0 ? "00" : m);

    const btn = document.createElement("button");
    btn.className = "hora-btn";
    btn.textContent = hora;

    const ocupada = reservas.find(r =>
      haySolapamiento(r, fechaSeleccionada, pistaSeleccionada, hora, duracionSeleccionada)
    );

    if (ocupada) {
      btn.classList.add("ocupado");
      btn.disabled = true;
    }

    btn.onclick = () => {
      document.querySelectorAll(".hora-btn").forEach(b => b.classList.remove("seleccionado"));
      btn.classList.add("seleccionado");
      horaSeleccionada = hora;
    };

    cont.appendChild(btn);
  }
}

/* ================= CONFIRMAR RESERVA ================= */
async function confirmarReserva() {
  if (!fechaSeleccionada || !pistaSeleccionada || !horaSeleccionada)
    return alert("Selecciona fecha, pista y hora");

  await cargarLimites();

  const hoyStr = new Date().toISOString().split("T")[0];

  const activas = reservas.filter(
    r => r.email && r.email.trim().toLowerCase() === usuario && r.fecha >= hoyStr
  );

  if (activas.length >= limites.maxReservas) {
    return alert(
      `Has alcanzado el número máximo de ${limites.maxReservas} reservas activas para los próximos ${limites.diasAnticipacion} días.`
    );
  }

  const res = await fetch("/api/reservas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: usuario,
      fecha: fechaSeleccionada,
      pista: pistaSeleccionada,
      hora: horaSeleccionada,
      duracion: duracionSeleccionada,
    }),
  });

  if (!res.ok) {
    const data = await res.json();
    return alert(data.error || "Error al confirmar");
  }

  const fechaObj = new Date(fechaSeleccionada);
  const fechaBonita = fechaObj.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const fechaFormateada = fechaBonita.charAt(0).toUpperCase() + fechaBonita.slice(1);

  alert(
    `Confirmada la reserva en la pista de ${pistaSeleccionada} para el ${fechaFormateada}, a las ${horaSeleccionada}, por ${duracionSeleccionada} minutos.\nRecuerde cancelarla si finalmente no pudiera asistir.\nGracias por utilizar el sistema de reservas del Club Deportivo El Tejar.`
  );

  await cargarReservas();

  fechaSeleccionada = null;
  pistaSeleccionada = null;
  horaSeleccionada = null;

  document.querySelectorAll(".seleccionado").forEach(el => el.classList.remove("seleccionado"));
}

function formatearFechaLarga(fechaStr) {
  if (!fechaStr) return "-";
  // Forzamos mediodía para evitar desfases de zona horaria al convertir
  const fecha = new Date(fechaStr + "T12:00:00");
  const opciones = { weekday: 'long', day: 'numeric', month: 'long' };
  const formateada = fecha.toLocaleDateString('es-ES', opciones);
  return formateada.charAt(0).toUpperCase() + formateada.slice(1);
}

/* ================= UTILIDADES DISPONIBILIDAD ================= */
function obtenerTagDisponibilidad(inscritos, plazas) {
  const maxListaEspera = Math.ceil(plazas * 0.25);
  const totalMax = plazas + maxListaEspera;

  if (inscritos < plazas) {
    return `<span class="cupo-tag verde">Plazas disponibles</span>`;
  } else if (inscritos < totalMax) {
    return `<span class="cupo-tag amarillo">Lista de Espera</span>`;
  } else {
    return `<span class="cupo-tag rojo">Completo</span>`;
  }
}

/* ================= CURSOS ================= */
async function cargarCursos() {
  const res = await fetch("/api/cursos");
  const cursos = res.ok ? await res.json() : [];

  const contenedor = document.getElementById("listaCursos");
  contenedor.innerHTML = "";

  if (!cursos.length) {
    contenedor.innerHTML = "<p>No hay cursos disponibles.</p>";
    return;
  }

  cursos.forEach(c => {
    const div = document.createElement("div");
    div.className = "curso-item";

    const tag = obtenerTagDisponibilidad(c.inscritos_count || 0, c.plazas || 0);

    div.innerHTML = `
      ${tag}
      <h4>${c.nombre}</h4>
      <p>${c.descripcion || ""}</p>
      <div style="font-size: 0.9em; opacity: 0.8; margin-bottom: 15px;">
        <p><strong>Inicio:</strong> ${formatearFechaLarga(c.fecha_inicio)}</p>
        <p><strong>Fin:</strong> ${formatearFechaLarga(c.fecha_fin)}</p>
        <p><strong>Precio:</strong> ${c.precio || ""} &nbsp; <strong>Profesor:</strong> ${c.profesor || ""}</p>
      </div>
      <input type="text" placeholder="Nombre del alumno" id="detalle_${c.id}">
      <button class="primary-btn" style="margin-top: 10px;" onclick="inscribirse(${c.id})">Inscribirse</button>
      <p id="estado_${c.id}"></p>
    `;
    contenedor.appendChild(div);
  });
}

/* ================= INSCRIBIR ================= */
async function inscribirse(cursoId) {
  const email = localStorage.getItem("email");
  const detalle = document.getElementById(`detalle_${cursoId}`).value.trim();

  if (!detalle) return alert("Debes indicar el nombre del alumno");

  const confirmacion = confirm(
    "Una vez comenzado el curso, la cancelación deberá gestionarse directamente con el profesor.\n\n¿Confirmas la inscripción?"
  );
  if (!confirmacion) return;

  const res = await fetch("/api/cursos/inscribir", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ curso_id: cursoId, email, detalle })
  });

  const data = await res.json();
  if (!res.ok) return alert(data.error || "Error al inscribirse");

  alert(`Inscripción ${data.estado} para "${detalle}".`);

  const estadoSpan = document.getElementById(`estado_${cursoId}`);
  estadoSpan.textContent = data.estado === "confirmado" ? "Inscripción confirmada" : "En lista de espera";

  document.getElementById(`detalle_${cursoId}`).value = "";

  await cargarCursos();
}

/* ================= RENDER MIS RESERVAS ================= */
function renderMisReservas() {
  const cont = document.getElementById("misReservas");
  if (!cont) return;

  cont.innerHTML = "";

  const hoyStr = new Date().toISOString().split("T")[0];

  const activas = reservas.filter(
    r =>
      r.email &&
      r.email.trim().toLowerCase() === usuario &&
      r.fecha >= hoyStr
  );

  if (activas.length === 0) {
    cont.innerHTML = "<p>No tienes reservas activas.</p>";
    return;
  }

  activas.sort((a, b) =>
    a.fecha.localeCompare(b.fecha) || a.hora.localeCompare(b.hora)
  );

  activas.forEach(r => {
    // Fecha larga tipo "Sábado, 23 de mayo"
    const fechaObj = new Date(r.fecha + "T12:00:00"); // mediodía para evitar desfases UTC
    const dia = fechaObj.getDate();
    const mes = fechaObj.toLocaleDateString("es-ES", { month: "long" });
    const semana = fechaObj.toLocaleDateString("es-ES", { weekday: "long" });
    const semanaCap = semana.charAt(0).toUpperCase() + semana.slice(1);

    // Construimos HTML: "Sábado, <span class='dia-numero'>23</span> de mayo"
    const fechaFormateada = `${semanaCap}, <span class="dia-numero">${dia}</span> de ${mes}`;

    const row = document.createElement("div");
    row.className = "lista-fila";
    row.innerHTML = `
      <span class="col-pista">${r.pista}</span>
      <span class="col-fecha">${fechaFormateada}</span>
      <span class="col-extra mobile-hide">${r.duracion} min</span>
      <span class="col-hora">${r.hora}</span>
      <button class="cancelar-btn">Cancelar</button>
    `;

    row.querySelector("button").onclick = async () => {
      if (!confirm(`¿Cancelar reserva del ${fechaFormateada} a las ${r.hora}?`)) return;
      await fetch("/api/reservas/" + r.id, { method: "DELETE" });
      await cargarReservas();
    };

    cont.appendChild(row);
  });
}

function formatFecha(fechaStr) {
  if (!fechaStr) return "";
  const fecha = new Date(fechaStr);
  const dia = fecha.getDate();
  const mes = fecha.toLocaleString("es-ES", { month: "short" });
  return `${dia} de ${mes}`;
}

/* ================= CARGAR MIS CURSOS ================= */
async function cargarMisCursos() {
  const contenedor = document.getElementById('misCursos');
  if (!contenedor) return;

  contenedor.innerHTML = '';

  try {
    const email = localStorage.getItem("email");
    if (!email) {
      contenedor.innerHTML = '<p>No estás identificado</p>';
      return;
    }

    const res = await fetch(`/api/mis-cursos/${email}`);
    const cursos = res.ok ? await res.json() : [];

    // Solo cursos activos (fecha_fin >= hoy)
    const hoyStr = new Date().toISOString().split("T")[0];
    const cursosActivos = cursos.filter(ins => ins.cursos.fecha_fin >= hoyStr);

    if (cursosActivos.length === 0) {
      contenedor.innerHTML = '<p>No estás apuntado a ningún curso activo</p>';
      return;
    }

    // Ordenar por fecha_fin
    cursosActivos.sort((a, b) => a.cursos.fecha_fin.localeCompare(b.cursos.fecha_fin));

    cursosActivos.forEach(ins => {
      const div = document.createElement('div');
      div.className = 'lista-fila';

      const detalle = ins.detalle || '';
      const descripcion = ins.cursos.descripcion || '';

      // Fecha fin corta: "23 may"
      const fechaFinObj = new Date(ins.cursos.fecha_fin + "T12:00:00");
      const diaFin = fechaFinObj.getDate();
      const mesFin = fechaFinObj.toLocaleDateString("es-ES", { month: "short" });
      const fechaFinCorta = `<span class="dia-numero">${diaFin}</span> ${mesFin}`;

      const esConfirmado = ins.estado === "confirmado";
      const claseBtn = esConfirmado ? "btn-estado ok" : "btn-estado espera";
      const textoBtn = esConfirmado ? "OK" : "Espera";

      div.innerHTML = `
        <span class="col-detalle">${detalle}</span>
        <span class="col-descripcion">${descripcion}</span>
        <span class="col-extra mobile-hide">👨‍🏫 ${ins.cursos.profesor || "-"}</span>
        <span class="col-fechafin">${fechaFinCorta}</span>
        <button class="${claseBtn}" onclick="mostrarCursos()">${textoBtn}</button>
      `;

      contenedor.appendChild(div);
    });

  } catch (err) {
    console.error(err);
    contenedor.innerHTML = '<p>Error cargando cursos</p>';
  }
}
/* ================= TORNEOS (vista usuario) ================= */
async function cargarTorneos() {
  const res = await fetch("/api/torneos");
  const torneos = res.ok ? await res.json() : [];

  const contenedor = document.getElementById("listaTorneos");
  contenedor.innerHTML = "";

  if (!torneos.length) {
    contenedor.innerHTML = "<p>No hay torneos disponibles.</p>";
    return;
  }

  torneos.forEach(t => {
    const div = document.createElement("div");
    div.className = "curso-item";

    const tag = obtenerTagDisponibilidad(t.inscritos_count || 0, t.plazas || 0);

    div.innerHTML = `
      ${tag}
      <h4>${t.nombre}</h4>
      <p>${t.descripcion || ""}</p>
      <div style="font-size: 0.9em; opacity: 0.8; margin-bottom: 15px;">
        <p><strong>Deporte:</strong> ${t.deporte || ""} &nbsp; <span class="mobile-hide"><strong>Categoría:</strong> ${t.categoria || ""}</span></p>
        <p><strong>Inicio:</strong> ${formatearFechaLarga(t.fecha_inicio)}</p>
        <p><strong>Fin:</strong> ${formatearFechaLarga(t.fecha_fin)}</p>
        <p><strong>Precio:</strong> ${t.precio || "Gratis"} &nbsp; <strong>Plazas:</strong> ${t.plazas}</p>
      </div>
      <input type="text" placeholder="Nombre del participante" id="detalle_torneo_${t.id}">
      <button class="primary-btn" style="margin-top: 10px;" onclick="inscribirseATorneo(${t.id})">Inscribirse</button>
      <p id="estado_torneo_${t.id}"></p>
    `;
    contenedor.appendChild(div);
  });
}

async function inscribirseATorneo(torneoId) {
  const email = localStorage.getItem("email");
  const detalle = document.getElementById(`detalle_torneo_${torneoId}`).value.trim();

  if (!detalle) return alert("Debes indicar el nombre del participante");

  const confirmacion = confirm(
    "Una vez inscrito, la cancelación deberá gestionarse directamente con la organización.\n\n¿Confirmas la inscripción?"
  );
  if (!confirmacion) return;

  const res = await fetch("/api/torneos/inscribir", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ torneo_id: torneoId, email, detalle })
  });

  const data = await res.json();
  if (!res.ok) return alert(data.error || "Error al inscribirse");

  alert(`Inscripción ${data.estado === "confirmado" ? "confirmada ✅" : "en lista de espera ⏳"} para "${detalle}".`);

  document.getElementById(`estado_torneo_${torneoId}`).textContent =
    data.estado === "confirmado" ? "✅ Inscripción confirmada" : "⏳ En lista de espera";

  document.getElementById(`detalle_torneo_${torneoId}`).value = "";

  await cargarTorneos();
  await cargarMisTorneos();
}

async function cargarMisTorneos() {
  const contenedor = document.getElementById('misTorneos');
  if (!contenedor) return;

  contenedor.innerHTML = '';

  try {
    const email = localStorage.getItem("email");
    if (!email) return;

    const res = await fetch(`/api/mis-torneos/${email}`);
    const torneos = res.ok ? await res.json() : [];

    const hoyStr = new Date().toISOString().split("T")[0];
    const activos = torneos.filter(ins => ins.torneos.fecha_fin >= hoyStr);

    if (activos.length === 0) {
      contenedor.innerHTML = '<p>No estás apuntado a ningún torneo activo</p>';
      return;
    }

    activos.sort((a, b) => a.torneos.fecha_fin.localeCompare(b.torneos.fecha_fin));

    activos.forEach(ins => {
      const div = document.createElement('div');
      div.className = 'lista-fila';

      const detalle = ins.detalle || '';
      const descripcion = ins.torneos.descripcion || ins.torneos.nombre || '';

      const fechaFinObj = new Date(ins.torneos.fecha_fin + "T12:00:00");
      const diaFin = fechaFinObj.getDate();
      const mesFin = fechaFinObj.toLocaleDateString("es-ES", { month: "short" });
      const fechaFinCorta = `<span class="dia-numero">${diaFin}</span> ${mesFin}`;

      let textoBtn = "OK";
      let claseBtn = "btn-estado ok";

      if (ins.estado === "lista_espera") {
        textoBtn = "Espera";
        claseBtn = "btn-estado espera";
      } else if (ins.progreso === "Eliminado") {
        textoBtn = "OUT";
        claseBtn = "btn-estado out";
      } else if (ins.progreso === "Ganador") {
        textoBtn = "Winner 🏆";
        claseBtn = "btn-estado ok";
      }

      div.innerHTML = `
        <span class="col-detalle">${detalle}</span>
        <span class="col-descripcion">${descripcion}</span>
        <span class="col-extra mobile-hide">🏆 ${ins.torneos.categoria || "-"}</span>
        <span class="col-fechafin">${fechaFinCorta}</span>
        <button class="${claseBtn}" onclick="mostrarTorneos()">${textoBtn}</button>
      `;

      contenedor.appendChild(div);
    });

  } catch (err) {
    console.error(err);
    contenedor.innerHTML = '<p>Error cargando torneos</p>';
  }
}

/* ================= EXPORTAMOS ================= */
window.login = login;
window.logout = logout;
window.seleccionarPista = seleccionarPista;
window.confirmarReserva = confirmarReserva;
window.seleccionarDuracion = seleccionarDuracion;
window.mostrarInicio = mostrarInicio;
window.mostrarCursos = mostrarCursos;
window.mostrarCampeonatos = mostrarCampeonatos;
window.mostrarTorneos = mostrarTorneos;
window.inscribirse = inscribirse;
window.inscribirseATorneo = inscribirseATorneo;
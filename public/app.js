/* =========================
   CONFIGURACIÓN
========================= */

const ADMIN_EMAIL = "admin@eltejar.com";
const ADMIN_PASSWORD = "1234";

const LIMITE_RESERVAS = 5;
const DIAS_LIMITE = 14;

const APERTURA = 9;
const CIERRE = 22;
const INTERVALO = 30;

/* =========================
   ESTADO GLOBAL
========================= */

let emailUsuario = null;
let socios = [];
let reservas = [];

let fechaSeleccionada = null;
let horaSeleccionada = null;

/* =========================
   HELPERS FECHA / HORA
========================= */

function hoyISO() {
  return new Date().toISOString().split("T")[0];
}

function sumarMinutos(hora, minutos) {
  const [h, m] = hora.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m + minutos, 0, 0);
  return d.toTimeString().slice(0, 5);
}

function reservaEstaEnElPasado(reserva) {
  const hoy = new Date();

  const inicio = reserva.bloques[0];
  const fin = sumarMinutos(
    reserva.bloques[reserva.bloques.length - 1],
    30
  );

  const fechaHoraFin = new Date(`${reserva.fecha}T${fin}:00`);

  return fechaHoraFin <= hoy;
}

function bloquesDesdeHora(hora, duracion) {
  const bloques = [];
  let actual = hora;
  for (let i = 0; i < duracion; i += 30) {
    bloques.push(actual);
    actual = sumarMinutos(actual, 30);
  }
  return bloques;
}

function formatearFechaBonita(iso) {
  const [y, m, d] = iso.split("-").map(Number);

  // Crear fecha en horario local (NO UTC)
  const fecha = new Date(y, m - 1, d);

  const dias = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

  return {
    diaSemana: dias[fecha.getDay()],
    dia: fecha.getDate(),
    mes: meses[fecha.getMonth()]
  };
}

/* =========================
   API
========================= */

async function cargarSocios() {
  try {
    const r = await fetch("/api/socios");
    if (!r.ok) throw new Error("Error cargando socios");
    socios = (await r.json()).map(s => s.toLowerCase().trim());
  } catch (e) {
    alert("⚠️ No se pudo conectar con el servidor. Inténtalo de nuevo.");
    throw e;
  }
}

async function cargarReservas() {
  const r = await fetch("/api/reservas");
  reservas = await r.json();
}

async function guardarReserva(reserva) {
  await fetch("/api/reservas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(reserva)
  });
}

async function borrarReserva(id) {
  await fetch(`/api/reservas/${id}`, { method: "DELETE" });
}

/* =========================
   LOGIN
========================= */

document.getElementById("btnAcceder").onclick = async () => {
  const email = document.getElementById("emailInput").value.trim().toLowerCase();

  await cargarSocios();
  await cargarReservas();

  if (email === ADMIN_EMAIL) {
    const password = prompt("Contraseña (solo admin)");
    if (password !== ADMIN_PASSWORD) {
      alert("Contraseña incorrecta");
      return;
    }
    emailUsuario = email;
    iniciarApp(true);
    return;
  }

  if (!socios.includes(email)) {
    document.getElementById("loginError").style.display = "block";
    return;
  }

  emailUsuario = email;
  iniciarApp(false);
};

function iniciarApp(esAdmin) {
  document.getElementById("login").style.display = "none";
  document.getElementById("app").style.display = "block";

  document.getElementById("panelSocios").style.display = esAdmin ? "block" : "none";
  if (esAdmin) mostrarSocios();

  generarFechas();
  mostrarReservas();
}

/* =========================
   FECHAS
========================= */

function generarFechas() {
  const cont = document.getElementById("selectorFechas");
  cont.innerHTML = "";

  for (let i = 0; i < DIAS_LIMITE; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const iso = d.toISOString().split("T")[0];

    const b = document.createElement("button");
    const f = formatearFechaBonita(iso);

    b.innerHTML = `
      <div class="dia-semana">${f.diaSemana}</div>
      <div class="dia-numero">${f.dia}</div>
      <div class="mes">${f.mes}</div>
    `;
    if (i === 0) {
      b.classList.add("active");
      fechaSeleccionada = iso;
    }

    b.onclick = () => {
      document.querySelectorAll("#selectorFechas button").forEach(x => x.classList.remove("active"));
      b.classList.add("active");
      fechaSeleccionada = iso;
      generarHorarios();
    };

    cont.appendChild(b);
  }

  generarHorarios();
}

/* =========================
   PISTA Y DURACIÓN
========================= */

function pistaActual() {
  return document.querySelector(".pista-btn.active")?.dataset.pista || "A";
}

function duracionActual() {
  return Number(document.querySelector(".duracion-btn.active")?.dataset.duracion || 60);
}

document.querySelectorAll(".pista-btn").forEach(b => {
  b.onclick = () => {
    document.querySelectorAll(".pista-btn").forEach(x => x.classList.remove("active"));
    b.classList.add("active");
    generarHorarios();
  };
});

document.querySelectorAll(".duracion-btn").forEach(b => {
  b.onclick = () => {
    document.querySelectorAll(".duracion-btn").forEach(x => x.classList.remove("active"));
    b.classList.add("active");
    generarHorarios();
  };
});

/* =========================
   SOLAPES
========================= */

function haySolape(bloques) {
  if (!fechaSeleccionada) return false;

  return reservas.some(r => {
    if (r.fecha !== fechaSeleccionada) return false;
    if (r.pistaId !== pistaActual()) return false;
    if (!Array.isArray(r.bloques)) return false;
    return r.bloques.some(b => bloques.includes(b));
  });
}

/* =========================
   HORARIOS
========================= */

function generarHorarios() {
  const cal = document.getElementById("calendario");
  cal.innerHTML = "";
  horaSeleccionada = null;
  document.getElementById("confirmarReserva").disabled = true;

  const duracion = duracionActual();

  const apertura = 9 * 60;
  const cierre = 22 * 60;

  const comidaInicio = 13 * 60;
  const comidaFin = 17 * 60;

  for (let inicio = apertura; inicio <= cierre - duracion; inicio += 30) {
    const fin = inicio + duracion;

    if (Math.max(inicio, comidaInicio) < Math.min(fin, comidaFin)) continue;

    const h = String(Math.floor(inicio / 60)).padStart(2, "0");
    const m = String(inicio % 60).padStart(2, "0");
    const hora = `${h}:${m}`;

    const bloques = bloquesDesdeHora(hora, duracion);
    if (haySolape(bloques)) continue;

    const b = document.createElement("button");
    b.textContent = hora;

    b.onclick = () => {
      document.querySelectorAll("#calendario button").forEach(x => x.classList.remove("active"));
      b.classList.add("active");
      horaSeleccionada = hora;
      document.getElementById("confirmarReserva").disabled = false;
    };

    cal.appendChild(b);
  }
}

/* =========================
   CONFIRMAR
========================= */

document.getElementById("confirmarReserva").onclick = async () => {
  const reservasUsuario = reservas.filter(
  r => r.email === emailUsuario && !reservaEstaEnElPasado(r)
);
  if (reservasUsuario.length >= LIMITE_RESERVAS) {
    alert("Has alcanzado el límite de reservas");
    return;
  }

  const duracion = duracionActual();
  const bloques = bloquesDesdeHora(horaSeleccionada, duracion);

  const reserva = {
    email: emailUsuario,
    fecha: fechaSeleccionada,
    pistaId: pistaActual(),
    bloques
  };

await guardarReserva(reserva);
await cargarReservas();
generarHorarios();
mostrarReservas();

const pistaNombre = pistaActual() === "A" ? "tenis" : "pádel";

const inicio = bloques[0];
const fin = sumarMinutos(bloques[bloques.length - 1], 30);

const fecha = new Date(fechaSeleccionada);
const textoFecha = fecha.toLocaleDateString("es-ES", {
  weekday: "long",
  day: "numeric",
  month: "long"
});

alert(
  `✅ Reserva confirmada\n\n` +
  `Pista de ${pistaNombre} del Tejar\n` +
  `${textoFecha}\n` +
  `De ${inicio} a ${fin}`
);
};

/* =========================
   MIS RESERVAS
========================= */

function mostrarReservas() {
  const ul = document.getElementById("reservasUl");
  ul.innerHTML = "";

  reservas
  .filter(r =>
    r.email === emailUsuario &&
    !reservaEstaEnElPasado(r)).
    forEach((r, idx) => {
    const li = document.createElement("li");
    const inicio = r.bloques[0];
    const fin = sumarMinutos(r.bloques[r.bloques.length - 1], 30);

    li.innerHTML = `${r.fecha} · ${r.pistaId === "A" ? "Tenis" : "Pádel"} · ${inicio} – ${fin} <button>❌</button>`;

    li.querySelector("button").onclick = async () => {
      await borrarReserva(idx);
      await cargarReservas();
      generarHorarios();
      mostrarReservas();
    };

    ul.appendChild(li);
  });
}

/* =========================
   SOCIOS
========================= */

function mostrarSocios() {
  const ul = document.getElementById("listaSocios");
  ul.innerHTML = "";
  socios.forEach(s => {
    const li = document.createElement("li");
    li.textContent = s;
    ul.appendChild(li);
  });
}

document.getElementById("agregarSocio").onclick = async () => {
  const input = document.getElementById("nuevoSocio");
  const email = input.value.trim().toLowerCase();
  if (!email) return;

  await fetch("/api/socios", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email })
  });

  input.value = "";
  await cargarSocios();
  mostrarSocios();
};

document.getElementById("descargarCSV").onclick = () => {
  window.open("/api/reservas.csv", "_blank");
};


window.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("descargarCSV");
  if (btn) {
    btn.onclick = () => {
      window.open("/api/reservas.csv", "_blank");
    };
  }
});




/* =========================
   CERRAR SESIÓN
========================= */

window.addEventListener("DOMContentLoaded", () => {

  // BOTÓN CERRAR SESIÓN
  const cerrar = document.getElementById("cerrarSesion");
  if (cerrar) {
    cerrar.onclick = () => {
      location.reload();
    };
  }

  // BOTÓN CSV (admin)
  const csv = document.getElementById("descargarCSV");
  if (csv) {
    csv.onclick = () => {
      window.open("/api/reservas.csv", "_blank");
    };
  }

});
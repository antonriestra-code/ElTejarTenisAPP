/* ===== VARIABLES GLOBALES ===== */
let horaSeleccionada = null;
let fechaSeleccionada = null;
const reservas = [];

const calendario = document.getElementById("calendario");
const btnConfirmar = document.getElementById("confirmarReserva");

const LIMITE_RESERVAS = 5;
const DIAS_VENTANA = 14;
const ADMIN_EMAIL = "admin@club.com";

/* ===== LOGIN ===== */
const loginDiv = document.getElementById("login");
const appDiv = document.getElementById("app");
const btnAcceder = document.getElementById("btnAcceder");
const emailInput = document.getElementById("emailInput");
const loginError = document.getElementById("loginError");

function emailActual() {
  return localStorage.getItem("emailUsuario");
}

btnAcceder.addEventListener("click", () => {
  const email = emailInput.value.trim().toLowerCase();
  if (!email) {
    loginError.style.display = "block";
    return;
  }
  localStorage.setItem("emailUsuario", email);
  mostrarApp();
});

/* ===== MOSTRAR APP ===== */
function mostrarApp() {
  loginDiv.style.display = "none";
  appDiv.style.display = "block";
  generarSelectorFechas();
  mostrarReservas();
  mostrarPanelSocios();
}

/* ===== CONTAR RESERVAS ACTIVAS ===== */
function contarReservasActivasUsuario() {
  const email = emailActual();
  const hoy = new Date();
  const finVentana = new Date();
  finVentana.setDate(hoy.getDate() + DIAS_VENTANA);

  return reservas.filter(r => {
    if (r.email !== email) return false;
    const fechaReserva = new Date(r.fecha);
    return fechaReserva >= hoy && fechaReserva <= finVentana;
  }).length;
}

/* ===== SELECTOR DE FECHAS ===== */
function generarSelectorFechas() {
  const contenedor = document.getElementById("selectorFechas");
  contenedor.innerHTML = "";

  const hoy = new Date();
  for (let i = 0; i <= 15; i++) {
    const fecha = new Date();
    fecha.setDate(hoy.getDate() + i);

    const btn = document.createElement("button");
    btn.classList.add("fecha-btn");
    btn.innerHTML = `
      ${fecha.toLocaleDateString("es-ES",{weekday:"short"})}<br>
      <strong>${fecha.getDate()}</strong><br>
      ${fecha.toLocaleDateString("es-ES",{month:"short"})}
    `;

    btn.addEventListener("click", () => {
      document.querySelectorAll(".fecha-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      fechaSeleccionada = fecha;
      generarHorarios(fecha);
    });

    contenedor.appendChild(btn);
  }

  const primero = contenedor.querySelector(".fecha-btn");
  primero.classList.add("active");
  fechaSeleccionada = hoy;
  generarHorarios(hoy);
}

/* ===== SELECTORES PISTA Y DURACIÓN ===== */
document.querySelectorAll(".pista-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".pista-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    resetearSeleccion();
    generarHorarios(fechaSeleccionada);
  });
});

document.querySelectorAll(".duracion-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".duracion-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    resetearSeleccion();
    generarHorarios(fechaSeleccionada);
  });
});

function duracionActual() {
  return Number(document.querySelector(".duracion-btn.active").dataset.duracion);
}

function pistaActual() {
  return document.querySelector(".pista-btn.active")?.dataset.pista || "A";
}

/* ===== HORARIOS ===== */
function generarHorarios(fecha) {
  calendario.innerHTML = "";
  const duracion = duracionActual();
  const pista = pistaActual();
  const fechaStr = fecha.toISOString().split("T")[0];

  const tramos = (fecha.getDay() === 0 || fecha.getDay() === 6)
    ? [["09:00","13:00"],["17:00","22:00"]]
    : [["09:00","13:00"],["17:30","22:00"]];

  generarBloques(tramos)
    .filter(h => disponible(h, fechaStr, pista, duracion))
    .forEach(hora => {
      const btn = document.createElement("button");
      btn.textContent = hora;
      btn.classList.add("bloque-hora");
      btn.addEventListener("click", () => {
        document.querySelectorAll(".bloque-hora").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        horaSeleccionada = hora;
        btnConfirmar.disabled = false;
      });
      calendario.appendChild(btn);
    });
}

function generarBloques(tramos) {
  const bloques = [];
  tramos.forEach(([inicio, fin]) => {
    let m = parseInt(inicio.split(":")[0]) * 60 + parseInt(inicio.split(":")[1]);
    const finMin = parseInt(fin.split(":")[0]) * 60 + parseInt(fin.split(":")[1]);
    while (m < finMin) {
      bloques.push(`${String(Math.floor(m/60)).padStart(2,"0")}:${String(m%60).padStart(2,"0")}`);
      m += 30;
    }
  });
  return bloques;
}

function disponible(hora, fechaStr, pista, duracion) {
  const bloquesNecesarios = duracion / 30;
  const [h, m] = hora.split(":").map(Number);
  const inicioMin = h * 60 + m;

  for (let i = 0; i < bloquesNecesarios; i++) {
    const bloque = `${String(Math.floor((inicioMin + i*30)/60)).padStart(2,"0")}:${String((inicioMin + i*30)%60).padStart(2,"0")}`;
    if (reservas.some(r => r.fecha === fechaStr && r.pistaId === pista && r.bloques.includes(bloque))) {
      return false;
    }
  }
  return true;
}

/* ===== RESERVAS ===== */
function resetearSeleccion() {
  horaSeleccionada = null;
  btnConfirmar.disabled = true;
  document.querySelectorAll(".bloque-hora").forEach(b => b.classList.remove("active"));
}

function sumar30Min(hora) {
  const [h, m] = hora.split(":").map(Number);
  const date = new Date();
  date.setHours(h);
  date.setMinutes(m + 30);
  return `${String(date.getHours()).padStart(2,"0")}:${String(date.getMinutes()).padStart(2,"0")}`;
}

function crearReserva(horaInicio) {
  const fecha = fechaSeleccionada.toISOString().split("T")[0];
  const pistaId = pistaActual();
  const duracion = duracionActual();
  const email = emailActual();

  const bloquesNecesarios = duracion / 30;
  const [h, m] = horaInicio.split(":").map(Number);
  const inicioMin = h * 60 + m;
  const bloques = [];

  for (let i = 0; i < bloquesNecesarios; i++) {
    const min = inicioMin + i*30;
    bloques.push(`${String(Math.floor(min/60)).padStart(2,"0")}:${String(min%60).padStart(2,"0")}`);
  }

  reservas.push({ fecha, pistaId, bloques, email });
}

function mostrarReservas() {
  const ul = document.getElementById("reservasUl");
  ul.innerHTML = "";

  const email = emailActual();
  reservas.filter(r => r.email === email).forEach(r => {
    const li = document.createElement("li");
    const inicio = r.bloques[0];
    const fin = sumar30Min(r.bloques[r.bloques.length - 1]);

    li.innerHTML = `
      ${r.fecha} · ${r.pistaId === "A" ? "Tenis" : "Pádel"} · ${inicio} – ${fin}
      <button>❌</button>
    `;

    li.querySelector("button").onclick = () => {
      const idx = reservas.indexOf(r);
      if (idx > -1) reservas.splice(idx, 1);
      generarHorarios(fechaSeleccionada);
      mostrarReservas();
    };

    ul.appendChild(li);
  });
}

btnConfirmar.addEventListener("click", () => {
  if (!horaSeleccionada || !fechaSeleccionada) return;

  const reservasActivas = contarReservasActivasUsuario();
  if (reservasActivas >= LIMITE_RESERVAS) {
    alert(`Has alcanzado el límite de ${LIMITE_RESERVAS} reservas en los próximos ${DIAS_VENTANA} días.\n\nCancela alguna reserva antes de hacer una nueva.`);
    return;
  }

  crearReserva(horaSeleccionada);
  resetearSeleccion();
  generarHorarios(fechaSeleccionada);
  mostrarReservas();
});

/* ===== CERRAR SESIÓN ===== */
document.addEventListener("DOMContentLoaded", () => {
  const btnCerrar = document.getElementById("cerrarSesion");
  btnCerrar.addEventListener("click", () => {
    localStorage.removeItem("emailUsuario");
    location.reload();
  });
});

/* ===== PANEL DE SOCIOS (SOLO ADMIN) ===== */
function mostrarPanelSocios() {
  const panel = document.getElementById("panelSocios");
  if (emailActual() === ADMIN_EMAIL) {
    panel.style.display = "block";
    actualizarListaSocios();
  } else {
    panel.style.display = "none";
  }
}

async function obtenerSocios() {
  const res = await fetch("/api/socios");
  return await res.json();
}

async function actualizarListaSocios() {
  const lista = document.getElementById("listaSocios");
  lista.innerHTML = "";
  const socios = await obtenerSocios();
  socios.forEach(email => {
    const li = document.createElement("li");
    li.textContent = email + " ";
    const btnEliminar = document.createElement("button");
    btnEliminar.textContent = "❌";
    btnEliminar.addEventListener("click", async () => {
      await fetch("/api/socios", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      actualizarListaSocios();
    });
    li.appendChild(btnEliminar);
    lista.appendChild(li);
  });
}

document.getElementById("btnAgregarSocio").addEventListener("click", async () => {
  const input = document.getElementById("nuevoSocioInput");
  const email = input.value.trim();
  if (!email) return;
  await fetch("/api/socios", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email })
  });
  input.value = "";
  actualizarListaSocios();
});
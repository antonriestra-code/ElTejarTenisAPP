console.log("APP JS COMPLETO CARGADO");

// ======================= VARIABLES =======================
let usuario = null;          // email
let usuarioNombre = null;    // solo visual
let reservas = [];
let fechaSeleccionada = null;
let pistaSeleccionada = null;
let horaSeleccionada = null;
let duracionSeleccionada = 60; // duración por defecto
let limites = { maxReservas: 4, diasAnticipacion: 15 };

// ======================= UTILIDADES =======================
function convertirHoraAMinutos(hora) {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

// Comprueba solapamiento de horas
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

// ======================= LOGIN =======================
async function login() {
  const email = document.getElementById("email").value.trim();
  const passwordInput = document.getElementById("password");

  if (!email) return alert("Introduce correo");

  if (email === "admin@eltejar.com") {
    passwordInput.style.display = "block";
    if (!passwordInput.value) return alert("Introduce contraseña");
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: passwordInput.value })
    });
    if (!res.ok) return alert("Contraseña incorrecta");
    window.location = "/admin.html";
    return;
  }

  const res = await fetch("/api/socios");
  const socios = await res.json();
  const socio = socios.find(s => s.email.trim().toLowerCase() === email.toLowerCase());
  if (!socio) return alert("No autorizado");

  usuario = email.toLowerCase();
  usuarioNombre = socio.nombre;

  document.getElementById("login").style.display = "none";
  document.getElementById("app").style.display = "block";
  renderBienvenida();

  await cargarLimites();
  await cargarReservas();
}

// ======================= MENSAJE BIENVENIDA =======================
function renderBienvenida() {
  const cont = document.getElementById("bienvenida");
  if (!cont) return;

  const ancho = window.innerWidth;
  if (ancho < 500) {
    cont.textContent = `Hola, ${usuarioNombre}`;
  } else {
    cont.textContent = `Hola, ${usuarioNombre}. Este es el sistema de reservas del Club Deportivo El Tejar.`;
  }
}

// ======================= LOGOUT =======================
function logout() {
  usuario = null;
  usuarioNombre = null;
  reservas = [];
  fechaSeleccionada = null;
  pistaSeleccionada = null;
  horaSeleccionada = null;
  document.getElementById("app").style.display = "none";
  document.getElementById("login").style.display = "block";
  document.getElementById("email").value = "";
  document.getElementById("password").value = "";
  document.getElementById("password").style.display = "none";
  document.getElementById("fechas").innerHTML = "";
  document.getElementById("horas").innerHTML = "";
  document.getElementById("misReservas").innerHTML = "";
}

// ======================= CARGA DE LÍMITES =======================
async function cargarLimites() {
  try {
    const res = await fetch("/api/limites");
    if (!res.ok) throw new Error("No se pudieron cargar los límites");
    const data = await res.json();
    limites = data;
    generarFechas(); // actualizar número de días que se muestran
  } catch (e) {
    console.error(e);
  }
}

// ======================= CARGA RESERVAS =======================
async function cargarReservas() {
  try {
    const res = await fetch("/api/reservas");
    reservas = res.ok ? await res.json() : [];
    if (!Array.isArray(reservas)) reservas = [];
  } catch (e) {
    reservas = [];
  }
  generarFechas();
  renderMisReservas();
}

// ======================= GENERAR FECHAS =======================
function generarFechas() {
  const cont = document.getElementById("fechas");
  if (!cont) return;
  cont.innerHTML = "";

  const dias = limites.diasAnticipacion || 15;

  for (let i = 0; i < dias; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const fecha = d.toISOString().split("T")[0];
    const btn = document.createElement("button");
    btn.className = "fecha-btn";
    btn.innerHTML = `<small>${d.toLocaleDateString("es-ES",{weekday:"short"})}</small><br>
                     <strong>${d.getDate()}</strong><br>
                     <small>${d.toLocaleDateString("es-ES",{month:"short"})}</small>`;
    btn.onclick = () => {
      document.querySelectorAll(".fecha-btn").forEach(b => b.classList.remove("seleccionado"));
      btn.classList.add("seleccionado");
      fechaSeleccionada = fecha;
      generarHoras();
    };
    cont.appendChild(btn);
  }
}

// ======================= PISTA =======================
function seleccionarPista(p) {
  pistaSeleccionada = p;
  document.getElementById("btnTenis").classList.remove("seleccionado");
  document.getElementById("btnPadel").classList.remove("seleccionado");
  document.getElementById("btn" + p).classList.add("seleccionado");
  generarHoras();
}

// ======================= DURACIÓN =======================
function seleccionarDuracion(minutos) {
  duracionSeleccionada = minutos;
  horaSeleccionada = null;
  document.querySelectorAll(".duracion-btn").forEach(b => b.classList.remove("seleccionado"));
  event.target.classList.add("seleccionado");
  generarHoras();
}

// ======================= GENERAR HORAS =======================
function generarHoras() {
  const cont = document.getElementById("horas");
  const section = document.getElementById("horarioSection");
  const selector = document.getElementById("duracion");
  if (selector) duracionSeleccionada = parseInt(selector.value);

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
      r.email && haySolapamiento(r, fechaSeleccionada, pistaSeleccionada, hora, duracionSeleccionada)
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

// ======================= CONFIRMAR RESERVA =======================
async function confirmarReserva() {
  if (!fechaSeleccionada || !pistaSeleccionada || !horaSeleccionada)
    return alert("Selecciona fecha, pista y hora");

  const hoyStr = new Date().toISOString().split("T")[0];
  const reservasFuturas = reservas.filter(r => r.fecha >= hoyStr && r.email === usuario);

  if (reservasFuturas.length >= limites.maxReservas) {
    return alert(`Has alcanzado el número máximo de ${limites.maxReservas} reservas activas para los próximos ${limites.diasAnticipacion} días.`);
  }

  const res = await fetch("/api/reservas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: usuario,
      fecha: fechaSeleccionada,
      pista: pistaSeleccionada,
      hora: horaSeleccionada,
      duracion: duracionSeleccionada
    })
  });

  if (!res.ok) {
    const data = await res.json();
    return alert(data.error || "Error al confirmar reserva");
  }

  const fechaObj = new Date(fechaSeleccionada);
  const fechaBonita = fechaObj.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
  const fechaFormateada = fechaBonita.charAt(0).toUpperCase() + fechaBonita.slice(1);

  alert(`Confirmada la reserva en la pista de ${pistaSeleccionada} para el ${fechaFormateada}, a las ${horaSeleccionada}. Recuerde cancelarla si finalmente no pudiera asistir. Gracias por utilizar el sistema de reservas del Club Deportivo El Tejar.`);

  // Limpiamos selección
  fechaSeleccionada = null;
  pistaSeleccionada = null;
  horaSeleccionada = null;
  document.querySelectorAll(".seleccionado").forEach(el => el.classList.remove("seleccionado"));

  await cargarReservas();
}

// ======================= RENDER MIS RESERVAS =======================
function renderMisReservas() {
  const cont = document.getElementById("misReservas");
  if (!cont) return;
  cont.innerHTML = "";

  if (!usuario) return;

  const hoyStr = new Date().toISOString().split("T")[0];
  const mias = reservas.filter(r => r.email && r.email === usuario && r.fecha >= hoyStr);

  if (mias.length === 0) {
    cont.innerHTML = "<p>No tienes reservas activas.</p>";
    return;
  }

  mias.forEach(r => {
    const fechaObj = new Date(r.fecha);
    const fechaBonita = fechaObj.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
    const fechaFormateada = fechaBonita.charAt(0).toUpperCase() + fechaBonita.slice(1);

    const row = document.createElement("div");
    row.className = "reserva-linea";
    row.innerHTML = `<span>${fechaFormateada}</span>
                     <span>${r.hora}</span>
                     <span>${r.pista === "Padel" ? "P" : "T"}</span>
                     <span>${r.duracion} min</span>
                     <button class="cancelar-btn">Cancelar</button>`;
    row.querySelector("button").onclick = async () => {
      await fetch("/api/reservas/" + r.id, { method: "DELETE" });
      await cargarReservas();
    };
    cont.appendChild(row);
  });
}

// ======================= DOM READY =======================
document.addEventListener("DOMContentLoaded", () => {
  const selector = document.getElementById("duracion");
  if (selector) {
    selector.addEventListener("change", e => {
      duracionSeleccionada = parseInt(e.target.value);
      horaSeleccionada = null;
      generarHoras();
    });
  }

  window.addEventListener("resize", renderBienvenida);
});

// ======================= EXPORTS =======================
window.login = login;
window.logout = logout;
window.seleccionarPista = seleccionarPista;
window.seleccionarDuracion = seleccionarDuracion;
window.confirmarReserva = confirmarReserva;


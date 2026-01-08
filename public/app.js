/********************************************************
 * ESTADO GLOBAL
 ********************************************************/

let emailUsuario = null;
let rolUsuario = null; // "admin" | "socio"

let fechaSeleccionada = null;
let horaSeleccionada = null;

let reservas = [];
let socios = [];

const LIMITE_RESERVAS = 5;
const DIAS_VENTANA = 14;

/********************************************************
 * HELPERS
 ********************************************************/

function $(id) {
  return document.getElementById(id);
}

function pistaActual() {
  return document.querySelector(".pista-btn.active")?.dataset.pista || "A";
}

function duracionActual() {
  return Number(document.querySelector(".duracion-btn.active")?.dataset.duracion || 60);
}

function sumarMinutos(hora, minutos) {
  const [h, m] = hora.split(":").map(Number);
  const d = new Date();
  d.setHours(h);
  d.setMinutes(m + minutos);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function resetearSeleccion() {
  horaSeleccionada = null;
  $("confirmarReserva").disabled = true;
  document.querySelectorAll(".bloque-hora").forEach(b => b.classList.remove("active"));
}

/********************************************************
 * LOGIN
 ********************************************************/

async function cargarSocios() {
  const res = await fetch("/api/socios");
  socios = await res.json();
}

$("btnAcceder").addEventListener("click", async () => {
  const email = $("emailInput").value.trim().toLowerCase();
  if (!email) return;

  await cargarSocios();

  const socio = socios.find(s => s.email === email);
  if (!socio) {
    $("loginError").style.display = "block";
    return;
  }

  emailUsuario = socio.email;
  rolUsuario = socio.rol;

  $("login").style.display = "none";
  $("app").style.display = "block";

  if (rolUsuario === "admin") {
    $("panelSocios").style.display = "block";
    renderSocios();
  }

  await cargarReservas();
  generarSelectorFechas();
  mostrarReservas();
});

/********************************************************
 * SOCIOS (solo admin)
 ********************************************************/

function renderSocios() {
  const ul = $("listaSocios");
  ul.innerHTML = "";

  socios.forEach((s, idx) => {
    const li = document.createElement("li");
    li.innerHTML = `
      ${s.email} (${s.rol})
      <button>❌</button>
    `;
    li.querySelector("button").onclick = async () => {
      if (s.rol === "admin") {
        alert("No puedes borrar el admin");
        return;
      }
      socios.splice(idx, 1);
      await fetch("/api/socios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(socios)
      });
      renderSocios();
    };
    ul.appendChild(li);
  });
}

$("btnAgregarSocio").addEventListener("click", async () => {
  const email = $("nuevoSocioInput").value.trim().toLowerCase();
  if (!email) return;

  if (socios.some(s => s.email === email)) return;

  socios.push({ email, rol: "socio" });

  await fetch("/api/socios", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(socios)
  });

  $("nuevoSocioInput").value = "";
  renderSocios();
});

/********************************************************
 * FECHAS
 ********************************************************/

function generarSelectorFechas() {
  const cont = $("selectorFechas");
  cont.innerHTML = "";

  const hoy = new Date();

  for (let i = 0; i < 15; i++) {
    const f = new Date();
    f.setDate(hoy.getDate() + i);

    const btn = document.createElement("button");
    btn.className = "fecha-btn";
    btn.innerHTML = `
      ${f.toLocaleDateString("es-ES", { weekday: "short" })}<br>
      <strong>${f.getDate()}</strong><br>
      ${f.toLocaleDateString("es-ES", { month: "short" })}
    `;

    btn.onclick = () => {
      document.querySelectorAll(".fecha-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      fechaSeleccionada = f;
      generarHorarios();
    };

    cont.appendChild(btn);

    if (i === 0) {
      btn.classList.add("active");
      fechaSeleccionada = f;
    }
  }

  generarHorarios();
}

/********************************************************
 * HORARIOS
 ********************************************************/

function generarBloques(tramos) {
  const bloques = [];
  tramos.forEach(([ini, fin]) => {
    let m = Number(ini.split(":")[0]) * 60 + Number(ini.split(":")[1]);
    const finM = Number(fin.split(":")[0]) * 60 + Number(fin.split(":")[1]);
    while (m < finM) {
      bloques.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
      m += 30;
    }
  });
  return bloques;
}

function disponible(hora, fechaStr, pista) {
  const dur = duracionActual();
  const bloquesNecesarios = dur / 30;

  for (let i = 0; i < bloquesNecesarios; i++) {
    const h = sumarMinutos(hora, i * 30);
    if (reservas.some(r =>
      r.fecha === fechaStr &&
      r.pistaId === pista &&
      r.bloques.includes(h)
    )) return false;
  }
  return true;
}

function generarHorarios() {
  const cal = $("calendario");
  cal.innerHTML = "";
  resetearSeleccion();

  if (!fechaSeleccionada) return;

  const fechaStr = fechaSeleccionada.toISOString().split("T")[0];
  const pista = pistaActual();

  const tramos =
    fechaSeleccionada.getDay() === 0 || fechaSeleccionada.getDay() === 6
      ? [["09:00", "13:00"], ["17:00", "22:00"]]
      : [["09:00", "13:00"], ["17:30", "22:00"]];

  generarBloques(tramos)
    .filter(h => disponible(h, fechaStr, pista))
    .forEach(h => {
      const btn = document.createElement("button");
      btn.className = "bloque-hora";
      btn.textContent = h;
      btn.onclick = () => {
        document.querySelectorAll(".bloque-hora").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        horaSeleccionada = h;
        $("confirmarReserva").disabled = false;
      };
      cal.appendChild(btn);
    });
}

/********************************************************
 * RESERVAS
 ********************************************************/

async function cargarReservas() {
  const res = await fetch("/api/reservas");
  reservas = await res.json();
}

function contarReservasActivas() {
  const hoy = new Date();
  const fin = new Date();
  fin.setDate(hoy.getDate() + DIAS_VENTANA);

  return reservas.filter(r => {
    if (r.email !== emailUsuario) return false;
    const f = new Date(r.fecha);
    return f >= hoy && f <= fin;
  }).length;
}

$("confirmarReserva").onclick = async () => {
  if (!horaSeleccionada || !fechaSeleccionada) return;

  if (contarReservasActivas() >= LIMITE_RESERVAS) {
    alert("Has alcanzado el límite de reservas");
    return;
  }

  const bloques = [];
  const dur = duracionActual();

  for (let i = 0; i < dur / 30; i++) {
    bloques.push(sumarMinutos(horaSeleccionada, i * 30));
  }

  const reserva = {
    fecha: fechaSeleccionada.toISOString().split("T")[0],
    pistaId: pistaActual(),
    bloques,
    email: emailUsuario
  };

  await fetch("/api/reservas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(reserva)
  });

  await cargarReservas();
  generarHorarios();
  mostrarReservas();
};

function mostrarReservas() {
  const ul = $("reservasUl");
  ul.innerHTML = "";

  reservas
    .filter(r => r.email === emailUsuario)
    .forEach((r, idx) => {
      const li = document.createElement("li");
      const inicio = r.bloques[0];
      const fin = sumarMinutos(r.bloques[r.bloques.length - 1], 30);

      li.innerHTML = `
        ${r.fecha} · ${r.pistaId === "A" ? "Tenis" : "Pádel"} · ${inicio} – ${fin}
        <button>❌</button>
      `;

      li.querySelector("button").onclick = async () => {
        await fetch(`/api/reservas/${idx}`, { method: "DELETE" });
        await cargarReservas();
        generarHorarios();
        mostrarReservas();
      };

      ul.appendChild(li);
    });
}

/********************************************************
 * CERRAR SESIÓN
 ********************************************************/

$("cerrarSesion").onclick = () => location.reload();
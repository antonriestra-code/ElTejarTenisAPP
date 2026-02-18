console.log("ADMIN JS CARGADO");

// -------------------- TABS --------------------
const tabButtons = document.querySelectorAll(".tab-btn");
const tabContents = document.querySelectorAll(".tab-content");
tabButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    tabButtons.forEach(b => b.classList.remove("seleccionado"));
    btn.classList.add("seleccionado");
    tabContents.forEach(tc => tc.style.display = "none");
    document.getElementById(btn.dataset.tab).style.display = "block";
  });
});

// -------------------- GENERAR HORAS --------------------
function generarHoras(selectId){
  const select = document.getElementById(selectId);
  select.innerHTML = "";
  for(let h=9; h<=21; h++){
    ["00","30"].forEach(m=>{
      select.innerHTML += `<option value="${h.toString().padStart(2,"0")}:${m}">${h.toString().padStart(2,"0")}:${m}</option>`;
    });
  }
}
generarHoras("espHora");
generarHoras("espHoraRec");

// -------------------- RESERVAS --------------------
async function cargarReservasAdmin(){
  let res = await fetch("/api/reservas");
  let reservas = await res.json();
  const filtro = document.getElementById("filtroFechaReserva").value;
  if(filtro) reservas = reservas.filter(r => r.fecha === filtro);
  reservas.sort((a,b) => new Date(a.fecha+" "+a.hora) - new Date(b.fecha+" "+b.hora));
  const cont = document.getElementById("tablaReservas");
  cont.innerHTML = "";
  reservas.forEach(r => {
    const row = document.createElement("div");
    row.className = "reserva-linea";
    if(r.email.includes("REVISAR")){
      row.style.background = "rgba(255,0,0,0.3)";
    }
    row.innerHTML = `
      <span>${r.email}</span>
      <span>${r.fecha}</span>
      <span>${r.hora}</span>
      <span>${r.pista}</span>
      <span>${r.duracion} min</span>
      <button class="cancelar-btn">Eliminar</button>
    `;
    row.querySelector("button").onclick = async () => {
      await fetch("/api/reservas/" + r.id, { method:"DELETE" });
      cargarReservasAdmin();
    };
    cont.appendChild(row);
  });
}

// -------------------- RESERVAS ESPECIALES --------------------
async function crearEspecialPuntual(){
  const fecha = espFecha.value;
  const hora = espHora.value;
  const pista = espPista.value;
  const duracion = parseInt(espDuracion.value);
  if(!fecha) return alert("Selecciona fecha");
  const res = await fetch("/api/admin/reserva-especial", {
    method:"POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ fecha, hora, pista, duracion, tipo:"puntual" })
  });
  if(res.ok) alert("Reserva puntual creada correctamente");
  cargarReservasAdmin();
}

async function crearEspecialRecurrente(){
  const dia = parseInt(espDiaSemana.value);
  const desde = espDesde.value;
  const hasta = espHasta.value;
  const hora = espHoraRec.value;
  const pista = espPistaRec.value;
  const duracion = parseInt(espDuracionRec.value);
  if(!desde || !hasta) return alert("Selecciona rango");
  let current = new Date(desde);
  const end = new Date(hasta);
  while(current <= end){
    if(current.getDay() === dia){
      const fechaStr = current.toISOString().split("T")[0];
      await fetch("/api/admin/reserva-especial", {
        method:"POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ fecha:fechaStr, hora, pista, duracion, tipo:"recurrente" })
      });
    }
    current.setDate(current.getDate()+1);
  }
  alert("Reservas recurrentes creadas correctamente");
  cargarReservasAdmin();
}

// -------------------- EXPORT CSV --------------------
function exportarCSV(){ window.open("/api/export","_blank"); }

// -------------------- SOCIOS / CURSOS --------------------
async function cargarSocios(){
  const res = await fetch("/api/socios");
  const socios = await res.json();
  const cont = document.getElementById("tablaSocios");
  cont.innerHTML = "";
  socios.forEach(s=>{
    const row = document.createElement("div");
    row.className = "reserva-linea";
    row.innerHTML = `<span>${s.nombre || ""}</span><span>${s.email}</span><button class="cancelar-btn">Eliminar</button>`;
    row.querySelector("button").onclick = async ()=>{ await fetch("/api/socios/" + s.email, { method:"DELETE" }); cargarSocios(); };
    cont.appendChild(row);
  });
}

async function crearSocio(){
  const email = nuevoEmail.value.trim();
  const nombre = nuevoNombre.value.trim();
  if(!email || !nombre) return alert("Email y nombre obligatorios");
  await fetch("/api/socios", { method:"POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({email,nombre}) });
  nuevoEmail.value = ""; nuevoNombre.value = "";
  cargarSocios();
}

async function cargarCursos(){
  const res = await fetch("/api/cursos");
  if(res.status!==200) return;
  const cursos = await res.json();
  const cont = document.getElementById("tablaCursos");
  cont.innerHTML = "";
  cursos.forEach(c=>{
    const row = document.createElement("div");
    row.className = "reserva-linea";
    row.innerHTML = `<span>${c.nombre}</span><span>${c.descripcion}</span><span>${c.fecha_inicio}</span><span>${c.fecha_fin}</span><span>${c.precio}</span><span>${c.profesor}</span><span>${c.telefono}</span><button class="cancelar-btn">Eliminar</button>`;
    row.querySelector("button").onclick = async ()=>{ await fetch("/api/cursos/" + c.id, { method:"DELETE" }); cargarCursos(); };
    cont.appendChild(row);
  });
}

async function crearCurso(){
  const nombre = cursoNombre.value.trim();
  if(!nombre) return alert("Nombre obligatorio");
  await fetch("/api/cursos", {
    method:"POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ nombre, descripcion:cursoDescripcion.value, fecha_inicio:cursoInicio.value, fecha_fin:cursoFin.value, precio:parseFloat(cursoPrecio.value), profesor:cursoProfesor.value, telefono:cursoTelefono.value })
  });
  cargarCursos();
}

// -------------------- LIMITES --------------------
async function cargarLimites(){
  const res = await fetch("/api/limites");
  if(!res.ok) return;
  const data = await res.json();
  maxReservasInput.value = data.maxReservas;
  diasAntInput.value = data.diasAnticipacion;
}
async function actualizarLimites(){
  const max = parseInt(maxReservasInput.value);
  const dias = parseInt(diasAntInput.value);
  if(isNaN(max) || isNaN(dias)) return alert("Valores inválidos");
  const res = await fetch("/api/limites", {
    method:"POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ maxReservas:max, diasAnticipacion:dias })
  });
  if(res.ok) alert("Límites actualizados correctamente");
}

// -------------------- LOGOUT --------------------
function logoutAdmin(){ window.location = "/"; }

// -------------------- INIT --------------------
cargarReservasAdmin();
cargarSocios();
cargarCursos();
cargarLimites();

console.log("APP NUEVA CARGADA");

let usuario = null;        // email (no lo tocamos)
let usuarioNombre = null;  // solo visual

let reservas = [];
let fechaSeleccionada = null;
let pistaSeleccionada = null;
let horaSeleccionada = null;

/* ================= LOGIN ================= */

async function login() {

  const email = document.getElementById("email").value.trim();
  const passwordInput = document.getElementById("password");

  if (!email) return alert("Introduce correo");

  if (email === "admin@eltejar.com") {

    passwordInput.style.display = "block";
    if (!passwordInput.value) return alert("Introduce contraseña");

    const res = await fetch("/api/admin/login", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({email,password:passwordInput.value})
    });

    if(!res.ok) return alert("Contraseña incorrecta");

    window.location = "/admin.html";
    return;
  }

  // LOGIN SOCIOS

  const res = await fetch("/api/socios");
  const socios = await res.json();

  const socio = socios.find(s =>
    s.email.trim().toLowerCase() === email.toLowerCase()
  );

  if(!socio) return alert("No autorizado");

  usuario = email.toLowerCase();
  usuarioNombre = socio.nombre;

  document.getElementById("login").style.display="none";
  document.getElementById("app").style.display="block";

  document.getElementById("bienvenida").textContent =
    "Hola, " + usuarioNombre + ". Este es el sistema de reservas del Club Deportivo El Tejar.";

  await cargarReservas();
}

/* ================= LOGOUT ================= */

function logout(){
  usuario = null;
  usuarioNombre = null;
  reservas = [];
  fechaSeleccionada = null;
  pistaSeleccionada = null;
  horaSeleccionada = null;

  document.getElementById("app").style.display="none";
  document.getElementById("login").style.display="block";

  document.getElementById("email").value="";
  document.getElementById("password").value="";
  document.getElementById("password").style.display="none";

  document.getElementById("fechas").innerHTML="";
  document.getElementById("horas").innerHTML="";
  document.getElementById("misReservas").innerHTML="";
}

/* ================= CARGAR RESERVAS ================= */

async function cargarReservas(){
  try{
    const res = await fetch("/api/reservas");
    reservas = res.ok ? await res.json() : [];
    if(!Array.isArray(reservas)) reservas=[];
  }catch(e){
    reservas=[];
  }

  generarFechas();
  renderMisReservas();
}

/* ================= FECHAS ================= */

function generarFechas(){
  const cont=document.getElementById("fechas");
  cont.innerHTML="";

  for(let i=0;i<15;i++){
    const d=new Date();
    d.setDate(d.getDate()+i);

    const fecha=d.toISOString().split("T")[0];
    const btn=document.createElement("button");
    btn.className="fecha-btn";

    btn.innerHTML=`
      <small>${d.toLocaleDateString("es-ES",{weekday:"short"})}</small><br>
      <strong>${d.getDate()}</strong><br>
      <small>${d.toLocaleDateString("es-ES",{month:"short"})}</small>
    `;

    btn.onclick=()=>{
      document.querySelectorAll(".fecha-btn").forEach(b=>b.classList.remove("seleccionado"));
      btn.classList.add("seleccionado");
      fechaSeleccionada=fecha;
      generarHoras();
    };

    cont.appendChild(btn);
  }
}

/* ================= PISTAS ================= */

function seleccionarPista(p){
  pistaSeleccionada=p;

  document.getElementById("btnTenis").classList.remove("seleccionado");
  document.getElementById("btnPadel").classList.remove("seleccionado");
  document.getElementById("btn"+p).classList.add("seleccionado");

  generarHoras();
}

/* ================= HORAS ================= */

function generarHoras(){
  const cont=document.getElementById("horas");
  cont.innerHTML="";
  if(!fechaSeleccionada||!pistaSeleccionada)return;

for(let h=9; h<=21; h++){

  // ⛔ BLOQUE HORARIO CENTRAL NO RESERVABLE
  if(h >= 13 && h < 17){
    continue; // salta esas horas
  }

  const hora=(h<10?"0"+h:h)+":00";

    const btn=document.createElement("button");
    btn.className="hora-btn";
    btn.textContent=hora;

    const ocupada=reservas.find(r=>
      r.fecha===fechaSeleccionada &&
      r.pista===pistaSeleccionada &&
      r.hora===hora
    );

    if(ocupada){
      btn.classList.add("ocupado");
      btn.disabled=true;
    }

    btn.onclick=()=>{
      document.querySelectorAll(".hora-btn").forEach(b=>b.classList.remove("seleccionado"));
      btn.classList.add("seleccionado");
      horaSeleccionada=hora;
    };

    cont.appendChild(btn);
  }
}

/* ================= CONFIRMAR ================= */

async function confirmarReserva(){

  if(!fechaSeleccionada || !pistaSeleccionada || !horaSeleccionada)
    return alert("Selecciona fecha, pista y hora");

  const res = await fetch("/api/reservas",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      email:usuario,
      fecha:fechaSeleccionada,
      pista:pistaSeleccionada,
      hora:horaSeleccionada
    })
  });

  if(!res.ok){
  const data = await res.json();
  return alert(data.error || "Error al confirmar");
}

  const fechaObj = new Date(fechaSeleccionada);
  const fechaBonita = fechaObj.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long"
  });
  const fechaFormateada =
    fechaBonita.charAt(0).toUpperCase() + fechaBonita.slice(1);

  alert(
`Confirmada la reserva en la pista de ${pistaSeleccionada}
para el ${fechaFormateada},
a las ${horaSeleccionada}.

Recuerde cancelarla si finalmente no pudiera asistir.

Gracias por utilizar el sistema de reservas del Club Deportivo El Tejar.`
  );

  await cargarReservas();

  // 🔹 Limpiamos selección
  fechaSeleccionada = null;
  pistaSeleccionada = null;
  horaSeleccionada = null;

  // 🔹 Opcional pero MUY recomendable:
  document.querySelectorAll(".seleccionado")
    .forEach(el => el.classList.remove("seleccionado"));
}


/* ================= MIS RESERVAS ================= */

function renderMisReservas(){

  const cont = document.getElementById("misReservas");
  cont.innerHTML = "";

  if(!usuario) return;

  const mias = reservas.filter(r =>
    r.email &&
    r.email.trim().toLowerCase() === usuario
  );

  if(mias.length === 0){
    cont.innerHTML = "<p>No tienes reservas activas.</p>";
    return;
  }

  mias.forEach(r => {

    const fechaObj = new Date(r.fecha);

    const fechaBonita = fechaObj.toLocaleDateString("es-ES", {
      weekday: "long",
      day: "numeric",
      month: "long"
    });

    const fechaFormateada =
      fechaBonita.charAt(0).toUpperCase() + fechaBonita.slice(1);

    const row = document.createElement("div");
    row.className = "reserva-linea";

    row.innerHTML = `
      <span>${fechaFormateada}</span>
      <span>${r.hora}</span>
      <span>${r.pista}</span>
      <button class="cancelar-btn">Cancelar</button>
    `;

    row.querySelector("button").onclick = async () => {
      await fetch("/api/reservas/" + r.id, { method:"DELETE" });
      await cargarReservas();
    };

    cont.appendChild(row);
  });
}

window.login = login;
window.logout = logout;
window.seleccionarPista = seleccionarPista;
window.confirmarReserva = confirmarReserva;

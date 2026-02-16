async function cargarReservasAdmin(){

  const fechaFiltro = document.getElementById("filtroFecha").value;

  const res = await fetch("/api/reservas");
  let reservas = await res.json();

  if(fechaFiltro){
    reservas = reservas.filter(r => r.fecha === fechaFiltro);
  }

  const cont = document.getElementById("tablaReservas");
  cont.innerHTML = "";

  reservas.sort((a,b)=> new Date(a.fecha+" "+a.hora) - new Date(b.fecha+" "+b.hora));

  reservas.forEach(r => {

    const row = document.createElement("div");
    row.className = "reserva-linea";

    row.innerHTML = `
      <span>${r.email}</span>
      <span>${r.fecha}</span>
      <span>${r.hora}</span>
      <span>${r.pista}</span>
      <button class="cancelar-btn">Eliminar</button>
    `;

    row.querySelector("button").onclick = async () => {
      await fetch("/api/reservas/" + r.id, { method:"DELETE" });
      await cargarReservasAdmin();
    };

    cont.appendChild(row);
  });
}

function exportarCSV(){
  window.location = "/api/export";
}

function logoutAdmin(){
  window.location = "/";
}

cargarReservasAdmin();

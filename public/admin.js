console.log("ADMIN JS CARGADO OK");

// -------------------- TABS --------------------
const tabButtons = document.querySelectorAll(".tab-btn");
const tabContents = document.querySelectorAll(".tab-content");

tabButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    tabButtons.forEach(b => b.classList.remove("seleccionado"));
    btn.classList.add("seleccionado");
    tabContents.forEach(tc => tc.style.display = "none");
    document.getElementById(btn.dataset.tab).style.display = "block";
    // Ocultar sección de inscritos al cambiar de tab para evitar confusión
    const seccionIns = document.getElementById("seccionInscritosDinamica");
    if (seccionIns) seccionIns.style.display = "none";
  });
});

// -------------------- GENERAR HORAS --------------------
function generarHoras(selectId) {
  const select = document.getElementById(selectId);
  if (!select) return;
  select.innerHTML = "";
  for (let h = 9; h <= 21; h++) {
    ["00", "30"].forEach(m => {
      const hora = `${h.toString().padStart(2, "0")}:${m}`;
      select.innerHTML += `<option value="${hora}">${hora}</option>`;
    });
  }
}
generarHoras("espHora");
generarHoras("espHoraRec");

// =====================================================
// ==================== RESERVAS =======================
// =====================================================

async function cargarReservasAdmin() {
  try {
    const res = await fetch("/api/reservas");
    if (!res.ok) throw new Error("Error cargando reservas");
    let reservas = await res.json();

    const filtro = document.getElementById("filtroFechaReserva")?.value;
    if (filtro) reservas = reservas.filter(r => r.fecha === filtro);

    reservas.sort((a, b) =>
      new Date(a.fecha + " " + a.hora) - new Date(b.fecha + " " + b.hora)
    );

    const cont = document.getElementById("tablaReservas");
    if (!cont) return;
    cont.innerHTML = "";

    reservas.forEach(r => {
      const row = document.createElement("div");
      row.className = "reserva-linea";

      if (r.email?.includes("REVISAR")) {
        row.classList.add("conflictiva");
      }

      row.innerHTML = `
        <span title="${r.email}">${r.email}</span>
        <span>${r.fecha}</span>
        <span>${r.hora}</span>
        <span>${r.pista}</span>
        <span>${r.duracion} min</span>
        <span><button class="cancelar-btn">Eliminar</button></span>
      `;

      row.querySelector("button").onclick = async () => {
        if (confirm("¿Eliminar esta reserva?")) {
          await fetch("/api/reservas/" + r.id, { method: "DELETE" });
          cargarReservasAdmin();
        }
      };

      cont.appendChild(row);
    });

  } catch (err) {
    console.error("Error reservas:", err);
  }
}

// =====================================================
// ================= RESERVAS ESPECIALES ===============
// =====================================================

async function crearEspecialPuntual() {
  try {
    const fecha = espFecha.value;
    const hora = espHora.value;
    const pista = espPista.value;
    const duracion = parseInt(espDuracion.value);

    if (!fecha) return alert("Selecciona fecha");

    const res = await fetch("/api/admin/reserva-especial", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fecha, hora, pista, duracion, tipo: "puntual" })
    });

    if (!res.ok) throw new Error("Error creando reserva puntual");

    alert("Reserva puntual creada correctamente");
    cargarReservasAdmin();

  } catch (err) {
    console.error(err);
    alert("Error al crear reserva puntual");
  }
}

async function crearEspecialRecurrente() {
  try {
    const dia = parseInt(espDiaSemana.value);
    const desde = espDesde.value;
    const hasta = espHasta.value;
    const hora = espHoraRec.value;
    const pista = espPistaRec.value;
    const duracion = parseInt(espDuracionRec.value);

    if (!desde || !hasta) return alert("Selecciona rango de fechas");

    let current = new Date(desde);
    const end = new Date(hasta);

    while (current <= end) {
      if (current.getDay() === dia) {
        const fechaStr = current.toISOString().split("T")[0];
        await fetch("/api/admin/reserva-especial", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fecha: fechaStr, hora, pista, duracion, tipo: "recurrente" })
        });
      }
      current.setDate(current.getDate() + 1);
    }

    alert("Reservas recurrentes creadas correctamente");
    cargarReservasAdmin();

  } catch (err) {
    console.error(err);
    alert("Error en reservas recurrentes");
  }
}

// =====================================================
// ===================== SOCIOS ========================
// =====================================================

async function cargarSocios() {
  try {
    const res = await fetch("/api/socios");
    if (!res.ok) throw new Error("Error cargando socios");

    const socios = await res.json();
    const cont = document.getElementById("tablaSocios");
    if (!cont) return;

    cont.innerHTML = "";

    socios.forEach(s => {
      const row = document.createElement("div");
      row.className = "reserva-linea";
      row.innerHTML = `
        <span>${s.nombre || ""}</span>
        <span>${s.email}</span>
        <button class="cancelar-btn">Eliminar</button>
      `;

      row.querySelector("button").onclick = async () => {
        if (confirm("¿Eliminar este socio?")) {
          const res = await fetch("/api/socios/" + s.email, { method: "DELETE" });
          if (!res.ok) {
            const data = await res.json();
            return alert(data.error || "Error al eliminar socio");
          }
          cargarSocios();
        }
      };

      cont.appendChild(row);
    });

  } catch (err) {
    console.error(err);
  }
}

async function crearSocio() {
  try {
    const email = nuevoEmail.value.trim();
    const nombre = nuevoNombre.value.trim();

    if (!email || !nombre)
      return alert("Email y nombre obligatorios");

    const res = await fetch("/api/socios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, nombre })
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Error 400 socio:", text);
      alert("Error creando socio");
      return;
    }

    nuevoEmail.value = "";
    nuevoNombre.value = "";
    cargarSocios();

  } catch (err) {
    console.error(err);
  }
}

// =====================================================
// ===================== CURSOS ========================
// =====================================================

async function cargarCursos() {
  try {
    const res = await fetch("/api/cursos");
    if (!res.ok) throw new Error("Error cargando cursos");

    const cursos = await res.json();
    const cont = document.getElementById("tablaCursos");
    if (!cont) return;

    cont.innerHTML = "";

    cursos.forEach(c => {
      const row = document.createElement("div");
      row.className = "reserva-linea";
      row.innerHTML = `
        <span>${c.nombre}</span>
        <span class="mobile-hide">${c.descripcion}</span>
        <span class="mobile-hide">${c.fecha_inicio}</span>
        <span class="mobile-hide">${c.fecha_fin}</span>
        <span class="mobile-hide">${c.precio}</span>
        <span class="mobile-hide">${c.profesor}</span>
        <span class="mobile-hide">${c.telefono}</span>
        <span>${c.plazas}</span>
        <span class="acciones-linea">
          <button class="secondary-btn btn-mini" title="Ver Inscritos">👥</button>
          <button class="cancelar-btn btn-mini" title="Eliminar">🗑️</button>
        </span>
      `;

      row.querySelectorAll("button")[0].onclick = () => verInscritosCurso(c.id, c.nombre);
      row.querySelectorAll("button")[1].onclick = async () => {
        if (confirm("¿Eliminar este curso y todas sus inscripciones?")) {
          await eliminarCurso(c.id);
        }
      };

      cont.appendChild(row);
    });

  } catch (err) {
    console.error(err);
  }
}

async function crearCurso() {
  try {
    const nombre = document.getElementById("cursoNombre").value.trim();
    const plazas = parseInt(document.getElementById("cursoPlazas").value);

    if (!nombre) return alert("Nombre obligatorio");
    if (isNaN(plazas) || plazas <= 0)
      return alert("Plazas inválidas");

    const res = await fetch("/api/cursos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre,
        descripcion: document.getElementById("cursoDescripcion").value,
        fecha_inicio: document.getElementById("cursoInicio").value,
        fecha_fin: document.getElementById("cursoFin").value,
        precio: document.getElementById("cursoPrecio").value,
        profesor: document.getElementById("cursoProfesor").value,
        telefono: document.getElementById("cursoTelefono").value,
        plazas
      })
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Error backend curso:", text);
      alert("Error creando curso");
      return;
    }

    // limpiar formulario
    ["cursoNombre", "cursoDescripcion", "cursoInicio", "cursoFin",
      "cursoPrecio", "cursoProfesor", "cursoTelefono", "cursoPlazas"].forEach(id => {
        document.getElementById(id).value = "";
      });

    cargarCursos();

  } catch (err) {
    console.error(err);
    alert("Error al crear curso");
  }
}

// =====================================================
// ===================== LIMITES =======================
// =====================================================

async function cargarLimites() {
  try {
    const res = await fetch("/api/limites");
    if (!res.ok) return;

    const data = await res.json();
    maxReservasInput.value = data.maxReservas;
    diasAntInput.value = data.diasAnticipacion;

  } catch (err) {
    console.error(err);
  }
}

async function actualizarLimites() {
  try {
    const max = parseInt(maxReservasInput.value);
    const dias = parseInt(diasAntInput.value);

    if (isNaN(max) || isNaN(dias))
      return alert("Valores inválidos");

    const res = await fetch("/api/limites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ maxReservas: max, diasAnticipacion: dias })
    });

    if (res.ok) alert("Límites actualizados correctamente");

  } catch (err) {
    console.error(err);
  }
}

// =====================================================
// =================== TORNEOS =========================
// =====================================================

async function cargarTorneos() {
  try {
    const res = await fetch("/api/torneos");
    if (!res.ok) throw new Error("Error cargando torneos");

    const torneos = await res.json();
    const cont = document.getElementById("tablaTorneos");
    if (!cont) return;

    cont.innerHTML = "";

    if (!torneos.length) {
      cont.innerHTML = "<p>No hay torneos activos.</p>";
      return;
    }

    torneos.forEach(t => {
      const row = document.createElement("div");
      row.className = "reserva-linea";
      row.innerHTML = `
        <span>${t.nombre}</span>
        <span class="mobile-hide">${t.deporte || ""}</span>
        <span class="mobile-hide">${t.categoria || ""}</span>
        <span class="mobile-hide">${t.fecha_inicio || ""}</span>
        <span class="mobile-hide">${t.fecha_fin || ""}</span>
        <span>${t.plazas}</span>
        <span class="acciones-linea">
          <button class="secondary-btn btn-mini" title="Ver Inscritos">👥</button>
          <button class="cancelar-btn btn-mini" title="Eliminar">🗑️</button>
        </span>
      `;

      row.querySelectorAll("button")[0].onclick = () => verInscritosTorneo(t.id, t.nombre);
      row.querySelectorAll("button")[1].onclick = async () => {
        if (confirm(`¿Eliminar el torneo "${t.nombre}" y todas sus inscripciones?`)) {
          await eliminarTorneo(t.id);
        }
      };

      cont.appendChild(row);
    });

  } catch (err) {
    console.error(err);
    alert("Error cargando torneos");
  }
}

async function crearTorneo() {
  try {
    const nombre = document.getElementById("torneoNombre").value.trim();
    const plazas = parseInt(document.getElementById("torneoPlazas").value);

    if (!nombre) return alert("Nombre obligatorio");
    if (isNaN(plazas) || plazas <= 0) return alert("Plazas inválidas");

    const res = await fetch("/api/torneos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre,
        descripcion: document.getElementById("torneoDescripcion").value,
        fecha_inicio: document.getElementById("torneoInicio").value,
        fecha_fin: document.getElementById("torneoFin").value,
        precio: document.getElementById("torneoPrecio").value,
        deporte: document.getElementById("torneoDeporte").value,
        categoria: document.getElementById("torneoCategoria").value,
        plazas
      })
    });

    if (!res.ok) {
      const data = await res.json();
      return alert(data.error || "Error creando torneo");
    }

    // Limpiar formulario
    ["torneoNombre", "torneoDescripcion", "torneoInicio", "torneoFin",
      "torneoPrecio", "torneoCategoria", "torneoPlazas"].forEach(id => {
        document.getElementById(id).value = "";
      });
    document.getElementById("torneoDeporte").value = "Tenis";

    cargarTorneos();

  } catch (err) {
    console.error(err);
    alert("Error creando torneo");
  }
}

async function eliminarTorneo(id) {
  try {
    const res = await fetch("/api/torneos/" + id, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      return alert(data.error || "No se pudo eliminar el torneo");
    }
    document.getElementById("seccionInscritosDinamica").style.display = "none";
    cargarTorneos();
  } catch (err) {
    console.error(err);
    alert("Error al intentar eliminar el torneo");
  }
}

async function eliminarCurso(id) {
  try {
    const res = await fetch("/api/cursos/" + id, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      return alert(data.error || "No se pudo eliminar el curso");
    }
    document.getElementById("seccionInscritosDinamica").style.display = "none";
    cargarCursos();
  } catch (err) {
    console.error(err);
    alert("Error al intentar eliminar el curso");
  }
}

async function verInscritosTorneo(id, nombre) {
  const seccion = document.getElementById("seccionInscritosDinamica");
  const titulo = document.getElementById("tituloInscritosDinamico");
  const lista = document.getElementById("listaInscritosDinamica");

  titulo.textContent = `🏆 Torneo: ${nombre}`;
  lista.innerHTML = "<p>Cargando...</p>";
  seccion.classList.remove("es-curso");
  seccion.style.display = "block";
  seccion.scrollIntoView({ behavior: "smooth", block: "start" });

  const res = await fetch(`/api/torneos/${id}/inscripciones`);
  const inscritos = res.ok ? await res.json() : [];

  lista.innerHTML = "";

  if (!inscritos.length) {
    lista.innerHTML = "<p>No hay inscritos aún.</p>";
    return;
  }

  inscritos.forEach(ins => {
    const estadoColor = ins.estado === "confirmado"
      ? "color:#28a745;font-weight:bold;"
      : "color:#e6a800;font-weight:bold;";
    const div = document.createElement("div");
    div.className = "lista-fila";

    div.innerHTML = `
      <span>${ins.email}</span>
      <span>${ins.detalle || ""}</span>
      <span style="${estadoColor}">${ins.estado === "confirmado" ? "✅ OK" : "⏳ Espera"}</span>
      <select onchange="cambiarProgresoTorneo(${ins.id}, this.value)">
        <option value="Inscrito" ${ins.progreso === 'Inscrito' ? 'selected' : ''}>Inscrito</option>
        <option value="1/4 Final" ${ins.progreso === '1/4 Final' ? 'selected' : ''}>1/4 Final</option>
        <option value="Semifinal" ${ins.progreso === 'Semifinal' ? 'selected' : ''}>Semifinal</option>
        <option value="Final" ${ins.progreso === 'Final' ? 'selected' : ''}>Final</option>
        <option value="Ganador" ${ins.progreso === 'Ganador' ? 'selected' : ''}>Ganador</option>
        <option value="Eliminado" ${ins.progreso === 'Eliminado' ? 'selected' : ''}>Eliminado</option>
      </select>
      <div class="acciones-linea">
        <button class="primary-btn btn-mini" title="Eliminar inscripción">🗑️</button>
      </div>
    `;

    div.querySelector("button").onclick = async () => {
      if (confirm(`¿Eliminar la inscripción de ${ins.email}?`)) {
        const res = await fetch("/api/torneos/inscripciones/" + ins.id, { method: "DELETE" });
        if (!res.ok) {
          const data = await res.json();
          return alert(data.error || "Error al eliminar inscripción");
        }
        verInscritosTorneo(id, nombre);
      }
    };

    lista.appendChild(div);
  });
}

async function verInscritosCurso(id, nombre) {
  const seccion = document.getElementById("seccionInscritosDinamica");
  const titulo = document.getElementById("tituloInscritosDinamico");
  const lista = document.getElementById("listaInscritosDinamica");

  titulo.textContent = `📚 Curso: ${nombre}`;
  lista.innerHTML = "<p>Cargando...</p>";
  seccion.classList.add("es-curso");
  seccion.style.display = "block";
  seccion.scrollIntoView({ behavior: "smooth", block: "start" });

  const res = await fetch(`/api/cursos/${id}/inscripciones`);
  const inscritos = res.ok ? await res.json() : [];

  lista.innerHTML = "";

  if (!inscritos.length) {
    lista.innerHTML = "<p>No hay inscritos aún.</p>";
    return;
  }

  inscritos.forEach(ins => {
    const div = document.createElement("div");
    div.className = "lista-fila";

    const estadoColor = ins.estado === "confirmado"
      ? "color:#28a745;font-weight:bold;"
      : "color:#e6a800;font-weight:bold;";

    div.innerHTML = `
      <span>${ins.email}</span>
      <span>${ins.detalle || ""}</span>
      <span style="${estadoColor}">${ins.estado === "confirmado" ? "✅ OK" : "⏳ Espera"}</span>
      <span class="col-progreso">-</span>
      <div class="acciones-linea">
        <button class="primary-btn btn-mini" title="Eliminar alumno">🗑️</button>
      </div>
    `;

    div.querySelector("button").onclick = async () => {
      if (confirm(`¿Eliminar al alumno ${ins.email} del curso?`)) {
        const res = await fetch("/api/cursos/inscripciones/" + ins.id, { method: "DELETE" });
        if (!res.ok) {
          const data = await res.json();
          return alert(data.error || "Error al eliminar alumno");
        }
        verInscritosCurso(id, nombre);
      }
    };

    lista.appendChild(div);
  });
}

async function cambiarProgresoTorneo(id, nuevoProgreso) {
  try {
    const res = await fetch(`/api/torneos/inscripciones/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ progreso: nuevoProgreso })
    });
    if (!res.ok) throw new Error("No se pudo actualizar el progreso");
    console.log("Progreso actualizado a:", nuevoProgreso);
  } catch (err) {
    console.error(err);
    alert("Error al actualizar el progreso");
  }
}

// Función auxiliar para descargar un CSV
async function descargarCSV(url, filename) {
  const res = await fetch(url);
  const data = await res.json();
  if (!data || !data.length) {
    console.log("No hay datos para " + filename);
    return;
  }
  const headers = Object.keys(data[0]).join(",");
  const rows = data.map(obj => Object.values(obj).map(v => `"${v}"`).join(","));
  const csvContent = "data:text/csv;charset=utf-8," + headers + "\n" + rows.join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

async function exportarCSV(tipo) {
  try {
    if (tipo === 'reservas') {
      await descargarCSV("/api/reservas", "reservas_tejar.csv");
    } else if (tipo === 'cursos') {
      // Descarga histórico completo de cursos
      await descargarCSV("/api/cursos?todo=true", "historico_cursos_tejar.csv");
      // Pequeño retraso para que el navegador no bloquee la segunda descarga
      await new Promise(r => setTimeout(r, 500));
      // Descarga todos los inscritos de todos los cursos
      await descargarCSV("/api/admin/cursos/inscripciones/all", "inscritos_cursos_completo.csv");
    } else if (tipo === 'torneos') {
      // Descarga histórico completo de torneos
      await descargarCSV("/api/torneos?todo=true", "historico_torneos_tejar.csv");
      // Pequeño retraso
      await new Promise(r => setTimeout(r, 500));
      // Descarga todos los inscritos de todos los torneos
      await descargarCSV("/api/admin/torneos/inscripciones/all", "inscritos_torneos_completo.csv");
    } else if (tipo === 'socios') {
      await descargarCSV("/api/socios", "socios_tejar.csv");
    } else {
      await descargarCSV("/api/reservas", "export.csv");
    }
  } catch (err) {
    console.error(err);
    alert("Error al exportar CSV. Revisa la consola.");
  }
}


// -------------------- LOGOUT --------------------
function logoutAdmin() { window.location = "/"; }

// -------------------- INIT --------------------
cargarReservasAdmin();
cargarSocios();
cargarCursos();
cargarLimites();
cargarTorneos();

// -------------------- EXPORT GLOBAL --------------------
window.crearEspecialPuntual = crearEspecialPuntual;
window.crearEspecialRecurrente = crearEspecialRecurrente;
window.crearSocio = crearSocio;
window.crearCurso = crearCurso;
window.actualizarLimites = actualizarLimites;
window.logoutAdmin = logoutAdmin;
window.cargarReservasAdmin = cargarReservasAdmin;
window.crearTorneo = crearTorneo;
window.exportarCSV = exportarCSV;
window.cambiarProgresoTorneo = cambiarProgresoTorneo;

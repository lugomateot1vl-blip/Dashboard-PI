const API_BASE = document.body.dataset.apiBase || "api/bridge.php";
const CLAVE_HISTORIAL = "dht11-muestras-v1";
const MAX_HISTORIAL = 720;
const metricas = {
  temperature: { titulo: "Temperatura", unidad: "°C", color: "#8b5cf6", fondo: "rgba(139, 92, 246, 0.12)", campo: "temperature" },
  humidity: { titulo: "Humedad", unidad: "%", color: "#0ea5e9", fondo: "rgba(14, 165, 233, 0.12)", campo: "humidity" }
};

const $ = (id) => document.getElementById(id);
const elementos = {
  valorTemp: $("valorTemp"), valorHum: $("valorHum"), valorModo: $("valorModo"), valorFan: $("valorFan"), valorLuz: $("valorLuz"),
  estadoConexion: $("estadoConexion"), estadoAlarma: $("estadoAlarma"), detalleEstado: $("detalleEstado"), btnModo: $("btnModo"),
  controlFanMode: $("controlFanMode"), btnFan: $("btnFan"), controlLightMode: $("controlLightMode"), sliderBrillo: $("sliderBrillo"), btnCorteLuz: $("btnCorteLuz"),
  valorBrilloPagina: $("valorBrilloPagina"), tablaVerde: $("tablaVerde"), tablaAmarillo: $("tablaAmarillo"), tablaFan: $("tablaFan"), tablaLuz: $("tablaLuz")
};

let historial = leerHistorial();
let metricaActual = document.body.dataset.metric || "temperature";
let grafico = null;
let estadoRecibido = null;

function leerHistorial() {
  try {
    const datos = JSON.parse(localStorage.getItem(CLAVE_HISTORIAL) || "[]");
    return Array.isArray(datos) ? datos.filter((m) => Number.isFinite(m.time) && Number.isFinite(m.temperature) && Number.isFinite(m.humidity)).slice(-MAX_HISTORIAL) : [];
  } catch (_) {
    return [];
  }
}

function guardarHistorial() {
  try {
    localStorage.setItem(CLAVE_HISTORIAL, JSON.stringify(historial.slice(-MAX_HISTORIAL)));
  } catch (_) {
    // Si el navegador no permite guardar localmente, la página sigue mostrando la lectura en vivo.
  }
}

function pintarEtiqueta(elemento, texto, color) {
  if (!elemento) return;
  elemento.textContent = texto;
  elemento.className = `etiqueta ${color}`;
}

async function llamarApi(action, payload = null) {
  const options = payload === null
    ? { method: "GET", cache: "no-store" }
    : { method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) };
  const respuesta = await fetch(`${API_BASE}?action=${encodeURIComponent(action)}`, options);
  const datos = await respuesta.json();
  if (!respuesta.ok) throw new Error(datos.error || `HTTP ${respuesta.status}`);
  return datos;
}

function enviarComando(command) {
  return llamarApi("command", { command });
}

function formatearHora(time, incluirFecha = false) {
  const fecha = new Date(time);
  return incluirFecha
    ? fecha.toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : fecha.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function actualizarSelectorMetrica() {
  document.querySelectorAll("button[data-metric]").forEach((boton) => {
    const activo = boton.dataset.metric === metricaActual;
    boton.classList.toggle("seleccionada", activo);
    boton.classList.toggle("activo", activo);
    boton.setAttribute("aria-pressed", String(activo));
  });
  const metrica = metricas[metricaActual];
  if ($("tituloGrafico")) $("tituloGrafico").textContent = metrica.titulo;
  if ($("descripcionGrafico")) $("descripcionGrafico").textContent = `Evolución de ${metrica.titulo.toLowerCase()} en las últimas lecturas`;
  if ($("nombreSerie")) $("nombreSerie").textContent = `${metrica.titulo} (${metrica.unidad})`;
  dibujarHistorial();
}

function datosVisibles() {
  const limite = document.body.dataset.page === "historial" ? 180 : 30;
  return historial.slice(-limite);
}

function dibujarHistorial() {
  const canvas = $("grafico");
  const metrica = metricas[metricaActual];
  const muestras = datosVisibles();
  const aviso = $("sinDatosGrafico");
  if (aviso) aviso.hidden = muestras.length > 0;
  if (!canvas || !window.Chart) return;

  const datos = muestras.map((m) => m[metrica.campo]);
  const etiquetas = muestras.map((m) => formatearHora(m.time));
  if (!grafico) {
    grafico = new Chart(canvas, {
      type: "line",
      data: { labels: etiquetas, datasets: [{ label: `${metrica.titulo} (${metrica.unidad})`, data: datos, borderColor: metrica.color, backgroundColor: metrica.fondo, fill: true, tension: 0.32, pointRadius: 2, pointHoverRadius: 5, borderWidth: 2 }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: "index" },
        plugins: { legend: { display: false }, tooltip: { callbacks: { title: (items) => items[0]?.label || "" } } },
        scales: {
          x: { title: { display: true, text: "Hora de la medición" }, grid: { display: false }, ticks: { autoSkip: true, maxTicksLimit: 8, maxRotation: 0 } },
          y: { title: { display: true, text: metrica.unidad }, beginAtZero: false, ticks: { maxTicksLimit: 6 }, grid: { color: "rgba(148, 163, 184, 0.18)" } }
        }
      }
    });
  } else {
    grafico.data.labels = etiquetas;
    grafico.data.datasets[0].label = `${metrica.titulo} (${metrica.unidad})`;
    grafico.data.datasets[0].data = datos;
    grafico.data.datasets[0].borderColor = metrica.color;
    grafico.data.datasets[0].backgroundColor = metrica.fondo;
    grafico.options.scales.y.title.text = metrica.unidad;
    grafico.update("none");
  }
  if ($("ultimaMuestra")) {
    const ultima = muestras[muestras.length - 1];
    $("ultimaMuestra").textContent = ultima ? `Última lectura: ${formatearHora(ultima.time, true)}` : "Sin mediciones todavía";
  }
}

function agregarMuestra(datos) {
  const temperatura = Number(datos.temperature);
  const humedad = Number(datos.humidity);
  if (!datos.sensorOk || !Number.isFinite(temperatura) || !Number.isFinite(humedad)) return;
  historial.push({ time: Date.now(), temperature: temperatura, humidity: humedad, mode: datos.mode || "GREEN", fan: Boolean(datos.fan) });
  if (historial.length > MAX_HISTORIAL) historial = historial.slice(-MAX_HISTORIAL);
  guardarHistorial();
  dibujarHistorial();
  dibujarTablaHistorial();
}

function dibujarTablaHistorial() {
  const cuerpo = $("filasHistorial");
  if (!cuerpo) return;
  cuerpo.replaceChildren();
  const ultimas = historial.slice(-20).reverse();
  if (!ultimas.length) {
    const fila = document.createElement("tr");
    fila.innerHTML = '<td colspan="4" class="celda-vacia">Todavía no hay datos guardados.</td>';
    cuerpo.append(fila);
  } else {
    ultimas.forEach((muestra) => {
      const fila = document.createElement("tr");
      const valores = [formatearHora(muestra.time, true), `${muestra.temperature.toFixed(1)} °C`, `${muestra.humidity.toFixed(1)} %`, muestra.fan ? "Ventilador encendido" : muestra.mode === "YELLOW" ? "Control armado" : "Desarmado"];
      valores.forEach((valor) => {
        const celda = document.createElement("td");
        celda.textContent = valor;
        fila.append(celda);
      });
      cuerpo.append(fila);
    });
  }
  if ($("cantidadRegistros")) $("cantidadRegistros").textContent = `${historial.length} ${historial.length === 1 ? "registro" : "registros"}`;
}

function mostrarDesconectado(mensaje) {
  pintarEtiqueta(elementos.estadoConexion, "Esperando Arduino y puente Python", "amarillo");
  pintarEtiqueta(elementos.estadoAlarma, "Sin datos recientes", "gris");
  if (elementos.detalleEstado) elementos.detalleEstado.textContent = mensaje;
  [elementos.valorTemp, elementos.valorHum, elementos.valorModo, elementos.valorFan, elementos.valorLuz].forEach((elemento) => { if (elemento) elemento.textContent = "--"; });
  [elementos.tablaVerde, elementos.tablaAmarillo, elementos.tablaFan, elementos.tablaLuz].forEach((elemento) => pintarEtiqueta(elemento, "--", "gris"));
  [elementos.btnModo, elementos.controlFanMode, elementos.btnFan, elementos.controlLightMode, elementos.sliderBrillo, elementos.btnCorteLuz].forEach((elemento) => { if (elemento) elemento.disabled = true; });
  if (elementos.btnModo) { elementos.btnModo.textContent = "Esperando comunicación USB"; elementos.btnModo.dataset.command = ""; }
  if (elementos.btnFan) elementos.btnFan.textContent = "Encender ventilador (modo manual)";
}

async function consultarEstado() {
  try {
    const datos = await llamarApi("state");
    if (!datos.online) {
      estadoRecibido = null;
      mostrarDesconectado("Iniciá XAMPP y el puente Python, y conectá el Arduino por USB.");
      return;
    }
    estadoRecibido = datos;
    pintarEtiqueta(elementos.estadoConexion, "Arduino conectado por USB", "verde");
    const brillo = Math.max(0, Math.min(255, Number(datos.brightness) || 0));
    const porcentajeLuz = Math.round(brillo * 100 / 255);
    const lucesEncendidas = datos.lightsEnabled !== false;
    if (elementos.valorLuz) elementos.valorLuz.textContent = lucesEncendidas ? porcentajeLuz : 0;
    pintarEtiqueta(elementos.tablaLuz, lucesEncendidas ? `${porcentajeLuz}%` : "Cortada", lucesEncendidas && porcentajeLuz > 0 ? "verde" : "gris");
    if (elementos.btnCorteLuz) {
      elementos.btnCorteLuz.disabled = false;
      elementos.btnCorteLuz.dataset.command = lucesEncendidas ? "I,OFF" : "I,ON";
      elementos.btnCorteLuz.textContent = lucesEncendidas ? "Apagar completamente" : "Restablecer iluminación";
    }
    const lightMode = String(datos.lightMode || "POT").toUpperCase();
    if (elementos.controlLightMode) { elementos.controlLightMode.value = lightMode === "WEB" ? "web" : "pot"; elementos.controlLightMode.disabled = false; }
    if (elementos.sliderBrillo) {
      elementos.sliderBrillo.disabled = lightMode !== "WEB";
      if (document.activeElement !== elementos.sliderBrillo) elementos.sliderBrillo.value = brillo;
    }
    if (elementos.valorBrilloPagina) elementos.valorBrilloPagina.textContent = `${brillo} / 255 (${porcentajeLuz}%)`;

    if (datos.sensorOk) {
      const temp = Number(datos.temperature);
      const hum = Number(datos.humidity);
      if (elementos.valorTemp) elementos.valorTemp.textContent = Number.isFinite(temp) ? temp.toFixed(1) : "ERROR";
      if (elementos.valorHum) elementos.valorHum.textContent = Number.isFinite(hum) ? hum.toFixed(1) : "ERROR";
      agregarMuestra(datos);
    } else {
      if (elementos.valorTemp) elementos.valorTemp.textContent = "ERROR";
      if (elementos.valorHum) elementos.valorHum.textContent = "ERROR";
    }

    const modo = String(datos.mode || "GREEN").toUpperCase();
    const controlMode = String(datos.controlMode || "AUTO").toUpperCase();
    const fan = Boolean(datos.fan);
    if (elementos.valorFan) elementos.valorFan.textContent = fan ? "Encendido" : "Apagado";
    if (elementos.controlFanMode) { elementos.controlFanMode.value = controlMode === "MANUAL" ? "manual" : "auto"; elementos.controlFanMode.disabled = false; }
    if (elementos.btnFan) {
      elementos.btnFan.dataset.state = fan ? "off" : "on";
      elementos.btnFan.textContent = fan ? "Apagar ventilador" : "Encender ventilador";
      elementos.btnFan.disabled = controlMode !== "MANUAL";
    }

    if (controlMode === "MANUAL") {
      if (elementos.valorModo) elementos.valorModo.textContent = "Manual";
      pintarEtiqueta(elementos.estadoAlarma, fan ? "MANUAL · ventilador encendido" : "MANUAL · ventilador apagado", fan ? "rojo" : "gris");
      if (elementos.detalleEstado) elementos.detalleEstado.textContent = `Control manual. Humedad actual: ${datos.sensorOk ? `${Number(datos.humidity).toFixed(1)} %` : "sin lectura válida"}.`;
    } else if (modo === "RED" || fan) {
      if (elementos.valorModo) elementos.valorModo.textContent = "Disparado";
      pintarEtiqueta(elementos.estadoAlarma, "ROJO · ventilador encendido", "rojo");
      if (elementos.detalleEstado) elementos.detalleEstado.textContent = datos.sensorOk ? `Humedad ${Number(datos.humidity).toFixed(1)} %: alcanzó el umbral de 70 %.` : "El ventilador figura encendido, pero el DHT11 no entrega una lectura válida.";
    } else if (modo === "YELLOW") {
      if (elementos.valorModo) elementos.valorModo.textContent = "Armado";
      pintarEtiqueta(elementos.estadoAlarma, "AMARILLO · esperando humedad", "amarillo");
      if (elementos.detalleEstado) elementos.detalleEstado.textContent = datos.sensorOk ? `Control armado. Se activa desde 70 % (lectura: ${Number(datos.humidity).toFixed(1)} %).` : "Control armado, pero el DHT11 no entrega una lectura válida.";
    } else {
      if (elementos.valorModo) elementos.valorModo.textContent = "Verde";
      pintarEtiqueta(elementos.estadoAlarma, "VERDE · control desarmado", "verde");
      if (elementos.detalleEstado) elementos.detalleEstado.textContent = "El sistema está desarmado. Armá el control para responder al umbral de humedad.";
    }

    pintarEtiqueta(elementos.tablaVerde, modo === "GREEN" ? "Encendido" : "Apagado", modo === "GREEN" ? "verde" : "gris");
    pintarEtiqueta(elementos.tablaAmarillo, modo === "YELLOW" ? "Encendido" : "Apagado", modo === "YELLOW" ? "amarillo" : "gris");
    pintarEtiqueta(elementos.tablaFan, fan ? "Encendido" : "Apagado", fan ? "rojo" : "gris");

    if (elementos.btnModo) {
      elementos.btnModo.disabled = controlMode === "MANUAL";
      if (controlMode === "MANUAL") { elementos.btnModo.textContent = "Control de humedad disponible en modo automático"; elementos.btnModo.dataset.command = ""; }
      else if (modo === "GREEN") { elementos.btnModo.textContent = "Armar control (amarillo)"; elementos.btnModo.dataset.command = "A"; }
      else { elementos.btnModo.textContent = "Desarmar (volver a verde)"; elementos.btnModo.dataset.command = "G"; }
    }
  } catch (error) {
    // La API pudo responder correctamente y el fallo ocurrir al actualizar un gráfico
    // u otro elemento. No borres las lecturas recibidas: muestra el error para poder
    // distinguir un problema visual de una desconexión real.
    estadoRecibido = null;
    console.error("Error al actualizar el dashboard:", error);
    pintarEtiqueta(elementos.estadoConexion, `Error al actualizar: ${error.message}`, "rojo");
    if (elementos.detalleEstado) elementos.detalleEstado.textContent = error.message;
  }
}

async function conBotonBloqueado(elemento, accion, mensajeError) {
  if (!elemento) return;
  elemento.disabled = true;
  try { await accion(); setTimeout(consultarEstado, 500); }
  catch (error) { mostrarDesconectado(`${mensajeError}: ${error.message}`); }
}

if (elementos.btnModo) elementos.btnModo.addEventListener("click", () => {
  const command = elementos.btnModo.dataset.command;
  if (command) conBotonBloqueado(elementos.btnModo, () => enviarComando(command), "No se pudo encolar la orden");
});
if (elementos.controlFanMode) elementos.controlFanMode.addEventListener("change", () => conBotonBloqueado(elementos.controlFanMode, () => enviarComando(elementos.controlFanMode.value === "manual" ? "C,MANUAL" : "C,AUTO"), "No se pudo cambiar el modo del ventilador"));
if (elementos.btnFan) elementos.btnFan.addEventListener("click", () => {
  const command = elementos.btnFan.dataset.state === "on" ? "F,1" : "F,0";
  conBotonBloqueado(elementos.btnFan, () => enviarComando(command), "No se pudo enviar la orden al ventilador");
});
if (elementos.btnCorteLuz) elementos.btnCorteLuz.addEventListener("click", () => {
  const command = elementos.btnCorteLuz.dataset.command;
  if (command) conBotonBloqueado(elementos.btnCorteLuz, () => enviarComando(command), "No se pudo cambiar el corte de iluminación");
});
if (elementos.controlLightMode) elementos.controlLightMode.addEventListener("change", () => conBotonBloqueado(elementos.controlLightMode, () => enviarComando(elementos.controlLightMode.value === "web" ? "L,WEB" : "L,POT"), "No se pudo cambiar la fuente de luz"));
if (elementos.sliderBrillo) {
  elementos.sliderBrillo.addEventListener("input", () => {
    const brillo = Number(elementos.sliderBrillo.value);
    const porcentaje = Math.round(brillo * 100 / 255);
    if (elementos.valorBrilloPagina) elementos.valorBrilloPagina.textContent = `${brillo} / 255 (${porcentaje}%)`;
  });
  elementos.sliderBrillo.addEventListener("change", () => {
    if (elementos.controlLightMode.value !== "web") return;
    conBotonBloqueado(elementos.sliderBrillo, () => enviarComando(`B,${elementos.sliderBrillo.value}`), "No se pudo enviar el brillo");
  });
}

document.querySelectorAll("button[data-metric]").forEach((boton) => boton.addEventListener("click", () => {
  metricaActual = boton.dataset.metric in metricas ? boton.dataset.metric : "temperature";
  actualizarSelectorMetrica();
}));

document.querySelectorAll("#btnTema").forEach((boton) => boton.addEventListener("click", () => {
  document.body.classList.toggle("oscuro");
  localStorage.setItem("dht11-tema", document.body.classList.contains("oscuro") ? "oscuro" : "claro");
}));
if (localStorage.getItem("dht11-tema") === "oscuro") document.body.classList.add("oscuro");

actualizarSelectorMetrica();
dibujarTablaHistorial();
consultarEstado();
setInterval(consultarEstado, 2000);


const API_BASE = "api/bridge.php";

const valorTemp = document.getElementById("valorTemp");
const valorHum = document.getElementById("valorHum");
const valorModo = document.getElementById("valorModo");
const valorFan = document.getElementById("valorFan");
const valorLuz = document.getElementById("valorLuz");
const estadoConexion = document.getElementById("estadoConexion");
const estadoAlarma = document.getElementById("estadoAlarma");
const detalleEstado = document.getElementById("detalleEstado");
const btnModo = document.getElementById("btnModo");
const controlFanMode = document.getElementById("controlFanMode");
const btnFan = document.getElementById("btnFan");
const controlLightMode = document.getElementById("controlLightMode");
const sliderBrillo = document.getElementById("sliderBrillo");
const valorBrilloPagina = document.getElementById("valorBrilloPagina");
const tablaVerde = document.getElementById("tablaVerde");
const tablaAmarillo = document.getElementById("tablaAmarillo");
const tablaFan = document.getElementById("tablaFan");
const tablaLuz = document.getElementById("tablaLuz");

function pintarEtiqueta(elemento, texto, color) {
  elemento.textContent = texto;
  elemento.className = `etiqueta ${color}`;
}

async function llamarApi(action, payload = null) {
  const options = payload === null
    ? { method: "GET", cache: "no-store" }
    : {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      };
  const respuesta = await fetch(`${API_BASE}?action=${encodeURIComponent(action)}`, options);
  const datos = await respuesta.json();
  if (!respuesta.ok) throw new Error(datos.error || `HTTP ${respuesta.status}`);
  return datos;
}

async function enviarComando(command) {
  return llamarApi("command", { command });
}

function mostrarDesconectado(mensaje) {
  pintarEtiqueta(estadoConexion, "Esperando Arduino y puente Python", "amarillo");
  pintarEtiqueta(estadoAlarma, "Sin datos recientes", "gris");
  detalleEstado.textContent = mensaje;
  valorTemp.textContent = "--";
  valorHum.textContent = "--";
  valorModo.textContent = "--";
  valorFan.textContent = "--";
  valorLuz.textContent = "--";
  pintarEtiqueta(tablaVerde, "--", "gris");
  pintarEtiqueta(tablaAmarillo, "--", "gris");
  pintarEtiqueta(tablaFan, "--", "gris");
  pintarEtiqueta(tablaLuz, "--", "gris");
  btnModo.disabled = true;
  controlFanMode.disabled = true;
  btnFan.disabled = true;
  controlLightMode.disabled = true;
  sliderBrillo.disabled = true;
  btnModo.textContent = "Esperando comunicación USB";
  btnFan.textContent = "Encender ventilador (modo manual)";
}

async function consultarEstado() {
  try {
    const datos = await llamarApi("state");
    if (!datos.online) {
      mostrarDesconectado("Iniciá XAMPP y el puente Python, y conectá el Arduino por USB.");
      return;
    }

    pintarEtiqueta(estadoConexion, "Arduino conectado por USB", "verde");
    const brillo = Math.max(0, Math.min(255, Number(datos.brightness) || 0));
    const porcentajeLuz = Math.round(brillo * 100 / 255);
    valorLuz.textContent = porcentajeLuz;
    pintarEtiqueta(tablaLuz, `${porcentajeLuz}%`, porcentajeLuz > 0 ? "verde" : "gris");
    const lightMode = String(datos.lightMode || "POT").toUpperCase();
    controlLightMode.value = lightMode === "WEB" ? "web" : "pot";
    controlLightMode.disabled = false;
    sliderBrillo.disabled = lightMode !== "WEB";
    if (document.activeElement !== sliderBrillo) sliderBrillo.value = brillo;
    valorBrilloPagina.textContent = `${brillo} / 255 (${porcentajeLuz}%)`;

    if (datos.sensorOk) {
      valorTemp.textContent = Number(datos.temperature).toFixed(1);
      valorHum.textContent = Number(datos.humidity).toFixed(1);
      agregarPuntoGrafico(Number(datos.temperature));
    } else {
      valorTemp.textContent = "ERROR";
      valorHum.textContent = "ERROR";
    }

    const modo = String(datos.mode || "GREEN").toUpperCase();
    const controlMode = String(datos.controlMode || "AUTO").toUpperCase();
    const fan = Boolean(datos.fan);
    valorFan.textContent = fan ? "Encendido" : "Apagado";
    controlFanMode.value = controlMode === "MANUAL" ? "manual" : "auto";
    controlFanMode.disabled = false;
    btnFan.dataset.state = fan ? "off" : "on";
    btnFan.textContent = fan ? "Apagar ventilador" : "Encender ventilador";
    btnFan.disabled = controlMode !== "MANUAL";

    if (controlMode === "MANUAL") {
      valorModo.textContent = "Manual";
      pintarEtiqueta(estadoAlarma, fan ? "MANUAL · ventilador encendido" : "MANUAL · ventilador apagado", fan ? "rojo" : "gris");
      detalleEstado.textContent = `Control manual. Humedad actual: ${datos.sensorOk ? `${Number(datos.humidity).toFixed(1)} %` : "sin lectura válida"}.`;
    } else if (modo === "RED" || fan) {
      valorModo.textContent = "Disparado";
      pintarEtiqueta(estadoAlarma, "ROJO · ventilador encendido", "rojo");
      detalleEstado.textContent = datos.sensorOk
        ? `Humedad ${Number(datos.humidity).toFixed(1)} %: alcanzó el umbral de 70 %.`
        : "El ventilador figura encendido, pero el DHT11 no entrega una lectura válida.";
    } else if (modo === "YELLOW") {
      valorModo.textContent = "Armado";
      pintarEtiqueta(estadoAlarma, "AMARILLO · esperando humedad", "amarillo");
      detalleEstado.textContent = datos.sensorOk
        ? `Control armado. Se activa desde 70 % (lectura: ${Number(datos.humidity).toFixed(1)} %).`
        : "Control armado, pero el DHT11 no entrega una lectura válida.";
    } else {
      valorModo.textContent = "Verde";
      pintarEtiqueta(estadoAlarma, "VERDE · control desarmado", "verde");
      detalleEstado.textContent = "El sistema está desarmado. Armá el control para responder al umbral de humedad.";
    }

    pintarEtiqueta(tablaVerde, modo === "GREEN" ? "Encendido" : "Apagado", modo === "GREEN" ? "verde" : "gris");
    pintarEtiqueta(tablaAmarillo, modo === "YELLOW" ? "Encendido" : "Apagado", modo === "YELLOW" ? "amarillo" : "gris");
    pintarEtiqueta(tablaFan, fan ? "Encendido" : "Apagado", fan ? "rojo" : "gris");

    btnModo.disabled = controlMode === "MANUAL";
    if (controlMode === "MANUAL") {
      btnModo.textContent = "Control de humedad disponible en modo automático";
      btnModo.dataset.command = "";
    } else if (modo === "GREEN") {
      btnModo.textContent = "Armar control (amarillo)";
      btnModo.dataset.command = "A";
    } else {
      btnModo.textContent = "Desarmar (volver a verde)";
      btnModo.dataset.command = "G";
    }
  } catch (error) {
    mostrarDesconectado(`No se pudo consultar la API local de XAMPP: ${error.message}`);
  }
}

function agregarPuntoGrafico(temperatura) {
  if (!window.graficoTemperatura) return;
  const etiquetas = window.graficoTemperatura.data.labels;
  const valores = window.graficoTemperatura.data.datasets[0].data;
  etiquetas.push(new Date().toLocaleTimeString());
  valores.push(temperatura);
  if (valores.length > 20) {
    etiquetas.shift();
    valores.shift();
  }
  window.graficoTemperatura.update("none");
}

btnModo.addEventListener("click", async () => {
  const command = btnModo.dataset.command;
  if (!command) return;
  btnModo.disabled = true;
  try {
    await enviarComando(command);
    setTimeout(consultarEstado, 500);
  } catch (error) {
    mostrarDesconectado(`No se pudo encolar la orden: ${error.message}`);
  }
});

controlFanMode.addEventListener("change", async () => {
  controlFanMode.disabled = true;
  try {
    await enviarComando(controlFanMode.value === "manual" ? "C,MANUAL" : "C,AUTO");
    setTimeout(consultarEstado, 500);
  } catch (error) {
    mostrarDesconectado(`No se pudo cambiar el modo del ventilador: ${error.message}`);
  }
});

btnFan.addEventListener("click", async () => {
  const command = btnFan.dataset.state === "on" ? "F,1" : "F,0";
  btnFan.disabled = true;
  try {
    await enviarComando(command);
    setTimeout(consultarEstado, 500);
  } catch (error) {
    mostrarDesconectado(`No se pudo enviar la orden al ventilador: ${error.message}`);
  }
});

controlLightMode.addEventListener("change", async () => {
  controlLightMode.disabled = true;
  try {
    await enviarComando(controlLightMode.value === "web" ? "L,WEB" : "L,POT");
    setTimeout(consultarEstado, 500);
  } catch (error) {
    mostrarDesconectado(`No se pudo cambiar la fuente de luz: ${error.message}`);
  }
});

sliderBrillo.addEventListener("input", () => {
  const brillo = Number(sliderBrillo.value);
  const porcentaje = Math.round(brillo * 100 / 255);
  valorBrilloPagina.textContent = `${brillo} / 255 (${porcentaje}%)`;
});

sliderBrillo.addEventListener("change", async () => {
  if (controlLightMode.value !== "web") return;
  sliderBrillo.disabled = true;
  try {
    await enviarComando(`B,${sliderBrillo.value}`);
    setTimeout(consultarEstado, 500);
  } catch (error) {
    mostrarDesconectado(`No se pudo enviar el brillo: ${error.message}`);
  }
});

document.getElementById("btnTema").addEventListener("click", () => {
  document.body.classList.toggle("oscuro");
});

if (window.Chart) {
  window.graficoTemperatura = new Chart(document.getElementById("grafico"), {
    type: "line",
    data: {
      labels: [],
      datasets: [{
        label: "Temperatura (°C)",
        data: [],
        borderColor: "#8b5cf6",
        backgroundColor: "rgba(139, 92, 246, 0.1)",
        fill: true,
        tension: 0.3
      }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });
}

consultarEstado();
setInterval(consultarEstado, 2000);

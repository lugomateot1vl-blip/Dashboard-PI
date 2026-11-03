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
const ipEsp = document.getElementById("ipEsp");

const tablaVerde = document.getElementById("tablaVerde");
const tablaAmarillo = document.getElementById("tablaAmarillo");
const tablaFan = document.getElementById("tablaFan");
const tablaLuz = document.getElementById("tablaLuz");

let baseEsp = localStorage.getItem("baseEsp") || "";
ipEsp.value = baseEsp.replace(/^https?:\/\//, "");

function pintarEtiqueta(elemento, texto, color) {
  elemento.textContent = texto;
  elemento.className = `etiqueta ${color}`;
}

function obtenerBaseEsp() {
  let valor = ipEsp.value.trim().replace(/\/$/, "");
  if (!valor) return "";
  if (!/^https?:\/\//i.test(valor)) valor = `http://${valor}`;
  return valor;
}

function mostrarDesconectado(mensaje) {
  pintarEtiqueta(estadoConexion, "Sin conexión", "gris");
  pintarEtiqueta(estadoAlarma, "Sin conexión", "gris");
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
  btnModo.textContent = "Conectá el ESP-12E";
  btnFan.textContent = "Encender ventilador (modo manual)";
}

async function consultarEstado() {
  const base = obtenerBaseEsp();
  if (!base) {
    mostrarDesconectado("Ingresá la IP del ESP-12E que aparece en el Monitor Serie del Arduino.");
    return;
  }

  try {
    const respuesta = await fetch(`${base}/api/status`, { cache: "no-store" });
    if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
    const datos = await respuesta.json();

    const brillo = Math.max(0, Math.min(255, Number(datos.brightness) || 0));
    const porcentajeLuz = Math.round(brillo * 100 / 255);
    valorLuz.textContent = porcentajeLuz;
    pintarEtiqueta(tablaLuz, `${porcentajeLuz}%`, porcentajeLuz > 0 ? "verde" : "gris");
    const lightMode = String(datos.lightMode || "POT").toUpperCase();
    controlLightMode.value = lightMode === "WEB" ? "web" : "pot";
    controlLightMode.disabled = !datos.online;
    sliderBrillo.disabled = !datos.online || lightMode !== "WEB";
    if (document.activeElement !== sliderBrillo) sliderBrillo.value = brillo;
    valorBrilloPagina.textContent = `${brillo} / 255 (${porcentajeLuz}%)`;

    pintarEtiqueta(estadoConexion, datos.online ? "ESP y Arduino conectados" : "ESP conectado, Arduino sin datos", datos.online ? "verde" : "amarillo");

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
    controlFanMode.disabled = !datos.online;
    btnFan.dataset.state = fan ? "off" : "on";
    btnFan.textContent = fan ? "Apagar ventilador" : "Encender ventilador";
    btnFan.disabled = !datos.online || controlMode !== "MANUAL";

    if (controlMode === "MANUAL") {
      valorModo.textContent = "Manual";
      pintarEtiqueta(estadoAlarma, fan ? "MANUAL · ventilador encendido" : "MANUAL · ventilador apagado", fan ? "rojo" : "gris");
      detalleEstado.textContent = `Control manual desde la página. Humedad actual: ${datos.sensorOk ? `${Number(datos.humidity).toFixed(1)} %` : "sin lectura válida"}.`;
    } else if (modo === "RED" || fan) {
      valorModo.textContent = "Disparado";
      pintarEtiqueta(estadoAlarma, "ROJO · ventilador encendido", "rojo");
      detalleEstado.textContent = datos.sensorOk
        ? `Humedad ${Number(datos.humidity).toFixed(1)} %: alcanzó el umbral de 70 %.`
        : "El circuito informa ventilador encendido; el DHT11 no está entregando una lectura válida.";
    } else if (modo === "YELLOW") {
      valorModo.textContent = "Armado";
      pintarEtiqueta(estadoAlarma, "AMARILLO · esperando humedad", "amarillo");
      detalleEstado.textContent = datos.sensorOk
        ? `Control armado. Se activa a partir de 70 % (lectura actual: ${Number(datos.humidity).toFixed(1)} %).`
        : "Control armado, pero el DHT11 no está entregando una lectura válida.";
    } else {
      valorModo.textContent = "Verde";
      pintarEtiqueta(estadoAlarma, "VERDE · control desarmado", "verde");
      detalleEstado.textContent = "El sistema está desarmado. Armá el control para que responda al umbral de humedad.";
    }

    pintarEtiqueta(tablaVerde, modo === "GREEN" ? "Encendido" : "Apagado", modo === "GREEN" ? "verde" : "gris");
    pintarEtiqueta(tablaAmarillo, modo === "YELLOW" ? "Encendido" : "Apagado", modo === "YELLOW" ? "amarillo" : "gris");
    pintarEtiqueta(tablaFan, fan ? "Encendido" : "Apagado", fan ? "rojo" : "gris");

    btnModo.disabled = !datos.online || controlMode === "MANUAL";
    if (!datos.online) {
      btnModo.textContent = "Esperando comunicación con Arduino";
      btnModo.dataset.modo = "";
    } else if (controlMode === "MANUAL") {
      btnModo.textContent = "Control de humedad disponible en modo automático";
      btnModo.dataset.modo = "";
    } else if (modo === "GREEN") {
      btnModo.textContent = "Armar control (amarillo)";
      btnModo.dataset.modo = "armed";
    } else {
      btnModo.textContent = "Desarmar (volver a verde)";
      btnModo.dataset.modo = "green";
    }
  } catch (error) {
    mostrarDesconectado(`No se pudo consultar ${base}. Verificá que la PC y el ESP estén en la misma red Wi-Fi. (${error.message})`);
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

document.getElementById("btnConectar").addEventListener("click", () => {
  baseEsp = obtenerBaseEsp();
  localStorage.setItem("baseEsp", baseEsp);
  consultarEstado();
});

btnModo.addEventListener("click", async () => {
  const base = obtenerBaseEsp();
  const nuevoModo = btnModo.dataset.modo;
  if (!base || !nuevoModo) return;

  btnModo.disabled = true;
  try {
    const respuesta = await fetch(`${base}/api/mode?value=${encodeURIComponent(nuevoModo)}`, { cache: "no-store" });
    if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
    setTimeout(consultarEstado, 500);
  } catch (error) {
    mostrarDesconectado(`No se pudo enviar la orden al ESP-12E. (${error.message})`);
  }
});

controlFanMode.addEventListener("change", async () => {
  const base = obtenerBaseEsp();
  if (!base) return;
  controlFanMode.disabled = true;
  try {
    const respuesta = await fetch(`${base}/api/fan?mode=${encodeURIComponent(controlFanMode.value)}`, { cache: "no-store" });
    if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
    setTimeout(consultarEstado, 400);
  } catch (error) {
    mostrarDesconectado(`No se pudo cambiar el modo del ventilador. (${error.message})`);
  }
});

btnFan.addEventListener("click", async () => {
  const base = obtenerBaseEsp();
  const state = btnFan.dataset.state;
  if (!base || !state) return;
  btnFan.disabled = true;
  try {
    const respuesta = await fetch(`${base}/api/fan?state=${encodeURIComponent(state)}`, { cache: "no-store" });
    if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
    setTimeout(consultarEstado, 400);
  } catch (error) {
    mostrarDesconectado(`No se pudo enviar el comando al ventilador. (${error.message})`);
  }
});

controlLightMode.addEventListener("change", async () => {
  const base = obtenerBaseEsp();
  if (!base) return;
  controlLightMode.disabled = true;
  try {
    const respuesta = await fetch(`${base}/api/lights?mode=${encodeURIComponent(controlLightMode.value)}`, { cache: "no-store" });
    if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
    setTimeout(consultarEstado, 400);
  } catch (error) {
    mostrarDesconectado(`No se pudo cambiar el control de iluminación. (${error.message})`);
  }
});

sliderBrillo.addEventListener("input", () => {
  const brillo = Number(sliderBrillo.value);
  const porcentaje = Math.round(brillo * 100 / 255);
  valorBrilloPagina.textContent = `${brillo} / 255 (${porcentaje}%)`;
});

sliderBrillo.addEventListener("change", async () => {
  const base = obtenerBaseEsp();
  if (!base || controlLightMode.value !== "web") return;
  sliderBrillo.disabled = true;
  try {
    const respuesta = await fetch(`${base}/api/lights?brightness=${encodeURIComponent(sliderBrillo.value)}`, { cache: "no-store" });
    if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
    setTimeout(consultarEstado, 400);
  } catch (error) {
    mostrarDesconectado(`No se pudo enviar el brillo a las luces. (${error.message})`);
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

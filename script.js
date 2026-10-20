// ==========================================
// 1. ESTADO DEL SISTEMA
// Acá guardamos TODOS los datos en un solo objeto.
// Más adelante, estos valores pueden venir del Arduino.
// ==========================================
const estado = {
  temperatura: 24,
  humedad: 50,
  luz: false,                 // true = encendida, false = apagada
  aire: false,
  tomas: true,
  alarma: "desactivada"       // "desactivada", "activada" o "disparada"
};

// ==========================================
// 2. BUSCAR ELEMENTOS DEL HTML (por su id)
// ==========================================
const valorTemp  = document.getElementById("valorTemp");
const valorHum   = document.getElementById("valorHum");
const valorLuz   = document.getElementById("valorLuz");
const valorAire  = document.getElementById("valorAire");
const tablaLuz   = document.getElementById("tablaLuz");
const tablaAire  = document.getElementById("tablaAire");
const tablaTomas = document.getElementById("tablaTomas");
const estadoAlarma = document.getElementById("estadoAlarma");

// ==========================================
// 3. FUNCIÓN QUE DIBUJA EL ESTADO EN LA PANTALLA
// Se llama cada vez que algo cambia.
// ==========================================

// Pone texto y color a una etiqueta
function pintarEtiqueta(elemento, texto, color) {
  elemento.textContent = texto;
  elemento.className = "etiqueta " + color;   // ej: "etiqueta verde"
}

function actualizarPantalla() {
  // Números
  valorTemp.textContent = estado.temperatura.toFixed(1);
  valorHum.textContent = Math.round(estado.humedad);

  // Textos de las tarjetas
  valorLuz.textContent  = estado.luz  ? "Encendida" : "Apagada";
  valorAire.textContent = estado.aire ? "Encendido" : "Apagado";

  // Etiquetas de la tabla
  pintarEtiqueta(tablaLuz,   estado.luz  ? "Encendida" : "Apagada",  estado.luz  ? "verde" : "gris");
  pintarEtiqueta(tablaAire,  estado.aire ? "Encendido" : "Apagado",  estado.aire ? "verde" : "gris");
  pintarEtiqueta(tablaTomas, estado.tomas ? "Con energía" : "Sin energía", estado.tomas ? "verde" : "gris");

  // Alarma: un color por cada estado
  if (estado.alarma === "desactivada") pintarEtiqueta(estadoAlarma, "Desactivada", "gris");
  if (estado.alarma === "activada")    pintarEtiqueta(estadoAlarma, "Activada", "amarillo");
  if (estado.alarma === "disparada")   pintarEtiqueta(estadoAlarma, "¡DISPARADA!", "rojo");
}

// ==========================================
// 4. BOTONES (cada uno cambia el estado y vuelve a dibujar)
// ==========================================
document.getElementById("btnLuz").addEventListener("click", function () {
  estado.luz = !estado.luz;          // el "!" invierte: true pasa a false y viceversa
  actualizarPantalla();
});

document.getElementById("btnAire").addEventListener("click", function () {
  estado.aire = !estado.aire;
  actualizarPantalla();
});

document.getElementById("btnAlarma").addEventListener("click", function () {
  // Si está desactivada se activa; si está activada o disparada, se desactiva
  if (estado.alarma === "desactivada") {
    estado.alarma = "activada";
  } else {
    estado.alarma = "desactivada";
  }
  actualizarPantalla();
});

document.getElementById("btnDisparar").addEventListener("click", function () {
  // Solo se puede disparar si la alarma estaba activada
  if (estado.alarma === "activada") {
    estado.alarma = "disparada";
    actualizarPantalla();
  }
});

// Apagado total: deja todo en condición segura (pedido en el proyecto)
document.getElementById("btnApagadoTotal").addEventListener("click", function () {
  estado.luz = false;
  estado.aire = false;
  estado.tomas = false;
  actualizarPantalla();
});

// Cambiar tema claro / oscuro
document.getElementById("btnTema").addEventListener("click", function () {
  document.body.classList.toggle("oscuro");
});

// ==========================================
// 5. GRÁFICO (Chart.js)
// ==========================================
const horas = [];          // etiquetas del eje X
const temperaturas = [];   // valores del eje Y

const grafico = new Chart(document.getElementById("grafico"), {
  type: "line",
  data: {
    labels: horas,
    datasets: [{
      label: "Temperatura (°C)",
      data: temperaturas,
      borderColor: "#8b5cf6",
      backgroundColor: "rgba(139, 92, 246, 0.1)",
      fill: true,
      tension: 0.4
    }]
  },
  options: { responsive: true, maintainAspectRatio: false }
});

// ==========================================
// 6. TIEMPO REAL (simulado)
// Cada 2 segundos inventamos una nueva medición.
// Cuando tengas el Arduino, reemplazás esta parte por los datos reales.
// ==========================================
function medirSensores() {
  // Cambia un poquito el valor anterior (entre -0.5 y +0.5)
  estado.temperatura += (Math.random() - 0.5);
  estado.humedad += (Math.random() - 0.5) * 2;

  // Si el aire está encendido, la temperatura tiende a bajar
  if (estado.aire) estado.temperatura -= 0.3;

  // Guardamos la medición para el gráfico
  horas.push(new Date().toLocaleTimeString());
  temperaturas.push(estado.temperatura.toFixed(1));

  // Dejamos solo las últimas 10 mediciones
  if (temperaturas.length > 10) {
    horas.shift();
    temperaturas.shift();
  }

  grafico.update();
  actualizarPantalla();
}

setInterval(medirSensores, 2000);   // 2000 milisegundos = 2 segundos

// Dibujamos todo una vez al abrir la página
medirSensores();

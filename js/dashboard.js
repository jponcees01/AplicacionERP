// ==========================================================
// DASHBOARD.JS
// ==========================================================

const DASHBOARD_ENDPOINTS = {
  kpiInventario: "/kpi-inventario",
  ventasMes: "/ventas-mes",
  ventas7Dias: "/ventas-7-dias",
  stockAlertas: "/stock-alertas",
  solicitudesPendientes: "/solicitudes-pendientes",
  operacionesResumen: "/operaciones-resumen",
  enviosPendientes: "/envios-pendientes",

  /*
   * Si tu Swagger todavía muestra:
   * /dashboard/dashboard/productos-stock-bajo
   * deja esta ruta así.
   *
   * Si ya corregiste el controller y muestra:
   * /dashboard/productos-stock-bajo
   * cambia por:
   * "/productos-stock-bajo"
   */
  productosStockBajo: "/dashboard/productos-stock-bajo",

  actividadReciente: "/actividad-reciente"
};

const COMBO_ALMACEN_ENDPOINT =
  `${CONFIG.API_URL}/inventario/combo?tipo=ALMACEN`;


// ==========================================================
// SERVICIO DASHBOARD
// ==========================================================

const DashboardService = {
  baseUrl: `${CONFIG.API_URL}/dashboard`,

  obtenerSesion() {
    try {
      return CONFIG.getData?.() ?? {};
    } catch (error) {
      console.error("Error leyendo la sesión:", error);
      return {};
    }
  },

  obtenerToken() {
    return this.obtenerSesion()?.accessToken ?? null;
  },

  obtenerHeaders() {
    const token = this.obtenerToken();

    const headers = {
      Accept: "application/json"
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    } else {
      console.warn(
        "No se encontró accessToken dentro de localStorage.data"
      );
    }

    return headers;
  },

  construirUrl(
    endpoint,
    idAlmacen = null,
    parametros = {}
  ) {
    const url = new URL(
      `${this.baseUrl}${endpoint}`
    );

    if (
      idAlmacen !== null &&
      idAlmacen !== undefined &&
      idAlmacen !== ""
    ) {
      url.searchParams.set(
        "idAlmacen",
        String(idAlmacen)
      );
    }

    Object.entries(parametros).forEach(
      ([clave, valor]) => {
        if (
          valor !== null &&
          valor !== undefined &&
          valor !== ""
        ) {
          url.searchParams.set(
            clave,
            String(valor)
          );
        }
      }
    );

    return url.toString();
  },

  async get(
    nombre,
    endpoint,
    idAlmacen = null,
    parametros = {}
  ) {
    const url = this.construirUrl(
      endpoint,
      idAlmacen,
      parametros
    );

    console.group(`ENDPOINT: ${nombre}`);
    console.log("URL:", url);
    console.log("ID almacén:", idAlmacen);
    console.log("Parámetros:", parametros);

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: this.obtenerHeaders()
      });

      console.log("Estado HTTP:", response.status);
      console.log("Respuesta OK:", response.ok);

      const contentType =
        response.headers.get("content-type") ?? "";

      let data;

      if (contentType.includes("application/json")) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      console.log(`Respuesta ${nombre}:`, data);

      if (Array.isArray(data)) {
        console.table(data);
      } else if (
        data &&
        typeof data === "object"
      ) {
        console.table([data]);
      }

      if (!response.ok) {
        const mensaje =
          typeof data === "string"
            ? data
            : data?.message ??
              data?.error ??
              `Error HTTP ${response.status}`;

        throw new Error(mensaje);
      }

      return data;

    } catch (error) {
      console.error(
        `Error consumiendo ${nombre}:`,
        error
      );

      throw error;

    } finally {
      console.groupEnd();
    }
  },

  obtenerKpiInventario(idAlmacen) {
    return this.get(
      "KPI inventario",
      DASHBOARD_ENDPOINTS.kpiInventario,
      idAlmacen
    );
  },

  obtenerVentasMes(idAlmacen) {
    return this.get(
      "Ventas del mes",
      DASHBOARD_ENDPOINTS.ventasMes,
      idAlmacen
    );
  },

  obtenerVentas7Dias(idAlmacen) {
    return this.get(
      "Ventas últimos 7 días",
      DASHBOARD_ENDPOINTS.ventas7Dias,
      idAlmacen
    );
  },

  obtenerStockAlertas(idAlmacen) {
    return this.get(
      "Alertas de stock",
      DASHBOARD_ENDPOINTS.stockAlertas,
      idAlmacen
    );
  },

  obtenerSolicitudesPendientes(idAlmacen) {
    return this.get(
      "Solicitudes pendientes",
      DASHBOARD_ENDPOINTS.solicitudesPendientes,
      idAlmacen
    );
  },

  obtenerOperacionesResumen(idAlmacen) {
    return this.get(
      "Resumen de operaciones",
      DASHBOARD_ENDPOINTS.operacionesResumen,
      idAlmacen
    );
  },

  obtenerEnviosPendientes(idAlmacen) {
    return this.get(
      "Envíos pendientes",
      DASHBOARD_ENDPOINTS.enviosPendientes,
      idAlmacen
    );
  },

  obtenerProductosStockBajo(idAlmacen) {
    return this.get(
      "Productos con stock bajo",
      DASHBOARD_ENDPOINTS.productosStockBajo,
      idAlmacen
    );
  },

  obtenerActividadReciente(
    idAlmacen,
    limite = 5
  ) {
    return this.get(
      "Actividad reciente",
      DASHBOARD_ENDPOINTS.actividadReciente,
      idAlmacen,
      { limite }
    );
  }
};


// ==========================================================
// FUNCIONES GENERALES
// ==========================================================

function obtenerSesion() {
  try {
    return CONFIG.getData?.() ?? {};
  } catch (error) {
    console.error("Error leyendo sesión:", error);
    return {};
  }
}

function obtenerIdAlmacenSeleccionado() {
  const select =
    document.getElementById("selectAlmacen");

  if (select) {
    if (select.value === "") {
      return null;
    }

    const valor = Number(select.value);

    return Number.isNaN(valor)
      ? null
      : valor;
  }

  return obtenerSesion()?.idAlmacen ?? null;
}

function obtenerPrimerRegistro(datos) {
  if (Array.isArray(datos)) {
    return datos[0] ?? {};
  }

  if (
    datos &&
    typeof datos === "object"
  ) {
    return datos;
  }

  return {};
}

function cambiarTexto(id, valor) {
  const elemento = document.getElementById(id);

  if (!elemento) {
    console.warn(
      `No se encontró el elemento #${id}`
    );
    return;
  }

  elemento.textContent = valor ?? 0;
}

function escaparHtml(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatearNumero(valor) {
  return Number(valor ?? 0).toLocaleString(
    "es-PE"
  );
}

function formatearMoneda(valor) {
  return Number(valor ?? 0).toLocaleString(
    "es-PE",
    {
      style: "currency",
      currency: "PEN",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }
  );
}

function formatearFechaHora(fecha) {
  if (!fecha) {
    return "Sin fecha";
  }

  const date = new Date(fecha);

  if (Number.isNaN(date.getTime())) {
    return String(fecha);
  }

  return date.toLocaleString("es-PE", {
    dateStyle: "short",
    timeStyle: "short"
  });
}

function formatearDia(fecha) {
  if (!fecha) {
    return "";
  }

  const date = new Date(`${fecha}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return String(fecha);
  }

  return date.toLocaleDateString("es-PE", {
    weekday: "short",
    day: "2-digit"
  });
}


// ==========================================================
// USUARIO Y FECHA
// ==========================================================

function cargarDatosUsuario() {
  const sesion = obtenerSesion();

  console.group("DATOS DE SESIÓN");
  console.log("Username:", sesion.username);
  console.log("Rol:", sesion.rol);
  console.log("ID usuario:", sesion.idUsuario);
  console.log("ID almacén:", sesion.idAlmacen);
  console.log(
    "Tiene accessToken:",
    Boolean(sesion.accessToken)
  );
  console.groupEnd();

  const username =
    sesion.username ?? "Usuario";

  const rol =
    sesion.rol ?? "Sin rol";

  const nombre =
    sesion.nombre ??
    sesion.primerNombre ??
    username;

  cambiarTexto(
    "nombreUsuarioSesion",
    nombre
  );

  cambiarTexto(
    "rolUsuarioSesion",
    rol
  );

  cambiarTexto(
    "usernameSesion",
    `@${username}`
  );

  cambiarTexto(
    "nombreBienvenida",
    nombre
  );

  const avatar =
    document.getElementById("usuarioAvatar");

  if (avatar) {
    avatar.textContent =
      String(nombre)
        .trim()
        .charAt(0)
        .toUpperCase() || "U";
  }

  if (
    String(rol).toUpperCase() === "ADMIN"
  ) {
    document.body.classList.add(
      "usuario-admin"
    );
  } else {
    document.body.classList.remove(
      "usuario-admin"
    );
  }
}

function cargarFechaActual() {
  const fecha = new Date();

  const texto = fecha.toLocaleDateString(
    "es-PE",
    {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric"
    }
  );

  cambiarTexto(
    "fechaActual",
    texto.charAt(0).toUpperCase() +
      texto.slice(1)
  );
}


// ==========================================================
// COMBO DE ALMACENES
// ==========================================================

function normalizarListaCombo(respuesta) {
  if (Array.isArray(respuesta)) {
    return respuesta;
  }

  if (Array.isArray(respuesta?.data)) {
    return respuesta.data;
  }

  if (Array.isArray(respuesta?.content)) {
    return respuesta.content;
  }

  if (Array.isArray(respuesta?.resultado)) {
    return respuesta.resultado;
  }

  return [];
}

function obtenerIdCombo(item) {
  return (
    item?.idAlmacen ??
    item?.id_almacen ??
    item?.id ??
    item?.valor ??
    item?.value ??
    null
  );
}

function obtenerNombreCombo(item) {
  return (
    item?.nombre ??
    item?.descripcion ??
    item?.label ??
    item?.texto ??
    item?.nombreAlmacen ??
    `Almacén ${obtenerIdCombo(item) ?? ""}`
  );
}

async function cargarComboAlmacenes() {
  const select =
    document.getElementById("selectAlmacen");

  if (!select) {
    console.warn(
      'No existe el select con id="selectAlmacen"'
    );
    return;
  }

  const sesion = obtenerSesion();
  const token = sesion?.accessToken;
  const rol = String(
    sesion?.rol ?? ""
  ).toUpperCase();

  const idAlmacenUsuario =
    sesion?.idAlmacen ?? null;

  console.group("CARGANDO COMBO DE ALMACENES");
  console.log("URL:", COMBO_ALMACEN_ENDPOINT);
  console.log("Rol:", rol);
  console.log(
    "Almacén del usuario:",
    idAlmacenUsuario
  );

  select.disabled = true;
  select.innerHTML = `
    <option value="">
      Cargando almacenes...
    </option>
  `;

  try {
    const response = await fetch(
      COMBO_ALMACEN_ENDPOINT,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`
        }
      }
    );

    console.log("Estado HTTP:", response.status);
    console.log("Respuesta OK:", response.ok);

    const contentType =
      response.headers.get("content-type") ?? "";

    const respuesta =
      contentType.includes("application/json")
        ? await response.json()
        : await response.text();

    console.log(
      "Respuesta completa del combo:",
      respuesta
    );

    if (!response.ok) {
      const mensaje =
        typeof respuesta === "string"
          ? respuesta
          : respuesta?.message ??
            respuesta?.error ??
            `Error HTTP ${response.status}`;

      throw new Error(mensaje);
    }

    const almacenes =
      normalizarListaCombo(respuesta);

    console.log(
      "Lista normalizada de almacenes:",
      almacenes
    );

    console.table(almacenes);

    select.innerHTML = "";

    if (rol === "ADMIN") {
      const opcionTodos =
        document.createElement("option");

      opcionTodos.value = "";
      opcionTodos.textContent =
        "Todos los almacenes";

      select.appendChild(opcionTodos);
    }

    almacenes.forEach((almacen) => {
      const id = obtenerIdCombo(almacen);
      const nombre =
        obtenerNombreCombo(almacen);

      if (
        id === null ||
        id === undefined ||
        id === ""
      ) {
        console.warn(
          "Almacén omitido porque no tiene ID:",
          almacen
        );
        return;
      }

      const opcion =
        document.createElement("option");

      opcion.value = String(id);
      opcion.textContent = nombre;

      select.appendChild(opcion);
    });

    if (rol === "ADMIN") {
      select.value = "";
      select.disabled = false;
    } else {
      const valorUsuario =
        String(idAlmacenUsuario ?? "");

      const existeOpcion =
        Array.from(select.options).some(
          opcion =>
            opcion.value === valorUsuario
        );

      if (
        !existeOpcion &&
        idAlmacenUsuario !== null
      ) {
        const opcionUsuario =
          document.createElement("option");

        opcionUsuario.value =
          valorUsuario;

        opcionUsuario.textContent =
          `Almacén ${idAlmacenUsuario}`;

        select.appendChild(opcionUsuario);
      }

      select.value = valorUsuario;
      select.disabled = true;
    }

    console.log(
      "Valor final del combo:",
      select.value
    );

  } catch (error) {
    console.error(
      "Error cargando combo de almacenes:",
      error
    );

    select.innerHTML = `
      <option value="">
        Error al cargar almacenes
      </option>
    `;

    select.disabled = true;

  } finally {
    console.groupEnd();
  }
}

function configurarCambioAlmacen() {
  const select =
    document.getElementById("selectAlmacen");

  if (!select) {
    return;
  }

  select.addEventListener(
    "change",
    async () => {
      const idAlmacen =
        obtenerIdAlmacenSeleccionado();

      console.log(
        "Almacén seleccionado:",
        idAlmacen
      );

      await cargarDashboard();
    }
  );
}


// ==========================================================
// KPI INVENTARIO
// ==========================================================

function pintarKpiInventario(datos) {
  const registro =
    obtenerPrimerRegistro(datos);

  cambiarTexto(
    "totalProductos",
    formatearNumero(
      registro.totalProductos
    )
  );

  cambiarTexto(
    "stockTotal",
    formatearNumero(
      registro.stockTotal
    )
  );
}


// ==========================================================
// VENTAS DEL MES
// ==========================================================

function pintarVentasMes(datos) {
  const registro =
    obtenerPrimerRegistro(datos);

  cambiarTexto(
    "ventasMes",
    formatearMoneda(
      registro.ventasMes
    )
  );
}


// ==========================================================
// ENVÍOS PENDIENTES
// ==========================================================

function pintarEnviosPendientes(datos) {
  const registro =
    obtenerPrimerRegistro(datos);

  cambiarTexto(
    "enviosPendientes",
    formatearNumero(
      registro.enviosPendientes
    )
  );
}


// ==========================================================
// ALERTAS DE STOCK
// ==========================================================

function pintarStockAlertas(datos) {
  const registro =
    obtenerPrimerRegistro(datos);

  cambiarTexto(
    "productosStockBajo",
    formatearNumero(
      registro.stockBajo
    )
  );

  cambiarTexto(
    "productosSinStock",
    formatearNumero(
      registro.sinStock
    )
  );
}


// ==========================================================
// SOLICITUDES PENDIENTES
// ==========================================================

function pintarSolicitudesPendientes(datos) {
  const registro =
    obtenerPrimerRegistro(datos);

  cambiarTexto(
    "solicitudesPendientes",
    formatearNumero(
      registro.solicitudesPendientes
    )
  );
}


// ==========================================================
// RESUMEN DE OPERACIONES
// ==========================================================

function calcularPorcentaje(
  valor,
  maximo
) {
  const numero = Number(valor ?? 0);
  const limite = Number(maximo ?? 0);

  if (limite <= 0) {
    return numero > 0 ? 100 : 0;
  }

  return Math.min(
    100,
    Math.round(
      (numero / limite) * 100
    )
  );
}

function actualizarBarra(
  id,
  porcentaje
) {
  const barra = document.getElementById(id);

  if (!barra) {
    return;
  }

  barra.style.width =
    `${porcentaje}%`;

  barra.setAttribute(
    "aria-valuenow",
    String(porcentaje)
  );
}

function pintarResumenOperaciones(datos) {
  const registro =
    obtenerPrimerRegistro(datos);

  const ventasPagadas =
    Number(registro.ventasPagadas ?? 0);

  const enviosEntregados =
    Number(registro.enviosEntregados ?? 0);

  const devolucionesProcesadas =
    Number(
      registro.devolucionesProcesadas ?? 0
    );

  const almacenesActivos =
    Number(registro.almacenesActivos ?? 0);

  cambiarTexto(
    "ventasPagadas",
    formatearNumero(ventasPagadas)
  );

  cambiarTexto(
    "enviosEntregados",
    formatearNumero(enviosEntregados)
  );

  cambiarTexto(
    "devolucionesProcesadas",
    formatearNumero(
      devolucionesProcesadas
    )
  );

  cambiarTexto(
    "almacenesActivos",
    formatearNumero(almacenesActivos)
  );

  const maximo = Math.max(
    ventasPagadas,
    enviosEntregados,
    devolucionesProcesadas,
    almacenesActivos,
    1
  );

  actualizarBarra(
    "barraVentasPagadas",
    calcularPorcentaje(
      ventasPagadas,
      maximo
    )
  );

  actualizarBarra(
    "barraEnviosEntregados",
    calcularPorcentaje(
      enviosEntregados,
      maximo
    )
  );

  actualizarBarra(
    "barraDevolucionesProcesadas",
    calcularPorcentaje(
      devolucionesProcesadas,
      maximo
    )
  );

  actualizarBarra(
    "barraAlmacenesActivos",
    calcularPorcentaje(
      almacenesActivos,
      maximo
    )
  );
}


// ==========================================================
// GRÁFICO DE VENTAS
// ==========================================================

function pintarGraficoVentas(datos) {
  const contenedor =
    document.getElementById(
      "graficoVentas"
    );

  if (!contenedor) {
    return;
  }

  const lista = Array.isArray(datos)
    ? [...datos]
    : [];

  lista.sort((a, b) => {
    return new Date(a.dia) -
      new Date(b.dia);
  });

  if (lista.length === 0) {
    contenedor.innerHTML = `
      <div
        class="
          d-flex
          justify-content-center
          align-items-center
          h-100
          text-muted
        "
      >
        No hay datos de ventas para mostrar.
      </div>
    `;

    return;
  }

  const valores = lista.map(
    item => Number(item.totalDia ?? 0)
  );

  const maximo = Math.max(
    ...valores,
    1
  );

  contenedor.innerHTML = `
    <div
      style="
        position: relative;
        width: 100%;
        height: 320px;
        min-height: 320px;
        padding: 15px 10px 0;
      "
    >

      <div
        style="
          position: absolute;
          top: 50px;
          left: 10px;
          right: 10px;
          bottom: 38px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          pointer-events: none;
        "
      >
        <div style="border-top: 1px dashed #e4e7ec;"></div>
        <div style="border-top: 1px dashed #e4e7ec;"></div>
        <div style="border-top: 1px dashed #e4e7ec;"></div>
        <div style="border-top: 1px dashed #e4e7ec;"></div>
      </div>

      <div
        style="
          position: relative;
          z-index: 2;
          display: flex;
          align-items: stretch;
          justify-content: space-between;
          gap: 14px;
          width: 100%;
          height: 100%;
        "
      >

        ${lista.map(item => {
          const valor =
            Number(item.totalDia ?? 0);

          const altura =
            valor === 0
              ? 3
              : Math.max(
                  15,
                  Math.round(
                    (valor / maximo) * 100
                  )
                );

          return `
            <div
              style="
                flex: 1;
                min-width: 45px;
                display: flex;
                flex-direction: column;
                align-items: center;
              "
            >

              <div
                style="
                  min-height: 22px;
                  margin-bottom: 8px;
                  font-size: 11px;
                  font-weight: 600;
                  color: #344054;
                  white-space: nowrap;
                "
              >
                ${formatearMoneda(valor)}
              </div>

              <div
                style="
                  width: 100%;
                  height: 230px;
                  display: flex;
                  align-items: flex-end;
                  justify-content: center;
                "
              >

                <div
                  title="${formatearMoneda(valor)}"
                  style="
                    width: 55%;
                    height: ${altura}%;
                    min-height: 5px;
                    border-radius: 8px 8px 3px 3px;
                    background: linear-gradient(
                      180deg,
                      #2563eb 0%,
                      #60a5fa 100%
                    );
                    transition: height .4s ease;
                  "
                ></div>

              </div>

              <div
                style="
                  margin-top: 10px;
                  font-size: 12px;
                  color: #667085;
                  text-transform: capitalize;
                "
              >
                ${formatearDia(item.dia)}
              </div>

            </div>
          `;
        }).join("")}

      </div>

    </div>
  `;
}


// ==========================================================
// TABLA DE STOCK BAJO
// ==========================================================

function pintarProductosStockBajo(datos) {
  const tbody =
    document.getElementById(
      "tablaStockBajo"
    );

  if (!tbody) {
    return;
  }

  const productos = Array.isArray(datos)
    ? datos
    : [];

  tbody.innerHTML = "";

  if (productos.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td
          colspan="5"
          class="text-center text-muted py-4"
        >
          No hay productos con stock bajo.
        </td>
      </tr>
    `;

    return;
  }

  productos.forEach(producto => {
    const stock =
      Number(producto.stock ?? 0);

    const sinStock =
      producto.estadoStock ===
        "SIN_STOCK" ||
      stock <= 0;

    const estadoTexto =
      sinStock
        ? "Sin stock"
        : "Stock bajo";

    const claseEstado =
      sinStock
        ? "text-bg-danger"
        : "text-bg-warning";

    const descripcionProducto = [
      producto.producto,
      producto.variante,
      producto.abreviatura
    ]
      .filter(Boolean)
      .map(escaparHtml)
      .join(" - ");

    const fila =
      document.createElement("tr");

    fila.innerHTML = `
      <td>
        <div class="fw-semibold">
          ${descripcionProducto || "Producto"}
        </div>

        ${
          producto.sku
            ? `
              <small class="text-muted">
                SKU:
                ${escaparHtml(producto.sku)}
              </small>
            `
            : ""
        }
      </td>

      <td>
        ${escaparHtml(
          producto.almacen ?? "-"
        )}
      </td>

      <td>
        <strong>
          ${formatearNumero(stock)}
        </strong>
      </td>

      <td>
        ${formatearNumero(
          producto.stockMinimo
        )}
      </td>

      <td>
        <span class="badge ${claseEstado}">
          ${estadoTexto}
        </span>
      </td>
    `;

    tbody.appendChild(fila);
  });
}


// ==========================================================
// ACTIVIDAD RECIENTE
// ==========================================================

function obtenerIconoActividad(tipo) {
  switch (
    String(tipo ?? "").toUpperCase()
  ) {
    case "VENTA":
      return "bi-cart-check";

    case "ENVIO":
      return "bi-truck";

    case "DEVOLUCION":
      return "bi-arrow-return-left";

    case "SOLICITUD":
      return "bi-clipboard-check";

    case "INVENTARIO":
      return "bi-boxes";

    default:
      return "bi-bell";
  }
}

function obtenerClaseActividad(tipo) {
  switch (
    String(tipo ?? "").toUpperCase()
  ) {
    case "VENTA":
      return "bg-success-subtle text-success";

    case "ENVIO":
      return "bg-info-subtle text-info";

    case "DEVOLUCION":
      return "bg-warning-subtle text-warning";

    case "SOLICITUD":
      return "bg-primary-subtle text-primary";

    case "INVENTARIO":
      return "bg-secondary-subtle text-secondary";

    default:
      return "bg-light text-dark";
  }
}

function pintarActividadReciente(datos) {
  const contenedor =
    document.getElementById(
      "listaActividad"
    );

  if (!contenedor) {
    return;
  }

  const actividades =
    Array.isArray(datos)
      ? datos
      : [];

  contenedor.innerHTML = "";

  if (actividades.length === 0) {
    contenedor.innerHTML = `
      <div class="text-center text-muted py-5">
        <i
          class="bi bi-clock-history fs-3"
        ></i>

        <p class="mt-2 mb-0">
          No hay actividad reciente.
        </p>
      </div>
    `;

    return;
  }

  actividades.forEach(actividad => {
    const item =
      document.createElement("div");

    item.className =
      "d-flex gap-3 py-3 border-bottom";

    item.innerHTML = `
      <div
        class="
          d-flex
          align-items-center
          justify-content-center
          rounded
          flex-shrink-0
          ${obtenerClaseActividad(
            actividad.tipo
          )}
        "
        style="
          width: 42px;
          height: 42px;
        "
      >
        <i
          class="
            bi
            ${obtenerIconoActividad(
              actividad.tipo
            )}
          "
        ></i>
      </div>

      <div class="flex-grow-1">

        <div class="fw-semibold">
          ${escaparHtml(
            actividad.titulo ??
            "Actividad"
          )}
        </div>

        <div class="text-muted small">
          ${escaparHtml(
            actividad.descripcion ?? ""
          )}
        </div>

        <div
          class="text-muted mt-1"
          style="font-size: 11px;"
        >
          ${formatearFechaHora(
            actividad.fecha
          )}
        </div>

      </div>
    `;

    contenedor.appendChild(item);
  });
}


// ==========================================================
// CARGAR TODO EL DASHBOARD
// ==========================================================

async function cargarDashboard() {
  const idAlmacen =
    obtenerIdAlmacenSeleccionado();

  console.group(
    "CARGANDO DASHBOARD COMPLETO"
  );

  console.log(
    "CONFIG.API_URL:",
    CONFIG.API_URL
  );

  console.log(
    "ID almacén seleccionado:",
    idAlmacen
  );

  const peticiones = [
    {
      nombre: "KPI inventario",
      promesa:
        DashboardService
          .obtenerKpiInventario(
            idAlmacen
          )
    },
    {
      nombre: "Ventas del mes",
      promesa:
        DashboardService
          .obtenerVentasMes(
            idAlmacen
          )
    },
    {
      nombre: "Envíos pendientes",
      promesa:
        DashboardService
          .obtenerEnviosPendientes(
            idAlmacen
          )
    },
    {
      nombre: "Alertas de stock",
      promesa:
        DashboardService
          .obtenerStockAlertas(
            idAlmacen
          )
    },
    {
      nombre: "Solicitudes pendientes",
      promesa:
        DashboardService
          .obtenerSolicitudesPendientes(
            idAlmacen
          )
    },
    {
      nombre: "Ventas últimos 7 días",
      promesa:
        DashboardService
          .obtenerVentas7Dias(
            idAlmacen
          )
    },
    {
      nombre: "Resumen de operaciones",
      promesa:
        DashboardService
          .obtenerOperacionesResumen(
            idAlmacen
          )
    },
    {
      nombre: "Productos stock bajo",
      promesa:
        DashboardService
          .obtenerProductosStockBajo(
            idAlmacen
          )
    },
    {
      nombre: "Actividad reciente",
      promesa:
        DashboardService
          .obtenerActividadReciente(
            idAlmacen,
            5
          )
    }
  ];

  const resultados =
    await Promise.allSettled(
      peticiones.map(
        peticion => peticion.promesa
      )
    );

  resultados.forEach(
    (resultado, indice) => {
      const nombre =
        peticiones[indice].nombre;

      if (
        resultado.status ===
        "fulfilled"
      ) {
        console.log(
          `${nombre}:`,
          resultado.value
        );
      } else {
        console.error(
          `${nombre}:`,
          resultado.reason
        );
      }
    }
  );

  const [
    kpiResultado,
    ventasMesResultado,
    enviosResultado,
    stockResultado,
    solicitudesResultado,
    ventas7DiasResultado,
    operacionesResultado,
    productosResultado,
    actividadResultado
  ] = resultados;

  if (
    kpiResultado.status ===
    "fulfilled"
  ) {
    pintarKpiInventario(
      kpiResultado.value
    );
  }

  if (
    ventasMesResultado.status ===
    "fulfilled"
  ) {
    pintarVentasMes(
      ventasMesResultado.value
    );
  }

  if (
    enviosResultado.status ===
    "fulfilled"
  ) {
    pintarEnviosPendientes(
      enviosResultado.value
    );
  }

  if (
    stockResultado.status ===
    "fulfilled"
  ) {
    pintarStockAlertas(
      stockResultado.value
    );
  }

  if (
    solicitudesResultado.status ===
    "fulfilled"
  ) {
    pintarSolicitudesPendientes(
      solicitudesResultado.value
    );
  }

  if (
    ventas7DiasResultado.status ===
    "fulfilled"
  ) {
    pintarGraficoVentas(
      ventas7DiasResultado.value
    );
  }

  if (
    operacionesResultado.status ===
    "fulfilled"
  ) {
    pintarResumenOperaciones(
      operacionesResultado.value
    );
  }

  if (
    productosResultado.status ===
    "fulfilled"
  ) {
    pintarProductosStockBajo(
      productosResultado.value
    );
  }

  if (
    actividadResultado.status ===
    "fulfilled"
  ) {
    pintarActividadReciente(
      actividadResultado.value
    );
  }

  console.groupEnd();
}


// ==========================================================
// BOTÓN ACTUALIZAR
// ==========================================================

window.actualizarDashboard =
  async function actualizarDashboard() {
    console.log(
      "Actualizando dashboard manualmente"
    );

    await cargarDashboard();
  };


// ==========================================================
// INICIALIZACIÓN
// ==========================================================

document.addEventListener(
  "DOMContentLoaded",
  async () => {
    console.log(
      "dashboard.js cargado correctamente"
    );

    cargarDatosUsuario();
    cargarFechaActual();

    configurarCambioAlmacen();

    await cargarComboAlmacenes();

    await cargarDashboard();
  }
);
/* ============================================================
   CONFIGURACIÓN
============================================================ */

const API_URL = CONFIG.API_URL;

const ENDPOINTS = {
    ventas: `${API_URL}/ventas`,
    almacenes: `${API_URL}/almacenes`,
    inventario: `${API_URL}/inventario`,

    pdf(rutaPdf) {

        const rutaLimpia =
            String(rutaPdf ?? "")
                .trim()
                .replaceAll("\\", "/")
                .replace(/^\/+/, "");

        const rutaCodificada =
            rutaLimpia
                .split("/")
                .map(function (segmento) {
                    return encodeURIComponent(segmento);
                })
                .join("/");

        return `${API_URL}/documentos/${rutaCodificada}`;
    }
};


/* ============================================================
   ESTADO GLOBAL
============================================================ */

let ventas = [];
let productosDisponibles = [];
let detalleNuevaVenta = [];

let paginaActual = 0;
let tamanioPagina = 10;
let totalPaginas = 0;
let totalElementos = 0;

let temporizadorBusqueda = null;
let cargandoVentas = false;
let registrandoVenta = false;

let clienteWebSocketVentas = null;
let suscripcionWebSocketVentas = null;

/* ============================================================
   ELEMENTOS DEL HTML
============================================================ */

const tablaVentas =
    document.getElementById("tablaVentas");

const buscarVenta =
    document.getElementById("buscarVenta");

const filtroEstado =
    document.getElementById("filtroEstado");

const fechaInicio =
    document.getElementById("fechaInicio");

const fechaFin =
    document.getElementById("fechaFin");

const selectorAlmacen =
    document.getElementById("idAlmacen");

const selectorProducto =
    document.getElementById("productoSeleccionado");

const inputStock =
    document.getElementById("stockProducto");

const inputCantidad =
    document.getElementById("cantidadProducto");

const inputPrecio =
    document.getElementById("precioVentaProducto");

const tablaDetalleVenta =
    document.getElementById("tablaDetalleVenta");

const botonRegistrarVenta =
    document.getElementById("btnRegistrarVenta");


/* ============================================================
   INICIALIZACIÓN
============================================================ */

document.addEventListener(
    "DOMContentLoaded",
    async function () {

        configurarEventos();

        renderizarDetalleNuevaVenta();

        await cargarAlmacenes();

        await cargarVentas();

        conectarWebSocketVentas();
    }
);

/* ============================================================
   WEBSOCKET DE VENTAS
============================================================ */

function conectarWebSocketVentas() {

    const idAlmacen =
        obtenerIdAlmacenSesion();

    if (
        !Number.isFinite(idAlmacen) ||
        idAlmacen <= 0
    ) {

        console.warn(
            "No se inició el WebSocket de ventas: almacén inválido."
        );

        return;
    }

    if (
        typeof SockJS === "undefined" ||
        typeof StompJs === "undefined"
    ) {

        console.error(
            "SockJS o StompJs no están cargados."
        );

        return;
    }

    if (
        clienteWebSocketVentas &&
        clienteWebSocketVentas.active
    ) {
        return;
    }

    clienteWebSocketVentas =
        new StompJs.Client({

            webSocketFactory:
                function () {

                    return new SockJS(
                        CONFIG.WS_URL
                    );
                },

            reconnectDelay:
                5000,

            heartbeatIncoming:
                10000,

            heartbeatOutgoing:
                10000,

            debug:
                function (mensaje) {

                    console.log(
                        "[STOMP VENTAS]",
                        mensaje
                    );
                }
        });

    clienteWebSocketVentas.onConnect =
        function () {

            console.log(
                "WebSocket de ventas conectado correctamente."
            );

            suscribirseCanalVentas(
                idAlmacen
            );
        };

    clienteWebSocketVentas.onStompError =
        function (frame) {

            console.error(
                "Error STOMP ventas:",
                frame.headers?.message
            );

            console.error(
                frame.body
            );
        };

    clienteWebSocketVentas.onWebSocketError =
        function (error) {

            console.error(
                "Error WebSocket ventas:",
                error
            );
        };

    clienteWebSocketVentas.onWebSocketClose =
        function () {

            console.warn(
                "WebSocket de ventas desconectado."
            );
        };

    clienteWebSocketVentas.activate();
}

function suscribirseCanalVentas(
    idAlmacen
) {

    if (
        !clienteWebSocketVentas ||
        !clienteWebSocketVentas.connected
    ) {
        return;
    }

    if (suscripcionWebSocketVentas) {

        suscripcionWebSocketVentas
            .unsubscribe();

        suscripcionWebSocketVentas =
            null;
    }

    const canal =
        `/topic/ventas/almacen/${idAlmacen}`;

    suscripcionWebSocketVentas =
        clienteWebSocketVentas.subscribe(
            canal,
            procesarEventoWebSocketVenta
        );

    console.log(
        "Suscrito al canal:",
        canal
    );
}

async function procesarEventoWebSocketVenta(
    mensaje
) {

    try {

        const evento =
            JSON.parse(
                mensaje.body
            );

        console.log(
            "Evento WebSocket de venta recibido:",
            evento
        );

        /*
         * Esperar a que finalice la transacción del backend.
         */
        await new Promise(
            resolve =>
                setTimeout(
                    resolve,
                    500
                )
        );

        paginaActual = 0;

        await cargarVentas();

        const idAlmacen =
            obtenerIdAlmacenSesion();

        /*
         * Actualizar el stock del combo de productos.
         */
        if (idAlmacen) {

            await cargarProductosDisponibles(
                idAlmacen
            );
        }

        mostrarMensajeWebSocketVenta(
            evento
        );

        if (
            typeof actualizarAlertasGlobales ===
            "function"
        ) {
            actualizarAlertasGlobales();
        }

    } catch (error) {

        console.error(
            "Error procesando evento WebSocket de venta:",
            error
        );
    }
}


function mostrarMensajeWebSocketVenta(
    evento
) {

    const accion =
        String(
            evento?.accion || ""
        )
            .trim()
            .toUpperCase();

    let mensaje =
        evento?.mensaje ||
        "Se actualizó una venta.";

    let tipo =
        "info";

    switch (accion) {

        case "VENTA_CREADA":

            mensaje =
                "Se registró una nueva venta.";

            tipo =
                "success";

            break;

        case "VENTA_REGISTRADA":

            mensaje =
                "Se registró una nueva venta.";

            tipo =
                "success";

            break;

        case "VENTA_ANULADA":

            mensaje =
                "La venta fue anulada.";

            tipo =
                "danger";

            break;
    }

    mostrarToast(
        mensaje,
        tipo
    );
}

/* ============================================================
   EVENTOS
============================================================ */

function configurarEventos() {

    buscarVenta?.addEventListener(
        "input",
        function () {

            clearTimeout(temporizadorBusqueda);

            temporizadorBusqueda = setTimeout(
                function () {
                    paginaActual = 0;
                    cargarVentas();
                },
                400
            );
        }
    );

    filtroEstado?.addEventListener(
        "change",
        function () {
            paginaActual = 0;
            cargarVentas();
        }
    );

    fechaInicio?.addEventListener(
        "change",
        function () {
            paginaActual = 0;
            cargarVentas();
        }
    );

    fechaFin?.addEventListener(
        "change",
        function () {
            paginaActual = 0;
            cargarVentas();
        }
    );

    selectorAlmacen?.addEventListener(
        "change",
        async function () {

            detalleNuevaVenta = [];
            productosDisponibles = [];

            renderizarDetalleNuevaVenta();
            limpiarProductoSeleccionado();

            const idAlmacen =
                convertirNumero(
                    selectorAlmacen.value
                );

            if (!idAlmacen) {

                bloquearProductos(
                    "Primero selecciona un almacén"
                );

                return;
            }

            await cargarProductosDisponibles(
                idAlmacen
            );
        }
    );

    selectorProducto?.addEventListener(
        "change",
        cargarProductoSeleccionado
    );
}


/* ============================================================
   DATOS DE SESIÓN
============================================================ */

function obtenerDatosSesion() {

    try {

        if (
            typeof CONFIG !== "undefined" &&
            typeof CONFIG.getData === "function"
        ) {
            return CONFIG.getData();
        }

        const datos =
            localStorage.getItem("data");

        return datos
            ? JSON.parse(datos)
            : null;

    } catch (error) {

        console.error(
            "No se pudieron leer los datos de sesión:",
            error
        );

        return null;
    }
}


function obtenerToken() {

    const datos =
        obtenerDatosSesion();

    return (
        datos?.accessToken ??
        localStorage.getItem("accessToken") ??
        null
    );
}


function obtenerIdAlmacenSesion() {

    const datos =
        obtenerDatosSesion();

    return convertirNumero(
        datos?.idAlmacen
    );
}


/* ============================================================
   HEADERS HTTP
============================================================ */

function obtenerHeaders(
    enviarJson = false
) {

    const headers = {
        Accept: "application/json"
    };

    const token =
        obtenerToken();

    if (token) {
        headers.Authorization =
            `Bearer ${token}`;
    }

    if (enviarJson) {
        headers["Content-Type"] =
            "application/json";
    }

    return headers;
}


/* ============================================================
   CARGAR ALMACENES
============================================================ */

async function cargarAlmacenes() {

    if (!selectorAlmacen) {
        return;
    }

    selectorAlmacen.disabled = true;

    selectorAlmacen.innerHTML = `
        <option value="">
            Cargando almacén...
        </option>
    `;

    try {

        const idAlmacenSesion =
            obtenerIdAlmacenSesion();

        /*
         * Usuario con almacén asignado.
         */
        if (idAlmacenSesion) {

            selectorAlmacen.innerHTML = `
                <option value="${idAlmacenSesion}">
                    Almacén ${idAlmacenSesion}
                </option>
            `;

            selectorAlmacen.value =
                String(idAlmacenSesion);

            selectorAlmacen.disabled =
                true;

            await cargarProductosDisponibles(
                idAlmacenSesion
            );

            return;
        }

        /*
         * Usuario sin almacén asignado.
         */
        const parametros =
            new URLSearchParams({
                page: "0",
                size: "200"
            });

        const response =
            await fetch(
                `${ENDPOINTS.almacenes}?${parametros.toString()}`,
                {
                    method: "GET",
                    headers: obtenerHeaders()
                }
            );

        if (!response.ok) {

            throw new Error(
                await leerError(
                    response,
                    "No se pudieron cargar los almacenes"
                )
            );
        }

        const respuesta =
            await response.json();

        const almacenes =
            obtenerLista(respuesta);

        selectorAlmacen.innerHTML = `
            <option value="">
                Seleccionar almacén
            </option>
        `;

        almacenes.forEach(
            function (almacen) {

                const idAlmacen =
                    almacen.idAlmacen ??
                    almacen.id ??
                    almacen.value;

                if (!idAlmacen) {
                    return;
                }

                const nombre =
                    almacen.nombre ??
                    almacen.almacen ??
                    almacen.descripcion ??
                    almacen.texto ??
                    `Almacén ${idAlmacen}`;

                const opcion =
                    document.createElement(
                        "option"
                    );

                opcion.value =
                    String(idAlmacen);

                opcion.textContent =
                    nombre;

                selectorAlmacen.appendChild(
                    opcion
                );
            }
        );

        selectorAlmacen.disabled =
            false;

    } catch (error) {

        console.error(
            "Error cargando almacenes:",
            error
        );

        selectorAlmacen.innerHTML = `
            <option value="">
                No se pudo cargar el almacén
            </option>
        `;

        selectorAlmacen.disabled =
            true;

        mostrarToast(
            error.message,
            "danger"
        );
    }
}


/* ============================================================
   CARGAR PRODUCTOS DESDE GET /inventario
============================================================ */

async function cargarProductosDisponibles(
    idAlmacen
) {

    productosDisponibles = [];

    bloquearProductos(
        "Cargando productos..."
    );

    try {

        const parametros =
            new URLSearchParams();

        parametros.set(
            "idAlmacen",
            String(idAlmacen)
        );

        parametros.set(
            "estado",
            "true"
        );

        parametros.set(
            "page",
            "0"
        );

        parametros.set(
            "size",
            "200"
        );

        const response =
            await fetch(
                `${ENDPOINTS.inventario}?${parametros.toString()}`,
                {
                    method: "GET",
                    headers: obtenerHeaders()
                }
            );

        if (!response.ok) {

            throw new Error(
                await leerError(
                    response,
                    "No se pudieron cargar los productos del inventario"
                )
            );
        }

        const respuesta =
            await response.json();

        productosDisponibles =
            obtenerLista(respuesta)
                .map(normalizarProducto)
                .filter(
                    function (producto) {

                        return (
                            producto.idInventario !== null &&
                            producto.stock > 0 &&
                            producto.estado !== false
                        );
                    }
                );

        cargarComboProductos();

    } catch (error) {

        console.error(
            "Error cargando productos:",
            error
        );

        bloquearProductos(
            "No se pudieron cargar los productos"
        );

        mostrarToast(
            error.message,
            "danger"
        );
    }
}


/* ============================================================
   NORMALIZAR PRODUCTO
============================================================ */

function normalizarProducto(
    producto
) {

    return {

        idInventario:
            convertirNumero(
                producto.idInventario ??
                producto.id_inventario ??
                producto.id
            ),

        codigo:
            producto.sku ??
            producto.codigo ??
            producto.codigoProducto ??
            producto.codigoBarra ??
            "SIN CÓDIGO",

        nombre:
            producto.nombreProducto ??
            producto.producto ??
            producto.nombre ??
            "Producto",

        variante:
            producto.variante ??
            producto.descripcionVariante ??
            producto.descripcion ??
            "Sin variante",

        unidad:
            producto.unidadAbreviatura ??
            producto.abreviatura ??
            producto.unidad ??
            producto.unidadMedida ??
            "-",

        stock:
            convertirNumero(
                producto.stock ??
                producto.stockActual ??
                producto.cantidad
            ) || 0,

        precioVenta:
            convertirNumero(
                producto.precioVenta ??
                producto.precio_venta ??
                producto.precio ??
                producto.precioUnitario
            ) || 0,

        estado:
            normalizarBooleano(
                producto.estado
            )
    };
}


/* ============================================================
   COMBO DE PRODUCTOS
============================================================ */

function cargarComboProductos() {

    if (!selectorProducto) {
        return;
    }

    selectorProducto.innerHTML = `
        <option value="">
            Seleccionar producto
        </option>
    `;

    if (
        productosDisponibles.length === 0
    ) {

        selectorProducto.innerHTML = `
            <option value="">
                No hay productos con stock disponible
            </option>
        `;

        selectorProducto.disabled =
            true;

        return;
    }

    productosDisponibles.forEach(
        function (producto) {

            const opcion =
                document.createElement(
                    "option"
                );

            opcion.value =
                String(producto.idInventario);

            opcion.textContent =
                `${producto.codigo} - ` +
                `${producto.nombre} - ` +
                `${producto.variante} - ` +
                `Stock: ${producto.stock}`;

            selectorProducto.appendChild(
                opcion
            );
        }
    );

    selectorProducto.disabled =
        false;
}


function bloquearProductos(
    mensaje
) {

    if (!selectorProducto) {
        return;
    }

    selectorProducto.innerHTML = `
        <option value="">
            ${escaparHtml(mensaje)}
        </option>
    `;

    selectorProducto.disabled =
        true;

    limpiarProductoSeleccionado();
}


/* ============================================================
   PRODUCTO SELECCIONADO
============================================================ */

function cargarProductoSeleccionado() {

    const idInventario =
        convertirNumero(
            selectorProducto?.value
        );

    const producto =
        productosDisponibles.find(
            function (item) {
                return (
                    item.idInventario ===
                    idInventario
                );
            }
        );

    if (!producto) {

        limpiarProductoSeleccionado();

        return;
    }

    inputStock.value =
        String(producto.stock);

    inputCantidad.value =
        "1";

    inputCantidad.max =
        String(producto.stock);

    inputPrecio.value =
        producto.precioVenta > 0
            ? producto.precioVenta.toFixed(2)
            : "";
}


function limpiarProductoSeleccionado() {

    if (inputStock) {
        inputStock.value = "0";
    }

    if (inputCantidad) {

        inputCantidad.value = "1";

        inputCantidad.removeAttribute(
            "max"
        );
    }

    if (inputPrecio) {
        inputPrecio.value = "";
    }
}


/* ============================================================
   ABRIR MODAL NUEVA VENTA
============================================================ */

async function abrirModalNuevaVenta() {

    limpiarFormularioVenta();

    const elementoModal =
        document.getElementById(
            "modalVenta"
        );

    if (!elementoModal) {

        mostrarToast(
            "No se encontró el modal de nueva venta",
            "danger"
        );

        return;
    }

    const modal =
        bootstrap.Modal.getOrCreateInstance(
            elementoModal
        );

    modal.show();

    const idAlmacen =
        convertirNumero(
            selectorAlmacen?.value
        ) ??
        obtenerIdAlmacenSesion();

    if (!idAlmacen) {

        bloquearProductos(
            "Primero selecciona un almacén"
        );

        return;
    }

    if (
        selectorAlmacen &&
        !selectorAlmacen.value
    ) {
        selectorAlmacen.value =
            String(idAlmacen);
    }

    await cargarProductosDisponibles(
        idAlmacen
    );
}


function limpiarFormularioVenta() {

    detalleNuevaVenta = [];

    const tipoComprobante =
        document.getElementById(
            "tipoComprobante"
        );

    const observacion =
        document.getElementById(
            "observacion"
        );

    if (tipoComprobante) {
        tipoComprobante.value = "";
    }

    if (observacion) {
        observacion.value = "";
    }

    if (selectorProducto) {
        selectorProducto.value = "";
    }

    limpiarProductoSeleccionado();

    renderizarDetalleNuevaVenta();
}


/* ============================================================
   AGREGAR PRODUCTO
============================================================ */

function agregarProductoVenta() {

    const idInventario =
        convertirNumero(
            selectorProducto?.value
        );

    const cantidad =
        convertirNumero(
            inputCantidad?.value
        );

    const precio =
        convertirNumero(
            inputPrecio?.value
        );

    if (!idInventario) {

        mostrarToast(
            "Selecciona un producto",
            "warning"
        );

        return;
    }

    const producto =
        productosDisponibles.find(
            function (item) {
                return (
                    item.idInventario ===
                    idInventario
                );
            }
        );

    if (!producto) {

        mostrarToast(
            "No se encontró el producto seleccionado",
            "danger"
        );

        return;
    }

    if (
        !Number.isInteger(cantidad) ||
        cantidad <= 0
    ) {

        mostrarToast(
            "La cantidad debe ser un número entero mayor que cero",
            "warning"
        );

        return;
    }

    if (
        precio === null ||
        precio <= 0
    ) {

        mostrarToast(
            "El precio debe ser mayor que cero",
            "warning"
        );

        return;
    }

    const detalleExistente =
        detalleNuevaVenta.find(
            function (detalle) {
                return (
                    detalle.idInventario ===
                    idInventario
                );
            }
        );

    const cantidadTotal =
        detalleExistente
            ? detalleExistente.cantidad +
            cantidad
            : cantidad;

    if (
        cantidadTotal >
        producto.stock
    ) {

        mostrarToast(
            `Stock insuficiente. Disponible: ${producto.stock}`,
            "warning"
        );

        return;
    }

    if (detalleExistente) {

        detalleExistente.cantidad =
            cantidadTotal;

        detalleExistente.precio =
            precio;

        detalleExistente.subtotal =
            cantidadTotal * precio;

    } else {

        detalleNuevaVenta.push({

            idInventario:
                producto.idInventario,

            codigo:
                producto.codigo,

            nombre:
                producto.nombre,

            variante:
                producto.variante,

            unidad:
                producto.unidad,

            stock:
                producto.stock,

            cantidad:
                cantidad,

            precio:
                precio,

            subtotal:
                cantidad * precio
        });
    }

    selectorProducto.value = "";

    limpiarProductoSeleccionado();

    renderizarDetalleNuevaVenta();
}


/* ============================================================
   RENDERIZAR DETALLE
============================================================ */

function renderizarDetalleNuevaVenta() {

    if (!tablaDetalleVenta) {
        return;
    }

    tablaDetalleVenta.innerHTML = "";

    if (
        detalleNuevaVenta.length === 0
    ) {

        tablaDetalleVenta.innerHTML = `
            <tr>

                <td
                    colspan="9"
                    class="text-center text-muted py-4"
                >

                    <i
                        class="bi bi-cart-plus fs-4 d-block mb-2"
                    ></i>

                    Todavía no agregaste productos.

                </td>

            </tr>
        `;

        actualizarTotalVenta();

        return;
    }

    detalleNuevaVenta.forEach(
        function (detalle) {

            const fila =
                document.createElement(
                    "tr"
                );

            fila.innerHTML = `
                <td>
                    ${escaparHtml(detalle.codigo)}
                </td>

                <td>
                    ${escaparHtml(detalle.nombre)}
                </td>

                <td>
                    ${escaparHtml(detalle.variante)}
                </td>

                <td>
                    ${escaparHtml(detalle.unidad)}
                </td>

                <td>
                    ${detalle.stock}
                </td>

                <td>

                    <input
                        type="number"
                        class="form-control form-control-sm"
                        min="1"
                        max="${detalle.stock}"
                        step="1"
                        value="${detalle.cantidad}"
                        onchange="actualizarCantidadDetalle(
                            ${detalle.idInventario},
                            this.value
                        )"
                    >

                </td>

                <td>

                    <div class="input-group input-group-sm">

                        <span class="input-group-text">
                            S/
                        </span>

                        <input
                            type="number"
                            class="form-control"
                            min="0.01"
                            step="0.01"
                            value="${detalle.precio.toFixed(2)}"
                            onchange="actualizarPrecioDetalle(
                                ${detalle.idInventario},
                                this.value
                            )"
                        >

                    </div>

                </td>

                <td class="fw-bold">
                    ${formatearMoneda(
                detalle.subtotal
            )}
                </td>

                <td class="text-center">

                    <button
                        type="button"
                        class="btn btn-sm btn-outline-danger"
                        title="Quitar producto"
                        onclick="eliminarProductoVenta(
                            ${detalle.idInventario}
                        )"
                    >

                        <i class="bi bi-trash"></i>

                    </button>

                </td>
            `;

            tablaDetalleVenta.appendChild(
                fila
            );
        }
    );

    actualizarTotalVenta();
}


function actualizarCantidadDetalle(
    idInventario,
    valor
) {

    const cantidad =
        convertirNumero(valor);

    const detalle =
        detalleNuevaVenta.find(
            function (item) {
                return (
                    item.idInventario ===
                    idInventario
                );
            }
        );

    if (!detalle) {
        return;
    }

    if (
        !Number.isInteger(cantidad) ||
        cantidad <= 0 ||
        cantidad > detalle.stock
    ) {

        mostrarToast(
            `La cantidad debe estar entre 1 y ${detalle.stock}`,
            "warning"
        );

        renderizarDetalleNuevaVenta();

        return;
    }

    detalle.cantidad =
        cantidad;

    detalle.subtotal =
        detalle.cantidad *
        detalle.precio;

    renderizarDetalleNuevaVenta();
}


function actualizarPrecioDetalle(
    idInventario,
    valor
) {

    const precio =
        convertirNumero(valor);

    const detalle =
        detalleNuevaVenta.find(
            function (item) {
                return (
                    item.idInventario ===
                    idInventario
                );
            }
        );

    if (!detalle) {
        return;
    }

    if (
        precio === null ||
        precio <= 0
    ) {

        mostrarToast(
            "El precio debe ser mayor que cero",
            "warning"
        );

        renderizarDetalleNuevaVenta();

        return;
    }

    detalle.precio =
        precio;

    detalle.subtotal =
        detalle.cantidad *
        detalle.precio;

    renderizarDetalleNuevaVenta();
}


function eliminarProductoVenta(
    idInventario
) {

    detalleNuevaVenta =
        detalleNuevaVenta.filter(
            function (detalle) {
                return (
                    detalle.idInventario !==
                    idInventario
                );
            }
        );

    renderizarDetalleNuevaVenta();
}


function calcularTotalVenta() {

    return detalleNuevaVenta.reduce(
        function (total, detalle) {
            return total + detalle.subtotal;
        },
        0
    );
}


function actualizarTotalVenta() {

    const elementoTotal =
        document.getElementById(
            "totalVenta"
        );

    if (!elementoTotal) {
        return;
    }

    elementoTotal.textContent =
        formatearMoneda(
            calcularTotalVenta()
        );
}


/* ============================================================
   REGISTRAR VENTA
============================================================ */

async function registrarVenta() {

    if (registrandoVenta) {
        return;
    }

    const idAlmacen =
        convertirNumero(
            selectorAlmacen?.value
        ) ??
        obtenerIdAlmacenSesion();

    const tipoComprobante =
        document
            .getElementById(
                "tipoComprobante"
            )
            ?.value
            ?.trim();

    const observacion =
        document
            .getElementById(
                "observacion"
            )
            ?.value
            ?.trim();

    if (!idAlmacen) {

        mostrarToast(
            "No se encontró el almacén para registrar la venta",
            "warning"
        );

        return;
    }

    if (!tipoComprobante) {

        mostrarToast(
            "Selecciona el tipo de comprobante",
            "warning"
        );

        return;
    }

    if (
        detalleNuevaVenta.length === 0
    ) {

        mostrarToast(
            "Agrega al menos un producto",
            "warning"
        );

        return;
    }

    const request = {

        idAlmacen:
            idAlmacen,

        tipoComprobante:
            tipoComprobante,

        observacion:
            observacion || null,

        detalles:
            detalleNuevaVenta.map(
                function (detalle) {

                    return {
                        idInventario:
                            detalle.idInventario,

                        cantidad:
                            detalle.cantidad,

                        precio:
                            detalle.precio
                    };
                }
            )
    };

    console.log(
        "Request de venta:",
        request
    );

    registrandoVenta = true;

    cambiarBotonRegistro(true);

    /*
     * No se abre modalCarga aquí porque modalVenta
     * ya se encuentra abierto.
     */

    try {

        const response =
            await fetch(
                ENDPOINTS.ventas,
                {
                    method: "POST",

                    headers:
                        obtenerHeaders(true),

                    body:
                        JSON.stringify(request)
                }
            );

        if (!response.ok) {

            throw new Error(
                await leerError(
                    response,
                    "No se pudo registrar la venta"
                )
            );
        }

        const resultado =
            await response.json();

        const idVenta =
            resultado.idVenta ??
            resultado.id ??
            null;

        /*
         * Cerrar modal de registro inmediatamente.
         */
        cerrarModalVenta();

        /*
         * Limpiar formulario.
         */
        detalleNuevaVenta = [];

        limpiarFormularioVenta();

        /*
         * Mostrar confirmación sin esperar las recargas.
         */
        mostrarToast(
            idVenta
                ? `Venta ${idVenta} registrada correctamente`
                : "Venta registrada correctamente",
            "success"
        );

        if (typeof actualizarAlertasGlobales === "function") { actualizarAlertasGlobales(); }

        /*
         * Actualizar tabla.
         */
        paginaActual = 0;

        try {

            await cargarVentas();

        } catch (errorActualizacion) {

            console.error(
                "La venta se registró, pero no se pudo actualizar la tabla:",
                errorActualizacion
            );
        }

        /*
         * Actualizar productos y stock.
         */
        try {

            await cargarProductosDisponibles(
                idAlmacen
            );

        } catch (errorInventario) {

            console.error(
                "La venta se registró, pero no se pudo actualizar el inventario:",
                errorInventario
            );
        }

    } catch (error) {

        console.error(
            "Error registrando venta:",
            error
        );

        mostrarToast(
            error.message,
            "danger"
        );

    } finally {

        registrandoVenta = false;

        cambiarBotonRegistro(false);
    }
}


function cerrarModalVenta() {

    const elemento =
        document.getElementById(
            "modalVenta"
        );

    if (!elemento) {
        return;
    }

    const modal =
        bootstrap.Modal.getInstance(
            elemento
        );

    if (modal) {
        modal.hide();
    }

    /*
     * Limpieza de seguridad del fondo del modal.
     */
    setTimeout(
        function () {

            if (
                !document.querySelector(
                    ".modal.show"
                )
            ) {

                document.body.classList.remove(
                    "modal-open"
                );

                document.body.style.removeProperty(
                    "overflow"
                );

                document.body.style.removeProperty(
                    "padding-right"
                );

                document
                    .querySelectorAll(
                        ".modal-backdrop"
                    )
                    .forEach(
                        function (backdrop) {
                            backdrop.remove();
                        }
                    );
            }

        },
        350
    );
}


function cambiarBotonRegistro(
    cargando
) {

    if (!botonRegistrarVenta) {
        return;
    }

    botonRegistrarVenta.disabled =
        cargando;

    botonRegistrarVenta.innerHTML =
        cargando
            ? `
                <span
                    class="spinner-border spinner-border-sm me-2"
                    role="status"
                ></span>

                Registrando...
              `
            : `
                <i class="bi bi-floppy me-2"></i>

                Registrar venta
              `;
}


/* ============================================================
   LISTAR VENTAS
============================================================ */

async function cargarVentas() {

    if (cargandoVentas) {
        return;
    }

    cargandoVentas = true;

    mostrarCargandoVentas();

    try {

        const parametros =
            new URLSearchParams({
                page:
                    String(paginaActual),

                size:
                    String(tamanioPagina)
            });

        const estado =
            filtroEstado?.value?.trim();

        const buscar =
            buscarVenta?.value?.trim();

        const inicio =
            fechaInicio?.value;

        const fin =
            fechaFin?.value;

        if (estado) {
            parametros.set(
                "estado",
                estado
            );
        }

        if (buscar) {
            parametros.set(
                "buscar",
                buscar
            );
        }

        if (inicio) {
            parametros.set(
                "fechaInicio",
                inicio
            );
        }

        if (fin) {
            parametros.set(
                "fechaFin",
                fin
            );
        }

        const response =
            await fetch(
                `${ENDPOINTS.ventas}?${parametros.toString()}`,
                {
                    method: "GET",
                    headers: obtenerHeaders()
                }
            );

        if (!response.ok) {

            throw new Error(
                await leerError(
                    response,
                    "No se pudieron cargar las ventas"
                )
            );
        }

        const respuesta =
            await response.json();

        ventas =
            (
                Array.isArray(respuesta)
                    ? respuesta
                    : respuesta.content || []
            ).map(function (venta) {

                return {
                    ...venta,

                    rutaPdf:
                        venta.rutaPdf ??
                        venta.rutapdf ??
                        venta.ruta_pdf ??
                        null
                };
            });

        paginaActual =
            respuesta.number ??
            paginaActual;

        totalPaginas =
            respuesta.totalPages ??
            (
                ventas.length > 0
                    ? 1
                    : 0
            );

        totalElementos =
            respuesta.totalElements ??
            ventas.length;

        renderizarVentas();

        renderizarPaginacion();

        actualizarResumen();

    } catch (error) {

        console.error(
            "Error cargando ventas:",
            error
        );

        ventas = [];
        totalPaginas = 0;
        totalElementos = 0;

        renderizarVentas();
        renderizarPaginacion();
        actualizarResumen();

        mostrarToast(
            error.message,
            "danger"
        );

    } finally {

        cargandoVentas = false;
    }
}


function mostrarCargandoVentas() {

    if (!tablaVentas) {
        return;
    }

    tablaVentas.innerHTML = `
        <tr>

            <td
                colspan="7"
                class="text-center py-5"
            >

                <span
                    class="spinner-border spinner-border-sm text-primary me-2"
                ></span>

                Cargando ventas...

            </td>

        </tr>
    `;
}


/* ============================================================
   RENDERIZAR VENTAS
============================================================ */

function renderizarVentas() {

    if (!tablaVentas) {
        return;
    }

    tablaVentas.innerHTML = "";

    const sinVentas =
        document.getElementById(
            "sinVentas"
        );

    const contenedorPaginacion =
        document.getElementById(
            "contenedorPaginacion"
        );

    if (
        !Array.isArray(ventas) ||
        ventas.length === 0
    ) {

        sinVentas?.classList.remove(
            "d-none"
        );

        contenedorPaginacion?.classList.add(
            "d-none"
        );

        actualizarCantidadRegistros();

        return;
    }

    sinVentas?.classList.add(
        "d-none"
    );

    contenedorPaginacion?.classList.remove(
        "d-none"
    );

    ventas.forEach(
        function (venta) {

            const idVenta =
                venta.idVenta ??
                venta.id;

            const numeroComprobante =
                venta.numeroComprobante ??
                venta.numero ??
                `Venta ${idVenta}`;

            const fecha =
                formatearFechaHora(
                    venta.fecha
                );

            const usuario =
                venta.usuario ??
                "Sin usuario";

            const total =
                convertirNumero(
                    venta.total
                ) || 0;

            const estado =
                venta.estado ??
                "SIN ESTADO";

            const rutaPdf =
                venta.rutaPdf ??
                venta.rutapdf ??
                venta.ruta_pdf ??
                null;

            const botonPdf =
                rutaPdf
                    ? `
                        <button
                            type="button"
                            class="btn btn-sm btn-outline-danger"
                            title="Ver comprobante PDF"
                            onclick="verPdfVenta(${idVenta})"
                        >
                            <i class="bi bi-file-earmark-pdf"></i>
                        </button>
                    `
                    : `
                        <button
                            type="button"
                            class="btn btn-sm btn-outline-secondary"
                            title="PDF no disponible"
                            disabled
                        >
                            <i class="bi bi-file-earmark-x"></i>
                        </button>
                    `;

            const fila =
                document.createElement(
                    "tr"
                );

            fila.innerHTML = `
                <td>
                    ${idVenta}
                </td>

                <td>
                    <span class="numero-venta">
                        ${escaparHtml(
                            numeroComprobante
                        )}
                    </span>
                </td>

                <td>
                    ${escaparHtml(fecha)}
                </td>

                <td>
                    ${escaparHtml(usuario)}
                </td>

                <td class="fw-bold">
                    ${formatearMoneda(total)}
                </td>

                <td>
                    ${crearBadgeEstado(estado)}
                </td>

                <td class="text-center">
                    ${botonPdf}
                </td>
            `;

            tablaVentas.appendChild(
                fila
            );
        }
    );

    actualizarCantidadRegistros();
}


function actualizarCantidadRegistros() {

    const elemento =
        document.getElementById(
            "cantidadRegistrosVenta"
        );

    if (!elemento) {
        return;
    }

    elemento.textContent =
        `${totalElementos} ${totalElementos === 1
            ? "registro"
            : "registros"
        }`;
}


/* ============================================================
   PDF
============================================================ */

async function verPdfVenta(
    idVenta
) {

    let urlTemporalPdf = null;

    try {

        const venta =
            ventas.find(
                function (item) {

                    return Number(
                        item.idVenta ??
                        item.id
                    ) === Number(idVenta);
                }
            );

        if (!venta) {

            throw new Error(
                "No se encontró la venta seleccionada"
            );
        }

        const rutaPdf =
            venta.rutaPdf ??
            venta.rutapdf ??
            venta.ruta_pdf ??
            null;

        if (
            !rutaPdf ||
            String(rutaPdf).trim() === ""
        ) {

            throw new Error(
                "Esta venta no tiene un comprobante PDF disponible"
            );
        }

        const token =
            obtenerToken();

        if (!token) {

            throw new Error(
                "No se encontró el token de acceso"
            );
        }

        const url =
            ENDPOINTS.pdf(
                rutaPdf
            );

        console.log(
            "Ruta PDF:",
            rutaPdf
        );

        console.log(
            "URL PDF:",
            url
        );

        const response =
            await fetch(
                url,
                {
                    method: "GET",

                    headers: {
                        Accept: "application/pdf",
                        Authorization:
                            `Bearer ${token}`
                    },

                    cache: "no-store"
                }
            );

        if (!response.ok) {

            throw new Error(
                await leerError(
                    response,
                    "No se pudo obtener el PDF"
                )
            );
        }

        const blob =
            await response.blob();

        if (blob.size === 0) {

            throw new Error(
                "El archivo PDF está vacío"
            );
        }

        urlTemporalPdf =
            URL.createObjectURL(
                blob
            );

        const iframe =
            document.getElementById(
                "iframeVentaPdf"
            );

        const elementoModal =
            document.getElementById(
                "modalPreviewPdfVenta"
            );

        if (!iframe || !elementoModal) {

            throw new Error(
                "No se encontró el visor del PDF"
            );
        }

        iframe.src =
            urlTemporalPdf;

        const modal =
            bootstrap.Modal
                .getOrCreateInstance(
                    elementoModal
                );

        modal.show();

        elementoModal.addEventListener(
            "hidden.bs.modal",
            function limpiarPdf() {

                iframe.src =
                    "about:blank";

                if (urlTemporalPdf) {

                    URL.revokeObjectURL(
                        urlTemporalPdf
                    );

                    urlTemporalPdf =
                        null;
                }

                elementoModal.removeEventListener(
                    "hidden.bs.modal",
                    limpiarPdf
                );
            }
        );

    } catch (error) {

        console.error(
            "Error visualizando PDF:",
            error
        );

        if (urlTemporalPdf) {

            URL.revokeObjectURL(
                urlTemporalPdf
            );
        }

        mostrarToast(
            error.message,
            "danger"
        );
    }
}


/* ============================================================
   RESUMEN
============================================================ */

async function actualizarResumen() {
    try {

        const url = `${CONFIG.API_URL}/ventas/dashboard?idAlmacen=${CONFIG.getData().idAlmacen}`

        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Accept": "application/json",
                "Authorization": `Bearer ${CONFIG.getData().accessToken}`
            }
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("Error resumen kardex:", data);
            return;
        }

        console.log("RESUMEN VENTAS:", data);

        document.getElementById("totalVentas").textContent = data.totalVentas;

        document.getElementById("totalCompletadas").textContent = data.ventasCompletadas;

        document.getElementById("importeTotalVentas").textContent = formatearMoneda(data.importeRegistrado);


    } catch (error) {
        console.error("Error al obtener kardex:", error);
    }

}


/* ============================================================
   PAGINACIÓN
============================================================ */

function renderizarPaginacion() {

    const paginacion =
        document.getElementById(
            "paginacionVentas"
        );

    const texto =
        document.getElementById(
            "textoPaginacion"
        );

    if (!paginacion) {
        return;
    }

    paginacion.innerHTML = "";

    if (
        totalPaginas <= 0
    ) {

        if (texto) {
            texto.textContent =
                "Sin resultados";
        }

        return;
    }

    if (texto) {

        texto.textContent =
            `Página ${paginaActual + 1} de ${totalPaginas}`;
    }

    paginacion.appendChild(
        crearBotonPagina(
            "Anterior",
            paginaActual - 1,
            paginaActual === 0
        )
    );

    const paginaInicial =
        Math.max(
            0,
            paginaActual - 2
        );

    const paginaFinal =
        Math.min(
            totalPaginas - 1,
            paginaActual + 2
        );

    for (
        let pagina = paginaInicial;
        pagina <= paginaFinal;
        pagina++
    ) {

        paginacion.appendChild(
            crearBotonPagina(
                String(pagina + 1),
                pagina,
                false,
                pagina === paginaActual
            )
        );
    }

    paginacion.appendChild(
        crearBotonPagina(
            "Siguiente",
            paginaActual + 1,
            paginaActual >=
            totalPaginas - 1
        )
    );
}


function crearBotonPagina(
    texto,
    pagina,
    deshabilitado,
    activo = false
) {

    const item =
        document.createElement("li");

    item.className =
        "page-item";

    if (deshabilitado) {
        item.classList.add("disabled");
    }

    if (activo) {
        item.classList.add("active");
    }

    const boton =
        document.createElement("button");

    boton.type =
        "button";

    boton.className =
        "page-link";

    boton.textContent =
        texto;

    boton.disabled =
        deshabilitado;

    boton.addEventListener(
        "click",
        function () {

            if (
                deshabilitado ||
                pagina === paginaActual
            ) {
                return;
            }

            paginaActual =
                pagina;

            cargarVentas();
        }
    );

    item.appendChild(boton);

    return item;
}


/* ============================================================
   FILTROS
============================================================ */

function limpiarFiltros() {

    if (buscarVenta) {
        buscarVenta.value = "";
    }

    if (filtroEstado) {
        filtroEstado.value = "";
    }

    if (fechaInicio) {
        fechaInicio.value = "";
    }

    if (fechaFin) {
        fechaFin.value = "";
    }

    paginaActual = 0;

    cargarVentas();
}


/* ============================================================
   ESTADOS
============================================================ */

function crearBadgeEstado(
    estado
) {

    const valor =
        String(
            estado || ""
        )
            .trim()
            .toUpperCase();

    let clase =
        "text-bg-secondary";

    if (
        valor === "PROCESADO" ||
        valor === "RECIBIDO"
    ) {
        clase =
            "text-bg-success";
    }

    if (
        valor === "CREADO" ||
        valor === "EN_TRANSITO"
    ) {
        clase =
            "text-bg-warning";
    }

    if (
        valor === "ANULADO"
    ) {
        clase =
            "text-bg-danger";
    }

    return `
        <span class="badge ${clase}">
            ${escaparHtml(
        capitalizarEstado(valor)
    )}
        </span>
    `;
}


function capitalizarEstado(
    estado
) {

    if (!estado) {
        return "Sin estado";
    }

    return estado
        .toLowerCase()
        .replaceAll("_", " ")
        .replace(
            /\b\w/g,
            function (letra) {
                return letra.toUpperCase();
            }
        );
}


/* ============================================================
   MODAL DE CARGA
============================================================ */

function mostrarCarga(
    mensaje = "Procesando..."
) {

    const texto =
        document.getElementById(
            "textoCarga"
        );

    if (texto) {
        texto.textContent = mensaje;
    }

    const elemento =
        document.getElementById(
            "modalCarga"
        );

    if (!elemento) {
        return;
    }

    bootstrap.Modal
        .getOrCreateInstance(elemento)
        .show();
}


function ocultarCarga() {

    const elemento =
        document.getElementById(
            "modalCarga"
        );

    if (!elemento) {
        return;
    }

    const modal =
        bootstrap.Modal.getInstance(
            elemento
        );

    if (modal) {
        modal.hide();
    }

    setTimeout(
        function () {

            elemento.classList.remove(
                "show"
            );

            elemento.style.display =
                "none";

            elemento.setAttribute(
                "aria-hidden",
                "true"
            );

            elemento.removeAttribute(
                "aria-modal"
            );

            if (
                !document.querySelector(
                    ".modal.show"
                )
            ) {

                document.body.classList.remove(
                    "modal-open"
                );

                document.body.style.removeProperty(
                    "overflow"
                );

                document.body.style.removeProperty(
                    "padding-right"
                );

                document
                    .querySelectorAll(
                        ".modal-backdrop"
                    )
                    .forEach(
                        function (backdrop) {
                            backdrop.remove();
                        }
                    );
            }

        },
        350
    );
}


/* ============================================================
   TOAST
============================================================ */

function mostrarToast(
    mensaje,
    tipo = "success"
) {

    const toastElemento =
        document.getElementById(
            "toastMensaje"
        );

    const texto =
        document.getElementById(
            "textoToast"
        );

    if (
        !toastElemento ||
        !texto
    ) {

        alert(mensaje);

        return;
    }

    texto.textContent =
        mensaje;

    toastElemento.className =
        `toast align-items-center border-0 text-bg-${tipo}`;

    bootstrap.Toast
        .getOrCreateInstance(
            toastElemento
        )
        .show();
}


/* ============================================================
   ERRORES HTTP
============================================================ */

async function leerError(
    response,
    mensajeDefecto
) {

    try {

        const contentType =
            response.headers.get(
                "content-type"
            ) || "";

        if (
            contentType.includes(
                "application/json"
            )
        ) {

            const error =
                await response.json();

            return (
                error.message ??
                error.mensaje ??
                error.error ??
                error.detalle ??
                mensajeDefecto
            );
        }

        const texto =
            await response.text();

        return (
            texto.trim() ||
            mensajeDefecto
        );

    } catch (error) {

        return mensajeDefecto;
    }
}


/* ============================================================
   UTILIDADES
============================================================ */

function obtenerLista(
    respuesta
) {

    if (Array.isArray(respuesta)) {
        return respuesta;
    }

    if (
        Array.isArray(
            respuesta?.content
        )
    ) {
        return respuesta.content;
    }

    if (
        Array.isArray(
            respuesta?.data
        )
    ) {
        return respuesta.data;
    }

    if (
        Array.isArray(
            respuesta?.resultado
        )
    ) {
        return respuesta.resultado;
    }

    return [];
}


function convertirNumero(
    valor
) {

    if (
        valor === null ||
        valor === undefined ||
        valor === ""
    ) {
        return null;
    }

    const numero =
        Number(valor);

    return Number.isFinite(numero)
        ? numero
        : null;
}


function normalizarBooleano(
    valor
) {

    if (
        valor === true ||
        valor === "true" ||
        valor === 1 ||
        valor === "1"
    ) {
        return true;
    }

    if (
        valor === false ||
        valor === "false" ||
        valor === 0 ||
        valor === "0"
    ) {
        return false;
    }

    return null;
}


function formatearMoneda(
    valor
) {

    const numero =
        convertirNumero(valor) || 0;

    return new Intl.NumberFormat(
        "es-PE",
        {
            style: "currency",
            currency: "PEN",
            minimumFractionDigits: 2
        }
    ).format(numero);
}


function formatearFechaHora(
    valor
) {

    if (!valor) {
        return "-";
    }

    const fecha =
        new Date(valor);

    if (
        Number.isNaN(
            fecha.getTime()
        )
    ) {
        return String(valor);
    }

    return new Intl.DateTimeFormat(
        "es-PE",
        {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        }
    ).format(fecha);
}


function escaparHtml(
    valor
) {

    return String(
        valor ?? ""
    )
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

window.addEventListener(
    "beforeunload",
    function () {

        if (suscripcionWebSocketVentas) {

            suscripcionWebSocketVentas
                .unsubscribe();

            suscripcionWebSocketVentas =
                null;
        }

        if (
            clienteWebSocketVentas &&
            clienteWebSocketVentas.active
        ) {

            clienteWebSocketVentas
                .deactivate();
        }
    }
);

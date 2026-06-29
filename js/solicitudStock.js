"use strict";

(function () {

    if (typeof CONFIG === "undefined") {
        console.error(
            "CONFIG no está disponible. Carga config.js antes de solicitudStock.js."
        );
        return;
    }

    /* =========================================================
       ENDPOINTS
    ========================================================= */

    const ENDPOINTS = {

        almacenes:
            `${CONFIG.API_URL}/inventario/combo?tipo=ALMACEN`,

        choferes:
            `${CONFIG.API_URL}/inventario/combo?tipo=CHOFER`,

        vehiculos:
            `${CONFIG.API_URL}/inventario/combo?tipo=VEHICULO`,

        productosSolicitud: (idAlmacen) =>
            `${CONFIG.API_URL}/inventario/productos-solicitud?idAlmacen=${idAlmacen}`,

        solicitudes:
            `${CONFIG.API_URL}/solicitudes-stock`,

        registrarSolicitud:
            `${CONFIG.API_URL}/solicitudes-stock`,

        generarEnvioDesdeSolicitud:
            `${CONFIG.API_URL}/envios/desde-solicitud`,

        anularSolicitud:
            `${CONFIG.API_URL}/envios/anular`,

        pdfSolicitud: function (rutaPdf) {

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

            return `${CONFIG.API_URL}/documentos/${rutaCodificada}`;
        }
    };

    /* =========================================================
       VARIABLES
    ========================================================= */

    let inventarioOrigen = [];
    let detalleSolicitud = [];
    let solicitudesRegistradas = [];

    let paginaActualServidor = 0;
    let totalPaginasServidor = 0;
    let totalElementosServidor = 0;

    const tamanioPagina = 5;

    let temporizadorBusqueda = null;
    let nombreAlmacenSolicitante = "";

    let idSolicitudAprobarSeleccionada = null;
    let idSolicitudAnularSeleccionada = null;
    let clienteWebSocketSolicitudes = null;
    let suscripcionWebSocketSolicitudes = null;

    /* =========================================================
       INICIALIZACIÓN
    ========================================================= */

    document.addEventListener(
        "DOMContentLoaded",
        iniciarPagina
    );

    async function iniciarPagina() {

        configurarEventos();
        renderizarDetalleSolicitud();
        limpiarStockSeleccionado();

        try {

            await cargarAlmacenesOrigen();
            await cargarSolicitudes();
            conectarWebSocketSolicitudes();

        } catch (error) {

            console.error(
                "Error inicializando la página:",
                error
            );

            mostrarToast(
                obtenerMensajeError(error),
                "danger"
            );
        }
    }

    /* =========================================================
   WEBSOCKET SOLICITUDES
========================================================= */

    function conectarWebSocketSolicitudes() {

        const idAlmacen =
            obtenerIdAlmacenSesion();

        if (
            !Number.isFinite(idAlmacen) ||
            idAlmacen <= 0
        ) {

            console.warn(
                "No se inició WebSocket de solicitudes: almacén inválido."
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
            clienteWebSocketSolicitudes &&
            clienteWebSocketSolicitudes.active
        ) {
            return;
        }

        clienteWebSocketSolicitudes =
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
                            "[STOMP SOLICITUDES]",
                            mensaje
                        );
                    }
            });

        clienteWebSocketSolicitudes.onConnect =
            function () {

                console.log(
                    "WebSocket de solicitudes conectado correctamente."
                );

                suscribirseCanalSolicitudes(
                    idAlmacen
                );
            };

        clienteWebSocketSolicitudes.onStompError =
            function (frame) {

                console.error(
                    "Error STOMP solicitudes:",
                    frame.headers?.message
                );

                console.error(
                    frame.body
                );
            };

        clienteWebSocketSolicitudes.onWebSocketError =
            function (error) {

                console.error(
                    "Error WebSocket solicitudes:",
                    error
                );
            };

        clienteWebSocketSolicitudes.onWebSocketClose =
            function () {

                console.warn(
                    "WebSocket de solicitudes desconectado."
                );
            };

        clienteWebSocketSolicitudes.activate();
    }

    function suscribirseCanalSolicitudes(
        idAlmacen
    ) {

        if (
            !clienteWebSocketSolicitudes ||
            !clienteWebSocketSolicitudes.connected
        ) {
            return;
        }

        if (suscripcionWebSocketSolicitudes) {

            suscripcionWebSocketSolicitudes
                .unsubscribe();

            suscripcionWebSocketSolicitudes =
                null;
        }

        const canal =
            `/topic/solicitudes/almacen/${idAlmacen}`;

        suscripcionWebSocketSolicitudes =
            clienteWebSocketSolicitudes.subscribe(
                canal,
                procesarEventoWebSocketSolicitud
            );

        console.log(
            "Suscrito al canal:",
            canal
        );
    }

    async function procesarEventoWebSocketSolicitud(
        mensaje
    ) {

        try {

            const evento =
                JSON.parse(
                    mensaje.body
                );

            console.log(
                "Evento WebSocket de solicitud recibido:",
                evento
            );

            await new Promise(
                resolve =>
                    setTimeout(
                        resolve,
                        500
                    )
            );

            paginaActualServidor = 0;

            await cargarSolicitudes();

            mostrarMensajeWebSocketSolicitud(
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
                "Error procesando evento WebSocket de solicitud:",
                error
            );
        }
    }

    function mostrarMensajeWebSocketSolicitud(
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
            "Se actualizó una solicitud.";

        let tipo =
            "info";

        switch (accion) {

            case "SOLICITUD_CREADA":

                mensaje =
                    "Se creó una nueva solicitud de stock.";

                tipo =
                    "success";

                break;

            case "SOLICITUD_PROCESADA":

                mensaje =
                    "La solicitud fue aprobada y procesada.";

                tipo =
                    "success";

                break;

            case "SOLICITUD_ANULADA":

                mensaje =
                    "La solicitud fue anulada.";

                tipo =
                    "danger";

                break;

            case "ENVIO_GENERADO_DESDE_SOLICITUD":

                mensaje =
                    "Se generó un envío desde la solicitud.";

                tipo =
                    "success";

                break;
        }

        mostrarToast(
            mensaje,
            tipo
        );
    }

    function configurarEventos() {

        document
            .getElementById("buscarSolicitud")
            ?.addEventListener(
                "input",
                function () {

                    clearTimeout(
                        temporizadorBusqueda
                    );

                    temporizadorBusqueda =
                        setTimeout(
                            function () {

                                paginaActualServidor = 0;

                                cargarSolicitudes();
                            },
                            400
                        );
                }
            );

        document
            .getElementById("filtroEstado")
            ?.addEventListener(
                "change",
                function () {

                    paginaActualServidor = 0;

                    cargarSolicitudes();
                }
            );

        document
            .getElementById("choferEnvio")
            ?.addEventListener(
                "change",
                function () {
                    this.classList.remove("is-invalid");
                }
            );

        document
            .getElementById("vehiculoEnvio")
            ?.addEventListener(
                "change",
                function () {
                    this.classList.remove("is-invalid");
                }
            );

        document
            .getElementById("motivoRechazo")
            ?.addEventListener(
                "input",
                function () {
                    this.classList.remove("is-invalid");
                }
            );
    }

    /* =========================================================
       SESIÓN
    ========================================================= */

    function obtenerDatosSesion() {

        try {
            return CONFIG.getData() || null;

        } catch (error) {

            console.error(
                "No se pudo leer la sesión:",
                error
            );

            return null;
        }
    }

    function obtenerToken() {

        return (
            obtenerDatosSesion()?.accessToken ||
            CONFIG.getToken?.() ||
            null
        );
    }

    function obtenerIdAlmacenSesion() {

        return Number(
            obtenerDatosSesion()?.idAlmacen ||
            obtenerDatosSesion()?.idalmacen ||
            obtenerDatosSesion()?.almacen?.idAlmacen ||
            obtenerDatosSesion()?.almacen?.id ||
            0
        );
    }

    /* =========================================================
       PETICIONES HTTP
    ========================================================= */

    async function realizarPeticion(
        url,
        opciones = {}
    ) {

        const token = obtenerToken();

        if (!token) {
            throw new Error(
                "No se encontró el token de acceso."
            );
        }

        const headers = {

            Accept: "application/json",

            Authorization:
                `Bearer ${token}`,

            ...(opciones.body
                ? {
                    "Content-Type": "application/json"
                }
                : {}),

            ...(opciones.headers || {})
        };

        const response = await fetch(
            url,
            {
                ...opciones,
                headers,
                cache: "no-store"
            }
        );

        const contentType =
            response.headers.get("content-type") || "";

        let respuesta = null;

        if (response.status !== 204) {

            respuesta =
                contentType.includes("application/json")
                    ? await response.json()
                    : await response.text();
        }

        if (!response.ok) {

            console.error(
                "Error HTTP:",
                {
                    url,
                    status: response.status,
                    respuesta
                }
            );

            if (response.status === 401) {
                throw new Error(
                    "La sesión expiró o el token no es válido."
                );
            }

            if (response.status === 403) {
                throw new Error(
                    "No tienes permisos para realizar esta operación."
                );
            }

            throw new Error(
                respuesta?.mensaje ||
                respuesta?.message ||
                respuesta?.error ||
                respuesta ||
                `Error HTTP ${response.status}`
            );
        }

        return respuesta;
    }

    function obtenerListaRespuesta(respuesta) {

        if (Array.isArray(respuesta)) {
            return respuesta;
        }

        if (Array.isArray(respuesta?.content)) {
            return respuesta.content;
        }

        if (Array.isArray(respuesta?.data)) {
            return respuesta.data;
        }

        if (Array.isArray(respuesta?.resultado)) {
            return respuesta.resultado;
        }

        if (Array.isArray(respuesta?.lista)) {
            return respuesta.lista;
        }

        return [];
    }

    /* =========================================================
       LISTAR SOLICITUDES
    ========================================================= */

    async function cargarSolicitudes() {

        const buscar =
            document
                .getElementById(
                    "buscarSolicitud"
                )
                ?.value
                ?.trim() || "";

        const estado =
            document
                .getElementById(
                    "filtroEstado"
                )
                ?.value || "";

        const fechaInicio =
            document
                .getElementById(
                    "fechaInicio"
                )
                ?.value || "";

        const fechaFin =
            document
                .getElementById(
                    "fechaFin"
                )
                ?.value || "";

        if (
            fechaInicio &&
            fechaFin &&
            fechaInicio > fechaFin
        ) {

            mostrarToast(
                "La fecha inicial no puede ser mayor que la fecha final.",
                "warning"
            );

            return;
        }

        const parametros =
            new URLSearchParams();

        const idAlmacen =
            obtenerIdAlmacenSesion();

        if (idAlmacen > 0) {

            parametros.set(
                "idAlmacen",
                String(idAlmacen)
            );
        }

        if (buscar) {

            parametros.set(
                "buscar",
                buscar
            );
        }

        /*
         * Tu repository actualmente no recibe estado como parámetro
         * independiente. Se envía como búsqueda únicamente si quieres
         * mantener el filtro actual.
         */
        if (
            estado &&
            estado !== "todos"
        ) {

            parametros.set(
                "buscar",
                estado
            );
        }

        if (fechaInicio) {

            parametros.set(
                "fechaInicio",
                fechaInicio
            );
        }

        if (fechaFin) {

            parametros.set(
                "fechaFin",
                fechaFin
            );
        }

        parametros.set(
            "page",
            String(paginaActualServidor)
        );

        parametros.set(
            "size",
            String(tamanioPagina)
        );

        try {

            const respuesta =
                await realizarPeticion(
                    `${ENDPOINTS.solicitudes}?${parametros.toString()}`
                );

            solicitudesRegistradas =
                obtenerListaRespuesta(
                    respuesta
                ).map(
                    normalizarSolicitud
                );

            paginaActualServidor =
                Number(
                    respuesta?.number ??
                    paginaActualServidor
                );

            totalPaginasServidor =
                Number(
                    respuesta?.totalPages ??
                    (
                        solicitudesRegistradas.length > 0
                            ? 1
                            : 0
                    )
                );

            totalElementosServidor =
                Number(
                    respuesta?.totalElements ??
                    solicitudesRegistradas.length
                );

            renderizarSolicitudes(
                solicitudesRegistradas
            );

            actualizarPaginacionSolicitudes();

            await actualizarResumen();

        } catch (error) {

            solicitudesRegistradas = [];

            paginaActualServidor = 0;
            totalPaginasServidor = 0;
            totalElementosServidor = 0;

            renderizarSolicitudes([]);

            actualizarPaginacionSolicitudes();

            console.error(
                "Error cargando solicitudes:",
                error
            );

            mostrarToast(
                obtenerMensajeError(error),
                "danger"
            );
        }
    }

    function normalizarSolicitud(item) {

        return {

            id: Number(
                item.idSolicitud ??
                item.idsolicitud ??
                item.id_solicitud ??
                item.id ??
                0
            ),

            numero:
                item.numeroSolicitud ??
                item.numeroComprobante ??
                item.numerosolicitud ??
                item.numerocomprobante ??
                item.numero_solicitud ??
                "SIN NÚMERO",

            fecha:
                formatearFecha(
                    item.fecha
                ),

            estado:
                normalizarEstado(
                    item.estado
                ),

            almacenOrigen:
                item.almacenOrigen ??
                item.almacenorigen ??
                item.almacen_origen ??
                "Sin almacén",

            almacenSolicitante:
                item.almacenSolicitante ??
                item.almacenDestino ??
                item.almacendestino ??
                item.almacen_solicitante ??
                item.almacen ??
                "Sin almacén",

            idAlmacenOrigen: Number(
                item.idAlmacenOrigen ??
                item.idalmacenorigen ??
                item.id_almacen_origen ??
                0
            ),

            idAlmacenDestino: Number(
                item.idAlmacenDestino ??
                item.idalmacendestino ??
                item.idAlmacenSolicita ??
                item.idalmacensolicita ??
                item.id_almacen_solicita ??
                item.id_almacen_destino ??
                item.idAlmacen ??
                item.idalmacen ??
                0
            ),
            rutaPdf:
                item.rutaPdf ??
                item.rutapdf ??
                item.ruta_pdf ??
                null
        };
    }

    function normalizarEstado(estado) {

        const valor =
            String(estado ?? "")
                .trim()
                .toUpperCase();

        const estados = {

            PENDIENTE: "Pendiente",
            CREADO: "Creado",
            PROCESADO: "Procesado",
            EN_TRANSITO: "En tránsito",
            "EN TRÁNSITO": "En tránsito",
            RECIBIDO: "Recibido",
            ANULADO: "Anulado"
        };

        return (
            estados[valor] ||
            estado ||
            "Sin estado"
        );
    }

    function formatearFecha(fecha) {

        if (!fecha) {
            return "";
        }

        if (
            typeof fecha === "string" &&
            fecha.includes("/")
        ) {
            return fecha;
        }

        const valor = new Date(fecha);

        if (Number.isNaN(valor.getTime())) {
            return String(fecha);
        }

        return valor.toLocaleString(
            "es-PE",
            {
                dateStyle: "short",
                timeStyle: "short"
            }
        );
    }

    /* =========================================================
       ABRIR MODAL NUEVA SOLICITUD
    ========================================================= */

    function abrirModalNuevaSolicitud() {

        inventarioOrigen = [];
        detalleSolicitud = [];

        asignarValor(
            "almacenOrigen",
            ""
        );

        asignarValor(
            "productoSeleccionado",
            ""
        );

        asignarValor(
            "observacion",
            ""
        );

        bloquearComboProductos(
            "Primero selecciona el almacén de origen"
        );

        limpiarStockSeleccionado();
        renderizarDetalleSolicitud();

        const modal =
            document.getElementById(
                "modalSolicitud"
            );

        if (!modal) {

            mostrarToast(
                "No se encontró el modal de solicitud.",
                "danger"
            );

            return;
        }

        bootstrap.Modal
            .getOrCreateInstance(modal)
            .show();
    }

    /* =========================================================
       ALMACENES
    ========================================================= */

    async function cargarAlmacenesOrigen() {

        const respuesta =
            await realizarPeticion(
                ENDPOINTS.almacenes
            );

        const almacenes =
            obtenerListaRespuesta(
                respuesta
            );

        const select =
            document.getElementById(
                "almacenOrigen"
            );

        if (!select) {
            return;
        }

        const idAlmacenDestino =
            obtenerIdAlmacenSesion();

        const almacenDestino =
            almacenes.find(
                function (almacen) {

                    return Number(
                        almacen.id ??
                        almacen.idAlmacen ??
                        almacen.idalmacen ??
                        0
                    ) === idAlmacenDestino;
                }
            );

        nombreAlmacenSolicitante =
            obtenerTextoCombo(almacenDestino) ||
            `Almacén ${idAlmacenDestino}`;

        asignarValor(
            "almacenDestino",
            idAlmacenDestino
        );

        asignarValor(
            "almacenDestinoNombre",
            nombreAlmacenSolicitante
        );

        select.innerHTML = `
            <option value="">
                Seleccionar almacén de origen
            </option>
        `;

        almacenes.forEach(
            function (almacen) {

                const id = obtenerIdCombo(
                    almacen
                );

                if (
                    !id ||
                    id === idAlmacenDestino
                ) {
                    return;
                }

                const opcion =
                    document.createElement(
                        "option"
                    );

                opcion.value =
                    String(id);

                opcion.textContent =
                    obtenerTextoCombo(
                        almacen
                    ) ||
                    `Almacén ${id}`;

                select.appendChild(
                    opcion
                );
            }
        );
    }

    /* =========================================================
       PRODUCTOS DEL ALMACÉN ORIGEN
    ========================================================= */

    async function cargarInventarioOrigen() {

        const idAlmacenOrigen = Number(
            document
                .getElementById("almacenOrigen")
                ?.value
        );

        inventarioOrigen = [];
        detalleSolicitud = [];

        renderizarDetalleSolicitud();
        limpiarStockSeleccionado();

        if (!idAlmacenOrigen) {

            bloquearComboProductos(
                "Primero selecciona el almacén de origen"
            );

            return;
        }

        bloquearComboProductos(
            "Cargando productos..."
        );

        try {

            const respuesta =
                await realizarPeticion(
                    ENDPOINTS.productosSolicitud(
                        idAlmacenOrigen
                    )
                );

            inventarioOrigen =
                obtenerListaRespuesta(respuesta)
                    .map(normalizarProductoInventario)
                    .filter(
                        function (producto) {

                            return (
                                producto.idProductoUnidad > 0 &&
                                producto.stock > 0
                            );
                        }
                    );

            llenarComboProductos();

        } catch (error) {

            inventarioOrigen = [];

            bloquearComboProductos(
                "No se pudieron cargar los productos"
            );

            mostrarToast(
                obtenerMensajeError(error),
                "danger"
            );
        }
    }

    function normalizarProductoInventario(item) {

        return {

            idProductoUnidad: Number(
                item.idProductoUnidad ??
                item.id_producto_unidad ??
                0
            ),

            codigo:
                item.sku ??
                item.codigoBarra ??
                item.codigo_barra ??
                "SIN-CÓDIGO",

            nombre:
                item.producto ??
                item.nombreProducto ??
                item.nombre ??
                "Producto sin nombre",

            variante:
                item.variante ??
                item.descripcionVariante ??
                item.descripcion_variante ??
                "Sin variante",

            unidad:
                item.unidadMedida ??
                item.unidadAbreviatura ??
                item.unidad_medida ??
                item.unidad_abreviatura ??
                "Sin unidad",

            stock: Number(
                item.stockDisponible ??
                item.stock_disponible ??
                item.stock ??
                0
            )
        };
    }

    /* =========================================================
       COMBO DE PRODUCTOS
    ========================================================= */

    function llenarComboProductos() {

        const select =
            document.getElementById(
                "productoSeleccionado"
            );

        if (!select) {
            return;
        }

        select.innerHTML = "";

        if (inventarioOrigen.length === 0) {

            bloquearComboProductos(
                "El almacén seleccionado no tiene productos con stock"
            );

            return;
        }

        const opcionInicial =
            document.createElement(
                "option"
            );

        opcionInicial.value = "";

        opcionInicial.textContent =
            "Seleccionar producto, variante y unidad";

        select.appendChild(
            opcionInicial
        );

        inventarioOrigen.forEach(
            function (producto) {

                const opcion =
                    document.createElement(
                        "option"
                    );

                opcion.value =
                    String(
                        producto.idProductoUnidad
                    );

                opcion.textContent =
                    `${producto.nombre} | ` +
                    `${producto.variante} | ` +
                    `${producto.unidad}`;

                select.appendChild(
                    opcion
                );
            }
        );

        select.disabled = false;

        limpiarStockSeleccionado();
    }

    function bloquearComboProductos(mensaje) {

        const select =
            document.getElementById(
                "productoSeleccionado"
            );

        if (select) {

            select.disabled = true;

            select.innerHTML = `
                <option value="">
                    ${escaparHtml(mensaje)}
                </option>
            `;
        }

        limpiarStockSeleccionado();
    }

    /* =========================================================
       STOCK DISPONIBLE
    ========================================================= */

    function actualizarStockSeleccionado() {

        const idProductoUnidad = Number(
            document
                .getElementById("productoSeleccionado")
                ?.value
        );

        const producto =
            inventarioOrigen.find(
                function (item) {

                    return (
                        item.idProductoUnidad ===
                        idProductoUnidad
                    );
                }
            );

        if (!producto) {

            limpiarStockSeleccionado();
            return;
        }

        const stock =
            Number(producto.stock || 0);

        asignarValor(
            "stockDisponibleSeleccionado",
            stock
        );

        asignarTexto(
            "textoTopeStock",
            `Cantidad máxima: ${stock}`
        );

        const inputCantidad =
            document.getElementById(
                "cantidadSolicitada"
            );

        if (inputCantidad) {

            inputCantidad.disabled =
                stock <= 0;

            inputCantidad.min = "1";
            inputCantidad.max = String(stock);

            inputCantidad.value =
                stock > 0
                    ? "1"
                    : "0";
        }
    }

    function validarCantidadDisponible(input) {

        const minimo =
            Number(input.min || 1);

        const maximo =
            Number(input.max || 0);

        const cantidad =
            Number(input.value || 0);

        if (cantidad < minimo) {

            input.value =
                String(minimo);

            return;
        }

        if (
            maximo > 0 &&
            cantidad > maximo
        ) {

            input.value =
                String(maximo);

            mostrarToast(
                `Solo puedes solicitar hasta ${maximo} unidades.`,
                "warning"
            );
        }
    }

    function limpiarStockSeleccionado() {

        asignarValor(
            "stockDisponibleSeleccionado",
            0
        );

        asignarTexto(
            "textoTopeStock",
            "Cantidad máxima: 0"
        );

        const inputCantidad =
            document.getElementById(
                "cantidadSolicitada"
            );

        if (inputCantidad) {

            inputCantidad.value = "1";
            inputCantidad.min = "1";
            inputCantidad.max = "1";
            inputCantidad.disabled = true;
        }
    }

    /* =========================================================
       AGREGAR PRODUCTO
    ========================================================= */

    function agregarProductoSolicitud() {

        const idProductoUnidad = Number(
            document
                .getElementById("productoSeleccionado")
                ?.value
        );

        const cantidad = Number(
            document
                .getElementById("cantidadSolicitada")
                ?.value
        );

        if (!idProductoUnidad) {

            mostrarToast(
                "Selecciona un producto.",
                "warning"
            );

            return;
        }

        if (
            !Number.isInteger(cantidad) ||
            cantidad <= 0
        ) {

            mostrarToast(
                "La cantidad debe ser un entero mayor que cero.",
                "warning"
            );

            return;
        }

        const producto =
            inventarioOrigen.find(
                function (item) {

                    return (
                        item.idProductoUnidad ===
                        idProductoUnidad
                    );
                }
            );

        if (!producto) {

            mostrarToast(
                "No se encontró el producto seleccionado.",
                "danger"
            );

            return;
        }

        if (cantidad > producto.stock) {

            mostrarToast(
                `Solo hay ${producto.stock} unidades disponibles.`,
                "warning"
            );

            return;
        }

        const existente =
            detalleSolicitud.find(
                function (item) {

                    return (
                        item.idProductoUnidad ===
                        idProductoUnidad
                    );
                }
            );

        if (existente) {

            const nuevaCantidad =
                existente.cantidad +
                cantidad;

            if (nuevaCantidad > producto.stock) {

                mostrarToast(
                    `La cantidad total no puede superar ${producto.stock}.`,
                    "warning"
                );

                return;
            }

            existente.cantidad =
                nuevaCantidad;

        } else {

            detalleSolicitud.push({
                ...producto,
                cantidad
            });
        }

        asignarValor(
            "productoSeleccionado",
            ""
        );

        limpiarStockSeleccionado();
        renderizarDetalleSolicitud();
    }

    /* =========================================================
       DETALLE NUEVA SOLICITUD
    ========================================================= */

    function renderizarDetalleSolicitud() {

        const tabla =
            document.getElementById(
                "tablaDetalleSolicitud"
            );

        if (!tabla) {
            return;
        }

        if (detalleSolicitud.length === 0) {

            tabla.innerHTML = `
                <tr>
                    <td
                        colspan="7"
                        class="text-center py-5 text-muted"
                    >
                        Todavía no has agregado productos.
                    </td>
                </tr>
            `;

            actualizarTotalUnidades();

            return;
        }

        tabla.innerHTML =
            detalleSolicitud
                .map(
                    function (producto, indice) {

                        return `
                            <tr>

                                <td>
                                    ${escaparHtml(producto.codigo)}
                                </td>

                                <td>
                                    ${escaparHtml(producto.nombre)}
                                </td>

                                <td>
                                    ${escaparHtml(producto.variante)}
                                </td>

                                <td>
                                    ${escaparHtml(producto.unidad)}
                                </td>

                                <td class="text-center">
                                    ${producto.stock}
                                </td>

                                <td class="text-center">

                                    <input
                                        type="number"
                                        class="form-control form-control-sm text-center"
                                        min="1"
                                        max="${producto.stock}"
                                        step="1"
                                        value="${producto.cantidad}"
                                        oninput="
                                            validarCantidadDetalle(
                                                ${indice},
                                                this
                                            )
                                        "
                                    >

                                </td>

                                <td class="text-center">

                                    <button
                                        type="button"
                                        class="btn btn-sm btn-outline-danger"
                                        onclick="
                                            eliminarProductoSolicitud(
                                                ${indice}
                                            )
                                        "
                                    >
                                        <i class="bi bi-trash"></i>
                                    </button>

                                </td>

                            </tr>
                        `;
                    }
                )
                .join("");

        actualizarTotalUnidades();
    }

    function validarCantidadDetalle(
        indice,
        input
    ) {

        const producto =
            detalleSolicitud[indice];

        if (!producto) {
            return;
        }

        let cantidad =
            Number(input.value || 0);

        if (cantidad < 1) {
            cantidad = 1;
        }

        if (cantidad > producto.stock) {

            cantidad =
                producto.stock;

            mostrarToast(
                `La cantidad máxima es ${producto.stock}.`,
                "warning"
            );
        }

        input.value =
            String(cantidad);

        producto.cantidad =
            cantidad;

        actualizarTotalUnidades();
    }

    function eliminarProductoSolicitud(indice) {

        detalleSolicitud.splice(
            indice,
            1
        );

        renderizarDetalleSolicitud();
    }

    function actualizarTotalUnidades() {

        const total =
            detalleSolicitud.reduce(
                function (
                    acumulado,
                    producto
                ) {

                    return (
                        acumulado +
                        Number(producto.cantidad || 0)
                    );
                },
                0
            );

        asignarTexto(
            "totalUnidadesSolicitud",
            total
        );
    }

    /* =========================================================
       REGISTRAR SOLICITUD
    ========================================================= */

    async function registrarSolicitud() {

        const idAlmacenOrigen = Number(
            document
                .getElementById("almacenOrigen")
                ?.value
        );

        const idAlmacenDestino = Number(
            document
                .getElementById("almacenDestino")
                ?.value ||
            obtenerIdAlmacenSesion()
        );

        const nombreAlmacenOrigen =
            obtenerTextoSeleccionado(
                document.getElementById(
                    "almacenOrigen"
                )
            );

        const observacion =
            document
                .getElementById("observacion")
                ?.value
                ?.trim() || "";

        if (!idAlmacenOrigen) {

            mostrarToast(
                "Selecciona el almacén de origen.",
                "warning"
            );

            return;
        }

        if (!idAlmacenDestino) {

            mostrarToast(
                "No se encontró el almacén solicitante.",
                "danger"
            );

            return;
        }

        if (
            idAlmacenOrigen ===
            idAlmacenDestino
        ) {

            mostrarToast(
                "El almacén origen y solicitante no pueden ser iguales.",
                "warning"
            );

            return;
        }

        if (detalleSolicitud.length === 0) {

            mostrarToast(
                "Agrega al menos un producto.",
                "warning"
            );

            return;
        }

        const request = {

            idAlmacenOrigen:
                idAlmacenOrigen,

            idAlmacenDestino:
                idAlmacenDestino,

            observacion:
                observacion ||
                `Solicitud de productos desde ${nombreAlmacenOrigen}`,

            detalle:
                detalleSolicitud.map(
                    function (producto) {

                        return {

                            idProductoUnidad:
                                producto.idProductoUnidad,

                            cantidad:
                                producto.cantidad
                        };
                    }
                )
        };

        console.log(
            "Solicitud enviada:",
            request
        );

        const boton =
            document.getElementById(
                "btnRegistrarSolicitud"
            );

        cambiarEstadoBoton(
            boton,
            true,
            "Registrando..."
        );

        try {

            const respuesta =
                await realizarPeticion(
                    ENDPOINTS.registrarSolicitud,
                    {
                        method: "POST",
                        body: JSON.stringify(request)
                    }
                );

            detalleSolicitud = [];
            inventarioOrigen = [];

            renderizarDetalleSolicitud();
            limpiarStockSeleccionado();

            bootstrap.Modal
                .getInstance(
                    document.getElementById(
                        "modalSolicitud"
                    )
                )
                ?.hide();

            await cargarSolicitudes();

            mostrarToast(
                respuesta?.mensaje ||
                "Solicitud registrada correctamente.",
                "success"
            );

        } catch (error) {

            console.error(
                "Error registrando solicitud:",
                error
            );

            mostrarToast(
                obtenerMensajeError(error),
                "danger"
            );

        } finally {

            cambiarEstadoBoton(
                boton,
                false
            );
        }
    }

    /* =========================================================
       RENDERIZAR TABLA
    ========================================================= */

    function renderizarSolicitudes(lista) {

        const tabla =
            document.getElementById(
                "tablaSolicitudes"
            );

        const sinSolicitudes =
            document.getElementById(
                "sinSolicitudes"
            );

        if (!tabla) {
            return;
        }

        tabla.innerHTML = "";

        if (
            !Array.isArray(lista) ||
            lista.length === 0
        ) {

            tabla.innerHTML = `
                <tr>
                    <td
                        colspan="6"
                        class="text-center py-4 text-muted"
                    >
                        No hay solicitudes cargadas.
                    </td>
                </tr>
            `;

            sinSolicitudes
                ?.classList
                .remove("d-none");

            return;
        }

        sinSolicitudes
            ?.classList
            .add("d-none");

        const idAlmacenSesion =
            obtenerIdAlmacenSesion();

        lista.forEach(
            function (solicitud) {

                const esOrigen =
                    solicitud.idAlmacenOrigen ===
                    idAlmacenSesion;

                const esDestino =
                    solicitud.idAlmacenDestino ===
                    idAlmacenSesion;

                const puedeVerPdf =
                    (
                        esOrigen ||
                        esDestino
                    ) &&
                    solicitud.rutaPdf &&
                    String(
                        solicitud.rutaPdf
                    )
                        .toLowerCase()
                        .endsWith(".pdf");

                const puedeDecidir =
                    esOrigen &&
                    solicitud.estado ===
                    "Pendiente";

                const botonPdf =
                    puedeVerPdf
                        ? `
            <button
                type="button"
                class="btn btn-sm btn-outline-danger"
                title="Ver PDF"
                onclick="verPdfSolicitud(${solicitud.id})"
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

                const botonesDecision =
                    puedeDecidir
                        ? `
                            <button
                                type="button"
                                class="btn btn-sm btn-outline-success"
                                title="Aprobar solicitud"
                                onclick="
                                    abrirModalAprobarSolicitud(
                                        ${solicitud.id}
                                    )
                                "
                            >
                                <i class="bi bi-check-lg"></i>
                            </button>

                            <button
                                type="button"
                                class="btn btn-sm btn-outline-danger"
                                title="Anular solicitud"
                                onclick="
                                    abrirModalRechazarSolicitud(
                                        ${solicitud.id}
                                    )
                                "
                            >
                                <i class="bi bi-x-lg"></i>
                            </button>
                        `
                        : "";

                const fila =
                    document.createElement(
                        "tr"
                    );

                fila.innerHTML = `

                    <td>

                        <span class="numero-solicitud">
                            ${escaparHtml(solicitud.numero)}
                        </span>

                    </td>

                    <td>
                        ${escaparHtml(solicitud.fecha)}
                    </td>

                    <td>
                        ${escaparHtml(solicitud.almacenOrigen)}
                    </td>

                    <td>
                        ${escaparHtml(solicitud.almacenSolicitante)}
                    </td>

                    <td>
                        ${obtenerBadgeEstado(solicitud.estado)}
                    </td>

                    <td class="text-center">

                        <div
                            class="d-flex justify-content-center gap-1 flex-wrap"
                        >
                            ${botonPdf}
                            ${botonesDecision}
                        </div>

                    </td>
                `;

                tabla.appendChild(
                    fila
                );
            }
        );
    }

    /* =========================================================
       APROBAR Y GENERAR ENVÍO
    ========================================================= */

    async function abrirModalAprobarSolicitud(
        idSolicitud
    ) {

        const solicitud =
            buscarSolicitudPorId(
                idSolicitud
            );

        const idAlmacenSesion =
            obtenerIdAlmacenSesion();

        if (!solicitud) {

            mostrarToast(
                "No se encontró la solicitud.",
                "danger"
            );

            return;
        }

        if (
            solicitud.idAlmacenOrigen !==
            idAlmacenSesion
        ) {

            mostrarToast(
                "Solo el almacén de origen puede aprobar esta solicitud.",
                "danger"
            );

            return;
        }

        if (
            solicitud.estado !==
            "Pendiente"
        ) {

            mostrarToast(
                "Solo se pueden aprobar solicitudes pendientes.",
                "warning"
            );

            return;
        }

        idSolicitudAprobarSeleccionada =
            Number(idSolicitud);

        asignarValor(
            "idSolicitudAprobar",
            idSolicitud
        );

        asignarTexto(
            "numeroSolicitudAprobar",
            solicitud.numero
        );

        asignarValor(
            "choferEnvio",
            ""
        );

        asignarValor(
            "vehiculoEnvio",
            ""
        );

        document
            .getElementById("choferEnvio")
            ?.classList
            .remove("is-invalid");

        document
            .getElementById("vehiculoEnvio")
            ?.classList
            .remove("is-invalid");

        const modal =
            document.getElementById(
                "modalAprobarSolicitud"
            );

        if (!modal) {

            mostrarToast(
                "No se encontró el modal de aprobación.",
                "danger"
            );

            return;
        }

        bootstrap.Modal
            .getOrCreateInstance(modal)
            .show();

        await cargarChoferesYVehiculos();
    }

    async function cargarChoferesYVehiculos() {

        const selectChofer =
            document.getElementById(
                "choferEnvio"
            );

        const selectVehiculo =
            document.getElementById(
                "vehiculoEnvio"
            );

        const mensajeCarga =
            document.getElementById(
                "mensajeCargaTransporte"
            );

        if (
            !selectChofer ||
            !selectVehiculo
        ) {
            return;
        }

        selectChofer.disabled = true;
        selectVehiculo.disabled = true;

        selectChofer.innerHTML = `
            <option value="">
                Cargando choferes...
            </option>
        `;

        selectVehiculo.innerHTML = `
            <option value="">
                Cargando vehículos...
            </option>
        `;

        mensajeCarga
            ?.classList
            .remove("d-none");

        try {

            const [
                respuestaChoferes,
                respuestaVehiculos
            ] = await Promise.all([

                realizarPeticion(
                    ENDPOINTS.choferes
                ),

                realizarPeticion(
                    ENDPOINTS.vehiculos
                )
            ]);

            llenarComboGenerico(
                selectChofer,
                obtenerListaRespuesta(
                    respuestaChoferes
                ),
                "Seleccionar chofer"
            );

            llenarComboGenerico(
                selectVehiculo,
                obtenerListaRespuesta(
                    respuestaVehiculos
                ),
                "Seleccionar vehículo"
            );

        } catch (error) {

            console.error(
                "Error cargando choferes o vehículos:",
                error
            );

            selectChofer.innerHTML = `
                <option value="">
                    No se pudieron cargar los choferes
                </option>
            `;

            selectVehiculo.innerHTML = `
                <option value="">
                    No se pudieron cargar los vehículos
                </option>
            `;

            mostrarToast(
                obtenerMensajeError(error),
                "danger"
            );

        } finally {

            selectChofer.disabled = false;
            selectVehiculo.disabled = false;

            mensajeCarga
                ?.classList
                .add("d-none");
        }
    }

    function llenarComboGenerico(
        select,
        lista,
        textoInicial
    ) {

        select.innerHTML = "";

        const opcionInicial =
            document.createElement(
                "option"
            );

        opcionInicial.value = "";
        opcionInicial.textContent =
            textoInicial;

        select.appendChild(
            opcionInicial
        );

        lista.forEach(
            function (item) {

                const id =
                    obtenerIdCombo(item);

                if (!id) {
                    return;
                }

                const opcion =
                    document.createElement(
                        "option"
                    );

                opcion.value =
                    String(id);

                opcion.textContent =
                    obtenerTextoCombo(item) ||
                    `Registro ${id}`;

                select.appendChild(
                    opcion
                );
            }
        );
    }

    async function confirmarAprobacionSolicitud() {

        const idSolicitud = Number(
            document
                .getElementById("idSolicitudAprobar")
                ?.value ||
            idSolicitudAprobarSeleccionada
        );

        const idChofer = Number(
            document
                .getElementById("choferEnvio")
                ?.value
        );

        const idVehiculo = Number(
            document
                .getElementById("vehiculoEnvio")
                ?.value
        );

        const selectChofer =
            document.getElementById(
                "choferEnvio"
            );

        const selectVehiculo =
            document.getElementById(
                "vehiculoEnvio"
            );

        let formularioValido = true;

        selectChofer
            ?.classList
            .remove("is-invalid");

        selectVehiculo
            ?.classList
            .remove("is-invalid");

        if (!idSolicitud) {

            mostrarToast(
                "No se seleccionó una solicitud.",
                "danger"
            );

            return;
        }

        if (!idChofer) {

            selectChofer
                ?.classList
                .add("is-invalid");

            formularioValido = false;
        }

        if (!idVehiculo) {

            selectVehiculo
                ?.classList
                .add("is-invalid");

            formularioValido = false;
        }

        if (!formularioValido) {

            mostrarToast(
                "Selecciona el chofer y el vehículo.",
                "warning"
            );

            return;
        }

        const request = {

            idSolicitud:
                idSolicitud,

            idChofer:
                idChofer,

            idVehiculo:
                idVehiculo
        };

        console.log(
            "Generando envío desde solicitud:",
            request
        );

        const boton =
            document.getElementById(
                "btnConfirmarAprobacion"
            );

        cambiarEstadoBoton(
            boton,
            true,
            "Generando envío..."
        );

        try {

            const respuesta =
                await realizarPeticion(
                    ENDPOINTS.generarEnvioDesdeSolicitud,
                    {
                        method: "POST",
                        body: JSON.stringify(request)
                    }
                );

            bootstrap.Modal
                .getInstance(
                    document.getElementById(
                        "modalAprobarSolicitud"
                    )
                )
                ?.hide();

            idSolicitudAprobarSeleccionada =
                null;

            asignarValor(
                "idSolicitudAprobar",
                ""
            );

            await cargarSolicitudes();

            const idEnvio =
                respuesta?.idGuiaEnvio ??
                respuesta?.idEnvio ??
                respuesta?.data ??
                respuesta;

            mostrarToast(
                respuesta?.mensaje ||
                (
                    idEnvio
                        ? `Solicitud procesada. Envío generado: ${idEnvio}`
                        : "Solicitud procesada y envío generado correctamente."
                ),
                "success"
            );

        } catch (error) {

            console.error(
                "Error generando envío desde solicitud:",
                error
            );

            mostrarToast(
                obtenerMensajeError(error),
                "danger"
            );

        } finally {

            cambiarEstadoBoton(
                boton,
                false
            );
        }
    }

    /* =========================================================
       ANULAR SOLICITUD
    ========================================================= */

    function abrirModalRechazarSolicitud(
        idSolicitud
    ) {

        const solicitud =
            buscarSolicitudPorId(
                idSolicitud
            );

        const idAlmacenSesion =
            obtenerIdAlmacenSesion();

        if (!solicitud) {

            mostrarToast(
                "No se encontró la solicitud.",
                "danger"
            );

            return;
        }

        if (
            solicitud.idAlmacenOrigen !==
            idAlmacenSesion
        ) {

            mostrarToast(
                "Solo el almacén de origen puede anular esta solicitud.",
                "danger"
            );

            return;
        }

        if (
            solicitud.estado !==
            "Pendiente"
        ) {

            mostrarToast(
                "Solo se pueden anular solicitudes pendientes.",
                "warning"
            );

            return;
        }

        idSolicitudAnularSeleccionada =
            Number(idSolicitud);

        asignarValor(
            "idSolicitudRechazo",
            idSolicitud
        );

        asignarTexto(
            "numeroSolicitudRechazo",
            solicitud.numero
        );

        asignarValor(
            "motivoRechazo",
            ""
        );

        document
            .getElementById("motivoRechazo")
            ?.classList
            .remove("is-invalid");

        const modal =
            document.getElementById(
                "modalRechazarSolicitud"
            );

        if (!modal) {

            mostrarToast(
                "No se encontró el modal de anulación.",
                "danger"
            );

            return;
        }

        bootstrap.Modal
            .getOrCreateInstance(modal)
            .show();
    }

    async function confirmarRechazoSolicitud() {

        const idSolicitud = Number(
            document
                .getElementById("idSolicitudRechazo")
                ?.value ||
            idSolicitudAnularSeleccionada
        );

        const textareaMotivo =
            document.getElementById(
                "motivoRechazo"
            );

        const motivo =
            textareaMotivo
                ?.value
                ?.trim() || "";

        textareaMotivo
            ?.classList
            .remove("is-invalid");

        if (!idSolicitud) {

            mostrarToast(
                "No se seleccionó una solicitud.",
                "danger"
            );

            return;
        }

        if (!motivo) {

            textareaMotivo
                ?.classList
                .add("is-invalid");

            mostrarToast(
                "Ingresa el motivo de anulación.",
                "warning"
            );

            return;
        }

        const request = {

            idSolicitud:
                idSolicitud,

            motivo:
                motivo
        };

        const boton =
            document.getElementById(
                "btnConfirmarRechazo"
            );

        cambiarEstadoBoton(
            boton,
            true,
            "Anulando..."
        );

        try {

            const respuesta =
                await realizarPeticion(
                    ENDPOINTS.anularSolicitud,
                    {
                        method: "PUT",
                        body: JSON.stringify(request)
                    }
                );

            bootstrap.Modal
                .getInstance(
                    document.getElementById(
                        "modalRechazarSolicitud"
                    )
                )
                ?.hide();

            idSolicitudAnularSeleccionada =
                null;

            asignarValor(
                "idSolicitudRechazo",
                ""
            );

            await cargarSolicitudes();

            mostrarToast(
                respuesta?.mensaje ||
                "Solicitud anulada correctamente.",
                "success"
            );

        } catch (error) {

            console.error(
                "Error anulando solicitud:",
                error
            );

            mostrarToast(
                obtenerMensajeError(error),
                "danger"
            );

        } finally {

            cambiarEstadoBoton(
                boton,
                false
            );
        }
    }

    /* =========================================================
       PREVIEW DEL PDF
    ========================================================= */
    async function verPdfSolicitud(
        idSolicitud
    ) {

        let urlTemporalPdf = null;

        try {

            const solicitud =
                buscarSolicitudPorId(
                    idSolicitud
                );

            if (!solicitud) {

                throw new Error(
                    "No se encontró la solicitud."
                );
            }

            const idAlmacenSesion =
                obtenerIdAlmacenSesion();

            const perteneceAlOrigen =
                solicitud.idAlmacenOrigen ===
                idAlmacenSesion;

            const perteneceAlDestino =
                solicitud.idAlmacenDestino ===
                idAlmacenSesion;

            if (
                !perteneceAlOrigen &&
                !perteneceAlDestino
            ) {

                throw new Error(
                    "No tienes permiso para ver este PDF."
                );
            }

            const rutaPdf =
                solicitud.rutaPdf ??
                solicitud.rutapdf ??
                solicitud.ruta_pdf ??
                null;

            if (
                !rutaPdf ||
                !String(rutaPdf)
                    .toLowerCase()
                    .endsWith(".pdf")
            ) {

                throw new Error(
                    "Esta solicitud no tiene un PDF válido."
                );
            }

            const token =
                obtenerToken();

            if (!token) {

                throw new Error(
                    "No se encontró el token de acceso."
                );
            }

            const url =
                ENDPOINTS.pdfSolicitud(
                    rutaPdf
                );

            console.log(
                "Ruta PDF solicitud:",
                rutaPdf
            );

            console.log(
                "URL PDF solicitud:",
                url
            );

            const response =
                await fetch(
                    url,
                    {
                        method: "GET",

                        headers: {
                            Accept:
                                "application/pdf",

                            Authorization:
                                `Bearer ${token}`
                        },

                        cache:
                            "no-store"
                    }
                );

            if (!response.ok) {

                const contentType =
                    response.headers.get(
                        "content-type"
                    ) || "";

                let mensaje =
                    "No se pudo cargar el PDF.";

                if (
                    contentType.includes(
                        "application/json"
                    )
                ) {

                    const error =
                        await response.json();

                    mensaje =
                        error?.mensaje ||
                        error?.message ||
                        error?.error ||
                        mensaje;

                } else {

                    const texto =
                        await response.text();

                    if (texto?.trim()) {
                        mensaje = texto;
                    }
                }

                throw new Error(
                    mensaje
                );
            }

            const blob =
                await response.blob();

            if (blob.size === 0) {

                throw new Error(
                    "El archivo PDF está vacío."
                );
            }

            urlTemporalPdf =
                URL.createObjectURL(
                    blob
                );

            const iframe =
                document.getElementById(
                    "iframeSolicitudPdf"
                );

            const modal =
                document.getElementById(
                    "modalPreviewPdf"
                );

            if (!iframe || !modal) {

                throw new Error(
                    "No se encontró el visor del PDF."
                );
            }

            iframe.src =
                urlTemporalPdf;

            bootstrap.Modal
                .getOrCreateInstance(
                    modal
                )
                .show();

            modal.addEventListener(
                "hidden.bs.modal",
                function limpiarPreview() {

                    iframe.src =
                        "about:blank";

                    if (urlTemporalPdf) {

                        URL.revokeObjectURL(
                            urlTemporalPdf
                        );

                        urlTemporalPdf = null;
                    }

                    modal.removeEventListener(
                        "hidden.bs.modal",
                        limpiarPreview
                    );
                }
            );

        } catch (error) {

            console.error(
                "Error mostrando PDF:",
                error
            );

            if (urlTemporalPdf) {

                URL.revokeObjectURL(
                    urlTemporalPdf
                );
            }

            mostrarToast(
                obtenerMensajeError(error),
                "danger"
            );
        }
    }

    /* =========================================================
       FILTROS
    ========================================================= */

    function filtrarSolicitudes() {

        const texto =
            document
                .getElementById("buscarSolicitud")
                ?.value
                ?.trim()
                ?.toLowerCase() || "";

        const estado =
            document
                .getElementById("filtroEstado")
                ?.value ||
            "todos";

        const filtradas =
            solicitudesRegistradas.filter(
                function (solicitud) {

                    const contenido = `
                        ${solicitud.numero}
                        ${solicitud.almacenSolicitante}
                        ${solicitud.almacenOrigen}
                        ${solicitud.estado}
                    `.toLowerCase();

                    const coincideTexto =
                        contenido.includes(texto);

                    const coincideEstado =
                        estado === "todos" ||
                        solicitud.estado
                            .toUpperCase()
                            .replaceAll(" ", "_")
                            .replaceAll("Á", "A") ===
                        estado.toUpperCase();

                    return (
                        coincideTexto &&
                        coincideEstado
                    );
                }
            );

        renderizarSolicitudes(
            filtradas
        );
    }

    function limpiarFiltros() {

        asignarValor(
            "buscarSolicitud",
            ""
        );

        asignarValor(
            "filtroEstado",
            "todos"
        );

        asignarValor(
            "fechaInicio",
            ""
        );

        asignarValor(
            "fechaFin",
            ""
        );

        paginaActualServidor = 0;

        cargarSolicitudes();
    }

    /* =========================================================
       RESUMEN
    ========================================================= */

    async function actualizarResumen() {
        try {

            const url = `${CONFIG.API_URL}/solicitudes-stock/dashboard?idAlmacen=${CONFIG.getData().idAlmacen}`

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

            console.log("RESUMEN SOLICITUDES:", data);

            document.getElementById("totalSolicitudes").textContent =
                data[0].totalSolicitudes ?? 0;

            document.getElementById("totalPendientes").textContent =
                data[0].pendientes ?? 0;

            document.getElementById("totalAprobadas").textContent =
                data[0].procesadas ?? 0;

            document.getElementById("totalRechazadas").textContent =
                data[0].anuladas ?? 0;


        } catch (error) {
            console.error("Error al obtener kardex:", error);
        }
    }

    function obtenerBadgeEstado(estado) {

        const clases = {

            Pendiente:
                "bg-warning-subtle text-warning",

            Creado:
                "bg-primary-subtle text-primary",

            Procesado:
                "bg-success-subtle text-success",

            "En tránsito":
                "bg-info-subtle text-info",

            Recibido:
                "bg-success-subtle text-success",

            Anulado:
                "bg-danger-subtle text-danger"
        };

        const clase =
            clases[estado] ||
            "bg-secondary-subtle text-secondary";

        return `
            <span class="badge ${clase}">
                ${escaparHtml(estado)}
            </span>
        `;
    }

    /* =========================================================
       UTILIDADES PARA COMBOS
    ========================================================= */

    function obtenerIdCombo(item) {

        return Number(
            item?.id ??
            item?.value ??
            item?.idChofer ??
            item?.idchofer ??
            item?.idVehiculo ??
            item?.idvehiculo ??
            item?.idAlmacen ??
            item?.idalmacen ??
            0
        );
    }

    function obtenerTextoCombo(item) {

        if (!item) {
            return "";
        }

        return (
            item.texto ??
            item.label ??
            item.nombreCompleto ??
            item.nombrecompleto ??
            item.nombre ??
            item.descripcion ??
            item.placa ??
            item.codigo ??
            ""
        );
    }

    /* =========================================================
       UTILIDADES GENERALES
    ========================================================= */

    function buscarSolicitudPorId(idSolicitud) {

        return solicitudesRegistradas.find(
            function (solicitud) {

                return (
                    Number(solicitud.id) ===
                    Number(idSolicitud)
                );
            }
        );
    }

    function obtenerTextoSeleccionado(select) {

        if (
            !select ||
            !select.value ||
            select.selectedIndex < 0
        ) {
            return "";
        }

        return select.options[
            select.selectedIndex
        ].textContent.trim();
    }

    function asignarValor(id, valor) {

        const elemento =
            document.getElementById(id);

        if (elemento) {
            elemento.value = valor ?? "";
        }
    }

    function asignarTexto(id, valor) {

        const elemento =
            document.getElementById(id);

        if (elemento) {
            elemento.textContent =
                String(valor ?? "");
        }
    }

    function cambiarEstadoBoton(
        boton,
        procesando,
        textoProcesando = ""
    ) {

        if (!boton) {
            return;
        }

        boton.disabled =
            procesando;

        if (procesando) {

            boton.innerHTML = `
                <span
                    class="spinner-border spinner-border-sm me-2"
                    role="status"
                ></span>

                ${escaparHtml(textoProcesando)}
            `;

            return;
        }

        switch (boton.id) {

            case "btnRegistrarSolicitud":

                boton.innerHTML = `
                    <i class="bi bi-floppy me-2"></i>
                    Registrar solicitud
                `;

                break;

            case "btnConfirmarAprobacion":

                boton.innerHTML = `
                    <i class="bi bi-check-circle me-2"></i>
                    Aprobar y generar envío
                `;

                break;

            case "btnConfirmarRechazo":

                boton.innerHTML = `
                    <i class="bi bi-x-circle me-2"></i>
                    Anular solicitud
                `;

                break;

            default:

                boton.textContent =
                    "Confirmar";
        }
    }

    function obtenerMensajeError(error) {

        return (
            error?.message ||
            "Ocurrió un error inesperado."
        );
    }

    function actualizarPaginacionSolicitudes() {

        const paginaVisible =
            paginaActualServidor + 1;

        asignarTexto(
            "paginaActual",
            totalPaginasServidor > 0
                ? paginaVisible
                : 1
        );

        asignarTexto(
            "textoPaginacion",
            totalPaginasServidor > 0
                ? `Página ${paginaVisible} de ${totalPaginasServidor} - ${totalElementosServidor} registros`
                : "Sin registros"
        );

        document
            .getElementById(
                "itemPaginaAnterior"
            )
            ?.classList
            .toggle(
                "disabled",
                paginaActualServidor <= 0
            );

        document
            .getElementById(
                "itemPaginaSiguiente"
            )
            ?.classList
            .toggle(
                "disabled",
                totalPaginasServidor === 0 ||
                paginaActualServidor >=
                totalPaginasServidor - 1
            );
    }


    async function cambiarPagina(
        cambio
    ) {

        const nuevaPagina =
            paginaActualServidor +
            Number(cambio);

        if (
            nuevaPagina < 0 ||
            nuevaPagina >=
            totalPaginasServidor
        ) {
            return;
        }

        paginaActualServidor =
            nuevaPagina;

        await cargarSolicitudes();
    }

    function escaparHtml(valor) {

        return String(valor ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    /* =========================================================
       TOAST
    ========================================================= */

    function mostrarToast(
        mensaje,
        tipo = "success"
    ) {

        const toast =
            document.getElementById(
                "toastMensaje"
            );

        const texto =
            document.getElementById(
                "textoToast"
            );

        if (!toast || !texto) {

            alert(mensaje);
            return;
        }

        toast.classList.remove(
            "text-bg-success",
            "text-bg-danger",
            "text-bg-warning",
            "text-bg-info"
        );

        toast.classList.add(
            `text-bg-${tipo}`
        );

        texto.textContent =
            mensaje;

        bootstrap.Toast
            .getOrCreateInstance(toast)
            .show();
    }

    /* =========================================================
       FUNCIONES EXPUESTAS AL HTML
    ========================================================= */

    window.abrirModalNuevaSolicitud =
        abrirModalNuevaSolicitud;

    window.cargarInventarioOrigen =
        cargarInventarioOrigen;

    window.actualizarStockSeleccionado =
        actualizarStockSeleccionado;

    window.validarCantidadDisponible =
        validarCantidadDisponible;

    window.agregarProductoSolicitud =
        agregarProductoSolicitud;

    window.validarCantidadDetalle =
        validarCantidadDetalle;

    window.eliminarProductoSolicitud =
        eliminarProductoSolicitud;

    window.registrarSolicitud =
        registrarSolicitud;

    window.abrirModalAprobarSolicitud =
        abrirModalAprobarSolicitud;

    window.confirmarAprobacionSolicitud =
        confirmarAprobacionSolicitud;

    window.abrirModalRechazarSolicitud =
        abrirModalRechazarSolicitud;

    window.confirmarRechazoSolicitud =
        confirmarRechazoSolicitud;

    window.verPdfSolicitud =
        verPdfSolicitud;

    window.limpiarFiltros =
        limpiarFiltros;

    window.cargarSolicitudes =
        cargarSolicitudes;
    window.cambiarPagina =
        cambiarPagina;

    window.addEventListener(
        "beforeunload",
        function () {

            if (suscripcionWebSocketSolicitudes) {

                suscripcionWebSocketSolicitudes
                    .unsubscribe();

                suscripcionWebSocketSolicitudes =
                    null;
            }

            if (
                clienteWebSocketSolicitudes &&
                clienteWebSocketSolicitudes.active
            ) {

                clienteWebSocketSolicitudes
                    .deactivate();
            }
        }
    );

})();

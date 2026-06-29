"use strict";

(function () {

    if (typeof CONFIG === "undefined") {
        console.error(
            "CONFIG no está disponible. Debes cargar config.js antes de envios.js."
        );
        return;
    }

    /* =========================================================
       ENDPOINTS
    ========================================================= */

    const ENDPOINTS = {
        listarEnvios: `${CONFIG.API_URL}/envios`,
        crearEnvio: `${CONFIG.API_URL}/envios`,

        enviarGuia: (idGuia) =>
            `${CONFIG.API_URL}/envios/${idGuia}/enviar`,

        recibirGuia: (idGuia) =>
            `${CONFIG.API_URL}/envios/${idGuia}/recibir`,

        anularGuia: (idGuia) =>
            `${CONFIG.API_URL}/envios/${idGuia}/anular`,

        pdfDocumento: (rutaPdf) => {
            const rutaLimpia = String(rutaPdf ?? "")
                .trim()
                .replaceAll("\\", "/")
                .replace(/^\/+/, "");

            return `${CONFIG.API_URL}/documentos/${rutaLimpia
                .split("/")
                .map(segmento => encodeURIComponent(segmento))
                .join("/")}`;
        },
        almacenes:
            `${CONFIG.API_URL}/inventario/combo?tipo=ALMACEN`,

        choferes:
            `${CONFIG.API_URL}/inventario/combo?tipo=CHOFER`,

        vehiculos:
            `${CONFIG.API_URL}/inventario/combo?tipo=VEHICULO`,

        productosAlmacen: (idAlmacen) =>
            `${CONFIG.API_URL}/inventario/productos-solicitud?idAlmacen=${idAlmacen}`
    };

    /* =========================================================
       VARIABLES
    ========================================================= */

    let enviosRegistrados = [];
    let inventarioOrigen = [];
    let detalleEnvio = [];

    let paginaActualServidor = 0;
    let totalPaginasServidor = 1;
    let totalElementosServidor = 0;
    let tamanioPagina = 10;

    let idEnvioSeleccionado = null;
    let temporizadorBusqueda = null;

    let clienteWebSocketEnvios = null;
    let suscripcionWebSocketEnvios = null;
    let temporizadorActualizacionWebSocketEnvios = null;
    let cargandoEnvios = false;
    let actualizacionWebSocketPendiente = false;

    /* =========================================================
       INICIALIZACIÓN
    ========================================================= */

    document.addEventListener(
        "DOMContentLoaded",
        iniciarPagina
    );

    async function iniciarPagina() {

        configurarEventos();
        renderizarDetalleEnvio();
        limpiarStockProducto();

        try {

            await cargarCombosGenerales();
            await cargarEnvios();

            conectarWebSocketEnvios();

        } catch (error) {

            console.error(
                "Error inicializando envíos:",
                error
            );

            mostrarToast(
                obtenerMensajeError(error),
                "danger"
            );
        }
    }

    function configurarEventos() {

        document
            .getElementById("buscarEnvio")
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
                                cargarEnvios();
                            },
                            400
                        );
                }
            );

        document
            .getElementById("filtroEstado")
            ?.addEventListener(
                "change",
                renderizarEnviosFiltrados
            );

        document
            .getElementById("filtroModoAlmacen")
            ?.addEventListener(
                "change",
                function () {
                    paginaActualServidor = 0;
                    cargarEnvios();
                }
            );

        document
            .getElementById("motivoAnulacionEnvio")
            ?.addEventListener(
                "input",
                function () {
                    this.classList.remove(
                        "is-invalid"
                    );
                }
            );

        [
            "almacenDestino",
            "chofer",
            "vehiculo",
            "motivo"
        ].forEach(function (id) {

            document
                .getElementById(id)
                ?.addEventListener(
                    id === "motivo"
                        ? "input"
                        : "change",
                    function () {
                        this.classList.remove(
                            "is-invalid"
                        );
                    }
                );
        });
    }

    /* =========================================================
       SESIÓN
    ========================================================= */

    function obtenerDatosSesion() {

        try {
            return CONFIG.getData?.() || null;

        } catch (error) {
            console.error(
                "No se pudieron obtener los datos de sesión:",
                error
            );

            return null;
        }
    }

    function obtenerToken() {

        const data =
            obtenerDatosSesion();

        return (
            data?.accessToken ||
            data?.token ||
            CONFIG.getToken?.() ||
            null
        );
    }

    function obtenerIdAlmacenSesion() {

        const data =
            obtenerDatosSesion();

        return Number(
            data?.idAlmacen ??
            data?.idalmacen ??
            data?.almacen?.idAlmacen ??
            data?.almacen?.id ??
            0
        );
    }

    /* =========================================================
       WEBSOCKET DE ENVÍOS
    ========================================================= */


    function conectarWebSocketEnvios() {

        const idAlmacen =
            obtenerIdAlmacenSesion();

        if (
            !Number.isFinite(idAlmacen) ||
            idAlmacen <= 0
        ) {
            console.warn(
                "No se inició el WebSocket porque el usuario no tiene almacén asignado."
            );

            return;
        }

        if (
            typeof SockJS === "undefined" ||
            typeof StompJs === "undefined"
        ) {
            console.error(
                "SockJS o StompJS no están cargados."
            );

            return;
        }

        if (
            clienteWebSocketEnvios &&
            clienteWebSocketEnvios.active
        ) {
            console.log(
                "El WebSocket de envíos ya está activo."
            );

            return;
        }

        const urlWebSocket = CONFIG.WS_URL;

        console.log(
            "Conectando WebSocket de envíos:",
            urlWebSocket
        );

        clienteWebSocketEnvios =
            new StompJs.Client({

                webSocketFactory:
                    function () {
                        return new SockJS(
                            urlWebSocket
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
                            "[STOMP ENVÍOS]",
                            mensaje
                        );
                    }
            });


        clienteWebSocketEnvios.onConnect =
            function () {

                console.log(
                    "WebSocket de envíos conectado correctamente."
                );

                suscribirseCanalEnvios(
                    idAlmacen
                );
            };


        clienteWebSocketEnvios.onStompError =
            function (frame) {

                console.error(
                    "Error STOMP:",
                    frame.headers?.message
                );

                console.error(
                    frame.body
                );
            };


        clienteWebSocketEnvios.onWebSocketError =
            function (error) {

                console.error(
                    "Error en WebSocket de envíos:",
                    error
                );
            };


        clienteWebSocketEnvios.onWebSocketClose =
            function () {

                console.warn(
                    "WebSocket de envíos desconectado."
                );
            };


        clienteWebSocketEnvios.activate();
    }


    function suscribirseCanalEnvios(
        idAlmacen
    ) {

        if (
            !clienteWebSocketEnvios ||
            !clienteWebSocketEnvios.connected
        ) {
            console.warn(
                "El cliente WebSocket todavía no está conectado."
            );

            return;
        }

        if (suscripcionWebSocketEnvios) {

            suscripcionWebSocketEnvios
                .unsubscribe();

            suscripcionWebSocketEnvios =
                null;
        }

        const canal =
            `/topic/envios/almacen/${idAlmacen}`;

        suscripcionWebSocketEnvios =
            clienteWebSocketEnvios.subscribe(
                canal,
                procesarEventoWebSocketEnvio
            );

        console.log(
            "Suscrito al canal:",
            canal
        );
    }


    async function procesarEventoWebSocketEnvio(
        mensaje
    ) {

        try {

            const evento =
                JSON.parse(
                    mensaje.body
                );

            console.log(
                "Evento WebSocket de envío recibido:",
                evento
            );

            /*
             * Si llegan varios eventos seguidos,
             * cancelar la recarga anterior y ejecutar
             * solamente la última.
             */
            clearTimeout(
                temporizadorActualizacionWebSocketEnvios
            );

            temporizadorActualizacionWebSocketEnvios =
                setTimeout(
                    async function () {

                        await actualizarVistaEnviosWebSocket();

                        mostrarMensajeWebSocketEnvio(
                            evento
                        );

                    },
                    700
                );

        } catch (error) {

            console.error(
                "No se pudo procesar el evento WebSocket:",
                error
            );
        }
    }

    async function actualizarVistaEnviosWebSocket() {

        if (cargandoEnvios) {

            actualizacionWebSocketPendiente = true;

            console.log(
                "Actualización WebSocket pendiente porque cargarEnvios sigue ejecutándose."
            );

            return;
        }

        actualizacionWebSocketPendiente = false;

        await cargarEnvios();

        if (
            typeof actualizarAlertasGlobales ===
            "function"
        ) {
            actualizarAlertasGlobales();
        }
    }


    function mostrarMensajeWebSocketEnvio(
        evento
    ) {

        const accion =
            String(
                evento?.accion || ""
            ).toUpperCase();

        let mensaje =
            evento?.mensaje ||
            "Se actualizó una guía de envío.";

        switch (accion) {

            case "ENVIO_CREADO":

                mensaje =
                    "Se creó una nueva guía de envío.";

                break;

            case "ENVIO_GENERADO_DESDE_SOLICITUD":

                mensaje =
                    "Se generó una guía desde una solicitud.";

                break;

            case "GUIA_ENVIADA":

                mensaje =
                    "Una guía fue enviada.";

                break;

            case "GUIA_RECIBIDA":

                mensaje =
                    "Una guía fue recibida.";

                break;

            case "GUIA_ANULADA":

                mensaje =
                    "Una guía fue anulada.";

                break;
        }

        mostrarToast(
            mensaje,
            obtenerTipoToastEventoEnvio(
                accion
            )
        );
    }


    function obtenerTipoToastEventoEnvio(
        accion
    ) {

        switch (accion) {

            case "GUIA_RECIBIDA":
                return "success";

            case "GUIA_ANULADA":
                return "danger";

            case "GUIA_ENVIADA":
                return "info";

            case "ENVIO_CREADO":
            case "ENVIO_GENERADO_DESDE_SOLICITUD":
                return "success";

            default:
                return "info";
        }
    }


    async function desconectarWebSocketEnvios() {

        try {

            if (suscripcionWebSocketEnvios) {

                suscripcionWebSocketEnvios
                    .unsubscribe();

                suscripcionWebSocketEnvios =
                    null;
            }

            if (
                clienteWebSocketEnvios &&
                clienteWebSocketEnvios.active
            ) {

                await clienteWebSocketEnvios
                    .deactivate();
            }

            clienteWebSocketEnvios = null;

        } catch (error) {

            console.error(
                "Error desconectando WebSocket:",
                error
            );
        }
    }


    /* =========================================================
       PETICIONES HTTP
    ========================================================= */

    async function realizarPeticion(
        url,
        opciones = {}
    ) {

        const token =
            obtenerToken();

        if (!token) {
            throw new Error(
                "No se encontró el token de acceso."
            );
        }

        const headers = {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,

            ...(opciones.body
                ? {
                    "Content-Type":
                        "application/json"
                }
                : {}),

            ...(opciones.headers || {})
        };

        const response =
            await fetch(
                url,
                {
                    ...opciones,
                    headers,
                    cache: "no-store"
                }
            );

        const contentType =
            response.headers.get(
                "content-type"
            ) || "";

        let respuesta = null;

        if (response.status !== 204) {

            if (
                contentType.includes(
                    "application/json"
                )
            ) {
                respuesta =
                    await response.json();

            } else {
                respuesta =
                    await response.text();
            }
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
                    respuesta?.mensaje ||
                    respuesta?.message ||
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

    function obtenerListaRespuesta(
        respuesta
    ) {

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
       COMBOS
    ========================================================= */

    async function cargarCombosGenerales() {

        const [
            respuestaAlmacenes,
            respuestaChoferes,
            respuestaVehiculos
        ] = await Promise.all([
            realizarPeticion(
                ENDPOINTS.almacenes
            ),

            realizarPeticion(
                ENDPOINTS.choferes
            ),

            realizarPeticion(
                ENDPOINTS.vehiculos
            )
        ]);

        llenarCombosAlmacenes(
            obtenerListaRespuesta(
                respuestaAlmacenes
            )
        );

        llenarComboGenerico(
            "chofer",
            obtenerListaRespuesta(
                respuestaChoferes
            ),
            "Seleccionar chofer"
        );

        llenarComboGenerico(
            "vehiculo",
            obtenerListaRespuesta(
                respuestaVehiculos
            ),
            "Seleccionar vehículo"
        );
    }

    function llenarCombosAlmacenes(
        almacenes
    ) {

        const selectOrigen =
            document.getElementById(
                "almacenOrigen"
            );

        const selectDestino =
            document.getElementById(
                "almacenDestino"
            );

        if (!selectOrigen || !selectDestino) {
            return;
        }

        const idAlmacenSesion =
            obtenerIdAlmacenSesion();

        selectOrigen.innerHTML = `
            <option value="">
                Seleccionar almacén de origen
            </option>
        `;

        selectDestino.innerHTML = `
            <option value="">
                Seleccionar almacén de destino
            </option>
        `;

        almacenes.forEach(
            function (almacen) {

                const id =
                    obtenerIdCombo(
                        almacen
                    );

                if (!id) {
                    return;
                }

                const nombre =
                    obtenerTextoCombo(
                        almacen
                    ) ||
                    `Almacén ${id}`;

                const opcionDestino =
                    document.createElement(
                        "option"
                    );

                opcionDestino.value =
                    String(id);

                opcionDestino.textContent =
                    nombre;

                selectDestino.appendChild(
                    opcionDestino
                );

                if (
                    id === idAlmacenSesion
                ) {
                    const opcionOrigen =
                        document.createElement(
                            "option"
                        );

                    opcionOrigen.value =
                        String(id);

                    opcionOrigen.textContent =
                        nombre;

                    selectOrigen.appendChild(
                        opcionOrigen
                    );
                }
            }
        );

        if (idAlmacenSesion > 0) {

            selectOrigen.value =
                String(idAlmacenSesion);

            selectOrigen.disabled =
                true;

            cargarProductosAlmacenOrigen();

        } else {

            selectOrigen.disabled =
                false;

            almacenes.forEach(
                function (almacen) {

                    const id =
                        obtenerIdCombo(
                            almacen
                        );

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
                        obtenerTextoCombo(
                            almacen
                        ) ||
                        `Almacén ${id}`;

                    selectOrigen.appendChild(
                        opcion
                    );
                }
            );
        }
    }

    function llenarComboGenerico(
        idSelect,
        lista,
        textoInicial
    ) {

        const select =
            document.getElementById(
                idSelect
            );

        if (!select) {
            return;
        }

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
                    obtenerIdCombo(
                        item
                    );

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
                    obtenerTextoCombo(
                        item
                    ) ||
                    `Registro ${id}`;

                select.appendChild(
                    opcion
                );
            }
        );
    }

    /* =========================================================
       LISTAR ENVÍOS
    ========================================================= */

    async function cargarEnvios() {

        const idAlmacen =
            obtenerIdAlmacenSesion();

        const modoAlmacen =
            document
                .getElementById(
                    "filtroModoAlmacen"
                )
                ?.value ||
            "AMBOS";

        const buscar =
            document
                .getElementById(
                    "buscarEnvio"
                )
                ?.value
                ?.trim() || "";

        const parametros =
            new URLSearchParams();

        cargandoEnvios = true;

        if (idAlmacen > 0) {
            parametros.set(
                "idAlmacen",
                String(idAlmacen)
            );
        }

        parametros.set(
            "modoAlmacen",
            modoAlmacen
        );

        if (buscar) {
            parametros.set(
                "buscar",
                buscar
            );
        }

        parametros.set(
            "page",
            String(
                paginaActualServidor
            )
        );

        parametros.set(
            "size",
            String(
                tamanioPagina
            )
        );

        mostrarCargandoTabla();

        try {

            const respuesta =
                await realizarPeticion(
                    `${ENDPOINTS.listarEnvios}?${parametros.toString()}`
                );

            enviosRegistrados =
                obtenerListaRespuesta(
                    respuesta
                ).map(
                    normalizarEnvio
                );

            paginaActualServidor =
                Number(
                    respuesta?.number ??
                    paginaActualServidor
                );

            totalPaginasServidor =
                Number(
                    respuesta?.totalPages ??
                    1
                );

            totalElementosServidor =
                Number(
                    respuesta?.totalElements ??
                    enviosRegistrados.length
                );

            renderizarEnviosFiltrados();
            await actualizarResumen();
            actualizarPaginacion();

        } catch (error) {

            enviosRegistrados = [];

            renderizarEnvios([]);

            await actualizarResumen();
            actualizarPaginacion();

            mostrarToast(
                obtenerMensajeError(error),
                "danger"
            );
        }

        finally {

            cargandoEnvios = false;

            if (actualizacionWebSocketPendiente) {

                actualizacionWebSocketPendiente = false;

                setTimeout(
                    function () {
                        actualizarVistaEnviosWebSocket();
                    },
                    300
                );
            }
        }
    }

    function normalizarEnvio(
        item
    ) {

        return {
            idEnvio: Number(
                item.idEnvio ??
                item.idenvio ??
                item.id_guia_envio ??
                item.id ??
                0
            ),

            numeroComprobante:
                item.numeroComprobante ??
                item.numerocomprobante ??
                item.numeroGuia ??
                item.numeroguia ??
                item.numero_guia ??
                "SIN NÚMERO",

            fecha:
                formatearFecha(
                    item.fecha
                ),

            estado:
                normalizarEstado(
                    item.estado
                ),

            idAlmacenOrigen: Number(
                item.idAlmacenOrigen ??
                item.idalmacenorigen ??
                item.id_almacen_origen ??
                0
            ),

            almacenOrigen:
                item.almacenOrigen ??
                item.almacenorigen ??
                item.origen ??
                "Sin almacén",

            idAlmacenDestino: Number(
                item.idAlmacenDestino ??
                item.idalmacendestino ??
                item.id_almacen_destino ??
                0
            ),

            almacenDestino:
                item.almacenDestino ??
                item.almacendestino ??
                item.destino ??
                "Sin almacén",

            idChofer: Number(
                item.idChofer ??
                item.idchofer ??
                item.id_chofer ??
                0
            ),

            chofer:
                item.chofer ??
                item.nombreChofer ??
                item.nombrechofer ??
                (
                    item.idChofer ||
                        item.idchofer
                        ? `Chofer ${item.idChofer ?? item.idchofer}`
                        : "Sin chofer"
                ),

            idVehiculo: Number(
                item.idVehiculo ??
                item.idvehiculo ??
                item.id_vehiculo ??
                0
            ),

            vehiculo:
                item.vehiculo ??
                item.placaVehiculo ??
                item.placavehiculo ??
                item.placa ??
                (
                    item.idVehiculo ||
                        item.idvehiculo
                        ? `Vehículo ${item.idVehiculo ?? item.idvehiculo}`
                        : "Sin vehículo"
                ),

            productos: Number(
                item.productos ??
                item.totalProductos ??
                item.totalproductos ??
                0
            ),

            unidades: Number(
                item.unidades ??
                item.totalUnidades ??
                item.totalunidades ??
                0
            ),

            usuario:
                item.usuario ??
                "Sin usuario",
            rutaPdf:
                item.rutaPdf ??
                item.rutapdf ??
                item.ruta_pdf ??
                null

        };
    }

    function normalizarEstado(
        estado
    ) {

        return String(
            estado ?? ""
        )
            .trim()
            .toUpperCase()
            .replaceAll(" ", "_");
    }

    function mostrarCargandoTabla() {

        const tabla =
            document.getElementById(
                "tablaEnvios"
            );

        if (!tabla) {
            return;
        }

        tabla.innerHTML = `
            <tr>
                <td
                    colspan="6"
                    class="text-center py-5 text-muted"
                >
                    <span
                        class="spinner-border spinner-border-sm me-2"
                        role="status"
                    ></span>

                    Cargando envíos...
                </td>
            </tr>
        `;
    }

    function renderizarEnviosFiltrados() {

        const estadoSeleccionado =
            document
                .getElementById(
                    "filtroEstado"
                )
                ?.value ||
            "todos";

        if (
            estadoSeleccionado ===
            "todos"
        ) {
            renderizarEnvios(
                enviosRegistrados
            );

            return;
        }

        const estadoNormalizado =
            normalizarEstado(
                estadoSeleccionado
            );

        const filtrados =
            enviosRegistrados.filter(
                function (envio) {
                    return (
                        envio.estado ===
                        estadoNormalizado
                    );
                }
            );

        renderizarEnvios(
            filtrados
        );
    }

    function renderizarEnvios(
        lista
    ) {

        const tabla =
            document.getElementById(
                "tablaEnvios"
            );

        const sinEnvios =
            document.getElementById(
                "sinEnvios"
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
                        class="text-center py-5 text-muted"
                    >
                        No se encontraron envíos.
                    </td>
                </tr>
            `;

            sinEnvios
                ?.classList
                .remove("d-none");

            return;
        }

        sinEnvios
            ?.classList
            .add("d-none");

        const idAlmacenSesion =
            obtenerIdAlmacenSesion();

        lista.forEach(
            function (envio) {

                const esOrigen =
                    Number(
                        envio.idAlmacenOrigen
                    ) ===
                    Number(
                        idAlmacenSesion
                    );

                const esDestino =
                    Number(
                        envio.idAlmacenDestino
                    ) ===
                    Number(
                        idAlmacenSesion
                    );

                const puedeEnviar =
                    esOrigen &&
                    envio.estado ===
                    "CREADO";

                const puedeRecibir =
                    esDestino &&
                    envio.estado ===
                    "EN_TRANSITO";

                const puedeAnular =
                    esOrigen &&
                    (
                        envio.estado ===
                        "CREADO" ||
                        envio.estado ===
                        "EN_TRANSITO"
                    );

                const botonEnviar =
                    puedeEnviar
                        ? `
                            <button
                                type="button"
                                class="btn btn-sm btn-outline-primary"
                                title="Enviar guía"
                                onclick="enviarGuia(${envio.idEnvio})"
                            >
                                <i class="bi bi-send"></i>
                            </button>
                        `
                        : "";

                const botonRecibir =
                    puedeRecibir
                        ? `
                            <button
                                type="button"
                                class="btn btn-sm btn-outline-success"
                                title="Recibir guía"
                                onclick="recibirGuia(${envio.idEnvio})"
                            >
                                <i class="bi bi-box-arrow-in-down"></i>
                            </button>
                        `
                        : "";

                const botonAnular =
                    puedeAnular
                        ? `
                            <button
                                type="button"
                                class="btn btn-sm btn-outline-danger"
                                title="Anular guía"
                                onclick="abrirModalAnularEnvio(${envio.idEnvio})"
                            >
                                <i class="bi bi-x-lg"></i>
                            </button>
                        `
                        : "";
                const botonPdf = envio.rutaPdf
                    ? `
        <button
            type="button"
            class="btn btn-sm btn-outline-danger"
            title="Ver PDF"
            onclick="verPdfEnvio(${envio.idEnvio})"
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
                        <span class="fw-semibold">
                            ${escaparHtml(
                    envio.numeroComprobante
                )}
                        </span>
                    </td>

                    <td>
                        ${escaparHtml(
                    envio.fecha
                )}
                    </td>

                    <td>
                        ${escaparHtml(
                    envio.almacenOrigen
                )}
                    </td>

                    <td>
                        ${escaparHtml(
                    envio.almacenDestino
                )}
                    </td>

                    <td>
                        ${obtenerBadgeEstado(
                    envio.estado
                )}
                    </td>

                    <td class="text-center">
                        <div
                            class="d-flex justify-content-center gap-1 flex-wrap"
                        >
                            ${botonPdf}
                            ${botonEnviar}
                            ${botonRecibir}
                            ${botonAnular}
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
       RESUMEN
    ========================================================= */

    async function actualizarResumen() {
        try {

            const url = `${CONFIG.API_URL}/envios/dashboard?idAlmacen=${CONFIG.getData().idAlmacen}`

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

            console.log("RESUMEN ENVIOS:", data);

            document.getElementById("totalEnvios").textContent = data.totalEnvios;
            document.getElementById("totalCreados").textContent = data.creados;
            document.getElementById("totalEnCamino").textContent = data.enTransito;
            document.getElementById("totalRecibidos").textContent = data.recibidos;
            document.getElementById("totalAnulados").textContent = data.anulados;

        } catch (error) {
            console.error("Error al obtener kardex:", error);
        }

    }

    function contarEstado(
        estado
    ) {

        return enviosRegistrados.filter(
            function (envio) {
                return (
                    envio.estado ===
                    estado
                );
            }
        ).length;
    }

    /* =========================================================
       PAGINACIÓN
    ========================================================= */

    function actualizarPaginacion() {

        const paginaVisible =
            paginaActualServidor + 1;

        asignarTexto(
            "paginaActual",
            paginaVisible
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

        await cargarEnvios();
    }

    /* =========================================================
       ABRIR MODAL NUEVO ENVÍO
    ========================================================= */

    async function abrirModalNuevoEnvio() {

        detalleEnvio = [];
        inventarioOrigen = [];

        asignarValor(
            "almacenDestino",
            ""
        );

        asignarValor(
            "chofer",
            ""
        );

        asignarValor(
            "vehiculo",
            ""
        );

        asignarValor(
            "motivo",
            ""
        );

        asignarValor(
            "observacion",
            ""
        );

        limpiarValidacionesFormulario();
        limpiarStockProducto();
        renderizarDetalleEnvio();

        const idAlmacenOrigen =
            obtenerIdAlmacenSesion();

        if (idAlmacenOrigen > 0) {

            asignarValor(
                "almacenOrigen",
                idAlmacenOrigen
            );

            await cargarProductosAlmacenOrigen();
        }

        const modal =
            document.getElementById(
                "modalEnvio"
            );

        if (!modal) {
            mostrarToast(
                "No se encontró el modal de envío.",
                "danger"
            );

            return;
        }

        bootstrap.Modal
            .getOrCreateInstance(
                modal
            )
            .show();
    }

    /* =========================================================
       PRODUCTOS DEL ALMACÉN
    ========================================================= */

    async function cargarProductosAlmacenOrigen() {

        const idAlmacenOrigen =
            Number(
                document
                    .getElementById(
                        "almacenOrigen"
                    )
                    ?.value
            );

        inventarioOrigen = [];
        detalleEnvio = [];

        renderizarDetalleEnvio();
        limpiarStockProducto();

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
                    ENDPOINTS.productosAlmacen(
                        idAlmacenOrigen
                    )
                );

            inventarioOrigen =
                obtenerListaRespuesta(
                    respuesta
                )
                    .map(
                        normalizarProducto
                    )
                    .filter(
                        function (producto) {
                            return (
                                producto.idProductoUnidad >
                                0 &&
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

    function normalizarProducto(
        item
    ) {

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
                item.codigo ??
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

    function llenarComboProductos() {

        const select =
            document.getElementById(
                "productoSeleccionado"
            );

        if (!select) {
            return;
        }

        select.innerHTML = "";

        if (
            inventarioOrigen.length === 0
        ) {

            bloquearComboProductos(
                "El almacén no tiene productos disponibles"
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
    }

    function bloquearComboProductos(
        mensaje
    ) {

        const select =
            document.getElementById(
                "productoSeleccionado"
            );

        if (!select) {
            return;
        }

        select.disabled = true;

        select.innerHTML = `
            <option value="">
                ${escaparHtml(mensaje)}
            </option>
        `;
    }

    /* =========================================================
       STOCK DEL PRODUCTO
    ========================================================= */

    function actualizarStockProductoEnvio() {

        const idProductoUnidad =
            Number(
                document
                    .getElementById(
                        "productoSeleccionado"
                    )
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
            limpiarStockProducto();
            return;
        }

        asignarValor(
            "stockDisponibleEnvio",
            producto.stock
        );

        const cantidad =
            document.getElementById(
                "cantidadProducto"
            );

        if (cantidad) {
            cantidad.disabled = false;
            cantidad.min = "1";
            cantidad.max =
                String(producto.stock);
            cantidad.value = "1";
        }
    }

    function validarCantidadProductoEnvio(
        input
    ) {

        const minimo =
            Number(input.min || 1);

        const maximo =
            Number(input.max || 0);

        let cantidad =
            Number(input.value || 0);

        if (cantidad < minimo) {
            cantidad = minimo;
        }

        if (
            maximo > 0 &&
            cantidad > maximo
        ) {

            cantidad = maximo;

            mostrarToast(
                `La cantidad máxima disponible es ${maximo}.`,
                "warning"
            );
        }

        input.value =
            String(cantidad);
    }

    function limpiarStockProducto() {

        asignarValor(
            "stockDisponibleEnvio",
            0
        );

        const cantidad =
            document.getElementById(
                "cantidadProducto"
            );

        if (cantidad) {
            cantidad.value = "1";
            cantidad.min = "1";
            cantidad.max = "1";
            cantidad.disabled = true;
        }
    }

    /* =========================================================
       DETALLE DE PRODUCTOS
    ========================================================= */

    function agregarProductoEnvio() {

        const idProductoUnidad =
            Number(
                document
                    .getElementById(
                        "productoSeleccionado"
                    )
                    ?.value
            );

        const cantidad =
            Number(
                document
                    .getElementById(
                        "cantidadProducto"
                    )
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
                "La cantidad debe ser mayor que cero.",
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

        const existente =
            detalleEnvio.find(
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

            if (
                nuevaCantidad >
                producto.stock
            ) {
                mostrarToast(
                    `La cantidad total no puede superar ${producto.stock}.`,
                    "warning"
                );
                return;
            }

            existente.cantidad =
                nuevaCantidad;

        } else {

            if (
                cantidad >
                producto.stock
            ) {
                mostrarToast(
                    `Solo existen ${producto.stock} unidades disponibles.`,
                    "warning"
                );
                return;
            }

            detalleEnvio.push({
                ...producto,
                cantidad
            });
        }

        asignarValor(
            "productoSeleccionado",
            ""
        );

        limpiarStockProducto();
        renderizarDetalleEnvio();
    }

    function renderizarDetalleEnvio() {

        const tabla =
            document.getElementById(
                "tablaDetalleEnvio"
            );

        if (!tabla) {
            return;
        }

        if (
            detalleEnvio.length === 0
        ) {

            tabla.innerHTML = `
                <tr>
                    <td
                        colspan="8"
                        class="text-center py-4 text-muted"
                    >
                        Todavía no has agregado productos.
                    </td>
                </tr>
            `;

            actualizarTotalUnidades();
            return;
        }

        tabla.innerHTML =
            detalleEnvio
                .map(
                    function (
                        producto,
                        indice
                    ) {

                        const stockRestante =
                            producto.stock -
                            producto.cantidad;

                        return `
                            <tr>
                                <td>
                                    ${escaparHtml(
                            producto.codigo
                        )}
                                </td>

                                <td>
                                    ${escaparHtml(
                            producto.nombre
                        )}
                                </td>

                                <td>
                                    ${escaparHtml(
                            producto.variante
                        )}
                                </td>

                                <td>
                                    ${escaparHtml(
                            producto.unidad
                        )}
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
                                        oninput="cambiarCantidadDetalle(${indice}, this)"
                                    />
                                </td>

                                <td class="text-center">
                                    ${stockRestante}
                                </td>

                                <td class="text-center">
                                    <button
                                        type="button"
                                        class="btn btn-sm btn-outline-danger"
                                        onclick="eliminarProductoEnvio(${indice})"
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

    function cambiarCantidadDetalle(
        indice,
        input
    ) {

        const producto =
            detalleEnvio[indice];

        if (!producto) {
            return;
        }

        let cantidad =
            Number(input.value || 0);

        if (cantidad < 1) {
            cantidad = 1;
        }

        if (
            cantidad >
            producto.stock
        ) {

            cantidad =
                producto.stock;

            mostrarToast(
                `La cantidad máxima es ${producto.stock}.`,
                "warning"
            );
        }

        producto.cantidad =
            cantidad;

        input.value =
            String(cantidad);

        renderizarDetalleEnvio();
    }

    function eliminarProductoEnvio(
        indice
    ) {

        detalleEnvio.splice(
            indice,
            1
        );

        renderizarDetalleEnvio();
    }

    function actualizarTotalUnidades() {

        const total =
            detalleEnvio.reduce(
                function (
                    acumulado,
                    producto
                ) {
                    return (
                        acumulado +
                        Number(
                            producto.cantidad ||
                            0
                        )
                    );
                },
                0
            );

        asignarTexto(
            "totalUnidadesEnvio",
            total
        );
    }

    /* =========================================================
       REGISTRAR ENVÍO
    ========================================================= */

    async function registrarEnvio() {

        const idAlmacenOrigen =
            Number(
                document
                    .getElementById(
                        "almacenOrigen"
                    )
                    ?.value
            );

        const idAlmacenDestino =
            Number(
                document
                    .getElementById(
                        "almacenDestino"
                    )
                    ?.value
            );

        const idChofer =
            Number(
                document
                    .getElementById(
                        "chofer"
                    )
                    ?.value
            );

        const idVehiculo =
            Number(
                document
                    .getElementById(
                        "vehiculo"
                    )
                    ?.value
            );

        const motivo =
            document
                .getElementById(
                    "motivo"
                )
                ?.value
                ?.trim() || "";

        const observacion =
            document
                .getElementById(
                    "observacion"
                )
                ?.value
                ?.trim() || "";

        limpiarValidacionesFormulario();

        let formularioValido = true;

        if (!idAlmacenOrigen) {
            marcarInvalido(
                "almacenOrigen"
            );
            formularioValido = false;
        }

        if (!idAlmacenDestino) {
            marcarInvalido(
                "almacenDestino"
            );
            formularioValido = false;
        }

        if (!idChofer) {
            marcarInvalido(
                "chofer"
            );
            formularioValido = false;
        }

        if (!idVehiculo) {
            marcarInvalido(
                "vehiculo"
            );
            formularioValido = false;
        }

        if (!motivo) {
            marcarInvalido(
                "motivo"
            );
            formularioValido = false;
        }

        if (!formularioValido) {
            mostrarToast(
                "Completa los campos obligatorios.",
                "warning"
            );
            return;
        }

        if (
            idAlmacenOrigen ===
            idAlmacenDestino
        ) {
            mostrarToast(
                "El almacén de origen y destino no pueden ser iguales.",
                "warning"
            );
            return;
        }

        if (
            detalleEnvio.length === 0
        ) {
            mostrarToast(
                "Agrega al menos un producto al envío.",
                "warning"
            );
            return;
        }

        const request = {
            idAlmacenOrigen,
            idAlmacenDestino,
            idChofer,
            idVehiculo,
            motivo,
            observacion,

            detalle:
                detalleEnvio.map(
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

        const boton =
            document.getElementById(
                "btnRegistrarEnvio"
            );

        cambiarEstadoBoton(
            boton,
            true,
            "Registrando..."
        );

        try {

            const respuesta =
                await realizarPeticion(
                    ENDPOINTS.crearEnvio,
                    {
                        method: "POST",
                        body:
                            JSON.stringify(
                                request
                            )
                    }
                );

            bootstrap.Modal
                .getInstance(
                    document.getElementById(
                        "modalEnvio"
                    )
                )
                ?.hide();

            detalleEnvio = [];

            renderizarDetalleEnvio();

            paginaActualServidor = 0;

            await cargarEnvios();

            mostrarToast(
                respuesta?.mensaje ||
                (
                    respuesta?.idGuiaEnvio
                        ? `Envío ${respuesta.idGuiaEnvio} registrado correctamente.`
                        : "Envío registrado correctamente."
                ),
                "success"
            );

            if (typeof actualizarAlertasGlobales === "function") { actualizarAlertasGlobales(); }

        } catch (error) {

            console.error(
                "Error registrando envío:",
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
       ENVIAR
    ========================================================= */

    async function enviarGuia(
        idGuia
    ) {

        const envio =
            buscarEnvioPorId(
                idGuia
            );

        if (!envio) {
            mostrarToast(
                "No se encontró la guía.",
                "danger"
            );
            return;
        }

        if (
            envio.estado !==
            "CREADO"
        ) {
            mostrarToast(
                "Solo se puede enviar una guía en estado CREADO.",
                "warning"
            );
            return;
        }

        const confirmar =
            window.confirm(
                `¿Deseas enviar la guía ${envio.numeroComprobante}?`
            );

        if (!confirmar) {
            return;
        }

        try {

            const respuesta =
                await realizarPeticion(
                    ENDPOINTS.enviarGuia(
                        idGuia
                    ),
                    {
                        method: "PUT"
                    }
                );

            await cargarEnvios();

            mostrarToast(
                respuesta?.mensaje ||
                "Guía enviada correctamente.",
                "success"
            );

        } catch (error) {
            mostrarToast(
                obtenerMensajeError(error),
                "danger"
            );
        }
    }

    /* =========================================================
       RECIBIR
    ========================================================= */

    async function recibirGuia(
        idGuia
    ) {

        const envio =
            buscarEnvioPorId(
                idGuia
            );

        if (!envio) {
            mostrarToast(
                "No se encontró la guía.",
                "danger"
            );
            return;
        }

        if (
            envio.estado !==
            "EN_TRANSITO"
        ) {
            mostrarToast(
                "Solo se puede recibir una guía en estado EN_TRANSITO.",
                "warning"
            );
            return;
        }

        const confirmar =
            window.confirm(
                `¿Confirmas la recepción de la guía ${envio.numeroComprobante}?`
            );

        if (!confirmar) {
            return;
        }

        try {

            const respuesta =
                await realizarPeticion(
                    ENDPOINTS.recibirGuia(
                        idGuia
                    ),
                    {
                        method: "PUT"
                    }
                );

            await cargarEnvios();

            mostrarToast(
                respuesta?.mensaje ||
                "Guía recibida correctamente.",
                "success"
            );

        } catch (error) {
            mostrarToast(
                obtenerMensajeError(error),
                "danger"
            );
        }
    }

    /* =========================================================
       ANULAR
    ========================================================= */

    function abrirModalAnularEnvio(
        idGuia
    ) {

        const envio =
            buscarEnvioPorId(
                idGuia
            );

        if (!envio) {
            mostrarToast(
                "No se encontró la guía.",
                "danger"
            );
            return;
        }

        if (
            envio.estado !== "CREADO" &&
            envio.estado !== "EN_TRANSITO"
        ) {
            mostrarToast(
                "La guía no puede anularse en su estado actual.",
                "warning"
            );
            return;
        }

        idEnvioSeleccionado =
            Number(idGuia);

        asignarValor(
            "idEnvioAnular",
            idGuia
        );

        asignarTexto(
            "numeroGuiaAnular",
            envio.numeroComprobante
        );

        asignarValor(
            "motivoAnulacionEnvio",
            ""
        );

        document
            .getElementById(
                "motivoAnulacionEnvio"
            )
            ?.classList
            .remove("is-invalid");

        const modal =
            document.getElementById(
                "modalAnularEnvio"
            );

        if (!modal) {
            mostrarToast(
                "No se encontró el modal de anulación.",
                "danger"
            );
            return;
        }

        bootstrap.Modal
            .getOrCreateInstance(
                modal
            )
            .show();
    }

    async function confirmarAnulacionEnvio() {

        const idGuia =
            Number(
                document
                    .getElementById(
                        "idEnvioAnular"
                    )
                    ?.value ||
                idEnvioSeleccionado
            );

        const textarea =
            document.getElementById(
                "motivoAnulacionEnvio"
            );

        const motivo =
            textarea
                ?.value
                ?.trim() || "";

        textarea
            ?.classList
            .remove("is-invalid");

        if (!idGuia) {
            mostrarToast(
                "No se seleccionó una guía.",
                "danger"
            );
            return;
        }

        if (!motivo) {
            textarea
                ?.classList
                .add("is-invalid");

            mostrarToast(
                "Ingresa el motivo de anulación.",
                "warning"
            );
            return;
        }

        const boton =
            document.getElementById(
                "btnConfirmarAnulacionEnvio"
            );

        cambiarEstadoBoton(
            boton,
            true,
            "Anulando..."
        );

        try {

            const respuesta =
                await realizarPeticion(
                    ENDPOINTS.anularGuia(
                        idGuia
                    ),
                    {
                        method: "PUT",

                        body:
                            JSON.stringify({
                                motivo
                            })
                    }
                );

            bootstrap.Modal
                .getInstance(
                    document.getElementById(
                        "modalAnularEnvio"
                    )
                )
                ?.hide();

            idEnvioSeleccionado = null;

            await cargarEnvios();

            mostrarToast(
                respuesta?.mensaje ||
                "Guía anulada correctamente.",
                "success"
            );

        } catch (error) {
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
       DETALLE
    ========================================================= */

    function verDetalleEnvio(
        idGuia
    ) {

        const envio =
            buscarEnvioPorId(
                idGuia
            );

        if (!envio) {
            mostrarToast(
                "No se encontró la guía.",
                "danger"
            );
            return;
        }

        const contenido =
            document.getElementById(
                "contenidoDetalleEnvio"
            );

        if (!contenido) {
            return;
        }

        contenido.innerHTML = `
            <div class="row g-3">

                <div class="col-md-6">
                    <small class="text-muted">
                        Número de guía
                    </small>

                    <div class="fw-semibold">
                        ${escaparHtml(
            envio.numeroComprobante
        )}
                    </div>
                </div>

                <div class="col-md-6">
                    <small class="text-muted">
                        Estado
                    </small>

                    <div>
                        ${obtenerBadgeEstado(
            envio.estado
        )}
                    </div>
                </div>

                <div class="col-md-6">
                    <small class="text-muted">
                        Almacén origen
                    </small>

                    <div class="fw-semibold">
                        ${escaparHtml(
            envio.almacenOrigen
        )}
                    </div>
                </div>

                <div class="col-md-6">
                    <small class="text-muted">
                        Almacén destino
                    </small>

                    <div class="fw-semibold">
                        ${escaparHtml(
            envio.almacenDestino
        )}
                    </div>
                </div>

                <div class="col-md-6">
                    <small class="text-muted">
                        Chofer
                    </small>

                    <div class="fw-semibold">
                        ${escaparHtml(
            envio.chofer
        )}
                    </div>
                </div>

                <div class="col-md-6">
                    <small class="text-muted">
                        Vehículo
                    </small>

                    <div class="fw-semibold">
                        ${escaparHtml(
            envio.vehiculo
        )}
                    </div>
                </div>

                <div class="col-md-6">
                    <small class="text-muted">
                        Productos
                    </small>

                    <div class="fw-semibold">
                        ${envio.productos}
                    </div>
                </div>

                <div class="col-md-6">
                    <small class="text-muted">
                        Unidades
                    </small>

                    <div class="fw-semibold">
                        ${envio.unidades}
                    </div>
                </div>

                <div class="col-12">
                    <small class="text-muted">
                        Fecha
                    </small>

                    <div class="fw-semibold">
                        ${escaparHtml(
            envio.fecha
        )}
                    </div>
                </div>

            </div>
        `;

        const modal =
            document.getElementById(
                "modalDetalleEnvio"
            );

        if (!modal) {
            return;
        }

        bootstrap.Modal
            .getOrCreateInstance(
                modal
            )
            .show();
    }

    /* =========================================================
       PDF
    ========================================================= */
    async function verPdfEnvio(idGuia) {

        let urlTemporalPdf = null;

        try {
            const envio = buscarEnvioPorId(idGuia);

            if (!envio) {
                throw new Error(
                    "No se encontró el envío seleccionado."
                );
            }

            if (
                !envio.rutaPdf ||
                String(envio.rutaPdf).trim() === ""
            ) {
                throw new Error(
                    "Este envío no tiene un PDF disponible."
                );
            }

            const url =
                ENDPOINTS.pdfDocumento(
                    envio.rutaPdf
                );

            console.log("ID envío:", idGuia);
            console.log("Ruta PDF:", envio.rutaPdf);
            console.log("URL PDF:", url);

            const response = await fetch(url, {
                method: "GET",

                headers: {
                    Accept: "application/pdf",
                    Authorization:
                        `Bearer ${obtenerToken()}`
                },

                cache: "no-store"
            });

            if (!response.ok) {
                const contentType =
                    response.headers.get(
                        "content-type"
                    ) || "";

                let mensaje;

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
                        error?.error;
                } else {
                    mensaje =
                        await response.text();
                }

                throw new Error(
                    mensaje ||
                    `No se pudo obtener el PDF. HTTP ${response.status}`
                );
            }

            const blob = await response.blob();

            if (blob.size === 0) {
                throw new Error(
                    "El PDF recibido está vacío."
                );
            }

            urlTemporalPdf =
                URL.createObjectURL(blob);

            const iframe =
                document.getElementById(
                    "iframeEnvioPdf"
                );

            const modal =
                document.getElementById(
                    "modalPreviewPdfEnvio"
                );

            if (!iframe || !modal) {
                throw new Error(
                    "No se encontró el visor del PDF."
                );
            }

            iframe.src = urlTemporalPdf;

            bootstrap.Modal
                .getOrCreateInstance(modal)
                .show();

            modal.addEventListener(
                "hidden.bs.modal",
                function limpiarPdf() {

                    iframe.src = "about:blank";

                    if (urlTemporalPdf) {
                        URL.revokeObjectURL(
                            urlTemporalPdf
                        );

                        urlTemporalPdf = null;
                    }

                    modal.removeEventListener(
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
                obtenerMensajeError(error),
                "danger"
            );
        }
    }
    /* =========================================================
       FILTROS
    ========================================================= */

    function limpiarFiltros() {

        asignarValor(
            "buscarEnvio",
            ""
        );

        asignarValor(
            "filtroEstado",
            "todos"
        );

        asignarValor(
            "filtroModoAlmacen",
            "AMBOS"
        );

        paginaActualServidor = 0;

        cargarEnvios();
    }

    /* =========================================================
       UTILIDADES
    ========================================================= */

    function buscarEnvioPorId(
        idGuia
    ) {

        return enviosRegistrados.find(
            function (envio) {
                return (
                    Number(envio.idEnvio) ===
                    Number(idGuia)
                );
            }
        );
    }

    function obtenerIdCombo(
        item
    ) {

        return Number(
            item?.id ??
            item?.value ??
            item?.idAlmacen ??
            item?.idalmacen ??
            item?.idChofer ??
            item?.idchofer ??
            item?.idVehiculo ??
            item?.idvehiculo ??
            0
        );
    }

    function obtenerTextoCombo(
        item
    ) {

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

    function obtenerBadgeEstado(
        estado
    ) {

        const configuracion = {
            CREADO: {
                clase:
                    "bg-warning-subtle text-warning",
                texto:
                    "Creado"
            },

            EN_TRANSITO: {
                clase:
                    "bg-info-subtle text-info",
                texto:
                    "En tránsito"
            },

            RECIBIDO: {
                clase:
                    "bg-success-subtle text-success",
                texto:
                    "Recibido"
            },

            ANULADO: {
                clase:
                    "bg-danger-subtle text-danger",
                texto:
                    "Anulado"
            },

            PROCESADO: {
                clase:
                    "bg-primary-subtle text-primary",
                texto:
                    "Procesado"
            }
        };

        const datos =
            configuracion[estado] || {
                clase:
                    "bg-secondary-subtle text-secondary",
                texto:
                    estado ||
                    "Sin estado"
            };

        return `
            <span class="badge ${datos.clase}">
                ${escaparHtml(
            datos.texto
        )}
            </span>
        `;
    }

    function formatearFecha(
        fecha
    ) {

        if (!fecha) {
            return "";
        }

        if (
            typeof fecha === "string" &&
            fecha.includes("/")
        ) {
            return fecha;
        }

        const valor =
            new Date(fecha);

        if (
            Number.isNaN(
                valor.getTime()
            )
        ) {
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

    function limpiarValidacionesFormulario() {

        [
            "almacenOrigen",
            "almacenDestino",
            "chofer",
            "vehiculo",
            "motivo"
        ].forEach(
            function (id) {
                document
                    .getElementById(id)
                    ?.classList
                    .remove("is-invalid");
            }
        );
    }

    function marcarInvalido(
        id
    ) {

        document
            .getElementById(id)
            ?.classList
            .add("is-invalid");
    }

    function asignarValor(
        id,
        valor
    ) {

        const elemento =
            document.getElementById(
                id
            );

        if (elemento) {
            elemento.value =
                valor ?? "";
        }
    }

    function asignarTexto(
        id,
        valor
    ) {

        const elemento =
            document.getElementById(
                id
            );

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

                ${escaparHtml(
                textoProcesando
            )}
            `;

            return;
        }

        if (
            boton.id ===
            "btnRegistrarEnvio"
        ) {

            boton.innerHTML = `
                <i class="bi bi-floppy me-2"></i>
                Registrar envío
            `;

            return;
        }

        if (
            boton.id ===
            "btnConfirmarAnulacionEnvio"
        ) {

            boton.innerHTML = `
                <i class="bi bi-x-circle me-2"></i>
                Anular guía
            `;
        }
    }

    function obtenerMensajeError(
        error
    ) {

        return (
            error?.message ||
            "Ocurrió un error inesperado."
        );
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
            .getOrCreateInstance(
                toast
            )
            .show();
    }

    /* =========================================================
       FUNCIONES DISPONIBLES PARA EL HTML
    ========================================================= */

    window.abrirModalNuevoEnvio =
        abrirModalNuevoEnvio;

    window.cargarProductosAlmacenOrigen =
        cargarProductosAlmacenOrigen;

    window.actualizarStockProductoEnvio =
        actualizarStockProductoEnvio;

    window.validarCantidadProductoEnvio =
        validarCantidadProductoEnvio;

    window.agregarProductoEnvio =
        agregarProductoEnvio;

    window.cambiarCantidadDetalle =
        cambiarCantidadDetalle;

    window.eliminarProductoEnvio =
        eliminarProductoEnvio;

    window.registrarEnvio =
        registrarEnvio;

    window.enviarGuia =
        enviarGuia;

    window.recibirGuia =
        recibirGuia;

    window.abrirModalAnularEnvio =
        abrirModalAnularEnvio;

    window.confirmarAnulacionEnvio =
        confirmarAnulacionEnvio;

    window.verDetalleEnvio =
        verDetalleEnvio;

    window.verPdfEnvio =
        verPdfEnvio;

    window.limpiarFiltros =
        limpiarFiltros;

    window.cambiarPagina =
        cambiarPagina;

    window.cargarEnvios =
        cargarEnvios;

    window.addEventListener(
        "beforeunload",
        function () {

            if (
                clienteWebSocketEnvios &&
                clienteWebSocketEnvios.active
            ) {
                clienteWebSocketEnvios
                    .deactivate();
            }
        }
    );

})();

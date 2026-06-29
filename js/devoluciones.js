"use strict";

/* ============================================================
   ENDPOINTS
============================================================ */

const DEVOLUCION_ENDPOINTS = {

    devoluciones:
        `${CONFIG.API_URL}/devoluciones`,

    enviosFormulario:
        `${CONFIG.API_URL}/devoluciones/formulario/envios`,

    productosFormulario: function (idGuiaEnvio) {
        return `${CONFIG.API_URL}/devoluciones/formulario/envios/${idGuiaEnvio}/productos`;
    },

    enviar: function (idDevolucion) {
        return `${CONFIG.API_URL}/devoluciones/${idDevolucion}/enviar`;
    },

    recibir: function (idDevolucion) {
        return `${CONFIG.API_URL}/devoluciones/${idDevolucion}/recibir`;
    },

    anular: function (idDevolucion) {
        return `${CONFIG.API_URL}/devoluciones/${idDevolucion}/anular`;
    },

    pdf: function (rutaPdf) {

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
    },

    choferes:
        `${CONFIG.API_URL}/inventario/combo?tipo=CHOFER`,

    vehiculos:
        `${CONFIG.API_URL}/inventario/combo?tipo=VEHICULO`
};


/* ============================================================
   VARIABLES
============================================================ */

let devolucionesRegistradas = [];

let enviosDisponibles = [];

let productosEnvioSeleccionado = [];

let detalleNuevaDevolucion = [];

let paginaActualServidor = 0;

let totalPaginasServidor = 0;

let totalElementosServidor = 0;

const tamanioPagina = 5;

let temporizadorBusqueda = null;

let idDevolucionSeleccionada = null;

let clienteWebSocketDevoluciones = null;
let suscripcionWebSocketDevoluciones = null;


/* ============================================================
   INICIALIZACIÓN
============================================================ */

document.addEventListener(
    "DOMContentLoaded",
    iniciarPaginaDevoluciones
);


async function iniciarPaginaDevoluciones() {

    configurarEventosDevoluciones();

    renderizarDetalleNuevaDevolucion();

    limpiarDatosProducto();

    mostrarCargandoDevoluciones();

    try {

        await Promise.all([
            cargarChoferes(),
            cargarVehiculos(),
            cargarEnviosDisponibles()
        ]);

        await cargarDevoluciones();

        conectarWebSocketDevoluciones();

    } catch (error) {

        console.error(
            "Error inicializando devoluciones:",
            error
        );

        mostrarToast(
            obtenerMensajeError(error),
            "danger"
        );
    }
}


/* ============================================================
   EVENTOS
============================================================ */

function configurarEventosDevoluciones() {

    const buscador =
        document.getElementById(
            "buscarDevolucion"
        );

    buscador?.addEventListener(
        "input",
        function () {

            clearTimeout(
                temporizadorBusqueda
            );

            temporizadorBusqueda =
                setTimeout(
                    function () {

                        paginaActualServidor = 0;

                        cargarDevoluciones();
                    },
                    400
                );
        }
    );


    document
        .getElementById(
            "filtroEstado"
        )
        ?.addEventListener(
            "change",
            renderizarDevolucionesFiltradas
        );


    document
        .getElementById(
            "fechaInicio"
        )
        ?.addEventListener(
            "change",
            function () {

                paginaActualServidor = 0;

                cargarDevoluciones();
            }
        );


    document
        .getElementById(
            "fechaFin"
        )
        ?.addEventListener(
            "change",
            function () {

                paginaActualServidor = 0;

                cargarDevoluciones();
            }
        );


    [
        "envioRelacionado",
        "tipoDevolucion",
        "chofer",
        "vehiculo"
    ].forEach(
        function (id) {

            document
                .getElementById(id)
                ?.addEventListener(
                    "change",
                    function () {

                        this.classList.remove(
                            "is-invalid"
                        );
                    }
                );
        }
    );


    document
        .getElementById(
            "motivoAnulacionDevolucion"
        )
        ?.addEventListener(
            "input",
            function () {

                this.classList.remove(
                    "is-invalid"
                );
            }
        );
}


/* ============================================================
   SESIÓN
============================================================ */

function obtenerDatosSesion() {

    try {

        if (
            typeof CONFIG.getData ===
            "function"
        ) {

            return CONFIG.getData();
        }

        if (
            typeof CONFIG.getUsuario ===
            "function"
        ) {

            const usuario =
                CONFIG.getUsuario();

            if (typeof usuario === "string") {

                return JSON.parse(
                    usuario
                );
            }

            return usuario;
        }

        const data =
            localStorage.getItem("data");

        if (data) {

            return JSON.parse(
                data
            );
        }

        const usuario =
            localStorage.getItem("usuario");

        return usuario
            ? JSON.parse(usuario)
            : null;

    } catch (error) {

        console.error(
            "No se pudieron obtener los datos de sesión:",
            error
        );

        return null;
    }
}


function obtenerToken() {

    if (
        typeof CONFIG.getToken ===
        "function"
    ) {

        const token =
            CONFIG.getToken();

        if (token) {
            return token;
        }
    }

    const data =
        obtenerDatosSesion();

    return (
        data?.accessToken ||
        data?.token ||
        localStorage.getItem("token") ||
        localStorage.getItem("accessToken")
    );
}


function obtenerIdAlmacenSesion() {

    const data =
        obtenerDatosSesion();

    const idAlmacen =
        data?.idAlmacen ??
        data?.idalmacen ??
        data?.id_almacen ??
        data?.almacen?.idAlmacen ??
        data?.almacen?.idalmacen ??
        data?.almacen?.id ??
        null;

    if (
        idAlmacen === null ||
        idAlmacen === undefined ||
        idAlmacen === ""
    ) {

        return null;
    }

    const numero =
        Number(idAlmacen);

    return Number.isNaN(numero)
        ? null
        : numero;
}

function conectarWebSocketDevoluciones() {

    const idAlmacen =
        obtenerIdAlmacenSesion();

    if (
        !Number.isFinite(idAlmacen) ||
        idAlmacen <= 0
    ) {
        console.warn(
            "No se inició WebSocket de devoluciones: almacén inválido."
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
        clienteWebSocketDevoluciones &&
        clienteWebSocketDevoluciones.active
    ) {
        return;
    }

    clienteWebSocketDevoluciones =
        new StompJs.Client({

            webSocketFactory: function () {
                return new SockJS(
                    CONFIG.WS_URL
                );
            },

            reconnectDelay: 5000,

            heartbeatIncoming: 10000,

            heartbeatOutgoing: 10000,

            debug: function (mensaje) {
                console.log(
                    "[STOMP DEVOLUCIONES]",
                    mensaje
                );
            }
        });

    clienteWebSocketDevoluciones.onConnect =
        function () {

            console.log(
                "WebSocket de devoluciones conectado correctamente."
            );

            suscribirseCanalDevoluciones(
                idAlmacen
            );
        };

    clienteWebSocketDevoluciones.onStompError =
        function (frame) {

            console.error(
                "Error STOMP devoluciones:",
                frame.headers?.message
            );

            console.error(
                frame.body
            );
        };

    clienteWebSocketDevoluciones.onWebSocketError =
        function (error) {

            console.error(
                "Error WebSocket devoluciones:",
                error
            );
        };

    clienteWebSocketDevoluciones.onWebSocketClose =
        function () {

            console.warn(
                "WebSocket de devoluciones desconectado."
            );
        };

    clienteWebSocketDevoluciones.activate();
}

function suscribirseCanalDevoluciones(
    idAlmacen
) {

    if (
        !clienteWebSocketDevoluciones ||
        !clienteWebSocketDevoluciones.connected
    ) {
        return;
    }

    if (suscripcionWebSocketDevoluciones) {

        suscripcionWebSocketDevoluciones
            .unsubscribe();

        suscripcionWebSocketDevoluciones =
            null;
    }

    const canal =
        `/topic/devoluciones/almacen/${idAlmacen}`;

    suscripcionWebSocketDevoluciones =
        clienteWebSocketDevoluciones.subscribe(
            canal,
            procesarEventoWebSocketDevolucion
        );

    console.log(
        "Suscrito al canal:",
        canal
    );
}


/* ============================================================
   PETICIONES HTTP
============================================================ */

async function realizarPeticionDevolucion(
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

        Accept:
            "application/json",

        Authorization:
            `Bearer ${token}`,

        ...(opciones.headers || {})
    };

    if (
        opciones.body !== undefined &&
        opciones.body !== null
    ) {

        headers["Content-Type"] =
            "application/json";
    }

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

    if (
        Array.isArray(
            respuesta?.lista
        )
    ) {

        return respuesta.lista;
    }

    return [];
}


/* ============================================================
   LISTAR DEVOLUCIONES
============================================================ */

async function cargarDevoluciones() {

    const buscar =
        document
            .getElementById(
                "buscarDevolucion"
            )
            ?.value
            ?.trim() || "";

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

    if (idAlmacen !== null) {

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

    mostrarCargandoDevoluciones();

    try {

        const respuesta =
            await realizarPeticionDevolucion(
                `${DEVOLUCION_ENDPOINTS.devoluciones}?${parametros.toString()}`
            );

        devolucionesRegistradas =
            obtenerListaRespuesta(
                respuesta
            ).map(
                normalizarDevolucion
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
                    devolucionesRegistradas.length > 0
                        ? 1
                        : 0
                )
            );

        totalElementosServidor =
            Number(
                respuesta?.totalElements ??
                devolucionesRegistradas.length
            );

        renderizarDevolucionesFiltradas();

        await actualizarResumenDevoluciones();

        actualizarPaginacionDevoluciones();

    } catch (error) {

        devolucionesRegistradas = [];

        paginaActualServidor = 0;

        totalPaginasServidor = 0;

        totalElementosServidor = 0;

        renderizarDevoluciones([]);

        await actualizarResumenDevoluciones();

        actualizarPaginacionDevoluciones();

        mostrarToast(
            obtenerMensajeError(error),
            "danger"
        );
    }
}

async function procesarEventoWebSocketDevolucion(
    mensaje
) {
    try {

        const evento =
            JSON.parse(mensaje.body);

        console.log(
            "Evento WebSocket de devolución recibido:",
            evento
        );

        /*
         * Espera corta para que termine el COMMIT
         * de la transacción del backend.
         */
        await new Promise(
            resolve => setTimeout(resolve, 500)
        );

        /*
         * Esta función vuelve a consultar el backend,
         * actualiza la tabla, resumen y paginación.
         */
        await cargarDevoluciones();

        /*
         * Actualiza también los envíos disponibles,
         * porque una devolución depende de una guía recibida.
         */
        await cargarEnviosDisponibles();

        mostrarMensajeWebSocketDevolucion(
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
            "Error procesando evento de devolución:",
            error
        );
    }
}

function normalizarDevolucion(
    item
) {

    return {

        idDevolucion: Number(
            item.idDevolucion ??
            item.iddevolucion ??
            item.id_guia_devolucion ??
            item.id ??
            0
        ),

        numeroComprobante:
            item.numeroComprobante ??
            item.numerocomprobante ??
            item.numeroDevolucion ??
            item.numero_devolucion ??
            "SIN NÚMERO",

        fecha:
            item.fecha ?? "",

        estado:
            normalizarEstado(
                item.estado
            ),

        tipo:
            item.tipo ??
            item.tipoGuiaDevolucion ??
            item.tipo_guia_devolucion ??
            "OTRO",

        usuario:
            item.usuario ??
            "Sin usuario",

        idAlmacenOrigen: Number(
            item.idAlmacenOrigen ??
            item.idalmacenorigen ??
            item.id_almacen_origen ??
            0
        ),

        idAlmacenDestino: Number(
            item.idAlmacenDestino ??
            item.idalmacendestino ??
            item.id_almacen_destino ??
            0
        ),

        almacenOrigen:
            item.almacenOrigen ??
            item.almacenorigen ??
            item.origen ??
            "Sin origen",

        almacenDestino:
            item.almacenDestino ??
            item.almacendestino ??
            item.destino ??
            "Sin destino",

        rutaPdf:
            item.rutaPdf ??
            item.rutapdf ??
            item.ruta_pdf ??
            null
    };
}


function mostrarCargandoDevoluciones() {

    const tabla =
        document.getElementById(
            "tablaDevoluciones"
        );

    if (!tabla) {
        return;
    }

    tabla.innerHTML = `
        <tr>
            <td
                colspan="7"
                class="text-center py-5 text-muted"
            >
                <span
                    class="spinner-border spinner-border-sm me-2"
                    role="status"
                ></span>

                Cargando devoluciones...
            </td>
        </tr>
    `;
}


function renderizarDevolucionesFiltradas() {

    const estado =
        document
            .getElementById(
                "filtroEstado"
            )
            ?.value || "todos";

    if (estado === "todos") {

        renderizarDevoluciones(
            devolucionesRegistradas
        );

        return;
    }

    const estadoNormalizado =
        normalizarEstado(
            estado
        );

    const filtradas =
        devolucionesRegistradas.filter(
            function (devolucion) {

                return (
                    devolucion.estado ===
                    estadoNormalizado
                );
            }
        );

    renderizarDevoluciones(
        filtradas
    );
}



function renderizarDevoluciones(
    lista
) {

    const tabla =
        document.getElementById(
            "tablaDevoluciones"
        );

    const sinDevoluciones =
        document.getElementById(
            "sinDevoluciones"
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
                    colspan="7"
                    class="text-center py-5 text-muted"
                >
                    No se encontraron devoluciones.
                </td>
            </tr>
        `;

        sinDevoluciones
            ?.classList
            .remove("d-none");

        return;
    }

    sinDevoluciones
        ?.classList
        .add("d-none");

    const idAlmacenSesion =
        obtenerIdAlmacenSesion();

    lista.forEach(
        function (devolucion) {

            const esAdministrador =
                idAlmacenSesion === null;

            const esOrigen =
                Number(
                    devolucion.idAlmacenOrigen
                ) ===
                Number(
                    idAlmacenSesion
                );

            const esDestino =
                Number(
                    devolucion.idAlmacenDestino
                ) ===
                Number(
                    idAlmacenSesion
                );

            const puedeEnviar =
                (
                    esAdministrador ||
                    esOrigen
                ) &&
                devolucion.estado ===
                "CREADO";

            const puedeRecibir =
                (
                    esAdministrador ||
                    esDestino
                ) &&
                devolucion.estado ===
                "EN_TRANSITO";

            const puedeAnular =
                (
                    esAdministrador ||
                    esOrigen
                ) &&
                (
                    devolucion.estado ===
                    "CREADO" ||
                    devolucion.estado ===
                    "EN_TRANSITO"
                );

            const rutaPdf =
                devolucion.rutaPdf ??
                devolucion.rutapdf ??
                devolucion.ruta_pdf ??
                null;

            const botonPdf =
                rutaPdf
                    ? `
                        <button
                            type="button"
                            class="btn btn-sm btn-outline-danger"
                            title="Ver PDF"
                            onclick="verPdfDevolucion(${devolucion.idDevolucion})"
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

            const botonEnviar =
                puedeEnviar
                    ? `
                        <button
                            type="button"
                            class="btn btn-sm btn-outline-primary"
                            title="Enviar devolución"
                            onclick="enviarDevolucion(${devolucion.idDevolucion})"
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
                            title="Recibir devolución"
                            onclick="recibirDevolucion(${devolucion.idDevolucion})"
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
                            title="Anular devolución"
                            onclick="abrirModalAnularDevolucion(${devolucion.idDevolucion})"
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
                    <span class="fw-semibold">
                        ${escaparHtml(
                devolucion.numeroComprobante
            )}
                    </span>
                </td>

                <td>
                    ${escaparHtml(
                formatearFechaHora(
                    devolucion.fecha
                )
            )}
                </td>

                <td>
                    ${escaparHtml(
                obtenerNombreTipo(
                    devolucion.tipo
                )
            )}
                </td>

                <td>
                    ${escaparHtml(
                devolucion.almacenOrigen
            )}
                </td>

                <td>
                    ${escaparHtml(
                devolucion.almacenDestino
            )}
                </td>

                <td>
                    ${obtenerBadgeEstado(
                devolucion.estado
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

/* ============================================================
   RESUMEN
============================================================ */

async function actualizarResumenDevoluciones() {
    try {

        const url = `${CONFIG.API_URL}/devoluciones/dashboard?idAlmacen=${CONFIG.getData().idAlmacen}`

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

        console.log("RESUMEN DEVOLUCIONES:", data);

        document.getElementById("totalDevoluciones").textContent = data.totalDevoluciones;
        document.getElementById("totalCreadas").textContent = data.creadas;
        document.getElementById("totalEnTransito").textContent = data.enTransito;
        document.getElementById("totalRecibidas").textContent = data.recibidas;
        document.getElementById("totalAnuladas").textContent = data.anuladas;


    } catch (error) {
        console.error("Error al obtener kardex:", error);
    }

}


function contarEstado(
    estado
) {

    return devolucionesRegistradas.filter(
        function (item) {

            return item.estado === estado;
        }
    ).length;
}


/* ============================================================
   PAGINACIÓN
============================================================ */

function actualizarPaginacionDevoluciones() {

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

    await cargarDevoluciones();
}


/* ============================================================
   CHOFERES Y VEHÍCULOS
============================================================ */

async function cargarChoferes() {

    try {

        const respuesta =
            await realizarPeticionDevolucion(
                DEVOLUCION_ENDPOINTS.choferes
            );

        llenarComboGenerico(
            "chofer",
            obtenerListaRespuesta(
                respuesta
            ),
            "Seleccionar chofer"
        );

    } catch (error) {

        console.error(
            "Error cargando choferes:",
            error
        );

        llenarComboGenerico(
            "chofer",
            [],
            "No se pudieron cargar los choferes"
        );
    }
}


async function cargarVehiculos() {

    try {

        const respuesta =
            await realizarPeticionDevolucion(
                DEVOLUCION_ENDPOINTS.vehiculos
            );

        llenarComboGenerico(
            "vehiculo",
            obtenerListaRespuesta(
                respuesta
            ),
            "Seleccionar vehículo"
        );

    } catch (error) {

        console.error(
            "Error cargando vehículos:",
            error
        );

        llenarComboGenerico(
            "vehiculo",
            [],
            "No se pudieron cargar los vehículos"
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


/* ============================================================
   ENVÍOS PARA EL FORMULARIO
============================================================ */

async function cargarEnviosDisponibles() {

    const selector =
        document.getElementById(
            "envioRelacionado"
        );

    if (selector) {

        selector.disabled = true;

        selector.innerHTML = `
            <option value="">
                Cargando envíos...
            </option>
        `;
    }

    try {

        const respuesta =
            await realizarPeticionDevolucion(
                DEVOLUCION_ENDPOINTS.enviosFormulario
            );

        enviosDisponibles =
            obtenerListaRespuesta(
                respuesta
            ).map(
                normalizarEnvioFormulario
            );

        llenarSelectorEnvios();

    } catch (error) {

        console.error(
            "Error cargando envíos disponibles:",
            error
        );

        enviosDisponibles = [];

        if (selector) {

            selector.disabled = true;

            selector.innerHTML = `
                <option value="">
                    No se pudieron cargar los envíos
                </option>
            `;
        }

        mostrarToast(
            obtenerMensajeError(error),
            "danger"
        );
    }
}


function normalizarEnvioFormulario(
    item
) {

    return {

        idGuiaEnvio: Number(
            item.idGuiaEnvio ??
            item.idguiaenvio ??
            0
        ),

        numeroGuia:
            item.numeroGuia ??
            item.numeroguia ??
            "SIN GUÍA",

        estado:
            normalizarEstado(
                item.estado
            ),

        fechaRecibo:
            item.fechaRecibo ??
            item.fecharecibo ??
            null,

        idAlmacenOrigen: Number(
            item.idAlmacenOrigen ??
            item.idalmacenorigen ??
            0
        ),

        almacenOrigen:
            item.almacenOrigen ??
            item.almacenorigen ??
            "Sin origen",

        idAlmacenDestino: Number(
            item.idAlmacenDestino ??
            item.idalmacendestino ??
            0
        ),

        almacenDestino:
            item.almacenDestino ??
            item.almacendestino ??
            "Sin destino",

        idChofer: Number(
            item.idChofer ??
            item.idchofer ??
            0
        ),

        chofer:
            item.chofer ??
            "Sin chofer",

        idVehiculo: Number(
            item.idVehiculo ??
            item.idvehiculo ??
            0
        ),

        vehiculo:
            item.vehiculo ??
            "Sin vehículo"
    };
}


function llenarSelectorEnvios() {

    const selector =
        document.getElementById(
            "envioRelacionado"
        );

    if (!selector) {
        return;
    }

    selector.innerHTML = `
        <option value="">
            Seleccionar envío
        </option>
    `;

    if (
        enviosDisponibles.length === 0
    ) {

        selector.disabled = true;

        selector.innerHTML = `
            <option value="">
                No hay envíos recibidos disponibles
            </option>
        `;

        return;
    }

    enviosDisponibles.forEach(
        function (envio) {

            const opcion =
                document.createElement(
                    "option"
                );

            opcion.value =
                String(
                    envio.idGuiaEnvio
                );

            opcion.textContent =
                `${envio.numeroGuia} - ` +
                `${envio.almacenOrigen} → ` +
                `${envio.almacenDestino}`;

            selector.appendChild(
                opcion
            );
        }
    );

    selector.disabled = false;
}


/* ============================================================
   ABRIR MODAL
============================================================ */

async function abrirModalNuevaDevolucion() {

    detalleNuevaDevolucion = [];

    productosEnvioSeleccionado = [];

    limpiarFormularioNuevaDevolucion();

    renderizarDetalleNuevaDevolucion();

    limpiarDatosProducto();

    const modalElemento =
        document.getElementById(
            "modalDevolucion"
        );

    if (!modalElemento) {

        mostrarToast(
            "No se encontró el modal de devolución.",
            "danger"
        );

        return;
    }

    bootstrap.Modal
        .getOrCreateInstance(
            modalElemento
        )
        .show();

    await cargarEnviosDisponibles();
}


function limpiarFormularioNuevaDevolucion() {

    asignarValor(
        "envioRelacionado",
        ""
    );

    asignarValor(
        "tipoDevolucion",
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
        "almacenOrigen",
        ""
    );

    asignarValor(
        "almacenDestino",
        ""
    );

    asignarValor(
        "idAlmacenOrigen",
        ""
    );

    asignarValor(
        "idAlmacenDestino",
        ""
    );

    asignarValor(
        "motivoProducto",
        ""
    );

    asignarValor(
        "observacionProducto",
        ""
    );

    limpiarValidacionesFormulario();

    bloquearSelectorProductos(
        "Selecciona primero un envío"
    );
}


/* ============================================================
   SELECCIONAR ENVÍO
============================================================ */

async function cargarDatosEnvio() {

    const idGuiaEnvio =
        Number(
            document
                .getElementById(
                    "envioRelacionado"
                )
                ?.value
        );

    const envio =
        enviosDisponibles.find(
            function (item) {

                return (
                    item.idGuiaEnvio ===
                    idGuiaEnvio
                );
            }
        );

    detalleNuevaDevolucion = [];

    productosEnvioSeleccionado = [];

    renderizarDetalleNuevaDevolucion();

    limpiarDatosProducto();

    if (!envio) {

        asignarValor(
            "almacenOrigen",
            ""
        );

        asignarValor(
            "idAlmacenOrigen",
            ""
        );

        asignarValor(
            "almacenDestino",
            ""
        );

        asignarValor(
            "idAlmacenDestino",
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

        bloquearSelectorProductos(
            "Selecciona primero un envío"
        );

        return;
    }

    /*
     * La vista ya devuelve los almacenes invertidos:
     *
     * idAlmacenOrigen  = destino original del envío
     * idAlmacenDestino = origen original del envío
     */

    asignarValor(
        "almacenOrigen",
        envio.almacenOrigen
    );

    asignarValor(
        "idAlmacenOrigen",
        envio.idAlmacenOrigen
    );

    asignarValor(
        "almacenDestino",
        envio.almacenDestino
    );

    asignarValor(
        "idAlmacenDestino",
        envio.idAlmacenDestino
    );

    /*
     * Autoseleccionar chofer y vehículo del envío.
     * El usuario todavía puede cambiarlos.
     */

    if (envio.idChofer > 0) {

        asignarValor(
            "chofer",
            envio.idChofer
        );
    }

    if (envio.idVehiculo > 0) {

        asignarValor(
            "vehiculo",
            envio.idVehiculo
        );
    }

    bloquearSelectorProductos(
        "Cargando productos..."
    );

    try {

        const respuesta =
            await realizarPeticionDevolucion(
                DEVOLUCION_ENDPOINTS.productosFormulario(
                    idGuiaEnvio
                )
            );

        productosEnvioSeleccionado =
            obtenerListaRespuesta(
                respuesta
            )
                .map(
                    normalizarProductoFormulario
                )
                .filter(
                    function (producto) {

                        return (
                            producto.idProductoUnidad > 0 &&
                            producto.cantidadEnviada > 0
                        );
                    }
                );

        llenarSelectorProductosEnvio();

    } catch (error) {

        console.error(
            "Error cargando productos del envío:",
            error
        );

        productosEnvioSeleccionado = [];

        bloquearSelectorProductos(
            "No se pudieron cargar los productos"
        );

        mostrarToast(
            obtenerMensajeError(error),
            "danger"
        );
    }
}


function normalizarProductoFormulario(
    item
) {

    return {

        idGuiaEnvio: Number(
            item.idGuiaEnvio ??
            item.idguiaenvio ??
            0
        ),

        idProductoUnidad: Number(
            item.idProductoUnidad ??
            item.idproductounidad ??
            0
        ),

        codigo:
            item.codigo ??
            item.sku ??
            "SIN-CÓDIGO",

        producto:
            item.producto ??
            "Producto sin nombre",

        variante:
            item.variante ??
            "Sin variante",

        unidad:
            item.unidad ??
            item.unidadAbreviatura ??
            item.unidadabreviatura ??
            "Unidad",

        unidadAbreviatura:
            item.unidadAbreviatura ??
            item.unidadabreviatura ??
            "",

        cantidadEnviada: Number(
            item.cantidadEnviada ??
            item.cantidadenviada ??
            0
        )
    };
}


function llenarSelectorProductosEnvio() {

    const selector =
        document.getElementById(
            "productoSeleccionado"
        );

    if (!selector) {
        return;
    }

    selector.innerHTML = `
        <option value="">
            Seleccionar producto
        </option>
    `;

    if (
        productosEnvioSeleccionado.length === 0
    ) {

        bloquearSelectorProductos(
            "El envío no contiene productos"
        );

        return;
    }

    productosEnvioSeleccionado.forEach(
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
                `${producto.codigo} - ` +
                `${producto.producto} - ` +
                `${producto.variante} - ` +
                `${producto.unidad} - ` +
                `Cantidad: ${producto.cantidadEnviada}`;

            selector.appendChild(
                opcion
            );
        }
    );

    selector.disabled = false;
}


function bloquearSelectorProductos(
    mensaje
) {

    const selector =
        document.getElementById(
            "productoSeleccionado"
        );

    if (!selector) {
        return;
    }

    selector.disabled = true;

    selector.innerHTML = `
        <option value="">
            ${escaparHtml(mensaje)}
        </option>
    `;
}


/* ============================================================
   PRODUCTO SELECCIONADO
============================================================ */

function actualizarDatosProductoDevolucion() {

    const idProductoUnidad =
        Number(
            document
                .getElementById(
                    "productoSeleccionado"
                )
                ?.value
        );

    const producto =
        productosEnvioSeleccionado.find(
            function (item) {

                return (
                    item.idProductoUnidad ===
                    idProductoUnidad
                );
            }
        );

    if (!producto) {

        limpiarDatosProducto();

        return;
    }

    asignarValor(
        "cantidadEnviada",
        producto.cantidadEnviada
    );

    const inputCantidad =
        document.getElementById(
            "cantidadDevuelta"
        );

    if (inputCantidad) {

        inputCantidad.disabled = false;

        inputCantidad.min = "1";

        inputCantidad.max =
            String(
                producto.cantidadEnviada
            );

        inputCantidad.value = "1";
    }
}


function validarCantidadDevuelta(
    input
) {

    const minimo =
        Number(
            input.min || 1
        );

    const maximo =
        Number(
            input.max || 0
        );

    let cantidad =
        Number(
            input.value || 0
        );

    if (!Number.isInteger(cantidad)) {

        cantidad =
            Math.floor(cantidad);
    }

    if (cantidad < minimo) {

        cantidad = minimo;
    }

    if (
        maximo > 0 &&
        cantidad > maximo
    ) {

        cantidad = maximo;

        mostrarToast(
            `La cantidad máxima es ${maximo}.`,
            "warning"
        );
    }

    input.value =
        String(cantidad);
}


function limpiarDatosProducto() {

    asignarValor(
        "cantidadEnviada",
        0
    );

    asignarValor(
        "motivoProducto",
        ""
    );

    asignarValor(
        "observacionProducto",
        ""
    );

    const inputCantidad =
        document.getElementById(
            "cantidadDevuelta"
        );

    if (inputCantidad) {

        inputCantidad.disabled = true;

        inputCantidad.min = "1";

        inputCantidad.max = "1";

        inputCantidad.value = "1";
    }
}


/* ============================================================
   AGREGAR PRODUCTO
============================================================ */

function agregarProductoDevolucion() {

    const idGuiaEnvio =
        Number(
            document
                .getElementById(
                    "envioRelacionado"
                )
                ?.value
        );

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
                    "cantidadDevuelta"
                )
                ?.value
        );

    const motivo =
        document
            .getElementById(
                "motivoProducto"
            )
            ?.value
            ?.trim() || "";

    const observacion =
        document
            .getElementById(
                "observacionProducto"
            )
            ?.value
            ?.trim() || "";

    if (!idGuiaEnvio) {

        mostrarToast(
            "Selecciona el envío relacionado.",
            "warning"
        );

        return;
    }

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
            "La cantidad debe ser un número entero mayor que cero.",
            "warning"
        );

        return;
    }

    if (!motivo) {

        mostrarToast(
            "Ingresa el motivo del producto.",
            "warning"
        );

        return;
    }

    const producto =
        productosEnvioSeleccionado.find(
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

    const productoExistente =
        detalleNuevaDevolucion.find(
            function (item) {

                return (
                    item.idProductoUnidad ===
                    idProductoUnidad
                );
            }
        );

    const cantidadAcumulada =
        productoExistente
            ? productoExistente.cantidad +
            cantidad
            : cantidad;

    if (
        cantidadAcumulada >
        producto.cantidadEnviada
    ) {

        mostrarToast(
            `No puedes devolver más de ${producto.cantidadEnviada} unidades.`,
            "warning"
        );

        return;
    }

    if (productoExistente) {

        productoExistente.cantidad =
            cantidadAcumulada;

        productoExistente.motivo =
            motivo;

        productoExistente.observacion =
            observacion;

    } else {

        detalleNuevaDevolucion.push({

            idProductoUnidad:
                producto.idProductoUnidad,

            codigo:
                producto.codigo,

            producto:
                producto.producto,

            variante:
                producto.variante,

            unidad:
                producto.unidad,

            cantidadEnviada:
                producto.cantidadEnviada,

            cantidad:
                cantidad,

            motivo:
                motivo,

            observacion:
                observacion
        });
    }

    asignarValor(
        "productoSeleccionado",
        ""
    );

    limpiarDatosProducto();

    renderizarDetalleNuevaDevolucion();
}


/* ============================================================
   TABLA DEL DETALLE NUEVO
============================================================ */

function renderizarDetalleNuevaDevolucion() {

    const tabla =
        document.getElementById(
            "tablaDetalleDevolucion"
        );

    if (!tabla) {
        return;
    }

    if (
        detalleNuevaDevolucion.length ===
        0
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

        actualizarTotalUnidadesDevolucion();

        return;
    }

    tabla.innerHTML =
        detalleNuevaDevolucion
            .map(
                function (
                    producto,
                    indice
                ) {

                    return `
                        <tr>

                            <td>
                                ${escaparHtml(
                        producto.producto
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
                                ${producto.cantidadEnviada}
                            </td>

                            <td class="text-center">

                                <input
                                    type="number"
                                    class="form-control form-control-sm text-center"
                                    min="1"
                                    max="${producto.cantidadEnviada}"
                                    step="1"
                                    value="${producto.cantidad}"
                                    oninput="actualizarCantidadDetalleDevolucion(${indice}, this)"
                                >

                            </td>

                            <td>
                                ${escaparHtml(
                        producto.motivo
                    )}
                            </td>

                            <td>
                                ${escaparHtml(
                        producto.observacion ||
                        "Sin observación"
                    )}
                            </td>

                            <td class="text-center">

                                <button
                                    type="button"
                                    class="btn btn-sm btn-outline-danger"
                                    title="Eliminar producto"
                                    onclick="eliminarProductoDevolucion(${indice})"
                                >
                                    <i class="bi bi-trash"></i>
                                </button>

                            </td>

                        </tr>
                    `;
                }
            )
            .join("");

    actualizarTotalUnidadesDevolucion();
}


function actualizarCantidadDetalleDevolucion(
    indice,
    input
) {

    const producto =
        detalleNuevaDevolucion[indice];

    if (!producto) {
        return;
    }

    let cantidad =
        Number(
            input.value || 0
        );

    if (!Number.isInteger(cantidad)) {

        cantidad =
            Math.floor(cantidad);
    }

    if (cantidad < 1) {

        cantidad = 1;
    }

    if (
        cantidad >
        producto.cantidadEnviada
    ) {

        cantidad =
            producto.cantidadEnviada;

        mostrarToast(
            `La cantidad máxima es ${producto.cantidadEnviada}.`,
            "warning"
        );
    }

    producto.cantidad =
        cantidad;

    input.value =
        String(cantidad);

    actualizarTotalUnidadesDevolucion();
}


function eliminarProductoDevolucion(
    indice
) {

    detalleNuevaDevolucion.splice(
        indice,
        1
    );

    renderizarDetalleNuevaDevolucion();
}


function actualizarTotalUnidadesDevolucion() {

    const total =
        detalleNuevaDevolucion.reduce(
            function (
                acumulado,
                producto
            ) {

                return (
                    acumulado +
                    Number(
                        producto.cantidad || 0
                    )
                );
            },
            0
        );

    asignarTexto(
        "totalUnidadesDevolucion",
        total
    );
}


/* ============================================================
   REGISTRAR DEVOLUCIÓN
============================================================ */

async function registrarDevolucion() {

    const idGuiaEnvio =
        Number(
            document
                .getElementById(
                    "envioRelacionado"
                )
                ?.value
        );

    const idAlmacenOrigen =
        Number(
            document
                .getElementById(
                    "idAlmacenOrigen"
                )
                ?.value
        );

    const idAlmacenDestino =
        Number(
            document
                .getElementById(
                    "idAlmacenDestino"
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

    const tipo =
        document
            .getElementById(
                "tipoDevolucion"
            )
            ?.value
            ?.trim() || "";

    limpiarValidacionesFormulario();

    let valido = true;

    if (!idGuiaEnvio) {

        marcarInvalido(
            "envioRelacionado"
        );

        valido = false;
    }

    if (!tipo) {

        marcarInvalido(
            "tipoDevolucion"
        );

        valido = false;
    }

    if (!idChofer) {

        marcarInvalido(
            "chofer"
        );

        valido = false;
    }

    if (!idVehiculo) {

        marcarInvalido(
            "vehiculo"
        );

        valido = false;
    }

    if (!valido) {

        mostrarToast(
            "Completa los campos obligatorios.",
            "warning"
        );

        return;
    }

    if (
        !idAlmacenOrigen ||
        !idAlmacenDestino
    ) {

        mostrarToast(
            "No se pudieron determinar los almacenes de la devolución.",
            "danger"
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
        detalleNuevaDevolucion.length ===
        0
    ) {

        mostrarToast(
            "Agrega al menos un producto.",
            "warning"
        );

        return;
    }

    const request = {

        idGuiaEnvio:
            idGuiaEnvio,

        idAlmacenOrigen:
            idAlmacenOrigen,

        idAlmacenDestino:
            idAlmacenDestino,

        idChofer:
            idChofer,

        idVehiculo:
            idVehiculo,

        tipo:
            tipo,

        detalle:
            detalleNuevaDevolucion.map(
                function (producto) {

                    return {

                        idProductoUnidad:
                            producto.idProductoUnidad,

                        cantidad:
                            producto.cantidad,

                        motivo:
                            producto.motivo,

                        observacion:
                            producto.observacion || null
                    };
                }
            )
    };

    console.log(
        "Solicitud de devolución:",
        request
    );

    const boton =
        document.getElementById(
            "btnRegistrarDevolucion"
        );

    cambiarEstadoBoton(
        boton,
        true,
        "Registrando..."
    );

    try {

        const respuesta =
            await realizarPeticionDevolucion(
                DEVOLUCION_ENDPOINTS.devoluciones,
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
                    "modalDevolucion"
                )
            )
            ?.hide();

        detalleNuevaDevolucion = [];

        productosEnvioSeleccionado = [];

        paginaActualServidor = 0;

        renderizarDetalleNuevaDevolucion();

        await Promise.all([
            cargarDevoluciones(),
            cargarEnviosDisponibles()
        ]);

        mostrarToast(
            respuesta?.idGuiaDevolucion
                ? `Devolución ${respuesta.idGuiaDevolucion} registrada correctamente.`
                : "Devolución registrada correctamente.",
            "success"
        );

        if (typeof actualizarAlertasGlobales === "function") { actualizarAlertasGlobales(); }

    } catch (error) {

        console.error(
            "Error registrando devolución:",
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


/* ============================================================
   ENVIAR DEVOLUCIÓN
============================================================ */

async function enviarDevolucion(
    idDevolucion
) {

    const devolucion =
        buscarDevolucionPorId(
            idDevolucion
        );

    if (!devolucion) {

        mostrarToast(
            "No se encontró la devolución.",
            "danger"
        );

        return;
    }

    if (
        devolucion.estado !==
        "CREADO"
    ) {

        mostrarToast(
            "Solo se puede enviar una devolución en estado CREADO.",
            "warning"
        );

        return;
    }

    const confirmar =
        window.confirm(
            `¿Deseas enviar la devolución ${devolucion.numeroComprobante}?`
        );

    if (!confirmar) {
        return;
    }

    try {

        const respuesta =
            await realizarPeticionDevolucion(
                DEVOLUCION_ENDPOINTS.enviar(
                    idDevolucion
                ),
                {
                    method: "PUT"
                }
            );

        await cargarDevoluciones();

        mostrarToast(
            respuesta?.mensaje ||
            "Devolución enviada correctamente.",
            "success"
        );

    } catch (error) {

        mostrarToast(
            obtenerMensajeError(error),
            "danger"
        );
    }
}


/* ============================================================
   RECIBIR DEVOLUCIÓN
============================================================ */

async function recibirDevolucion(
    idDevolucion
) {

    const devolucion =
        buscarDevolucionPorId(
            idDevolucion
        );

    if (!devolucion) {

        mostrarToast(
            "No se encontró la devolución.",
            "danger"
        );

        return;
    }

    if (
        devolucion.estado !==
        "EN_TRANSITO"
    ) {

        mostrarToast(
            "Solo se puede recibir una devolución en estado EN_TRANSITO.",
            "warning"
        );

        return;
    }

    const confirmar =
        window.confirm(
            `¿Confirmas la recepción de la devolución ${devolucion.numeroComprobante}?`
        );

    if (!confirmar) {
        return;
    }

    try {

        const respuesta =
            await realizarPeticionDevolucion(
                DEVOLUCION_ENDPOINTS.recibir(
                    idDevolucion
                ),
                {
                    method: "PUT"
                }
            );

        await cargarDevoluciones();

        mostrarToast(
            respuesta?.mensaje ||
            "Devolución recibida correctamente.",
            "success"
        );

    } catch (error) {

        mostrarToast(
            obtenerMensajeError(error),
            "danger"
        );
    }
}


/* ============================================================
   ANULAR DEVOLUCIÓN
============================================================ */

function abrirModalAnularDevolucion(
    idDevolucion
) {

    const devolucion =
        buscarDevolucionPorId(
            idDevolucion
        );

    if (!devolucion) {

        mostrarToast(
            "No se encontró la devolución.",
            "danger"
        );

        return;
    }

    if (
        devolucion.estado !== "CREADO" &&
        devolucion.estado !== "EN_TRANSITO"
    ) {

        mostrarToast(
            "La devolución no puede anularse en su estado actual.",
            "warning"
        );

        return;
    }

    idDevolucionSeleccionada =
        Number(
            idDevolucion
        );

    asignarValor(
        "idDevolucionAnular",
        idDevolucion
    );

    asignarTexto(
        "numeroDevolucionAnular",
        devolucion.numeroComprobante
    );

    asignarValor(
        "motivoAnulacionDevolucion",
        ""
    );

    document
        .getElementById(
            "motivoAnulacionDevolucion"
        )
        ?.classList
        .remove("is-invalid");

    const modal =
        document.getElementById(
            "modalAnularDevolucion"
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


async function confirmarAnulacionDevolucion() {

    const idDevolucion =
        Number(
            document
                .getElementById(
                    "idDevolucionAnular"
                )
                ?.value ||
            idDevolucionSeleccionada
        );

    const textarea =
        document.getElementById(
            "motivoAnulacionDevolucion"
        );

    const motivo =
        textarea
            ?.value
            ?.trim() || "";

    textarea
        ?.classList
        .remove("is-invalid");

    if (!idDevolucion) {

        mostrarToast(
            "No se seleccionó una devolución.",
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
            "btnConfirmarAnulacionDevolucion"
        );

    cambiarEstadoBoton(
        boton,
        true,
        "Anulando..."
    );

    try {

        const respuesta =
            await realizarPeticionDevolucion(
                DEVOLUCION_ENDPOINTS.anular(
                    idDevolucion
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
                    "modalAnularDevolucion"
                )
            )
            ?.hide();

        idDevolucionSeleccionada =
            null;

        await cargarDevoluciones();

        mostrarToast(
            respuesta?.mensaje ||
            "Devolución anulada correctamente.",
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



/* ============================================================
   VER PDF
============================================================ */
async function verPdfDevolucion(
    idDevolucion
) {

    let urlTemporalPdf = null;

    try {

        const devolucion =
            buscarDevolucionPorId(
                idDevolucion
            );

        if (!devolucion) {

            throw new Error(
                "No se encontró la devolución seleccionada."
            );
        }

        const rutaPdf =
            devolucion.rutaPdf ??
            devolucion.rutapdf ??
            devolucion.ruta_pdf ??
            null;

        if (
            !rutaPdf ||
            String(rutaPdf).trim() === ""
        ) {

            throw new Error(
                "Esta devolución no tiene un PDF disponible."
            );
        }

        if (
            !String(rutaPdf)
                .toLowerCase()
                .endsWith(".pdf")
        ) {

            throw new Error(
                "La ruta registrada no corresponde a un archivo PDF."
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
            DEVOLUCION_ENDPOINTS.pdf(
                rutaPdf
            );

        console.log(
            "Ruta PDF devolución:",
            rutaPdf
        );

        console.log(
            "URL PDF devolución:",
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
                "No se pudo obtener el PDF.";

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
                "iframeDevolucionPdf"
            );

        const modal =
            document.getElementById(
                "modalPreviewPdfDevolucion"
            );

        if (!iframe || !modal) {

            throw new Error(
                "No se encontró el visor de PDF."
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


/* ============================================================
   LIMPIAR FILTROS
============================================================ */

function limpiarFiltros() {

    asignarValor(
        "buscarDevolucion",
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

    cargarDevoluciones();
}


/* ============================================================
   BADGES
============================================================ */

function obtenerBadgeEstado(
    estado
) {

    const configuraciones = {

        CREADO: {

            clase:
                "bg-warning-subtle text-warning border border-warning-subtle",

            texto:
                "Creado"
        },

        PROCESADO: {

            clase:
                "bg-primary-subtle text-primary border border-primary-subtle",

            texto:
                "Procesado"
        },

        EN_TRANSITO: {

            clase:
                "bg-info-subtle text-info border border-info-subtle",

            texto:
                "En tránsito"
        },

        RECIBIDO: {

            clase:
                "bg-success-subtle text-success border border-success-subtle",

            texto:
                "Recibido"
        },

        ANULADO: {

            clase:
                "bg-danger-subtle text-danger border border-danger-subtle",

            texto:
                "Anulado"
        }
    };

    const configuracion =
        configuraciones[estado] || {

            clase:
                "bg-secondary-subtle text-secondary border",

            texto:
                estado || "Sin estado"
        };

    return `
        <span
            class="badge rounded-pill ${configuracion.clase}"
        >
            ${escaparHtml(
        configuracion.texto
    )}
        </span>
    `;
}


function obtenerNombreTipo(
    tipo
) {

    const tipos = {

        DEFECTUOSO:
            "Defectuoso",

        ERROR_DESPACHO:
            "Error de despacho",

        SOBRANTE:
            "Sobrante",

        GARANTIA:
            "Garantía",

        VENCIDO:
            "Vencido",

        OTRO:
            "Otro"
    };

    const valor =
        normalizarEstado(
            tipo
        );

    return (
        tipos[valor] ||
        tipo ||
        "Sin tipo"
    );
}


/* ============================================================
   UTILIDADES
============================================================ */

function buscarDevolucionPorId(
    idDevolucion
) {

    return devolucionesRegistradas.find(
        function (item) {

            return (
                Number(
                    item.idDevolucion
                ) ===
                Number(
                    idDevolucion
                )
            );
        }
    );
}


function normalizarEstado(
    valor
) {

    return String(
        valor ?? ""
    )
        .trim()
        .toUpperCase()
        .replaceAll(" ", "_");
}


function obtenerIdCombo(
    item
) {

    return Number(
        item?.id ??
        item?.value ??
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

    const nombreCompleto =
        [
            item.primerNombre ??
            item.primer_nombre,

            item.apellidoPaterno ??
            item.apellido_paterno,

            item.apellidoMaterno ??
            item.apellido_materno
        ]
            .filter(Boolean)
            .join(" ")
            .trim();

    return (
        item.texto ??
        item.label ??
        item.nombreCompleto ??
        item.nombrecompleto ??
        nombreCompleto ??
        item.nombre ??
        item.descripcion ??
        item.placa ??
        item.codigo ??
        ""
    );
}


function formatearFechaHora(
    fecha
) {

    if (!fecha) {
        return "";
    }

    if (
        typeof fecha === "string" &&
        /^\d{2}\/\d{2}\/\d{4}/.test(
            fecha
        )
    ) {

        return fecha;
    }

    const fechaConvertida =
        new Date(fecha);

    if (
        Number.isNaN(
            fechaConvertida.getTime()
        )
    ) {

        return String(fecha);
    }

    return fechaConvertida.toLocaleString(
        "es-PE",
        {
            dateStyle: "short",
            timeStyle: "short"
        }
    );
}


function limpiarValidacionesFormulario() {

    [
        "envioRelacionado",
        "tipoDevolucion",
        "chofer",
        "vehiculo"
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
            String(
                valor ?? ""
            );
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
        "btnRegistrarDevolucion"
    ) {

        boton.innerHTML = `
            <i class="bi bi-floppy me-2"></i>
            Registrar devolución
        `;

        return;
    }

    if (
        boton.id ===
        "btnConfirmarAnulacionDevolucion"
    ) {

        boton.innerHTML = `
            <i class="bi bi-x-circle me-2"></i>
            Anular devolución
        `;
    }
}


function obtenerMensajeError(
    error
) {

    if (
        typeof error ===
        "string"
    ) {

        return error;
    }

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


/* ============================================================
   TOAST
============================================================ */

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

function mostrarMensajeWebSocketDevolucion(
    evento
) {

    const accion =
        String(
            evento?.accion || ""
        ).toUpperCase();

    let mensaje =
        evento?.mensaje ||
        "Se actualizó una devolución.";

    let tipo =
        "info";

    switch (accion) {

        case "DEVOLUCION_CREADA":

            mensaje =
                "Se creó una nueva devolución.";

            tipo =
                "success";

            break;

        case "DEVOLUCION_ENVIADA":

            mensaje =
                "La devolución fue enviada.";

            tipo =
                "info";

            break;

        case "DEVOLUCION_RECIBIDA":

            mensaje =
                "La devolución fue recibida.";

            tipo =
                "success";

            break;

        case "DEVOLUCION_ANULADA":

            mensaje =
                "La devolución fue anulada.";

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
   FUNCIONES GLOBALES
============================================================ */

window.abrirModalNuevaDevolucion =
    abrirModalNuevaDevolucion;

window.cargarDatosEnvio =
    cargarDatosEnvio;

window.actualizarDatosProductoDevolucion =
    actualizarDatosProductoDevolucion;

window.validarCantidadDevuelta =
    validarCantidadDevuelta;

window.agregarProductoDevolucion =
    agregarProductoDevolucion;

window.actualizarCantidadDetalleDevolucion =
    actualizarCantidadDetalleDevolucion;

window.eliminarProductoDevolucion =
    eliminarProductoDevolucion;

window.registrarDevolucion =
    registrarDevolucion;

window.enviarDevolucion =
    enviarDevolucion;

window.recibirDevolucion =
    recibirDevolucion;

window.abrirModalAnularDevolucion =
    abrirModalAnularDevolucion;

window.confirmarAnulacionDevolucion =
    confirmarAnulacionDevolucion;



window.verPdfDevolucion =
    verPdfDevolucion;

window.limpiarFiltros =
    limpiarFiltros;

window.cambiarPagina =
    cambiarPagina;

window.cargarDevoluciones =
    cargarDevoluciones;

window.addEventListener(
    "beforeunload",
    function () {

        if (
            suscripcionWebSocketDevoluciones
        ) {
            suscripcionWebSocketDevoluciones
                .unsubscribe();
        }

        if (
            clienteWebSocketDevoluciones &&
            clienteWebSocketDevoluciones.active
        ) {
            clienteWebSocketDevoluciones
                .deactivate();
        }
    }
);

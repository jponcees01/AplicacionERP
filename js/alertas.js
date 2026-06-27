/* ============================================================
   CONFIGURACIÓN
============================================================ */

const API_URL_ALERTAS = CONFIG.API_URL;

const ENDPOINTS_ALERTAS = {
    listar: `${API_URL_ALERTAS}/alertas`,
    contarNoLeidas: `${API_URL_ALERTAS}/alertas/no-leidas/count`,
    marcarTodas: `${API_URL_ALERTAS}/alertas/leer-todas`
};


/* ============================================================
   ESTADO GLOBAL
============================================================ */

let alertasPagina = [];

let paginaActualAlertas = 0;
let tamanioPaginaAlertas = 10;
let totalPaginasAlertas = 0;
let totalElementosAlertas = 0;

let temporizadorBusquedaAlertas = null;
let cargandoAlertas = false;


/* ============================================================
   ELEMENTOS HTML
============================================================ */

const listaAlertas =
    document.getElementById(
        "listaAlertas"
    );

const buscarAlerta =
    document.getElementById(
        "buscarAlerta"
    );

const filtroTipoAlerta =
    document.getElementById(
        "filtroTipoAlerta"
    );

const filtroEstadoAlerta =
    document.getElementById(
        "filtroEstadoAlerta"
    );

const filtroLecturaAlerta =
    document.getElementById(
        "filtroLecturaAlerta"
    );

const botonLimpiarFiltrosAlertas =
    document.getElementById(
        "btnLimpiarFiltrosAlertas"
    );

const botonMarcarTodasLeidas =
    document.getElementById(
        "btnMarcarTodasLeidas"
    );


/* ============================================================
   INICIALIZACIÓN
============================================================ */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        configurarEventosAlertas();

        const token =
            obtenerTokenAlertas();

        if (!token) {

            mostrarToastAlertas(
                "No se encontró una sesión válida",
                "danger"
            );

            return;
        }

        cargarAlertas();

        cargarContadorAlertas();
    }
);


/* ============================================================
   EVENTOS
============================================================ */

function configurarEventosAlertas() {

    buscarAlerta?.addEventListener(
        "input",
        function () {

            clearTimeout(
                temporizadorBusquedaAlertas
            );

            temporizadorBusquedaAlertas =
                setTimeout(
                    function () {

                        paginaActualAlertas = 0;

                        cargarAlertas();
                    },
                    400
                );
        }
    );

    filtroTipoAlerta?.addEventListener(
        "change",
        function () {

            paginaActualAlertas = 0;

            cargarAlertas();
        }
    );

    filtroEstadoAlerta?.addEventListener(
        "change",
        function () {

            paginaActualAlertas = 0;

            cargarAlertas();
        }
    );

    filtroLecturaAlerta?.addEventListener(
        "change",
        function () {

            paginaActualAlertas = 0;

            cargarAlertas();
        }
    );

    botonLimpiarFiltrosAlertas?.addEventListener(
        "click",
        limpiarFiltrosAlertas
    );

    botonMarcarTodasLeidas?.addEventListener(
        "click",
        marcarTodasAlertasComoLeidas
    );
}


/* ============================================================
   SESIÓN
============================================================ */

function obtenerDatosSesionAlertas() {

    try {

        if (
            typeof CONFIG === "undefined" ||
            typeof CONFIG.getData !== "function"
        ) {
            return null;
        }

        return CONFIG.getData();

    } catch (error) {

        console.error(
            "Error leyendo sesión:",
            error
        );

        return null;
    }
}


function obtenerTokenAlertas() {

    const datos =
        obtenerDatosSesionAlertas();

    const token =
        datos?.accessToken;

    if (
        !token ||
        typeof token !== "string" ||
        token.trim() === ""
    ) {
        return null;
    }

    return token.trim();
}


function obtenerHeadersAlertas() {

    const token =
        obtenerTokenAlertas();

    if (!token) {

        throw new Error(
            "No se encontró el token de acceso"
        );
    }

    return {
        Accept: "application/json",
        Authorization: `Bearer ${token}`
    };
}


/* ============================================================
   CARGAR ALERTAS
============================================================ */

async function cargarAlertas() {

    if (cargandoAlertas) {
        return;
    }

    cargandoAlertas = true;

    mostrarCargandoAlertas();

    try {

        const parametros =
            construirParametrosAlertas();

        const query =
            parametros.toString();

        const url =
            query
                ? `${ENDPOINTS_ALERTAS.listar}?${query}`
                : ENDPOINTS_ALERTAS.listar;

        console.log(
            "Consultando alertas:",
            url
        );

        const response =
            await fetch(
                url,
                {
                    method: "GET",
                    headers:
                        obtenerHeadersAlertas()
                }
            );

        if (
            response.status === 401 ||
            response.status === 403
        ) {

            throw new Error(
                "No tienes autorización para consultar las alertas"
            );
        }

        if (!response.ok) {

            throw new Error(
                await leerErrorAlertas(
                    response,
                    "No se pudieron cargar las alertas"
                )
            );
        }

        const respuesta =
            await response.json();

        procesarRespuestaAlertas(
            respuesta
        );

        renderizarAlertas();

        renderizarPaginacionAlertas();

        actualizarCantidadRegistrosAlertas();

        actualizarResumenAlertas();

    } catch (error) {

        console.error(
            "Error cargando alertas:",
            error
        );

        alertasPagina = [];
        totalPaginasAlertas = 0;
        totalElementosAlertas = 0;

        renderizarAlertas();

        renderizarPaginacionAlertas();

        actualizarCantidadRegistrosAlertas();

        actualizarResumenAlertas();

        const mensaje =
            error instanceof TypeError &&
                error.message === "Failed to fetch"
                ? "No se pudo conectar con el servidor"
                : error.message;

        mostrarToastAlertas(
            mensaje,
            "danger"
        );

    } finally {

        cargandoAlertas = false;
    }
}


/* ============================================================
   PARÁMETROS

   No se envía idAlmacen.
   Por eso se muestran alertas de todos los almacenes.
============================================================ */

function construirParametrosAlertas() {

    const parametros =
        new URLSearchParams();

    parametros.set(
        "page",
        String(
            paginaActualAlertas
        )
    );

    parametros.set(
        "size",
        String(
            tamanioPaginaAlertas
        )
    );

    const buscar =
        buscarAlerta
            ?.value
            ?.trim();

    const tipo =
        filtroTipoAlerta
            ?.value
            ?.trim();

    const estado =
        filtroEstadoAlerta
            ?.value
            ?.trim();

    const leida =
        filtroLecturaAlerta
            ?.value
            ?.trim();

    if (buscar) {

        parametros.set(
            "buscar",
            buscar
        );
    }

    if (tipo) {

        parametros.set(
            "tipo",
            tipo
        );
    }

    if (estado) {

        parametros.set(
            "estado",
            estado
        );
    }

    if (
        leida === "true" ||
        leida === "false"
    ) {

        parametros.set(
            "leida",
            leida
        );
    }

    return parametros;
}


/* ============================================================
   RESPUESTA PAGINADA
============================================================ */

function procesarRespuestaAlertas(
    respuesta
) {

    if (
        Array.isArray(
            respuesta
        )
    ) {

        alertasPagina =
            respuesta;

        paginaActualAlertas = 0;

        totalElementosAlertas =
            respuesta.length;

        totalPaginasAlertas =
            respuesta.length > 0
                ? 1
                : 0;

        return;
    }

    alertasPagina =
        Array.isArray(
            respuesta?.content
        )
            ? respuesta.content
            : [];

    paginaActualAlertas =
        convertirNumeroAlertas(
            respuesta?.number
        ) ?? 0;

    totalPaginasAlertas =
        convertirNumeroAlertas(
            respuesta?.totalPages
        ) ?? 0;

    totalElementosAlertas =
        convertirNumeroAlertas(
            respuesta?.totalElements
        ) ?? alertasPagina.length;

    tamanioPaginaAlertas =
        convertirNumeroAlertas(
            respuesta?.size
        ) ?? tamanioPaginaAlertas;
}


/* ============================================================
   CARGANDO
============================================================ */

function mostrarCargandoAlertas() {

    if (!listaAlertas) {
        return;
    }

    listaAlertas.innerHTML = `
        <div class="text-center py-5">

            <span
                class="spinner-border spinner-border-sm text-primary me-2"
                role="status"
            ></span>

            Cargando alertas...

        </div>
    `;

    document
        .getElementById(
            "sinAlertas"
        )
        ?.classList
        .add(
            "d-none"
        );
}


/* ============================================================
   RENDERIZAR ALERTAS
============================================================ */

function renderizarAlertas() {

    if (!listaAlertas) {
        return;
    }

    listaAlertas.innerHTML = "";

    const sinAlertas =
        document.getElementById(
            "sinAlertas"
        );

    const contenedorPaginacion =
        document.getElementById(
            "contenedorPaginacionAlertas"
        );

    if (
        alertasPagina.length === 0
    ) {

        sinAlertas?.classList.remove(
            "d-none"
        );

        contenedorPaginacion?.classList.add(
            "d-none"
        );

        return;
    }

    sinAlertas?.classList.add(
        "d-none"
    );

    contenedorPaginacion?.classList.remove(
        "d-none"
    );

    alertasPagina.forEach(
        function (alerta) {

            const elemento =
                crearElementoAlerta(
                    alerta
                );

            listaAlertas.appendChild(
                elemento
            );
        }
    );
}


function crearElementoAlerta(
    alerta
) {

    const contenedor =
        document.createElement(
            "article"
        );

    const noLeida =
        alerta.leida === false;

    const activa =
        String(
            alerta.estado ?? ""
        ).toUpperCase() === "ACTIVA";

    contenedor.className =
        `alerta-item ${noLeida
            ? "alerta-no-leida"
            : ""
        } ${activa
            ? ""
            : "alerta-resuelta"
        }`;

    const configuracion =
        obtenerConfiguracionTipoAlerta(
            alerta.tipo
        );

    contenedor.innerHTML = `
        <div class="alerta-icono ${configuracion.claseIcono}">

            <i class="bi ${configuracion.icono}"></i>

        </div>

        <div class="alerta-contenido">

            <div class="alerta-cabecera">

                <div>

                    <div class="d-flex flex-wrap align-items-center gap-2">

                        <h6 class="fw-bold mb-0">

                            ${escaparHtmlAlertas(
        alerta.titulo ??
        configuracion.titulo
    )}

                        </h6>

                        ${noLeida
            ? `
                                    <span class="badge text-bg-primary">
                                        Nueva
                                    </span>
                                `
            : ""
        }

                        ${crearBadgeEstadoAlerta(
            alerta.estado
        )}

                    </div>

                    <div class="alerta-producto mt-1">

                        ${escaparHtmlAlertas(
            alerta.producto ??
            "Producto sin nombre"
        )}

                        <span>

                            -

                            ${escaparHtmlAlertas(
            alerta.variante ??
            "Sin variante"
        )}

                        </span>

                    </div>

                </div>

                <small class="text-muted">

                    ${formatearFechaAlertas(
            alerta.fechaCreacion
        )}

                </small>

            </div>

            <p class="alerta-mensaje">

                ${escaparHtmlAlertas(
            alerta.mensaje ??
            ""
        )}

            </p>

            <div class="alerta-datos">

                <span>

                    <i class="bi bi-buildings"></i>

                    ${escaparHtmlAlertas(
            alerta.almacen ??
            "-"
        )}

                </span>

                <span>

                    <i class="bi bi-upc-scan"></i>

                    ${escaparHtmlAlertas(
            alerta.sku ??
            "-"
        )}

                </span>

                <span>

                    <i class="bi bi-boxes"></i>

                    Stock:

                    <strong>
                        ${escaparHtmlAlertas(
            alerta.stockActual ?? 0
        )}
                    </strong>

                </span>

                <span>

                    Mínimo:

                    <strong>
                        ${escaparHtmlAlertas(
            alerta.stockMinimo ?? 0
        )}
                    </strong>

                </span>

                <span>

                    Reorden:

                    <strong>
                        ${escaparHtmlAlertas(
            alerta.puntoReorden ?? 0
        )}
                    </strong>

                </span>

            </div>

        </div>

        <div class="alerta-acciones">

            ${noLeida
            ? `
                        <button
                            type="button"
                            class="btn btn-sm btn-outline-primary btn-marcar-leida"
                            title="Marcar como leída"
                        >
                            <i class="bi bi-check2"></i>
                        </button>
                    `
            : ""
        }

            <button
                type="button"
                class="btn btn-sm btn-outline-danger btn-eliminar-alerta"
                title="Eliminar alerta"
            >
                <i class="bi bi-trash"></i>
            </button>

        </div>
    `;

    contenedor
        .querySelector(
            ".btn-marcar-leida"
        )
        ?.addEventListener(
            "click",
            function () {

                marcarAlertaComoLeida(
                    alerta.idAlerta
                );
            }
        );

    contenedor
        .querySelector(
            ".btn-eliminar-alerta"
        )
        ?.addEventListener(
            "click",
            function () {

                eliminarAlerta(
                    alerta.idAlerta
                );
            }
        );

    return contenedor;
}


/* ============================================================
   CONFIGURACIÓN DE TIPOS
============================================================ */

function obtenerConfiguracionTipoAlerta(
    tipo
) {

    switch (
    String(
        tipo ?? ""
    ).toUpperCase()
    ) {

        case "SIN_STOCK":

            return {
                icono:
                    "bi-x-octagon-fill",

                claseIcono:
                    "alerta-icono-sin-stock",

                titulo:
                    "Sin stock"
            };

        case "STOCK_CRITICO":

            return {
                icono:
                    "bi-exclamation-triangle-fill",

                claseIcono:
                    "alerta-icono-critico",

                titulo:
                    "Stock crítico"
            };

        case "PUNTO_REORDEN":

            return {
                icono:
                    "bi-arrow-repeat",

                claseIcono:
                    "alerta-icono-reorden",

                titulo:
                    "Punto de reorden"
            };

        default:

            return {
                icono:
                    "bi-bell-fill",

                claseIcono:
                    "alerta-icono-general",

                titulo:
                    "Alerta"
            };
    }
}


function crearBadgeEstadoAlerta(
    estado
) {

    const valor =
        String(
            estado ?? ""
        ).toUpperCase();

    if (
        valor === "ACTIVA"
    ) {

        return `
            <span class="badge text-bg-danger">
                Activa
            </span>
        `;
    }

    if (
        valor === "RESUELTA"
    ) {

        return `
            <span class="badge text-bg-success">
                Resuelta
            </span>
        `;
    }

    return `
        <span class="badge text-bg-secondary">

            ${escaparHtmlAlertas(
        formatearTextoAlertas(
            valor
        )
    )}

        </span>
    `;
}


/* ============================================================
   MARCAR UNA ALERTA COMO LEÍDA

   No se envía idAlmacen.
============================================================ */

async function marcarAlertaComoLeida(
    idAlerta
) {

    if (
        !idAlerta ||
        Number(idAlerta) <= 0
    ) {

        mostrarToastAlertas(
            "El identificador de la alerta no es válido",
            "warning"
        );

        return;
    }

    try {

        const url =
            `${ENDPOINTS_ALERTAS.listar}/${idAlerta}/leer`;

        const response =
            await fetch(
                url,
                {
                    method: "PATCH",
                    headers:
                        obtenerHeadersAlertas()
                }
            );

        if (
            response.status === 401 ||
            response.status === 403
        ) {

            throw new Error(
                "No tienes autorización para actualizar la alerta"
            );
        }

        if (!response.ok) {

            throw new Error(
                await leerErrorAlertas(
                    response,
                    "No se pudo marcar la alerta como leída"
                )
            );
        }

        mostrarToastAlertas(
            "Alerta marcada como leída",
            "success"
        );

        await cargarAlertas();

        await cargarContadorAlertas();

    } catch (error) {

        const mensaje =
            error instanceof TypeError &&
                error.message === "Failed to fetch"
                ? "No se pudo conectar con el servidor"
                : error.message;

        mostrarToastAlertas(
            mensaje,
            "danger"
        );
    }
}


/* ============================================================
   MARCAR TODAS COMO LEÍDAS

   No se envía idAlmacen.
   Marca las alertas de todos los almacenes.
============================================================ */

async function marcarTodasAlertasComoLeidas() {

    try {

        const response =
            await fetch(
                ENDPOINTS_ALERTAS.marcarTodas,
                {
                    method: "PATCH",
                    headers:
                        obtenerHeadersAlertas()
                }
            );

        if (
            response.status === 401 ||
            response.status === 403
        ) {

            throw new Error(
                "No tienes autorización para actualizar las alertas"
            );
        }

        if (!response.ok) {

            throw new Error(
                await leerErrorAlertas(
                    response,
                    "No se pudieron marcar las alertas"
                )
            );
        }

        const resultado =
            await response.json();

        mostrarToastAlertas(
            `${resultado.cantidad ?? 0} alertas marcadas como leídas`,
            "success"
        );

        await cargarAlertas();

        await cargarContadorAlertas();

    } catch (error) {

        const mensaje =
            error instanceof TypeError &&
                error.message === "Failed to fetch"
                ? "No se pudo conectar con el servidor"
                : error.message;

        mostrarToastAlertas(
            mensaje,
            "danger"
        );
    }
}


/* ============================================================
   ELIMINAR ALERTA

   No se envía idAlmacen.
============================================================ */

async function eliminarAlerta(
    idAlerta
) {

    if (
        !idAlerta ||
        Number(idAlerta) <= 0
    ) {

        mostrarToastAlertas(
            "El identificador de la alerta no es válido",
            "warning"
        );

        return;
    }

    const confirmar =
        confirm(
            "¿Deseas eliminar esta alerta?"
        );

    if (!confirmar) {
        return;
    }

    try {

        const url =
            `${ENDPOINTS_ALERTAS.listar}/${idAlerta}`;

        const response =
            await fetch(
                url,
                {
                    method: "DELETE",
                    headers:
                        obtenerHeadersAlertas()
                }
            );

        if (
            response.status === 401 ||
            response.status === 403
        ) {

            throw new Error(
                "No tienes autorización para eliminar la alerta"
            );
        }

        if (!response.ok) {

            throw new Error(
                await leerErrorAlertas(
                    response,
                    "No se pudo eliminar la alerta"
                )
            );
        }

        mostrarToastAlertas(
            "Alerta eliminada correctamente",
            "success"
        );

        if (
            alertasPagina.length === 1 &&
            paginaActualAlertas > 0
        ) {
            paginaActualAlertas--;
        }

        await cargarAlertas();

        await cargarContadorAlertas();

    } catch (error) {

        const mensaje =
            error instanceof TypeError &&
                error.message === "Failed to fetch"
                ? "No se pudo conectar con el servidor"
                : error.message;

        mostrarToastAlertas(
            mensaje,
            "danger"
        );
    }
}


/* ============================================================
   CONTADOR DE ALERTAS NO LEÍDAS

   Cuenta las alertas de todos los almacenes.
============================================================ */

async function cargarContadorAlertas() {

    try {

        const response =
            await fetch(
                ENDPOINTS_ALERTAS.contarNoLeidas,
                {
                    method: "GET",
                    headers:
                        obtenerHeadersAlertas()
                }
            );

        if (!response.ok) {

            console.error(
                "No se pudo consultar el contador de alertas"
            );

            return;
        }

        const resultado =
            await response.json();

        const cantidad =
            convertirNumeroAlertas(
                resultado?.cantidad
            ) ?? 0;

        const contador =
            document.getElementById(
                "contadorAlertasSidebar"
            );

        if (contador) {

            contador.textContent =
                cantidad;

            contador.classList.toggle(
                "d-none",
                cantidad === 0
            );
        }

    } catch (error) {

        console.error(
            "No se pudo cargar el contador:",
            error
        );
    }
}


/* ============================================================
   RESUMEN

   Los tipos se calculan sobre la página actual.
   El total general viene de totalElements.
============================================================ */

async function actualizarResumenAlertas() {
    try {

        const url = `${CONFIG.API_URL}/alertas/dashboard`

        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Accept": "application/json",
                "Authorization": `Bearer ${CONFIG.getData().accessToken}`
            }
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("Error resumen alertas:", data);
            return;
        }

        console.log("RESUMEN ALERTAS:", data);

        document.getElementById("totalAlertas").textContent = data.totalAlertas;
        document.getElementById("totalSinStock").textContent = data.sinStock;
        document.getElementById("totalStockCritico").textContent = data.stockCritico;
        document.getElementById("totalPuntoReorden").textContent = data.puntoReorden;

    } catch (error) {
        console.error("Error al obtener kardex:", error);
    }

}


/* ============================================================
   CANTIDAD DE REGISTROS
============================================================ */

function actualizarCantidadRegistrosAlertas() {

    const elemento =
        document.getElementById(
            "cantidadRegistrosAlertas"
        );

    if (!elemento) {
        return;
    }

    elemento.textContent =
        `${totalElementosAlertas} ${totalElementosAlertas === 1
            ? "registro"
            : "registros"
        }`;
}


/* ============================================================
   PAGINACIÓN
============================================================ */

function renderizarPaginacionAlertas() {

    const paginacion =
        document.getElementById(
            "paginacionAlertas"
        );

    const texto =
        document.getElementById(
            "textoPaginacionAlertas"
        );

    if (!paginacion) {
        return;
    }

    paginacion.innerHTML = "";

    if (
        totalPaginasAlertas <= 0
    ) {

        if (texto) {

            texto.textContent =
                "Sin resultados";
        }

        return;
    }

    if (texto) {

        texto.textContent =
            `Página ${paginaActualAlertas + 1} de ${totalPaginasAlertas}`;
    }

    paginacion.appendChild(
        crearBotonPaginaAlertas(
            "Anterior",
            paginaActualAlertas - 1,
            paginaActualAlertas === 0
        )
    );

    const inicio =
        Math.max(
            0,
            paginaActualAlertas - 2
        );

    const fin =
        Math.min(
            totalPaginasAlertas - 1,
            paginaActualAlertas + 2
        );

    for (
        let pagina = inicio;
        pagina <= fin;
        pagina++
    ) {

        paginacion.appendChild(
            crearBotonPaginaAlertas(
                String(
                    pagina + 1
                ),
                pagina,
                false,
                pagina === paginaActualAlertas
            )
        );
    }

    paginacion.appendChild(
        crearBotonPaginaAlertas(
            "Siguiente",
            paginaActualAlertas + 1,
            paginaActualAlertas >=
            totalPaginasAlertas - 1
        )
    );
}


function crearBotonPaginaAlertas(
    texto,
    pagina,
    deshabilitado,
    activo = false
) {

    const item =
        document.createElement(
            "li"
        );

    item.className =
        "page-item";

    if (deshabilitado) {

        item.classList.add(
            "disabled"
        );
    }

    if (activo) {

        item.classList.add(
            "active"
        );
    }

    const boton =
        document.createElement(
            "button"
        );

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
                pagina === paginaActualAlertas
            ) {
                return;
            }

            paginaActualAlertas =
                pagina;

            cargarAlertas();
        }
    );

    item.appendChild(
        boton
    );

    return item;
}


/* ============================================================
   LIMPIAR FILTROS
============================================================ */

function limpiarFiltrosAlertas() {

    if (buscarAlerta) {

        buscarAlerta.value = "";
    }

    if (filtroTipoAlerta) {

        filtroTipoAlerta.value = "";
    }

    if (filtroEstadoAlerta) {

        filtroEstadoAlerta.value = "";
    }

    if (filtroLecturaAlerta) {

        filtroLecturaAlerta.value = "";
    }

    paginaActualAlertas = 0;

    cargarAlertas();
}


/* ============================================================
   UTILIDADES
============================================================ */

function asignarTextoAlertas(
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
                valor ?? 0
            );
    }
}


function convertirNumeroAlertas(
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
        Number(
            valor
        );

    return Number.isFinite(
        numero
    )
        ? numero
        : null;
}


function formatearFechaAlertas(
    valor
) {

    if (!valor) {
        return "-";
    }

    const fecha =
        new Date(
            valor
        );

    if (
        Number.isNaN(
            fecha.getTime()
        )
    ) {

        return String(
            valor
        );
    }

    return new Intl.DateTimeFormat(
        "es-PE",
        {
            day:
                "2-digit",

            month:
                "2-digit",

            year:
                "numeric",

            hour:
                "2-digit",

            minute:
                "2-digit"
        }
    ).format(
        fecha
    );
}


function formatearTextoAlertas(
    valor
) {

    if (!valor) {
        return "-";
    }

    return String(
        valor
    )
        .trim()
        .toLowerCase()
        .replaceAll(
            "_",
            " "
        )
        .replace(
            /\b\w/g,
            function (letra) {

                return letra.toUpperCase();
            }
        );
}


function escaparHtmlAlertas(
    valor
) {

    return String(
        valor ?? ""
    )
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );
}


/* ============================================================
   LEER ERRORES HTTP
============================================================ */

async function leerErrorAlertas(
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
   TOAST
============================================================ */

function mostrarToastAlertas(
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

        alert(
            mensaje
        );

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

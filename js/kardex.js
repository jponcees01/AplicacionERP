/* ============================================================
   CONFIGURACIÓN
============================================================ */

const API_URL_KARDEX = CONFIG.API_URL;

const ENDPOINTS_KARDEX = {
    listar: `${API_URL_KARDEX}/kardex`
};


/* ============================================================
   ESTADO GLOBAL
============================================================ */

let movimientosKardex = [];

let paginaActualKardex = 0;
let tamanioPaginaKardex = 5;
let totalPaginasKardex = 0;
let totalElementosKardex = 0;

let temporizadorBusquedaKardex = null;
let cargandoKardex = false;


/* ============================================================
   ELEMENTOS DEL HTML
============================================================ */

const tablaKardex =
    document.getElementById(
        "tablaKardex"
    );

const buscarKardex =
    document.getElementById(
        "buscarKardex"
    );

const filtroTipoMovimiento =
    document.getElementById(
        "filtroTipoMovimiento"
    );

const filtroMotivo =
    document.getElementById(
        "filtroMotivo"
    );

const filtroAlmacen =
    document.getElementById(
        "filtroAlmacen"
    );

const fechaInicioKardex =
    document.getElementById(
        "fechaInicio"
    );

const fechaFinKardex =
    document.getElementById(
        "fechaFin"
    );

const botonLimpiarFiltrosKardex =
    document.getElementById(
        "btnLimpiarFiltros"
    );

const botonExportarKardex =
    document.getElementById(
        "btnExportarKardex"
    );


/* ============================================================
   INICIALIZACIÓN
============================================================ */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        cargarAlmacenes();

        configurarEventosKardex();

        const datosSesion =
            obtenerDatosSesionKardex();

        if (
            !datosSesion ||
            !datosSesion.accessToken
        ) {

            console.error(
                "No se encontró el token de acceso"
            );

            mostrarToastKardex(
                "No se encontró una sesión válida",
                "danger"
            );

            return;
        }

        cargarKardex();
    }
);


async function cargarAlmacenes() {

    filtroAlmacen?.addEventListener(
        "change",
        function () {

            paginaActualKardex = 0;

            cargarKardex();
        }
    );

    try {

        const response =
            await fetch(
                `${CONFIG.API_URL}/inventario/combo?tipo=ALMACEN`,
                {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${CONFIG.getData().accessToken}`
                    }
                }
            );

        const data = await response.json();

        // limpiar combo
        filtroAlmacen.innerHTML = "";

        const datosSesion =
            CONFIG.getData();

        const rol =
            (datosSesion?.rol || "").toUpperCase();

        const idAlmacenUsuario =
            datosSesion?.idAlmacen;

        // =========================
        // ADMIN: ve todos
        // =========================
        if (rol === "ADMIN") {

            filtroAlmacen.disabled = false;

            filtroAlmacen.innerHTML += `
                <option value="">
                    Todos
                </option>
            `;
        }

        // llenar desde backend
        data.forEach(item => {

            const option =
                document.createElement("option");

            option.value = item.id;
            option.textContent = item.texto;

            filtroAlmacen.appendChild(option);
        });

        // =========================
        // USER: bloquear y seleccionar su almacén
        // =========================
        if (rol !== "ADMIN") {

            filtroAlmacen.disabled = true;

            filtroAlmacen.value = idAlmacenUsuario;
        }

    } catch (error) {
        console.error("Error cargando almacenes:", error);
    }
}

/* ============================================================
   EVENTOS
============================================================ */

function configurarEventosKardex() {

    buscarKardex?.addEventListener(
        "input",
        function () {

            clearTimeout(
                temporizadorBusquedaKardex
            );

            temporizadorBusquedaKardex =
                setTimeout(
                    function () {

                        paginaActualKardex = 0;

                        cargarKardex();
                    },
                    400
                );
        }
    );



    filtroTipoMovimiento?.addEventListener(
        "change",
        function () {

            paginaActualKardex = 0;

            cargarKardex();
        }
    );

    filtroMotivo?.addEventListener(
        "change",
        function () {

            paginaActualKardex = 0;

            cargarKardex();
        }
    );

    fechaInicioKardex?.addEventListener(
        "change",
        function () {

            if (
                !validarRangoFechasKardex()
            ) {
                return;
            }

            paginaActualKardex = 0;

            cargarKardex();
        }
    );

    fechaFinKardex?.addEventListener(
        "change",
        function () {

            if (
                !validarRangoFechasKardex()
            ) {
                return;
            }

            paginaActualKardex = 0;

            cargarKardex();
        }
    );

    botonLimpiarFiltrosKardex?.addEventListener(
        "click",
        limpiarFiltrosKardex
    );

    botonExportarKardex?.addEventListener(
        "click",
        exportarKardexCsv
    );
}

function configurarFiltroAlmacenPorRol() {

    const datos =
        obtenerDatosSesionKardex();

    if (!filtroAlmacen) return;

    const rol =
        (datos?.rol || "").toUpperCase();

    const idAlmacen =
        datos?.idAlmacen;

    const nombreAlmacen =
        datos?.almacen || "MI ALMACÉN";

    // ================= ADMIN =================
    if (rol === "ADMIN") {

        filtroAlmacen.disabled = false;

        filtroAlmacen.innerHTML = `
            <option value="">TODOS LOS ALMACENES</option>
        `;

        return;
    }

    // ================= USUARIO =================
    filtroAlmacen.disabled = true;

    filtroAlmacen.innerHTML = `
        <option value="${idAlmacen}">
            ${nombreAlmacen}
        </option>
    `;

    filtroAlmacen.value = idAlmacen;
}


/* ============================================================
   DATOS DE SESIÓN
============================================================ */

function obtenerDatosSesionKardex() {

    try {

        if (
            typeof CONFIG === "undefined" ||
            typeof CONFIG.getData !== "function"
        ) {

            console.error(
                "CONFIG no está disponible"
            );

            return null;
        }

        return CONFIG.getData();

    } catch (error) {

        console.error(
            "No se pudieron leer los datos de sesión:",
            error
        );

        return null;
    }
}


function obtenerTokenKardex() {

    const datos =
        obtenerDatosSesionKardex();

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


function obtenerIdAlmacenSesionKardex() {

    const datos =
        obtenerDatosSesionKardex();

    return convertirNumeroKardex(
        datos?.idAlmacen
    );
}


/* ============================================================
   HEADERS HTTP
============================================================ */

function obtenerHeadersKardex() {

    const token =
        obtenerTokenKardex();

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
   CARGAR KARDEX
============================================================ */

async function cargarKardex() {

    if (cargandoKardex) {
        return;
    }

    if (
        !validarRangoFechasKardex()
    ) {
        return;
    }

    cargandoKardex = true;

    mostrarCargandoKardex();

    try {

        const parametros =
            construirParametrosKardex();

        const url =
            `${ENDPOINTS_KARDEX.listar}?${parametros.toString()}`;

        console.log(
            "Consultando kardex:",
            url
        );

        const response =
            await fetch(
                url,
                {
                    method: "GET",
                    headers:
                        obtenerHeadersKardex()
                }
            );

        if (
            response.status === 401 ||
            response.status === 403
        ) {

            throw new Error(
                "La sesión no tiene autorización para consultar el kardex"
            );
        }

        if (!response.ok) {

            throw new Error(
                await leerErrorKardex(
                    response,
                    "No se pudo cargar el kardex"
                )
            );
        }

        const respuesta =
            await response.json();

        procesarRespuestaKardex(
            respuesta
        );

        renderizarKardex();

        renderizarPaginacionKardex();

        actualizarResumenKardex(filtroAlmacen?.value);

        actualizarCantidadRegistrosKardex();

    } catch (error) {

        console.error(
            "Error cargando kardex:",
            error
        );

        movimientosKardex = [];
        totalPaginasKardex = 0;
        totalElementosKardex = 0;

        renderizarKardex();

        renderizarPaginacionKardex();

        actualizarResumenKardex();

        actualizarCantidadRegistrosKardex();

        const mensaje =
            error instanceof TypeError &&
                error.message === "Failed to fetch"
                ? "No se pudo conectar con el servidor"
                : error.message;

        mostrarToastKardex(
            mensaje,
            "danger"
        );

    } finally {

        cargandoKardex = false;
    }
}


/* ============================================================
   CONSTRUIR PARÁMETROS
============================================================ */

function construirParametrosKardex() {

    const parametros = new URLSearchParams();

    parametros.set("page", String(paginaActualKardex));
    parametros.set("size", String(tamanioPaginaKardex));

    const buscar = buscarKardex?.value?.trim();
    const naturaleza = filtroTipoMovimiento?.value?.trim();
    const tipoDocumento = filtroMotivo?.value?.trim();
    const fechaInicio = fechaInicioKardex?.value;
    const fechaFin = fechaFinKardex?.value;

    const datos = CONFIG.getData();
    const rol = (datos?.rol || "").toUpperCase();

    const idAlmacenCombo = filtroAlmacen?.value;

    // 🔥 SOLO UNA FUENTE DE VERDAD
    if (rol === "ADMIN") {

        if (idAlmacenCombo) {
            parametros.set("idAlmacen", Number(idAlmacenCombo));
        }

    } else {

        parametros.set("idAlmacen", datos?.idAlmacen);
    }

    if (buscar) parametros.set("buscar", buscar);
    if (naturaleza) parametros.set("naturaleza", naturaleza);
    if (tipoDocumento) parametros.set("tipoDocumento", tipoDocumento);
    if (fechaInicio) parametros.set("fechaInicio", fechaInicio);
    if (fechaFin) parametros.set("fechaFin", fechaFin);

    return parametros;
}


/* ============================================================
   PROCESAR RESPUESTA PAGINADA
============================================================ */

function procesarRespuestaKardex(
    respuesta
) {

    if (
        Array.isArray(
            respuesta
        )
    ) {

        movimientosKardex =
            respuesta;

        paginaActualKardex =
            0;

        totalElementosKardex =
            respuesta.length;

        totalPaginasKardex =
            respuesta.length > 0
                ? 1
                : 0;

        return;
    }

    movimientosKardex =
        Array.isArray(
            respuesta?.content
        )
            ? respuesta.content
            : [];

    paginaActualKardex =
        convertirNumeroKardex(
            respuesta?.number
        ) ?? 0;

    totalPaginasKardex =
        convertirNumeroKardex(
            respuesta?.totalPages
        ) ?? 0;

    totalElementosKardex =
        convertirNumeroKardex(
            respuesta?.totalElements
        ) ??
        movimientosKardex.length;

    tamanioPaginaKardex =
        convertirNumeroKardex(
            respuesta?.size
        ) ??
        tamanioPaginaKardex;
}


/* ============================================================
   MOSTRAR CARGANDO
============================================================ */

function mostrarCargandoKardex() {

    if (!tablaKardex) {
        return;
    }

    tablaKardex.innerHTML = `
        <tr>

            <td
                colspan="9"
                class="text-center py-5"
            >

                <span
                    class="spinner-border spinner-border-sm text-primary me-2"
                    role="status"
                ></span>

                Cargando movimientos...

            </td>

        </tr>
    `;

    const sinMovimientos =
        document.getElementById(
            "sinMovimientos"
        );

    sinMovimientos?.classList.add(
        "d-none"
    );
}


/* ============================================================
   RENDERIZAR KARDEX
============================================================ */

function renderizarKardex() {

    if (!tablaKardex) {
        return;
    }

    tablaKardex.innerHTML = "";

    const sinMovimientos =
        document.getElementById(
            "sinMovimientos"
        );

    const contenedorPaginacion =
        document.getElementById(
            "contenedorPaginacionKardex"
        );

    if (
        movimientosKardex.length === 0
    ) {

        sinMovimientos?.classList.remove(
            "d-none"
        );

        contenedorPaginacion?.classList.add(
            "d-none"
        );

        return;
    }

    sinMovimientos?.classList.add(
        "d-none"
    );

    contenedorPaginacion?.classList.remove(
        "d-none"
    );

    movimientosKardex.forEach(
        function (movimiento) {

            const fecha =
                formatearFechaHoraKardex(
                    movimiento.fecha
                );

            const producto =
                movimiento.producto ??
                "Sin producto";

            const variante =
                movimiento.variante ??
                "Sin variante";

            const tipoDocumento =
                movimiento.tipoDocumento ??
                "-";

            const naturaleza =
                obtenerNaturalezaMovimiento(
                    movimiento
                );

            const cantidad =
                convertirNumeroKardex(
                    movimiento.cantidad
                ) ?? 0;

            const costoUnitario =
                convertirNumeroKardex(
                    movimiento.costoUnitario
                ) ?? 0;

            const costoTotal =
                convertirNumeroKardex(
                    movimiento.costoTotal
                ) ?? 0;

            const stockAnterior =
                convertirNumeroKardex(
                    movimiento.stockAnterior
                ) ?? 0;

            const stockNuevo =
                convertirNumeroKardex(
                    movimiento.stockNuevo
                ) ?? 0;

            const fila =
                document.createElement(
                    "tr"
                );

            fila.innerHTML = `
                <td>
                    ${escaparHtmlKardex(
                fecha
            )}
                </td>

                <td>

                    <div class="fw-semibold">

                        ${escaparHtmlKardex(
                producto
            )}

                    </div>

                    <small class="text-muted">

                        Unidad:
                        ${escaparHtmlKardex(
                movimiento.idProductoUnidad ??
                "-"
            )}

                    </small>

                </td>

                <td>
                    ${escaparHtmlKardex(
                variante
            )}
                </td>

                <td>
                    ${crearBadgeMovimiento(
                naturaleza
            )}
                </td>

                <td>
                    ${escaparHtmlKardex(
                formatearTextoKardex(
                    tipoDocumento
                )
            )}
                </td>

                <td class="text-center">

                    <span class="${naturaleza === "ENTRADA"
                    ? "cantidad-entrada"
                    : naturaleza === "SALIDA"
                        ? "cantidad-salida"
                        : ""
                }">

                        ${naturaleza === "ENTRADA"
                    ? "+"
                    : naturaleza === "SALIDA"
                        ? "-"
                        : ""
                }${cantidad}

                    </span>

                </td>

                <td class="text-end">

                    ${formatearMonedaKardex(
                    costoUnitario
                )}

                </td>

                <td class="text-end">

                    ${formatearMonedaKardex(
                    costoTotal
                )}

                </td>

                <td class="text-center">

                    <span class="stock-anterior">
                        ${stockAnterior}
                    </span>

                </td>

                <td class="text-center">

                    <span class="stock-resultante">
                        ${stockNuevo}
                    </span>

                </td>
            `;

            tablaKardex.appendChild(
                fila
            );
        }
    );
}


/* ============================================================
   NATURALEZA DEL MOVIMIENTO
============================================================ */

function obtenerNaturalezaMovimiento(
    movimiento
) {

    if (
        movimiento.naturalezaMovimiento
    ) {

        return String(
            movimiento.naturalezaMovimiento
        )
            .trim()
            .toUpperCase();
    }

    const tipo =
        String(
            movimiento.tipoMovimiento ??
            ""
        )
            .trim()
            .toUpperCase();

    const entradas = [
        "INGRESO",
        "AJUSTE_POSITIVO",
        "TRANSFERENCIA_INGRESO"
    ];

    const salidas = [
        "SALIDA",
        "AJUSTE_NEGATIVO",
        "TRANSFERENCIA_SALIDA"
    ];

    if (
        entradas.includes(
            tipo
        )
    ) {
        return "ENTRADA";
    }

    if (
        salidas.includes(
            tipo
        )
    ) {
        return "SALIDA";
    }

    return "OTRO";
}


/* ============================================================
   BADGE DEL MOVIMIENTO
============================================================ */

function crearBadgeMovimiento(
    naturaleza
) {

    const valor =
        String(
            naturaleza ??
            "OTRO"
        )
            .trim()
            .toUpperCase();

    if (
        valor === "ENTRADA"
    ) {

        return `
            <span class="badge-movimiento badge-entrada">

                <i class="bi bi-arrow-down-circle"></i>

                Entrada

            </span>
        `;
    }

    if (
        valor === "SALIDA"
    ) {

        return `
            <span class="badge-movimiento badge-salida">

                <i class="bi bi-arrow-up-circle"></i>

                Salida

            </span>
        `;
    }

    return `
        <span class="badge text-bg-secondary">

            ${escaparHtmlKardex(
        formatearTextoKardex(
            valor
        )
    )}

        </span>
    `;
}


/* ============================================================
   RESUMEN
============================================================ */

async function actualizarResumenKardex(id) {

    try {

        const selectAlmacen =
            document.getElementById("idAlmacen");

        const idAlmacen =
            selectAlmacen?.value || id;

        const url = idAlmacen
            ? `${CONFIG.API_URL}/movimiento?idAlmacen=${idAlmacen}`
            : `${CONFIG.API_URL}/movimiento`;

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

        console.log("RESUMEN KARDEX:", data);

        document.getElementById("totalMovimientos").textContent =
            data.totalMovimientos ?? 0;

        document.getElementById("totalEntradas").textContent =
            data.entradas ?? 0;

        document.getElementById("totalSalidas").textContent =
            data.salidas ?? 0;

        document.getElementById("stockResultante").textContent =
            data.stockResultante ?? 0;

    } catch (error) {
        console.error("Error al obtener kardex:", error);
    }
}


/* ============================================================
   CANTIDAD DE REGISTROS
============================================================ */

function actualizarCantidadRegistrosKardex() {

    const elemento =
        document.getElementById(
            "cantidadRegistrosKardex"
        );

    if (!elemento) {
        return;
    }

    elemento.textContent =
        `${totalElementosKardex} ${totalElementosKardex === 1
            ? "registro"
            : "registros"
        }`;
}


/* ============================================================
   PAGINACIÓN
============================================================ */

function renderizarPaginacionKardex() {

    const paginacion =
        document.getElementById(
            "paginacionKardex"
        );

    const texto =
        document.getElementById(
            "textoPaginacionKardex"
        );

    if (!paginacion) {
        return;
    }

    paginacion.innerHTML = "";

    if (
        totalPaginasKardex <= 0
    ) {

        if (texto) {

            texto.textContent =
                "Sin resultados";
        }

        return;
    }

    if (texto) {

        texto.textContent =
            `Página ${paginaActualKardex + 1} de ${totalPaginasKardex}`;
    }

    paginacion.appendChild(
        crearBotonPaginaKardex(
            "Anterior",
            paginaActualKardex - 1,
            paginaActualKardex === 0
        )
    );

    const paginaInicial =
        Math.max(
            0,
            paginaActualKardex - 2
        );

    const paginaFinal =
        Math.min(
            totalPaginasKardex - 1,
            paginaActualKardex + 2
        );

    for (
        let pagina = paginaInicial;
        pagina <= paginaFinal;
        pagina++
    ) {

        paginacion.appendChild(
            crearBotonPaginaKardex(
                String(
                    pagina + 1
                ),
                pagina,
                false,
                pagina === paginaActualKardex
            )
        );
    }

    paginacion.appendChild(
        crearBotonPaginaKardex(
            "Siguiente",
            paginaActualKardex + 1,
            paginaActualKardex >=
            totalPaginasKardex - 1
        )
    );
}


function crearBotonPaginaKardex(
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
                pagina === paginaActualKardex
            ) {
                return;
            }

            paginaActualKardex =
                pagina;

            cargarKardex();
        }
    );

    item.appendChild(
        boton
    );

    return item;
}


/* ============================================================
   VALIDAR FECHAS
============================================================ */

function validarRangoFechasKardex() {

    const inicio =
        fechaInicioKardex
            ?.value;

    const fin =
        fechaFinKardex
            ?.value;

    if (
        inicio &&
        fin &&
        inicio > fin
    ) {

        mostrarToastKardex(
            "La fecha inicial no puede ser mayor que la fecha final",
            "warning"
        );

        return false;
    }

    return true;
}


/* ============================================================
   LIMPIAR FILTROS
============================================================ */

function limpiarFiltrosKardex() {

    if (buscarKardex) {
        buscarKardex.value = "";
    }

    if (filtroTipoMovimiento) {
        filtroTipoMovimiento.value = "";
    }

    if (filtroMotivo) {
        filtroMotivo.value = "";
    }

    if (filtroAlmacen) {
        filtroAlmacen.value = "";
    }

    if (fechaInicioKardex) {
        fechaInicioKardex.value = "";
    }

    if (fechaFinKardex) {
        fechaFinKardex.value = "";
    }

    paginaActualKardex = 0;

    cargarKardex();
}


/* ============================================================
   EXPORTAR CSV
============================================================ */

function exportarKardexCsv() {

    if (
        movimientosKardex.length === 0
    ) {

        mostrarToastKardex(
            "No hay movimientos para exportar",
            "warning"
        );

        return;
    }

    const encabezados = [
        "Fecha",
        "Producto",
        "Variante",
        "Tipo",
        "Motivo",
        "Cantidad",
        "Costo unitario",
        "Costo total",
        "Stock anterior",
        "Stock resultante"
    ];

    const filas =
        movimientosKardex.map(
            function (movimiento) {

                return [
                    formatearFechaHoraKardex(
                        movimiento.fecha
                    ),

                    movimiento.producto,

                    movimiento.variante,

                    obtenerNaturalezaMovimiento(
                        movimiento
                    ),

                    movimiento.tipoDocumento,

                    movimiento.cantidad,

                    movimiento.costoUnitario,

                    movimiento.costoTotal,

                    movimiento.stockAnterior,

                    movimiento.stockNuevo
                ];
            }
        );

    const contenido =
        [
            encabezados,
            ...filas
        ]
            .map(
                function (fila) {

                    return fila
                        .map(
                            escaparCsvKardex
                        )
                        .join(";");
                }
            )
            .join("\n");

    const blob =
        new Blob(
            [
                "\uFEFF",
                contenido
            ],
            {
                type:
                    "text/csv;charset=utf-8;"
            }
        );

    const url =
        URL.createObjectURL(
            blob
        );

    const enlace =
        document.createElement(
            "a"
        );

    enlace.href =
        url;

    enlace.download =
        `kardex_${obtenerFechaArchivoKardex()}.csv`;

    document.body.appendChild(
        enlace
    );

    enlace.click();

    enlace.remove();

    URL.revokeObjectURL(
        url
    );
}


function escaparCsvKardex(
    valor
) {

    const texto =
        String(
            valor ?? ""
        )
            .replaceAll(
                '"',
                '""'
            );

    return `"${texto}"`;
}


function obtenerFechaArchivoKardex() {

    const fecha =
        new Date();

    const anio =
        fecha.getFullYear();

    const mes =
        String(
            fecha.getMonth() + 1
        ).padStart(
            2,
            "0"
        );

    const dia =
        String(
            fecha.getDate()
        ).padStart(
            2,
            "0"
        );

    return `${anio}${mes}${dia}`;
}


/* ============================================================
   TOAST
============================================================ */

function mostrarToastKardex(
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


/* ============================================================
   LEER ERRORES HTTP
============================================================ */

async function leerErrorKardex(
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

function convertirNumeroKardex(
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


function formatearMonedaKardex(
    valor
) {

    const numero =
        convertirNumeroKardex(
            valor
        ) ?? 0;

    return new Intl.NumberFormat(
        "es-PE",
        {
            style:
                "currency",

            currency:
                "PEN",

            minimumFractionDigits:
                2
        }
    ).format(
        numero
    );
}


function formatearFechaHoraKardex(
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


function formatearTextoKardex(
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


function escaparHtmlKardex(
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
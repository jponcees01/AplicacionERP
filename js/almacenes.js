let almacenesCargados = [];
let paginaActual = 0;
let tamanioPagina = 5;
let temporizadorBusqueda = null;

/* =========================================================
   INICIALIZACIÓN
========================================================= */

document.addEventListener("DOMContentLoaded", function () {
    configurarFiltros();
    configurarTamanioPaginaAlmacenes();
    actualizarResumen();

    listarAlmacenes(
        null,
        "",
        0,
        tamanioPagina
    );
});

/* =========================================================
   LISTAR ALMACENES
========================================================= */

async function listarAlmacenes(
    estado = null,
    texto = "",
    page = 0,
    size = tamanioPagina
) {
    try {
        const dataSesion = CONFIG.getData();
        const token = dataSesion?.accessToken;

        if (!token) {
            mostrarToast(
                "No se encontró la sesión del usuario",
                "danger"
            );

            mostrarMensajeTabla(
                "No se encontró la sesión del usuario"
            );

            limpiarInformacionPaginacion();
            limpiarPaginacion();

            return;
        }

        const parametros =
            new URLSearchParams();

        if (estado !== null) {
            parametros.append(
                "estado",
                estado
            );
        }

        if (
            texto !== null &&
            texto.trim() !== ""
        ) {
            parametros.append(
                "texto",
                texto.trim()
            );
        }

        parametros.append(
            "page",
            page
        );

        parametros.append(
            "size",
            size
        );

        const url =
            `${CONFIG.API_URL}/almacenes?${parametros.toString()}`;

        console.log(
            "URL almacenes:",
            url
        );

        const response = await fetch(
            url,
            {
                method: "GET",
                headers: {
                    "Accept": "application/json",
                    "Authorization": `Bearer ${token}`
                }
            }
        );

        const result =
            await obtenerRespuesta(response);

        console.log(
            "Estado HTTP:",
            response.status
        );

        console.log(
            "Respuesta de almacenes:",
            result
        );

        if (!response.ok) {
            mostrarToast(
                obtenerMensajeError(
                    result,
                    "No se pudieron cargar los almacenes"
                ),
                "danger"
            );

            mostrarMensajeTabla(
                "No se pudieron cargar los almacenes"
            );

            limpiarInformacionPaginacion();
            limpiarPaginacion();

            return;
        }

        const almacenes =
            result?.content || [];

        almacenesCargados =
            Array.isArray(almacenes)
                ? almacenes
                : [];

        paginaActual =
            result?.number ?? page;

        tamanioPagina =
            result?.size ?? size;

        sincronizarSelectorTamanio();

        mostrarAlmacenes(
            almacenesCargados
        );


        mostrarPaginacion(result);

        actualizarInformacionPaginacionAlmacenes(
            result
        );

    } catch (error) {
        console.error(
            "Error al consultar almacenes:",
            error
        );

        mostrarToast(
            "No se pudo conectar con el servidor",
            "danger"
        );

        mostrarMensajeTabla(
            "Error al consultar los almacenes"
        );

        limpiarInformacionPaginacion();
        limpiarPaginacion();
    }
}

/* =========================================================
   MOSTRAR ALMACENES
========================================================= */

function mostrarAlmacenes(almacenes) {
    const tabla =
        document.getElementById(
            "tablaAlmacenes"
        );

    const sinAlmacenes =
        document.getElementById(
            "sinAlmacenes"
        );

    if (!tabla) {
        console.error(
            "No existe el tbody tablaAlmacenes"
        );

        return;
    }

    tabla.innerHTML = "";

    if (
        !Array.isArray(almacenes) ||
        almacenes.length === 0
    ) {
        if (sinAlmacenes) {
            sinAlmacenes.classList.remove(
                "d-none"
            );
        }

        mostrarMensajeTabla(
            "No se encontraron almacenes"
        );

        return;
    }

    if (sinAlmacenes) {
        sinAlmacenes.classList.add(
            "d-none"
        );
    }

    almacenes.forEach(function (almacen) {
        const nombreSeguro =
            escaparTexto(
                almacen.nombre || ""
            );

        const fila =
            document.createElement("tr");

        fila.innerHTML = `
            <td>
                ${almacen.idAlmacen ?? "-"}
            </td>

            <td>
                <div class="d-flex align-items-center gap-2">

                    <div class="icono-almacen">
                        <i class="bi bi-buildings"></i>
                    </div>

                    <strong>
                        ${almacen.nombre || "-"}
                    </strong>

                </div>
            </td>

            <td>
                ${almacen.ciudad || "-"}
            </td>

            <td>
                ${almacen.direccion || "-"}
            </td>

            <td>
                ${almacen.estado
                ? `
                            <span class="badge bg-success">
                                Activo
                            </span>
                        `
                : `
                            <span class="badge bg-danger">
                                Inactivo
                            </span>
                        `
            }
            </td>

            <td>
                ${formatearFecha(
                almacen.fechaCreacion
            )}
            </td>

            <td class="text-center">

                <div
                    class="d-flex justify-content-center gap-2"
                >

                    <button
                        type="button"
                        class="btn btn-sm btn-outline-warning"
                        title="Editar almacén"
                        onclick="editarAlmacen(
                            ${almacen.idAlmacen}
                        )"
                    >
                        <i class="bi bi-pencil"></i>
                    </button>

                    ${almacen.estado
                ? `
                                <button
                                    type="button"
                                    class="btn btn-sm btn-outline-danger"
                                    title="Deshabilitar almacén"
                                    onclick="deshabilitarAlmacen(
                                        ${almacen.idAlmacen},
                                        '${nombreSeguro}'
                                    )"
                                >
                                    <i class="bi bi-building-x"></i>
                                </button>
                            `
                : `
                                <button
                                    type="button"
                                    class="btn btn-sm btn-outline-success"
                                    title="Habilitar almacén"
                                    onclick="habilitarAlmacen(
                                        ${almacen.idAlmacen},
                                        '${nombreSeguro}'
                                    )"
                                >
                                    <i class="bi bi-building-check"></i>
                                </button>
                            `
            }

                </div>

            </td>
        `;

        tabla.appendChild(fila);
    });
}

function mostrarMensajeTabla(mensaje) {
    const tabla =
        document.getElementById(
            "tablaAlmacenes"
        );

    if (!tabla) {
        return;
    }

    tabla.innerHTML = `
        <tr>
            <td
                colspan="7"
                class="text-center py-4 text-muted"
            >
                ${mensaje}
            </td>
        </tr>
    `;
}

/* =========================================================
   ABRIR MODAL NUEVO ALMACÉN
========================================================= */

function abrirModalNuevoAlmacen() {
    limpiarFormularioAlmacen();

    const titulo =
        document.getElementById(
            "modalAlmacenLabel"
        );

    if (titulo) {
        titulo.innerHTML = `
            <i class="bi bi-building-add text-primary me-2"></i>
            Registrar almacén
        `;
    }

    const boton =
        document.getElementById(
            "btnGuardarAlmacen"
        );

    if (boton) {
        boton.innerHTML = `
            <i class="bi bi-floppy me-2"></i>
            Guardar almacén
        `;
    }

    const modalElemento =
        document.getElementById(
            "modalAlmacen"
        );

    if (!modalElemento) {
        mostrarToast(
            "No se encontró el modal de almacén",
            "danger"
        );

        return;
    }

    const modal =
        bootstrap.Modal.getOrCreateInstance(
            modalElemento
        );

    modal.show();
}

/* =========================================================
   EDITAR ALMACÉN
========================================================= */

function editarAlmacen(idAlmacen) {
    const almacen =
        almacenesCargados.find(
            function (item) {
                return (
                    Number(item.idAlmacen) ===
                    Number(idAlmacen)
                );
            }
        );

    if (!almacen) {
        mostrarToast(
            "No se encontró el almacén seleccionado",
            "danger"
        );

        return;
    }

    asignarValor(
        "almacenId",
        almacen.idAlmacen
    );

    asignarValor(
        "nombre",
        almacen.nombre
    );

    asignarValor(
        "ciudad",
        almacen.ciudad
    );

    asignarValor(
        "direccion",
        almacen.direccion
    );

    const titulo =
        document.getElementById(
            "modalAlmacenLabel"
        );

    if (titulo) {
        titulo.innerHTML = `
            <i class="bi bi-pencil text-warning me-2"></i>
            Editar almacén
        `;
    }

    const boton =
        document.getElementById(
            "btnGuardarAlmacen"
        );

    if (boton) {
        boton.innerHTML = `
            <i class="bi bi-floppy me-2"></i>
            Actualizar almacén
        `;
    }

    const modalElemento =
        document.getElementById(
            "modalAlmacen"
        );

    if (!modalElemento) {
        mostrarToast(
            "No se encontró el modal de almacén",
            "danger"
        );

        return;
    }

    const modal =
        bootstrap.Modal.getOrCreateInstance(
            modalElemento
        );

    modal.show();
}

/* =========================================================
   CREAR O ACTUALIZAR ALMACÉN
========================================================= */

async function guardarAlmacen(event) {
    event.preventDefault();

    const idAlmacen = Number(
        document.getElementById(
            "almacenId"
        )?.value
    );

    const editando =
        idAlmacen > 0;

    const nombre =
        obtenerValor("nombre");

    const ciudad =
        obtenerValor("ciudad");

    const direccion =
        obtenerValor("direccion");

    if (
        !nombre ||
        !ciudad ||
        !direccion
    ) {
        mostrarToast(
            "Completa todos los campos obligatorios",
            "warning"
        );

        return;
    }

    const almacenRequest = {
        nombre: nombre,
        ciudad: ciudad,
        direccion: direccion
    };

    const url = editando
        ? `${CONFIG.API_URL}/almacenes/${idAlmacen}/editar`
        : `${CONFIG.API_URL}/almacenes/crear`;

    const metodo = editando
        ? "PUT"
        : "POST";

    console.log(
        "Método:",
        metodo
    );

    console.log(
        "URL:",
        url
    );

    console.log(
        "Almacén enviado:",
        almacenRequest
    );

    const boton =
        document.getElementById(
            "btnGuardarAlmacen"
        );

    try {
        const dataSesion =
            CONFIG.getData();

        const token =
            dataSesion?.accessToken;

        if (!token) {
            mostrarToast(
                "No se encontró la sesión del usuario",
                "danger"
            );

            return;
        }

        if (boton) {
            boton.disabled = true;

            boton.innerHTML = `
                <span
                    class="spinner-border spinner-border-sm me-2"
                ></span>

                ${editando
                    ? "Actualizando..."
                    : "Guardando..."
                }
            `;
        }

        const response = await fetch(
            url,
            {
                method: metodo,
                headers: {
                    "Content-Type":
                        "application/json",

                    "Authorization":
                        `Bearer ${token}`
                },
                body: JSON.stringify(
                    almacenRequest
                )
            }
        );

        const result =
            await obtenerRespuesta(response);

        console.log(
            "Estado HTTP:",
            response.status
        );

        console.log(
            "Respuesta del servidor:",
            result
        );

        if (!response.ok) {
            mostrarToast(
                obtenerMensajeError(
                    result,
                    editando
                        ? "No se pudo actualizar el almacén"
                        : "No se pudo crear el almacén"
                ),
                "danger"
            );

            return;
        }

        mostrarToast(
            editando
                ? "Almacén actualizado correctamente"
                : "Almacén creado correctamente",
            "success"
        );

        cerrarModalAlmacen();
        limpiarFormularioAlmacen();

        await listarAlmacenes(
            obtenerEstadoSeleccionado(),
            obtenerTextoBusqueda(),
            paginaActual,
            tamanioPagina
        );

        actualizarResumen();

    } catch (error) {
        console.error(
            "Error al guardar almacén:",
            error
        );

        mostrarToast(
            "No se pudo conectar con el servidor",
            "danger"
        );

    } finally {
        if (boton) {
            boton.disabled = false;

            boton.innerHTML = `
                <i class="bi bi-floppy me-2"></i>

                ${editando
                    ? "Actualizar almacén"
                    : "Guardar almacén"
                }
            `;
        }
    }
}

/* =========================================================
   DESHABILITAR ALMACÉN
========================================================= */

async function deshabilitarAlmacen(
    idAlmacen,
    nombre
) {
    const confirmar =
        window.confirm(
            `¿Deseas deshabilitar el almacén ${nombre}?`
        );

    if (!confirmar) {
        return;
    }

    await cambiarEstadoAlmacen(
        "PUT",
        `${CONFIG.API_URL}/almacenes/${idAlmacen}/deshabilitar`,
        "Almacén deshabilitado correctamente",
        "No se pudo deshabilitar el almacén"
    );

    actualizarResumen();
}

/* =========================================================
   HABILITAR ALMACÉN
========================================================= */

async function habilitarAlmacen(
    idAlmacen,
    nombre
) {
    const confirmar =
        window.confirm(
            `¿Deseas habilitar el almacén ${nombre}?`
        );

    if (!confirmar) {
        return;
    }

    await cambiarEstadoAlmacen(
        "PUT",
        `${CONFIG.API_URL}/almacenes/${idAlmacen}/habilitar`,
        "Almacén habilitado correctamente",
        "No se pudo habilitar el almacén"
    );

    actualizarResumen();
}

/* =========================================================
   CAMBIAR ESTADO DEL ALMACÉN
========================================================= */

async function cambiarEstadoAlmacen(
    metodo,
    url,
    mensajeExito,
    mensajeError
) {
    try {
        const dataSesion =
            CONFIG.getData();

        const token =
            dataSesion?.accessToken;

        if (!token) {
            mostrarToast(
                "No se encontró la sesión del usuario",
                "danger"
            );

            return;
        }

        const response = await fetch(
            url,
            {
                method: metodo,
                headers: {
                    "Accept": "application/json",
                    "Authorization": `Bearer ${token}`
                }
            }
        );

        const result =
            await obtenerRespuesta(response);

        console.log(
            "Estado HTTP:",
            response.status
        );

        console.log(
            "Respuesta al cambiar estado:",
            result
        );

        if (!response.ok) {
            mostrarToast(
                obtenerMensajeError(
                    result,
                    mensajeError
                ),
                "danger"
            );

            return;
        }

        mostrarToast(
            mensajeExito,
            "success"
        );

        await listarAlmacenes(
            obtenerEstadoSeleccionado(),
            obtenerTextoBusqueda(),
            paginaActual,
            tamanioPagina
        );

    } catch (error) {
        console.error(
            "Error al cambiar el estado del almacén:",
            error
        );

        mostrarToast(
            "No se pudo conectar con el servidor",
            "danger"
        );
    }
}

/* =========================================================
   FILTROS
========================================================= */

function configurarFiltros() {
    const buscarAlmacen =
        document.getElementById(
            "buscarAlmacen"
        );

    const filtroEstado =
        document.getElementById(
            "filtroEstado"
        );

    if (buscarAlmacen) {
        buscarAlmacen.addEventListener(
            "input",
            function () {
                clearTimeout(
                    temporizadorBusqueda
                );

                temporizadorBusqueda =
                    setTimeout(function () {
                        paginaActual = 0;

                        listarAlmacenes(
                            obtenerEstadoSeleccionado(),
                            obtenerTextoBusqueda(),
                            0,
                            tamanioPagina
                        );
                    }, 400);
            }
        );
    }

    if (filtroEstado) {
        filtroEstado.addEventListener(
            "change",
            function () {
                paginaActual = 0;

                listarAlmacenes(
                    obtenerEstadoSeleccionado(),
                    obtenerTextoBusqueda(),
                    0,
                    tamanioPagina
                );
            }
        );
    }
}

function obtenerTextoBusqueda() {
    const input =
        document.getElementById(
            "buscarAlmacen"
        );

    return input
        ? input.value.trim()
        : "";
}

function obtenerEstadoSeleccionado() {
    const select =
        document.getElementById(
            "filtroEstado"
        );

    if (
        !select ||
        select.value === ""
    ) {
        return null;
    }

    return select.value === "true";
}

function limpiarFiltros() {
    const buscar =
        document.getElementById(
            "buscarAlmacen"
        );

    const estado =
        document.getElementById(
            "filtroEstado"
        );

    if (buscar) {
        buscar.value = "";
    }

    if (estado) {
        estado.value = "";
    }

    paginaActual = 0;

    listarAlmacenes(
        null,
        "",
        0,
        tamanioPagina
    );
}

/* =========================================================
   TAMAÑO DE PÁGINA
========================================================= */

function configurarTamanioPaginaAlmacenes() {
    const select =
        document.getElementById(
            "tamanioPaginaAlmacenes"
        );

    if (!select) {
        console.error(
            "No existe el selector tamanioPaginaAlmacenes"
        );

        return;
    }

    tamanioPagina =
        Number(select.value) || 5;

    select.addEventListener(
        "change",
        function () {
            const nuevoTamanio =
                Number(this.value);

            if (
                !Number.isInteger(nuevoTamanio) ||
                nuevoTamanio <= 0
            ) {
                return;
            }

            tamanioPagina =
                nuevoTamanio;

            paginaActual = 0;

            listarAlmacenes(
                obtenerEstadoSeleccionado(),
                obtenerTextoBusqueda(),
                0,
                tamanioPagina
            );
        }
    );
}

function sincronizarSelectorTamanio() {
    const select =
        document.getElementById(
            "tamanioPaginaAlmacenes"
        );

    if (select) {
        select.value =
            String(tamanioPagina);
    }
}

/* =========================================================
   RESUMEN
========================================================= */

async function actualizarResumen() {
    try {

        const url = `${CONFIG.API_URL}/almacenes/dashboard`

        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Accept": "application/json",
                "Authorization": `Bearer ${CONFIG.getData().accessToken}`
            }
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("Error resumen almacenes:", data);
            return;
        }

        console.log("RESUMEN ALMACENES:", data);

        document.getElementById("totalAlmacenes").textContent=data.totalAlmacenes;
        document.getElementById("totalActivos").textContent=data.activos;
        document.getElementById("totalInactivos").textContent=data.inactivos;

    } catch (error) {
        console.error("Error al obtener kardex:", error);
    }

}

/* =========================================================
   INFORMACIÓN DE PAGINACIÓN
========================================================= */

function actualizarInformacionPaginacionAlmacenes(
    result
) {
    const total =
        result?.totalElements ?? 0;

    const pagina =
        result?.number ?? paginaActual;

    const tamanio =
        result?.size ?? tamanioPagina;

    const cantidadActual =
        result?.numberOfElements ??
        result?.content?.length ??
        almacenesCargados.length;

    const inicio =
        total === 0
            ? 0
            : pagina * tamanio + 1;

    const fin =
        total === 0
            ? 0
            : Math.min(
                pagina * tamanio +
                cantidadActual,
                total
            );

    asignarTexto(
        "registroInicioAlmacenes",
        inicio
    );

    asignarTexto(
        "registroFinAlmacenes",
        fin
    );

    asignarTexto(
        "totalRegistrosAlmacenes",
        total
    );
}

function limpiarInformacionPaginacion() {
    asignarTexto(
        "registroInicioAlmacenes",
        0
    );

    asignarTexto(
        "registroFinAlmacenes",
        0
    );

    asignarTexto(
        "totalRegistrosAlmacenes",
        0
    );
}

/* =========================================================
   PAGINACIÓN
========================================================= */

function mostrarPaginacion(result) {
    const paginacion =
        document.getElementById(
            "paginacionAlmacenes"
        );

    if (!paginacion) {
        return;
    }

    paginacion.innerHTML = "";

    const totalPaginas =
        result?.totalPages ?? 0;

    const primeraPagina =
        result?.first ??
        paginaActual === 0;

    const ultimaPagina =
        result?.last ??
        paginaActual >= totalPaginas - 1;

    if (totalPaginas <= 1) {
        return;
    }

    paginacion.innerHTML += `
        <li
            class="page-item ${primeraPagina
            ? "disabled"
            : ""
        }"
        >
            <button
                type="button"
                class="page-link"
                ${primeraPagina
            ? "disabled"
            : ""
        }
                onclick="cambiarPaginaAlmacenes(
                    ${paginaActual - 1}
                )"
            >
                <i class="bi bi-chevron-left"></i>
                Anterior
            </button>
        </li>
    `;

    for (
        let pagina = 0;
        pagina < totalPaginas;
        pagina++
    ) {
        paginacion.innerHTML += `
            <li
                class="page-item ${pagina === paginaActual
                ? "active"
                : ""
            }"
            >
                <button
                    type="button"
                    class="page-link"
                    onclick="cambiarPaginaAlmacenes(
                        ${pagina}
                    )"
                >
                    ${pagina + 1}
                </button>
            </li>
        `;
    }

    paginacion.innerHTML += `
        <li
            class="page-item ${ultimaPagina
            ? "disabled"
            : ""
        }"
        >
            <button
                type="button"
                class="page-link"
                ${ultimaPagina
            ? "disabled"
            : ""
        }
                onclick="cambiarPaginaAlmacenes(
                    ${paginaActual + 1}
                )"
            >
                Siguiente
                <i class="bi bi-chevron-right"></i>
            </button>
        </li>
    `;
}

function limpiarPaginacion() {
    const paginacion =
        document.getElementById(
            "paginacionAlmacenes"
        );

    if (paginacion) {
        paginacion.innerHTML = "";
    }
}

function cambiarPaginaAlmacenes(page) {
    if (page < 0) {
        return;
    }

    paginaActual = page;

    listarAlmacenes(
        obtenerEstadoSeleccionado(),
        obtenerTextoBusqueda(),
        paginaActual,
        tamanioPagina
    );
}

/* =========================================================
   LIMPIAR Y CERRAR MODAL
========================================================= */

function limpiarFormularioAlmacen() {
    const formulario =
        document.getElementById(
            "formAlmacen"
        );

    if (formulario) {
        formulario.reset();
    }

    asignarValor(
        "almacenId",
        ""
    );
}

function cerrarModalAlmacen() {
    const modalElemento =
        document.getElementById(
            "modalAlmacen"
        );

    if (!modalElemento) {
        return;
    }

    const modal =
        bootstrap.Modal.getInstance(
            modalElemento
        );

    if (modal) {
        modal.hide();
    }
}

/* =========================================================
   FECHA
========================================================= */

function formatearFecha(fecha) {
    if (!fecha) {
        return "-";
    }

    const fechaConvertida =
        new Date(fecha);

    if (
        Number.isNaN(
            fechaConvertida.getTime()
        )
    ) {
        return fecha;
    }

    return fechaConvertida
        .toLocaleDateString(
            "es-PE",
            {
                day: "2-digit",
                month: "2-digit",
                year: "numeric"
            }
        );
}

/* =========================================================
   AUXILIARES
========================================================= */

function obtenerValor(id) {
    const elemento =
        document.getElementById(id);

    return elemento
        ? elemento.value.trim()
        : "";
}

function asignarValor(
    id,
    valor
) {
    const elemento =
        document.getElementById(id);

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
        document.getElementById(id);

    if (elemento) {
        elemento.textContent =
            valor;
    }
}

function escaparTexto(texto) {
    return String(texto)
        .replaceAll(
            "\\",
            "\\\\"
        )
        .replaceAll(
            "'",
            "\\'"
        );
}

async function obtenerRespuesta(response) {
    const texto =
        await response.text();

    if (!texto) {
        return null;
    }

    try {
        return JSON.parse(texto);
    } catch {
        return texto;
    }
}

function obtenerMensajeError(
    result,
    mensajeDefecto
) {
    if (
        result &&
        typeof result === "object"
    ) {
        return (
            result.message ||
            result.mensaje ||
            result.error ||
            mensajeDefecto
        );
    }

    if (
        typeof result === "string" &&
        result.trim() !== ""
    ) {
        return result;
    }

    return mensajeDefecto;
}

/* =========================================================
   TOAST
========================================================= */

function mostrarToast(
    mensaje,
    tipo = "success"
) {
    const toastElemento =
        document.getElementById(
            "toastMensaje"
        );

    const textoToast =
        document.getElementById(
            "textoToast"
        );

    if (
        !toastElemento ||
        !textoToast
    ) {
        console.log(mensaje);
        return;
    }

    textoToast.textContent =
        mensaje;

    toastElemento.classList.remove(
        "text-bg-success",
        "text-bg-danger",
        "text-bg-warning",
        "text-bg-info"
    );

    toastElemento.classList.add(
        `text-bg-${tipo}`
    );

    const toast =
        bootstrap.Toast.getOrCreateInstance(
            toastElemento,
            {
                delay: 1800,
                autohide: true
            }
        );

    toast.show();
}

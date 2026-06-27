let choferesCargados = [];
let paginaActual = 0;
let tamanioPagina = 5;
let temporizadorBusqueda = null;

/* =========================================================
   INICIALIZACIÓN
========================================================= */

document.addEventListener("DOMContentLoaded", function () {
    configurarFiltrosChoferes();
    configurarTamanioPaginaChoferes();

    actualizarResumenChoferes();

    listarChoferes(
        null,
        "",
        0,
        tamanioPagina
    );
});

/* =========================================================
   LISTAR CHOFERES
========================================================= */

async function listarChoferes(
    estado = null,
    buscar = "",
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

            limpiarInformacionPaginacionChoferes();
            limpiarPaginacionChoferes();
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
            buscar !== null &&
            buscar.trim() !== ""
        ) {
            parametros.append(
                "buscar",
                buscar.trim()
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
            `${CONFIG.API_URL}/choferes?${parametros.toString()}`;

        console.log(
            "URL choferes:",
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
            "Respuesta de choferes:",
            result
        );

        if (!response.ok) {
            mostrarToast(
                obtenerMensajeError(
                    result,
                    "No se pudieron cargar los choferes"
                ),
                "danger"
            );

            mostrarMensajeTabla(
                "No se pudieron cargar los choferes"
            );

            limpiarInformacionPaginacionChoferes();
            limpiarPaginacionChoferes();
            return;
        }

        const choferes =
            result?.content || [];

        choferesCargados =
            Array.isArray(choferes)
                ? choferes
                : [];

        paginaActual =
            result?.number ?? page;

        tamanioPagina =
            result?.size ?? size;

        sincronizarSelectorTamanioChoferes();

        mostrarChoferes(
            choferesCargados
        );

        mostrarPaginacionChoferes(
            result
        );

        actualizarInformacionPaginacionChoferes(
            result
        );

    } catch (error) {
        console.error(
            "Error al consultar choferes:",
            error
        );

        mostrarToast(
            "No se pudo conectar con el servidor",
            "danger"
        );

        mostrarMensajeTabla(
            "Error al consultar los choferes"
        );

        limpiarInformacionPaginacionChoferes();
        limpiarPaginacionChoferes();
    }
}

/* =========================================================
   MOSTRAR CHOFERES
========================================================= */

function mostrarChoferes(choferes) {
    const tabla =
        document.getElementById(
            "tablaChoferes"
        );

    const sinChoferes =
        document.getElementById(
            "sinChoferes"
        );

    if (!tabla) {
        console.error(
            "No existe el tbody tablaChoferes"
        );
        return;
    }

    tabla.innerHTML = "";

    if (
        !Array.isArray(choferes) ||
        choferes.length === 0
    ) {
        if (sinChoferes) {
            sinChoferes.classList.remove(
                "d-none"
            );
        }

        mostrarMensajeTabla(
            "No se encontraron choferes"
        );

        return;
    }

    if (sinChoferes) {
        sinChoferes.classList.add(
            "d-none"
        );
    }

    choferes.forEach(function (chofer) {
        const idChofer =
            chofer.idChofer ??
            chofer.id;

        const nombreSeguro =
            escaparTexto(
                chofer.nombre || ""
            );

        const iniciales =
            obtenerIniciales(
                chofer.nombre
            );

        const fila =
            document.createElement("tr");

        fila.innerHTML = `
            <td>
                ${idChofer ?? "-"}
            </td>

            <td>
                <div class="d-flex align-items-center gap-2">

                    <div class="avatar-chofer">
                        ${iniciales}
                    </div>

                    <strong>
                        ${chofer.nombre || "-"}
                    </strong>

                </div>
            </td>

            <td>
                ${chofer.dni || "-"}
            </td>

            <td>
                ${chofer.licencia || "-"}
            </td>

            <td>
                ${chofer.telefono || "-"}
            </td>

            <td>
                ${
                    chofer.estado
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

            <td class="text-center">

                <div class="d-flex justify-content-center gap-2">

                    <button
                        type="button"
                        class="btn btn-sm btn-outline-warning"
                        title="Editar chofer"
                        onclick="editarChofer(
                            ${idChofer}
                        )"
                    >
                        <i class="bi bi-pencil"></i>
                    </button>

                    ${
                        chofer.estado
                            ? `
                                <button
                                    type="button"
                                    class="btn btn-sm btn-outline-danger"
                                    title="Deshabilitar chofer"
                                    onclick="deshabilitarChofer(
                                        ${idChofer},
                                        '${nombreSeguro}'
                                    )"
                                >
                                    <i class="bi bi-person-x"></i>
                                </button>
                            `
                            : `
                                <button
                                    type="button"
                                    class="btn btn-sm btn-outline-success"
                                    title="Habilitar chofer"
                                    onclick="habilitarChofer(
                                        ${idChofer},
                                        '${nombreSeguro}'
                                    )"
                                >
                                    <i class="bi bi-person-check"></i>
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
            "tablaChoferes"
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

function obtenerIniciales(nombre) {
    if (!nombre) {
        return "CH";
    }

    const palabras =
        nombre.trim().split(/\s+/);

    const primera =
        palabras[0]?.charAt(0) || "";

    const segunda =
        palabras[1]?.charAt(0) || "";

    return (
        primera + segunda
    ).toUpperCase();
}

/* =========================================================
   NUEVO CHOFER
========================================================= */

function abrirModalNuevoChofer() {
    limpiarFormularioChofer();

    const titulo =
        document.getElementById(
            "modalChoferLabel"
        );

    if (titulo) {
        titulo.innerHTML = `
            <i class="bi bi-person-plus text-primary me-2"></i>
            Registrar chofer
        `;
    }

    const boton =
        document.getElementById(
            "btnGuardarChofer"
        );

    if (boton) {
        boton.innerHTML = `
            <i class="bi bi-floppy me-2"></i>
            Guardar chofer
        `;
    }

    const modalElemento =
        document.getElementById(
            "modalChofer"
        );

    if (!modalElemento) {
        mostrarToast(
            "No se encontró el modal de chofer",
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
   EDITAR CHOFER
========================================================= */

function editarChofer(idChofer) {
    const chofer =
        choferesCargados.find(
            function (item) {
                const id =
                    item.idChofer ??
                    item.id;

                return (
                    Number(id) ===
                    Number(idChofer)
                );
            }
        );

    if (!chofer) {
        mostrarToast(
            "No se encontró el chofer seleccionado",
            "danger"
        );
        return;
    }

    asignarValor(
        "choferId",
        idChofer
    );

    asignarValor(
        "nombre",
        chofer.nombre
    );

    asignarValor(
        "dni",
        chofer.dni
    );

    asignarValor(
        "telefono",
        chofer.telefono
    );

    asignarValor(
        "licencia",
        chofer.licencia
    );

    const titulo =
        document.getElementById(
            "modalChoferLabel"
        );

    if (titulo) {
        titulo.innerHTML = `
            <i class="bi bi-pencil text-warning me-2"></i>
            Editar chofer
        `;
    }

    const boton =
        document.getElementById(
            "btnGuardarChofer"
        );

    if (boton) {
        boton.innerHTML = `
            <i class="bi bi-floppy me-2"></i>
            Actualizar chofer
        `;
    }

    const modalElemento =
        document.getElementById(
            "modalChofer"
        );

    if (!modalElemento) {
        mostrarToast(
            "No se encontró el modal de chofer",
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
   CREAR O ACTUALIZAR
========================================================= */

async function guardarChofer(event) {
    event.preventDefault();

    const idChofer = Number(
        document.getElementById(
            "choferId"
        )?.value
    );

    const editando =
        idChofer > 0;

    const nombre =
        obtenerValor("nombre");

    const dni =
        obtenerValor("dni");

    const telefono =
        obtenerValor("telefono");

    const licencia =
        obtenerValor("licencia")
            .toUpperCase();

    if (
        !nombre ||
        !dni ||
        !telefono ||
        !licencia
    ) {
        mostrarToast(
            "Completa todos los campos obligatorios",
            "warning"
        );
        return;
    }

    if (!/^\d{8}$/.test(dni)) {
        mostrarToast(
            "El DNI debe tener exactamente 8 dígitos",
            "warning"
        );
        return;
    }

    if (!/^\d{9}$/.test(telefono)) {
        mostrarToast(
            "El teléfono debe tener exactamente 9 dígitos",
            "warning"
        );
        return;
    }

    let estadoActual = true;

    if (editando) {
        const choferActual =
            choferesCargados.find(
                function (item) {
                    const id =
                        item.idChofer ??
                        item.id;

                    return (
                        Number(id) ===
                        Number(idChofer)
                    );
                }
            );

        if (!choferActual) {
            mostrarToast(
                "No se encontró el chofer que deseas editar",
                "danger"
            );
            return;
        }

        estadoActual =
            choferActual.estado ?? true;
    }

    /*
     * No se envía el ID en el body.
     * El ID de creación lo genera la base de datos.
     */
    const choferRequest = {
        dni: dni,
        licencia: licencia,
        nombre: nombre,
        telefono: telefono,
        estado: estadoActual
    };

    const url = editando
        ? `${CONFIG.API_URL}/choferes/${idChofer}/editar`
        : `${CONFIG.API_URL}/choferes/crear`;

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
        "Chofer enviado:",
        choferRequest
    );

    const boton =
        document.getElementById(
            "btnGuardarChofer"
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

                ${
                    editando
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
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(
                    choferRequest
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
                        ? "No se pudo actualizar el chofer"
                        : "No se pudo crear el chofer"
                ),
                "danger"
            );
            return;
        }

        mostrarToast(
            editando
                ? "Chofer actualizado correctamente"
                : "Chofer creado correctamente",
            "success"
        );

        cerrarModalChofer();
        limpiarFormularioChofer();

        await listarChoferes(
            obtenerEstadoSeleccionado(),
            obtenerTextoBusqueda(),
            paginaActual,
            tamanioPagina
        );

        actualizarResumenChoferes();

    } catch (error) {
        console.error(
            "Error al guardar chofer:",
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

                ${
                    editando
                        ? "Actualizar chofer"
                        : "Guardar chofer"
                }
            `;
        }
    }
}

/* =========================================================
   DESHABILITAR
========================================================= */

async function deshabilitarChofer(
    idChofer,
    nombre
) {
    const confirmar =
        window.confirm(
            `¿Deseas deshabilitar al chofer ${nombre}?`
        );

    if (!confirmar) {
        return;
    }

    await cambiarEstadoChofer(
        "PUT",
        `${CONFIG.API_URL}/choferes/${idChofer}/deshabilitar`,
        "Chofer deshabilitado correctamente",
        "No se pudo deshabilitar el chofer"
    );

    actualizarResumenChoferes();
}

/* =========================================================
   HABILITAR
========================================================= */

async function habilitarChofer(
    idChofer,
    nombre
) {
    const confirmar =
        window.confirm(
            `¿Deseas habilitar al chofer ${nombre}?`
        );

    if (!confirmar) {
        return;
    }

    await cambiarEstadoChofer(
        "PUT",
        `${CONFIG.API_URL}/choferes/${idChofer}/habilitar`,
        "Chofer habilitado correctamente",
        "No se pudo habilitar el chofer"
    );
    actualizarResumenChoferes();
}


/* =========================================================
   CAMBIAR ESTADO
========================================================= */

async function cambiarEstadoChofer(
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

        await listarChoferes(
            obtenerEstadoSeleccionado(),
            obtenerTextoBusqueda(),
            paginaActual,
            tamanioPagina
        );

    } catch (error) {
        console.error(
            "Error al cambiar el estado del chofer:",
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

function configurarFiltrosChoferes() {
    const buscarChofer =
        document.getElementById(
            "buscarChofer"
        );

    const filtroEstado =
        document.getElementById(
            "filtroEstado"
        );

    if (buscarChofer) {
        buscarChofer.addEventListener(
            "input",
            function () {
                clearTimeout(
                    temporizadorBusqueda
                );

                temporizadorBusqueda =
                    setTimeout(function () {
                        paginaActual = 0;

                        listarChoferes(
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

                listarChoferes(
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
            "buscarChofer"
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

function limpiarFiltrosChoferes() {
    const buscar =
        document.getElementById(
            "buscarChofer"
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

    listarChoferes(
        null,
        "",
        0,
        tamanioPagina
    );
}

/* =========================================================
   TAMAÑO DE PÁGINA
========================================================= */

function configurarTamanioPaginaChoferes() {
    const select =
        document.getElementById(
            "tamanioPaginaChoferes"
        );

    if (!select) {
        console.error(
            "No existe el selector tamanioPaginaChoferes"
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

            listarChoferes(
                obtenerEstadoSeleccionado(),
                obtenerTextoBusqueda(),
                0,
                tamanioPagina
            );
        }
    );
}

function sincronizarSelectorTamanioChoferes() {
    const select =
        document.getElementById(
            "tamanioPaginaChoferes"
        );

    if (select) {
        select.value =
            String(tamanioPagina);
    }
}

/* =========================================================
   RESUMEN
========================================================= */

async function actualizarResumenChoferes() {
    try {

        const url = `${CONFIG.API_URL}/choferes/dashboard`;

        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Accept": "application/json",
                "Authorization": `Bearer ${CONFIG.getData().accessToken}`
            }
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("Error resumen choferes:", data);
            return;
        }

        console.log("RESUMEN CHOFERES:", data);

        document.getElementById("totalChoferes").textContent=data.totalChoferes;
        document.getElementById("totalActivos").textContent=data.activos;
        document.getElementById("totalInactivos").textContent=data.inactivos;
        

    } catch (error) {
        console.error("Error al obtener kardex:", error);
    }

}

/* =========================================================
   INFORMACIÓN DE PAGINACIÓN
========================================================= */

function actualizarInformacionPaginacionChoferes(
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
        choferesCargados.length;

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
        "registroInicioChoferes",
        inicio
    );

    asignarTexto(
        "registroFinChoferes",
        fin
    );

    asignarTexto(
        "totalRegistrosChoferes",
        total
    );
}

function limpiarInformacionPaginacionChoferes() {
    asignarTexto(
        "registroInicioChoferes",
        0
    );

    asignarTexto(
        "registroFinChoferes",
        0
    );

    asignarTexto(
        "totalRegistrosChoferes",
        0
    );
}

/* =========================================================
   PAGINACIÓN
========================================================= */

function mostrarPaginacionChoferes(result) {
    const paginacion =
        document.getElementById(
            "paginacionChoferes"
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
        <li class="page-item ${
            primeraPagina
                ? "disabled"
                : ""
        }">

            <button
                type="button"
                class="page-link"
                ${
                    primeraPagina
                        ? "disabled"
                        : ""
                }
                onclick="cambiarPaginaChoferes(
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
            <li class="page-item ${
                pagina === paginaActual
                    ? "active"
                    : ""
            }">

                <button
                    type="button"
                    class="page-link"
                    onclick="cambiarPaginaChoferes(
                        ${pagina}
                    )"
                >
                    ${pagina + 1}
                </button>

            </li>
        `;
    }

    paginacion.innerHTML += `
        <li class="page-item ${
            ultimaPagina
                ? "disabled"
                : ""
        }">

            <button
                type="button"
                class="page-link"
                ${
                    ultimaPagina
                        ? "disabled"
                        : ""
                }
                onclick="cambiarPaginaChoferes(
                    ${paginaActual + 1}
                )"
            >
                Siguiente
                <i class="bi bi-chevron-right"></i>
            </button>

        </li>
    `;
}

function limpiarPaginacionChoferes() {
    const paginacion =
        document.getElementById(
            "paginacionChoferes"
        );

    if (paginacion) {
        paginacion.innerHTML = "";
    }
}

function cambiarPaginaChoferes(page) {
    if (page < 0) {
        return;
    }

    paginaActual = page;

    listarChoferes(
        obtenerEstadoSeleccionado(),
        obtenerTextoBusqueda(),
        paginaActual,
        tamanioPagina
    );
}

/* =========================================================
   MODAL
========================================================= */

function limpiarFormularioChofer() {
    const formulario =
        document.getElementById(
            "formChofer"
        );

    if (formulario) {
        formulario.reset();
    }

    asignarValor(
        "choferId",
        ""
    );
}

function cerrarModalChofer() {
    const modalElemento =
        document.getElementById(
            "modalChofer"
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
        .replaceAll("\\", "\\\\")
        .replaceAll("'", "\\'");
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

let vehiculosCargados = [];
let paginaActual = 0;
let tamanioPagina = 5;
let temporizadorBusqueda = null;

/* =========================================================
   INICIALIZACIÓN
========================================================= */

document.addEventListener("DOMContentLoaded", function () {
    configurarFiltrosVehiculos();
    configurarTamanioPaginaVehiculos();
    actualizarResumenVehiculos();

    listarVehiculos(
        null,
        "",
        0,
        tamanioPagina
    );
});

/* =========================================================
   LISTAR VEHÍCULOS
========================================================= */

async function listarVehiculos(
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

            limpiarInformacionPaginacionVehiculos();
            limpiarPaginacionVehiculos();
            return;
        }

        const parametros = new URLSearchParams();

        if (estado !== null) {
            parametros.append("estado", estado);
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

        parametros.append("page", page);
        parametros.append("size", size);

        const url =
            `${CONFIG.API_URL}/vehiculos?${parametros.toString()}`;

        console.log("URL vehículos:", url);

        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Accept": "application/json",
                "Authorization": `Bearer ${token}`
            }
        });

        const result =
            await obtenerRespuesta(response);

        console.log(
            "Estado HTTP:",
            response.status
        );

        console.log(
            "Respuesta de vehículos:",
            result
        );

        if (!response.ok) {
            mostrarToast(
                obtenerMensajeError(
                    result,
                    "No se pudieron cargar los vehículos"
                ),
                "danger"
            );

            mostrarMensajeTabla(
                "No se pudieron cargar los vehículos"
            );

            limpiarInformacionPaginacionVehiculos();
            limpiarPaginacionVehiculos();
            return;
        }

        const vehiculos =
            result?.content || [];

        vehiculosCargados =
            Array.isArray(vehiculos)
                ? vehiculos
                : [];

        paginaActual =
            result?.number ?? page;

        tamanioPagina =
            result?.size ?? size;

        sincronizarSelectorTamanioVehiculos();

        mostrarVehiculos(
            vehiculosCargados
        );

        mostrarPaginacionVehiculos(
            result
        );

        actualizarInformacionPaginacionVehiculos(
            result
        );

    } catch (error) {
        console.error(
            "Error al consultar vehículos:",
            error
        );

        mostrarToast(
            "No se pudo conectar con el servidor",
            "danger"
        );

        mostrarMensajeTabla(
            "Error al consultar los vehículos"
        );

        limpiarInformacionPaginacionVehiculos();
        limpiarPaginacionVehiculos();
    }
}

/* =========================================================
   MOSTRAR VEHÍCULOS
========================================================= */

function mostrarVehiculos(vehiculos) {
    const tabla =
        document.getElementById(
            "tablaVehiculos"
        );

    const sinVehiculos =
        document.getElementById(
            "sinVehiculos"
        );

    if (!tabla) {
        console.error(
            "No existe el tbody tablaVehiculos"
        );
        return;
    }

    tabla.innerHTML = "";

    if (
        !Array.isArray(vehiculos) ||
        vehiculos.length === 0
    ) {
        if (sinVehiculos) {
            sinVehiculos.classList.remove(
                "d-none"
            );
        }

        mostrarMensajeTabla(
            "No se encontraron vehículos"
        );

        return;
    }

    if (sinVehiculos) {
        sinVehiculos.classList.add(
            "d-none"
        );
    }

    vehiculos.forEach(function (vehiculo) {
        const idVehiculo =
            vehiculo.idVehiculo ??
            vehiculo.id;

        const placaSegura =
            escaparTexto(
                vehiculo.placa || ""
            );

        const fila =
            document.createElement("tr");

        fila.innerHTML = `
            <td>
                ${idVehiculo ?? "-"}
            </td>

            <td>
                <div class="d-flex align-items-center gap-2">

                    <div class="icono-vehiculo">
                        <i class="bi bi-truck-front"></i>
                    </div>

                    <strong class="text-uppercase">
                        ${vehiculo.placa || "-"}
                    </strong>

                </div>
            </td>

            <td>
                ${vehiculo.marca || "-"}
            </td>

            <td>
                ${vehiculo.modelo || "-"}
            </td>

            <td>
                ${vehiculo.estado
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
                        title="Editar vehículo"
                        onclick="editarVehiculo(${idVehiculo})"
                    >
                        <i class="bi bi-pencil"></i>
                    </button>

                    ${vehiculo.estado
                ? `
                                <button
                                    type="button"
                                    class="btn btn-sm btn-outline-danger"
                                    title="Deshabilitar vehículo"
                                    onclick="deshabilitarVehiculo(
                                        ${idVehiculo},
                                        '${placaSegura}'
                                    )"
                                >
                                    <i class="bi bi-truck-flatbed"></i>
                                </button>
                            `
                : `
                                <button
                                    type="button"
                                    class="btn btn-sm btn-outline-success"
                                    title="Habilitar vehículo"
                                    onclick="habilitarVehiculo(
                                        ${idVehiculo},
                                        '${placaSegura}'
                                    )"
                                >
                                    <i class="bi bi-check-circle"></i>
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
            "tablaVehiculos"
        );

    if (!tabla) {
        return;
    }

    tabla.innerHTML = `
        <tr>
            <td
                colspan="6"
                class="text-center py-4 text-muted"
            >
                ${mensaje}
            </td>
        </tr>
    `;
}

/* =========================================================
   ABRIR MODAL NUEVO VEHÍCULO
========================================================= */

function abrirModalNuevoVehiculo() {
    limpiarFormularioVehiculo();

    const titulo =
        document.getElementById(
            "modalVehiculoLabel"
        );

    if (titulo) {
        titulo.innerHTML = `
            <i class="bi bi-truck-front text-primary me-2"></i>
            Registrar vehículo
        `;
    }

    const boton =
        document.getElementById(
            "btnGuardarVehiculo"
        );

    if (boton) {
        boton.innerHTML = `
            <i class="bi bi-floppy me-2"></i>
            Guardar vehículo
        `;
    }

    const modalElemento =
        document.getElementById(
            "modalVehiculo"
        );

    if (!modalElemento) {
        mostrarToast(
            "No se encontró el modal de vehículo",
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
   EDITAR VEHÍCULO
========================================================= */

function editarVehiculo(idVehiculo) {
    const vehiculo =
        vehiculosCargados.find(
            function (item) {
                const id =
                    item.idVehiculo ??
                    item.id;

                return (
                    Number(id) ===
                    Number(idVehiculo)
                );
            }
        );

    if (!vehiculo) {
        mostrarToast(
            "No se encontró el vehículo seleccionado",
            "danger"
        );
        return;
    }

    asignarValor(
        "vehiculoId",
        idVehiculo
    );

    asignarValor(
        "placa",
        vehiculo.placa
    );

    asignarValor(
        "marca",
        vehiculo.marca
    );

    asignarValor(
        "modelo",
        vehiculo.modelo
    );

    const titulo =
        document.getElementById(
            "modalVehiculoLabel"
        );

    if (titulo) {
        titulo.innerHTML = `
            <i class="bi bi-pencil text-warning me-2"></i>
            Editar vehículo
        `;
    }

    const boton =
        document.getElementById(
            "btnGuardarVehiculo"
        );

    if (boton) {
        boton.innerHTML = `
            <i class="bi bi-floppy me-2"></i>
            Actualizar vehículo
        `;
    }

    const modalElemento =
        document.getElementById(
            "modalVehiculo"
        );

    if (!modalElemento) {
        mostrarToast(
            "No se encontró el modal de vehículo",
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
   CREAR O ACTUALIZAR VEHÍCULO
========================================================= */

async function guardarVehiculo(event) {
    event.preventDefault();

    const idVehiculo = Number(
        document.getElementById(
            "vehiculoId"
        )?.value
    );

    const editando =
        idVehiculo > 0;

    const placa =
        obtenerValor("placa")
            .toUpperCase();

    const marca =
        obtenerValor("marca");

    const modelo =
        obtenerValor("modelo");

    if (
        !placa ||
        !marca ||
        !modelo
    ) {
        mostrarToast(
            "Completa todos los campos obligatorios",
            "warning"
        );
        return;
    }

    let estadoActual = true;

    if (editando) {
        const vehiculoActual =
            vehiculosCargados.find(
                function (item) {
                    const id =
                        item.idVehiculo ??
                        item.id;

                    return (
                        Number(id) ===
                        Number(idVehiculo)
                    );
                }
            );

        if (!vehiculoActual) {
            mostrarToast(
                "No se encontró el vehículo que deseas editar",
                "danger"
            );
            return;
        }

        estadoActual =
            vehiculoActual.estado ?? true;
    }

    /*
     * IMPORTANTE:
     * No se envía el ID en el body.
     * Para crear, el ID lo genera PostgreSQL.
     * Para editar, el ID se envía en la URL.
     */
    const vehiculoRequest = {
        placa: placa,
        marca: marca,
        modelo: modelo,
        estado: estadoActual
    };

    const url = editando
        ? `${CONFIG.API_URL}/vehiculos/${idVehiculo}/editar`
        : `${CONFIG.API_URL}/vehiculos/crear`;

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
        "Vehículo enviado:",
        vehiculoRequest
    );

    const boton =
        document.getElementById(
            "btnGuardarVehiculo"
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
                    role="status"
                    aria-hidden="true"
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
                    "Accept":
                        "application/json",

                    "Content-Type":
                        "application/json",

                    "Authorization":
                        `Bearer ${token}`
                },
                body: JSON.stringify(
                    vehiculoRequest
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
                        ? "No se pudo actualizar el vehículo"
                        : "No se pudo crear el vehículo"
                ),
                "danger"
            );
            return;
        }

        mostrarToast(
            editando
                ? "Vehículo actualizado correctamente"
                : "Vehículo creado correctamente",
            "success"
        );

        cerrarModalVehiculo();
        limpiarFormularioVehiculo();

        await listarVehiculos(
            obtenerEstadoSeleccionado(),
            obtenerTextoBusqueda(),
            paginaActual,
            tamanioPagina
        );

        actualizarResumenVehiculos();

    } catch (error) {
        console.error(
            "Error al guardar vehículo:",
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
                    ? "Actualizar vehículo"
                    : "Guardar vehículo"
                }
            `;
        }
    }
}

/* =========================================================
   DESHABILITAR VEHÍCULO
========================================================= */

async function deshabilitarVehiculo(
    idVehiculo,
    placa
) {
    const confirmar =
        window.confirm(
            `¿Deseas deshabilitar el vehículo ${placa}?`
        );

    if (!confirmar) {
        return;
    }

    await cambiarEstadoVehiculo(
        "PUT",
        `${CONFIG.API_URL}/vehiculos/${idVehiculo}/deshabilitar`,
        "Vehículo deshabilitado correctamente",
        "No se pudo deshabilitar el vehículo"
    );

    actualizarResumenVehiculos();
}

/* =========================================================
   HABILITAR VEHÍCULO
========================================================= */

async function habilitarVehiculo(
    idVehiculo,
    placa
) {
    const confirmar =
        window.confirm(
            `¿Deseas habilitar el vehículo ${placa}?`
        );

    if (!confirmar) {
        return;
    }

    await cambiarEstadoVehiculo(
        "PUT",
        `${CONFIG.API_URL}/vehiculos/${idVehiculo}/habilitar`,
        "Vehículo habilitado correctamente",
        "No se pudo habilitar el vehículo"
    );
}

/* =========================================================
   CAMBIAR ESTADO
========================================================= */

async function cambiarEstadoVehiculo(
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

        console.log(
            "Método cambio de estado:",
            metodo
        );

        console.log(
            "URL cambio de estado:",
            url
        );

        const response = await fetch(
            url,
            {
                method: metodo,
                headers: {
                    "Accept":
                        "application/json",

                    "Authorization":
                        `Bearer ${token}`
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

        await listarVehiculos(
            obtenerEstadoSeleccionado(),
            obtenerTextoBusqueda(),
            paginaActual,
            tamanioPagina
        );

        actualizarResumenVehiculos();

    } catch (error) {
        console.error(
            "Error al cambiar estado del vehículo:",
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

function configurarFiltrosVehiculos() {
    const buscarVehiculo =
        document.getElementById(
            "buscarVehiculo"
        );

    const filtroEstado =
        document.getElementById(
            "filtroEstado"
        );

    if (buscarVehiculo) {
        buscarVehiculo.addEventListener(
            "input",
            function () {
                clearTimeout(
                    temporizadorBusqueda
                );

                temporizadorBusqueda =
                    setTimeout(function () {
                        paginaActual = 0;

                        listarVehiculos(
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

                listarVehiculos(
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
            "buscarVehiculo"
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

function limpiarFiltrosVehiculos() {
    const buscar =
        document.getElementById(
            "buscarVehiculo"
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

    listarVehiculos(
        null,
        "",
        0,
        tamanioPagina
    );
}

/* =========================================================
   TAMAÑO DE PÁGINA
========================================================= */

function configurarTamanioPaginaVehiculos() {
    const select =
        document.getElementById(
            "tamanioPaginaVehiculos"
        );

    if (!select) {
        console.error(
            "No existe el selector tamanioPaginaVehiculos"
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

            listarVehiculos(
                obtenerEstadoSeleccionado(),
                obtenerTextoBusqueda(),
                0,
                tamanioPagina
            );
        }
    );
}

function sincronizarSelectorTamanioVehiculos() {
    const select =
        document.getElementById(
            "tamanioPaginaVehiculos"
        );

    if (select) {
        select.value =
            String(tamanioPagina);
    }
}

/* =========================================================
   RESUMEN
========================================================= */

async function actualizarResumenVehiculos() {
    try {

        const url = `${CONFIG.API_URL}/vehiculos/dashboard`

        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Accept": "application/json",
                "Authorization": `Bearer ${CONFIG.getData().accessToken}`
            }
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("Error resumen vehiculos:", data);
            return;
        }

        console.log("RESUMEN VEHCULOS:", data);

        document.getElementById("totalVehiculos").textContent = data.totalVehiculos;
        document.getElementById("totalActivos").textContent = data.activos;
        document.getElementById("totalInactivos").textContent = data.inactivos;
        

    } catch (error) {
        console.error("Error al obtener kardex:", error);
    }

}

/* =========================================================
   INFORMACIÓN DE PAGINACIÓN
========================================================= */

function actualizarInformacionPaginacionVehiculos(
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
        vehiculosCargados.length;

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
        "registroInicioVehiculos",
        inicio
    );

    asignarTexto(
        "registroFinVehiculos",
        fin
    );

    asignarTexto(
        "totalRegistrosVehiculos",
        total
    );
}

function limpiarInformacionPaginacionVehiculos() {
    asignarTexto(
        "registroInicioVehiculos",
        0
    );

    asignarTexto(
        "registroFinVehiculos",
        0
    );

    asignarTexto(
        "totalRegistrosVehiculos",
        0
    );
}

/* =========================================================
   PAGINACIÓN
========================================================= */

function mostrarPaginacionVehiculos(result) {
    const paginacion =
        document.getElementById(
            "paginacionVehiculos"
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
                onclick="cambiarPaginaVehiculos(
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
                    onclick="cambiarPaginaVehiculos(
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
                onclick="cambiarPaginaVehiculos(
                    ${paginaActual + 1}
                )"
            >
                Siguiente
                <i class="bi bi-chevron-right"></i>
            </button>
        </li>
    `;
}

function limpiarPaginacionVehiculos() {
    const paginacion =
        document.getElementById(
            "paginacionVehiculos"
        );

    if (paginacion) {
        paginacion.innerHTML = "";
    }
}

function cambiarPaginaVehiculos(page) {
    if (page < 0) {
        return;
    }

    paginaActual = page;

    listarVehiculos(
        obtenerEstadoSeleccionado(),
        obtenerTextoBusqueda(),
        paginaActual,
        tamanioPagina
    );
}

/* =========================================================
   MODAL
========================================================= */

function limpiarFormularioVehiculo() {
    const formulario =
        document.getElementById(
            "formVehiculo"
        );

    if (formulario) {
        formulario.reset();
    }

    asignarValor(
        "vehiculoId",
        ""
    );
}

function cerrarModalVehiculo() {
    const modalElemento =
        document.getElementById(
            "modalVehiculo"
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
